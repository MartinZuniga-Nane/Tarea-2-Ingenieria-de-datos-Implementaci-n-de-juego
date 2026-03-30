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
    this.navigationCooldownMs = options.navigationCooldownMs ?? 220;
    this.confirmCooldownMs = options.confirmCooldownMs ?? 650;
    this.shootCooldownMs = options.shootCooldownMs ?? 650;
    this.cooldowns = new CooldownMap({
      navigation: this.navigationCooldownMs,
      confirm: this.confirmCooldownMs,
      shoot: this.shootCooldownMs,
      "shoot-left": this.shootCooldownMs,
      "shoot-right": this.shootCooldownMs,
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

  setTimings({ persistenceMs, navigationCooldownMs, confirmCooldownMs, shootCooldownMs } = {}) {
    if (typeof persistenceMs === "number") {
      this.persistenceMs = persistenceMs;
    }

    const nextNavigation = navigationCooldownMs ?? this.navigationCooldownMs;
    const nextConfirm = confirmCooldownMs ?? this.confirmCooldownMs;
    const nextShoot = shootCooldownMs ?? this.shootCooldownMs;

    this.navigationCooldownMs = nextNavigation;
    this.confirmCooldownMs = nextConfirm;
    this.shootCooldownMs = nextShoot;
    this.cooldowns = new CooldownMap({
      navigation: nextNavigation,
      confirm: nextConfirm,
      shoot: nextShoot,
      "shoot-left": nextShoot,
      "shoot-right": nextShoot,
    });
  }

  update(now = performance.now()) {
    const actions = [];

    const predictions = this.adapter.getPredictionsRef?.() ?? this.adapter.getPredictions?.() ?? [this.adapter.getPrimaryPrediction()].filter(Boolean);
    const interpretations = predictions.map((prediction) => this.interpreter.interpret(prediction));
    const primary = interpretations[0] ?? { label: "NONE", confidence: 0, landmarks: null, handedness: null };
    this.lastInterpretation = primary;

    const battleGesture = interpretations.find((entry) => this.mapGestureToAction(this.getGestureKey(entry)));
    const interpretation = battleGesture ?? primary;
    const gestureKey = this.getGestureKey(interpretation);

    if (gestureKey !== this.candidateLabel) {
      this.candidateLabel = gestureKey;
      this.candidateSince = now;
    }

    if (
      gestureKey !== "NONE" &&
      gestureKey === this.candidateLabel &&
      now - this.candidateSince >= this.persistenceMs &&
      this.stableLabel !== gestureKey
    ) {
      this.stableLabel = gestureKey;
      const action = this.mapGestureToAction(gestureKey) ?? this.mapGestureToAction(interpretation.label);

      if (action) {
        const group = this.resolveCooldownGroup(action);
        if (this.cooldowns.canTrigger(group, now)) {
          this.cooldowns.trigger(group, now);
          this.lastAction = action;
          actions.push({ source: "gesture", action, at: now, handedness: interpretation.handedness ?? null });
        }
      }
    }

    if (gestureKey === "NONE") {
      this.stableLabel = "NONE";
    }

    return actions;
  }

  getGestureKey(interpretation) {
    if (!interpretation || interpretation.label === "NONE") {
      return "NONE";
    }

    if (interpretation.label === "OPEN_PALM" && interpretation.handedness) {
      return `OPEN_PALM_${interpretation.handedness.toUpperCase()}`;
    }

    return interpretation.label;
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

    if (action === "SHOOT_LEFT") {
      return "shoot-left";
    }

    if (action === "SHOOT_RIGHT") {
      return "shoot-right";
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
