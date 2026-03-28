import { CooldownMap } from "./cooldowns.js";
import { GestureInterpreter } from "./gestureInterpreter.js";

const DEFAULT_ACTION_MAP = {
  OPEN_PALM: "CONFIRM",
  LEFT_INDEX: "NAV_LEFT",
  RIGHT_INDEX: "NAV_RIGHT",
  TWO_FINGERS: "NAV_DOWN",
  THREE_FINGERS: "NAV_UP",
};

export class GestureController {
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.interpreter = new GestureInterpreter();
    this.actionMap = { ...DEFAULT_ACTION_MAP, ...(options.actionMap ?? {}) };
    this.persistenceMs = options.persistenceMs ?? 280;
    this.cooldowns = new CooldownMap({
      navigation: options.navigationCooldownMs ?? 220,
      confirm: options.confirmCooldownMs ?? 650,
      shoot: options.shootCooldownMs ?? 650,
    });
    this.stableLabel = "NONE";
    this.candidateLabel = "NONE";
    this.candidateSince = 0;
    this.lastAction = null;
    this.lastInterpretation = { label: "NONE", confidence: 0, landmarks: null };
  }

  setActionMap(actionMap) {
    this.actionMap = { ...DEFAULT_ACTION_MAP, ...(actionMap ?? {}) };
  }

  update(now = performance.now()) {
    const prediction = this.adapter.getPrimaryPrediction();
    const interpretation = this.interpreter.interpret(prediction);
    this.lastInterpretation = interpretation;

    if (interpretation.label !== this.candidateLabel) {
      this.candidateLabel = interpretation.label;
      this.candidateSince = now;
    }

    const actions = [];

    if (
      interpretation.label !== "NONE" &&
      interpretation.label === this.candidateLabel &&
      now - this.candidateSince >= this.persistenceMs &&
      this.stableLabel !== interpretation.label
    ) {
      this.stableLabel = interpretation.label;
      const action = this.mapGestureToAction(interpretation.label);

      if (action) {
        const group = this.resolveCooldownGroup(action);
        if (this.cooldowns.canTrigger(group, now)) {
          this.cooldowns.trigger(group, now);
          this.lastAction = action;
          actions.push({ source: "gesture", action, at: now });
        }
      }
    }

    if (interpretation.label === "NONE") {
      this.stableLabel = "NONE";
    }

    return actions;
  }

  mapGestureToAction(label) {
    return this.actionMap[label] ?? null;
  }

  resolveCooldownGroup(action) {
    if (action === "CONFIRM") {
      return "confirm";
    }

    if (action === "SHOOT") {
      return "shoot";
    }

    return "navigation";
  }

  getDebugSnapshot() {
    return {
      gesture: this.lastInterpretation.label,
      confidence: this.lastInterpretation.confidence,
      action: this.lastAction ?? "-",
      landmarks: this.lastInterpretation.landmarks,
      cameraStatus: this.adapter.status,
    };
  }
}
