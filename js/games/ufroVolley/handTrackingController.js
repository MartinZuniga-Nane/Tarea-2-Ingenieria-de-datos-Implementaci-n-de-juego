import { HandposeAdapter } from "../../shared/input/handposeAdapter.js";
import { GestureInterpreter } from "../../shared/input/gestureInterpreter.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class HandTrackingController {
  constructor({ config, webcamRoot, labelRoot, statusNode, startButton, getSceneKey, onAction }) {
    this.config = config;
    this.webcamRoot = webcamRoot;
    this.labelRoot = labelRoot;
    this.statusNode = statusNode;
    this.startButton = startButton;
    this.getSceneKey = getSceneKey;
    this.onAction = onAction;
    this.adapter = null;
    this.interpreter = new GestureInterpreter();
    this.unsubscribe = null;
    this.leftActive = false;
    this.rightActive = false;
    this.leftCandidateSince = 0;
    this.rightCandidateSince = 0;
    this.lastLeftTriggerAt = 0;
    this.lastRightTriggerAt = 0;
    this.isStarting = false;
    this.isReady = false;
    this.handleStartClick = this.handleStartClick.bind(this);
    this.handlePredictions = this.handlePredictions.bind(this);
  }

  mount() {
    this.startButton?.addEventListener("click", this.handleStartClick);
    this.buildLabelList();
    this.statusNode.textContent = "Preparando hand tracking...";
    if (this.startButton) {
      this.startButton.disabled = true;
      this.startButton.textContent = "Cargando...";
    }
  }

  async tryAutoStart() {
    try {
      await this.init();
    } catch (error) {
      this.handleInitError(error);
    }
  }

  async handleStartClick() {
    try {
      await this.init();
    } catch (error) {
      this.handleInitError(error);
    }
  }

  async init() {
    if (this.isReady || this.isStarting) {
      return;
    }

    this.isStarting = true;
    if (this.startButton) {
      this.startButton.disabled = true;
      this.startButton.textContent = "Iniciando...";
    }
    this.statusNode.textContent = "Solicitando acceso a camara...";

    this.adapter?.dispose();
    this.adapter = new HandposeAdapter({
      maxHands: 2,
      detectIntervalMs: this.config.detectIntervalMs,
      videoWidth: this.config.videoWidth,
      videoHeight: this.config.videoHeight,
    });

    await this.adapter.init();
    this.webcamRoot.innerHTML = "";
    this.webcamRoot.appendChild(this.adapter.video);
    this.unsubscribe = this.adapter.onPrediction(this.handlePredictions);
    this.isReady = true;
    this.isStarting = false;
    this.statusNode.textContent = "Camara lista: mano izquierda abierta = gatos, mano derecha abierta = perros.";
    if (this.startButton) {
      this.startButton.textContent = "Camara activa";
      this.startButton.disabled = true;
    }
  }

  handlePredictions(predictions) {
    const now = performance.now();
    const sceneKey = this.getSceneKey();
    if (sceneKey !== "match") {
      this.leftActive = false;
      this.rightActive = false;
      this.leftCandidateSince = 0;
      this.rightCandidateSince = 0;
      this.updateLabels(0, 0, null, null);
      this.statusNode.textContent = "Hand tracking en espera hasta el partido.";
      return;
    }

    const interpretations = (Array.isArray(predictions) ? predictions : [])
      .map((prediction) => this.interpreter.interpret(prediction))
      .filter((entry) => entry?.landmarks);

    let leftHand = null;
    let rightHand = null;
    for (let index = 0; index < interpretations.length; index += 1) {
      const entry = interpretations[index];
      if (!leftHand && entry.handedness === "Left") {
        leftHand = entry;
      } else if (!rightHand && entry.handedness === "Right") {
        rightHand = entry;
      }
      if (leftHand && rightHand) {
        break;
      }
    }
    const leftOpen = leftHand?.label === "OPEN_PALM" ? leftHand.confidence : 0;
    const rightOpen = rightHand?.label === "OPEN_PALM" ? rightHand.confidence : 0;
    this.updateLabels(leftOpen, rightOpen, leftHand, rightHand);

    let top = null;
    for (let index = 0; index < interpretations.length; index += 1) {
      const entry = interpretations[index];
      if (!top || (entry.confidence ?? 0) > (top.confidence ?? 0)) {
        top = entry;
      }
    }
    if (top) {
      this.statusNode.textContent = `Detectando ${top.handedness ?? "mano"} ${top.label} (${Number(top.confidence ?? 0).toFixed(2)})`;
    } else {
      this.statusNode.textContent = "Sin manos detectadas.";
    }

    if (leftOpen >= this.config.scoreThreshold) {
      this.leftCandidateSince = this.leftCandidateSince || now;
      if (
        !this.leftActive
        && now - this.leftCandidateSince >= this.config.persistenceMs
        && now - this.lastLeftTriggerAt >= this.config.triggerCooldownMs
      ) {
        this.leftActive = true;
        this.lastLeftTriggerAt = now;
        this.onAction("JUMP_LEFT_TEAM", "camera");
      }
    } else if (leftOpen <= this.config.releaseThreshold) {
      this.leftActive = false;
      this.leftCandidateSince = 0;
    }

    if (rightOpen >= this.config.scoreThreshold) {
      this.rightCandidateSince = this.rightCandidateSince || now;
      if (
        !this.rightActive
        && now - this.rightCandidateSince >= this.config.persistenceMs
        && now - this.lastRightTriggerAt >= this.config.triggerCooldownMs
      ) {
        this.rightActive = true;
        this.lastRightTriggerAt = now;
        this.onAction("JUMP_RIGHT_TEAM", "camera");
      }
    } else if (rightOpen <= this.config.releaseThreshold) {
      this.rightActive = false;
      this.rightCandidateSince = 0;
    }
  }

  updateLabels(leftOpen, rightOpen, leftHand, rightHand) {
    const rows = [...this.labelRoot.childNodes];
    const leftCount = leftHand?.details?.openCount ?? 0;
    const rightCount = rightHand?.details?.openCount ?? 0;
    const values = [
      `Izquierda abierta: ${clamp(leftOpen, 0, 1).toFixed(2)} (${leftCount}/5)`,
      `Derecha abierta: ${clamp(rightOpen, 0, 1).toFixed(2)} (${rightCount}/5)`,
      `Escena activa: ${this.getSceneKey() ?? "-"}`,
    ];
    rows.forEach((row, index) => {
      row.textContent = values[index] ?? "-";
    });
  }

  buildLabelList() {
    this.labelRoot.innerHTML = "";
    for (let index = 0; index < 3; index += 1) {
      const item = document.createElement("div");
      item.className = "game-shell__tm-label";
      this.labelRoot.appendChild(item);
    }
  }

  handleInitError(error) {
    this.isStarting = false;
    this.isReady = false;
    const message = String(error?.message ?? error ?? "").toLowerCase();
    if (message.includes("permiso") || message.includes("permission") || error?.name === "NotAllowedError") {
      this.statusNode.textContent = "Permiso de camara denegado. Habilitalo y reintenta.";
    } else if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
      this.statusNode.textContent = "No se encontro una camara disponible.";
    } else {
      this.statusNode.textContent = "No se pudo iniciar hand tracking.";
    }

    if (this.startButton) {
      this.startButton.textContent = "Reintentar camara";
      this.startButton.disabled = false;
    }
    console.error("Error iniciando hand tracking en UfroVolley:", error);
  }

  destroy() {
    this.startButton?.removeEventListener("click", this.handleStartClick);
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.adapter?.dispose();
    this.adapter = null;
    this.webcamRoot.innerHTML = "";
    this.labelRoot.innerHTML = "";
  }
}
