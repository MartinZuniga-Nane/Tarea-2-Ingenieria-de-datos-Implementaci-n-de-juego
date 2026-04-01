function normalizeLabel(rawLabel) {
  return String(rawLabel ?? "").trim().toLowerCase();
}

function normalizeClassificationResults(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  if (typeof payload === "object") {
    const label = payload.label ?? payload.className ?? payload.class;
    const confidence = payload.confidence ?? payload.probability ?? payload.score;
    if (typeof label === "string") {
      return [{ label, confidence: Number.isFinite(confidence) ? confidence : 0 }];
    }
  }

  return [];
}

export class BasketInputController {
  constructor({ config, webcamRoot, labelRoot, statusNode, startButton, getSceneKey, onAction }) {
    this.config = config;
    this.webcamRoot = webcamRoot;
    this.labelRoot = labelRoot;
    this.statusNode = statusNode;
    this.startButton = startButton;
    this.getSceneKey = getSceneKey;
    this.onAction = onAction;
    this.video = null;
    this.classifier = null;
    this.cameraStream = null;
    this.classifyTimeoutId = null;
    this.modelLabels = [];
    this.flipCanvas = null;
    this.flipContext = null;
    this.fistActive = false;
    this.fistSeenFrames = 0;
    this.openSeenFrames = 0;
    this.lastReleaseAt = 0;
    this.isStarting = false;
    this.isReady = false;
    this.handleStartClick = this.handleStartClick.bind(this);
  }

  mount() {
    this.startButton?.addEventListener("click", this.handleStartClick);
    this.statusNode.textContent = "Preparando modelo de UfroBasket...";
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
    this.statusNode.textContent = "Solicitando acceso a camara...";
    if (this.startButton) {
      this.startButton.disabled = true;
      this.startButton.textContent = "Iniciando...";
    }

    await this.loadMetadata();
    this.video = await this.createVideoElement();
    this.webcamRoot.innerHTML = "";
    this.webcamRoot.appendChild(this.video);
    this.classifier = await this.createClassifier();
    this.buildLabelList();
    this.isReady = true;
    this.isStarting = false;
    this.statusNode.textContent = "Camara lista: puño cerrado carga, mano abierta lanza.";
    if (this.startButton) {
      this.startButton.textContent = "Camara activa";
      this.startButton.disabled = true;
    }
    this.scheduleClassification(0);
  }

  async loadMetadata() {
    try {
      const response = await fetch(this.config.model.metadataPath, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`No se pudo leer metadata (${response.status})`);
      }
      const metadata = await response.json();
      this.modelLabels = Array.isArray(metadata?.labels) ? metadata.labels : [];
    } catch (error) {
      this.modelLabels = [];
      console.warn("UfroBasket no pudo leer metadata:", error?.message ?? error);
    }
  }

  async createVideoElement() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Este navegador no soporta camara");
    }

    const video = document.createElement("video");
    video.className = "handpose-video";
    video.setAttribute("playsinline", "true");
    video.setAttribute("autoplay", "true");
    video.muted = true;
    this.cameraStream?.getTracks?.().forEach((track) => track.stop());
    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    video.srcObject = this.cameraStream;
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play().catch(() => {});
        resolve();
      };
    });
    return video;
  }

  async createClassifier() {
    if (!window.ml5?.imageClassifier) {
      throw new Error("ml5.imageClassifier no esta disponible");
    }

    const modelPath = new URL(this.config.model.path, window.location.href).href;
    const classifier = await new Promise((resolve, reject) => {
      let settled = false;
      let instance = null;
      const timeoutId = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("El clasificador tardo demasiado en cargar"));
        }
      }, 12000);

      const finish = (value) => {
        if (settled || !value) {
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(value);
      };

      const fail = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);
        reject(error);
      };

      try {
        instance = window.ml5.imageClassifier(modelPath, () => finish(instance));
        if (instance && typeof instance.then === "function") {
          instance.then((resolved) => finish(resolved)).catch(fail);
        }
      } catch (error) {
        fail(error);
      }
    });

    if (typeof classifier.classify !== "function") {
      throw new Error("El clasificador no expone classify");
    }

    return classifier;
  }

  buildLabelList() {
    const labels = this.modelLabels.length > 0 ? this.modelLabels : ["Puño Cerrado", "Mano Abierta", "Fondo"];
    this.labelRoot.innerHTML = "";
    labels.forEach(() => {
      const item = document.createElement("div");
      item.className = "game-shell__tm-label";
      this.labelRoot.appendChild(item);
    });
  }

  scheduleClassification(delayMs = this.config.model.classifyIntervalMs) {
    if (!this.classifier || !this.video) {
      return;
    }

    if (this.classifyTimeoutId) {
      window.clearTimeout(this.classifyTimeoutId);
    }
    this.classifyTimeoutId = window.setTimeout(() => this.classifyFrame(), delayMs);
  }

  classifyFrame() {
    if (!this.classifier || !this.video) {
      return;
    }

    const mirroredSource = this.buildMirroredFrameSource();
    const directSource = this.video;
    if (!mirroredSource || !directSource) {
      this.scheduleClassification(120);
      return;
    }

    const handleResults = (error, results) => {
      if (error) {
        console.warn("UfroBasket classifier error:", error?.message ?? error);
        this.scheduleClassification(240);
        return;
      }

      this.processResults(results);
      this.scheduleClassification();
    };

    Promise.all([
      this.classifySource(mirroredSource),
      this.classifySource(directSource),
    ])
      .then(([mirroredResults, directResults]) => {
        handleResults(null, this.mergeResults(mirroredResults, directResults));
      })
      .catch((error) => {
      handleResults(error, []);
      });
  }

  classifySource(source) {
    return new Promise((resolve, reject) => {
      try {
        if (this.classifier.classify.length >= 2) {
          this.classifier.classify(source, (arg1, arg2) => {
            const resultsCandidate = (arg1 instanceof Error) ? arg2 : arg1;
            const fallbackCandidate = (arg2 instanceof Error) ? arg1 : arg2;
            const normalizedPrimary = normalizeClassificationResults(resultsCandidate);
            const normalizedFallback = normalizeClassificationResults(fallbackCandidate);
            const results = normalizedPrimary.length > 0 ? normalizedPrimary : normalizedFallback;
            const error = (arg1 instanceof Error) ? arg1 : ((arg2 instanceof Error) ? arg2 : null);
            if (error) {
              reject(error);
              return;
            }
            resolve(results);
          });
          return;
        }

        Promise.resolve(this.classifier.classify(source))
          .then((results) => resolve(normalizeClassificationResults(results)))
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  mergeResults(primaryResults, secondaryResults) {
    const merged = new Map();
    [...primaryResults, ...secondaryResults].forEach((result) => {
      const label = String(result.label ?? "");
      const confidence = Number(result.confidence ?? result.probability ?? 0);
      const existing = merged.get(label);
      if (!existing || confidence > existing.confidence) {
        merged.set(label, { label, confidence });
      }
    });
    return [...merged.values()].sort((a, b) => b.confidence - a.confidence);
  }

  buildMirroredFrameSource() {
    const videoElement = this.video;
    const isVideo = typeof HTMLVideoElement !== "undefined" && videoElement instanceof HTMLVideoElement;
    if (!isVideo) {
      return null;
    }

    if (!Number.isFinite(videoElement.videoWidth) || !Number.isFinite(videoElement.videoHeight) || videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) {
      return null;
    }
    if (!this.flipCanvas) {
      this.flipCanvas = document.createElement("canvas");
      this.flipContext = this.flipCanvas.getContext("2d", { willReadFrequently: false });
    }

    if (this.flipCanvas.width !== videoElement.videoWidth || this.flipCanvas.height !== videoElement.videoHeight) {
      this.flipCanvas.width = videoElement.videoWidth;
      this.flipCanvas.height = videoElement.videoHeight;
    }

    if (!this.flipContext) {
      return null;
    }

    this.flipContext.save();
    this.flipContext.clearRect(0, 0, this.flipCanvas.width, this.flipCanvas.height);
    this.flipContext.translate(this.flipCanvas.width, 0);
    this.flipContext.scale(-1, 1);
    this.flipContext.drawImage(videoElement, 0, 0, this.flipCanvas.width, this.flipCanvas.height);
    this.flipContext.restore();
    return this.flipCanvas;
  }

  processResults(results) {
    const sceneKey = this.getSceneKey();
    const rows = [...this.labelRoot.childNodes];
    rows.forEach((row, index) => {
      const result = results[index];
      row.textContent = result ? `${result.label}: ${Number(result.confidence ?? result.probability ?? 0).toFixed(2)}` : "-";
    });

    let fistProbability = 0;
    let openProbability = 0;
    let top = null;
    let topKnown = null;
    let topKnownType = null;
    results.forEach((result) => {
      const label = normalizeLabel(result.label);
      const confidence = Number(result.confidence ?? result.probability ?? 0);
      if (!top || confidence > top.confidence) {
        top = { label: result.label, confidence };
      }
      if (this.config.input.fistLabels.includes(label)) {
        fistProbability = confidence;
        if (!topKnown || confidence > topKnown.confidence) {
          topKnown = { label: result.label, confidence };
          topKnownType = "fist";
        }
      }
      if (this.config.input.openLabels.includes(label)) {
        openProbability = confidence;
        if (!topKnown || confidence > topKnown.confidence) {
          topKnown = { label: result.label, confidence };
          topKnownType = "open";
        }
      }
    });

    if (topKnown) {
      this.statusNode.textContent = `Detectando ${topKnown.label} (${topKnown.confidence.toFixed(2)})`;
    } else if (top) {
      this.statusNode.textContent = `Detectando ${top.label} (${top.confidence.toFixed(2)})`;
    } else {
      this.statusNode.textContent = "Sin gesto detectado.";
    }

    if (sceneKey !== "free-play") {
      return;
    }

    const usefulSum = fistProbability + openProbability;
    const fistRelative = usefulSum > 0 ? fistProbability / usefulSum : 0;
    const openRelative = usefulSum > 0 ? openProbability / usefulSum : 0;
    const fistDetected = (
      fistProbability >= this.config.input.holdThreshold
      || (topKnownType === "fist" && fistProbability >= this.config.input.neutralThreshold)
      || (topKnownType === "fist" && fistProbability >= 0.14 && fistRelative >= 0.6)
    );
    const openDetected = (
      openProbability >= this.config.input.releaseThreshold
      || (topKnownType === "open" && openProbability >= this.config.input.neutralThreshold)
      || (topKnownType === "open" && openProbability >= 0.18 && openRelative >= 0.6)
    );

    this.fistSeenFrames = fistDetected ? this.fistSeenFrames + 1 : 0;
    this.openSeenFrames = openDetected ? this.openSeenFrames + 1 : 0;

    if (this.fistSeenFrames >= this.config.input.fistPersistenceFrames && !this.fistActive) {
      this.fistActive = true;
      this.onAction("START_CHARGE", "camera");
    }

    if (
      this.fistActive
      && (this.openSeenFrames >= this.config.input.openPersistenceFrames || (topKnownType === "open" && openProbability >= this.config.input.neutralThreshold))
      && performance.now() - this.lastReleaseAt >= this.config.input.releaseCooldownMs
    ) {
      this.fistActive = false;
      this.fistSeenFrames = 0;
      this.openSeenFrames = 0;
      this.lastReleaseAt = performance.now();
      this.onAction("RELEASE_SHOT", "camera");
      return;
    }

    if (topKnownType === "open" && this.fistActive) {
      this.fistSeenFrames = 0;
    }

    if (!fistDetected && !openDetected && fistProbability <= this.config.input.neutralThreshold && openProbability <= this.config.input.neutralThreshold) {
      this.fistActive = false;
      this.fistSeenFrames = 0;
      this.openSeenFrames = 0;
    }
  }

  handleInitError(error) {
    this.isStarting = false;
    this.isReady = false;
    if (this.startButton) {
      this.startButton.textContent = "Reintentar camara";
      this.startButton.disabled = false;
    }
    this.statusNode.textContent = "Camara no disponible. Puedes jugar con espacio.";
    console.error("Error iniciando UfroBasket camera/model:", error);
  }

  destroy() {
    this.startButton?.removeEventListener("click", this.handleStartClick);
    if (this.classifyTimeoutId) {
      window.clearTimeout(this.classifyTimeoutId);
    }
    this.cameraStream?.getTracks?.().forEach((track) => track.stop());
    this.video?.remove();
    this.flipCanvas = null;
    this.flipContext = null;
    this.webcamRoot.innerHTML = "";
    this.labelRoot.innerHTML = "";
  }
}
