export class HandposeAdapter {
  constructor({ debug = false, maxHands = 2, detectIntervalMs = 0, videoWidth = 640, videoHeight = 480 } = {}) {
    this.debug = debug;
    this.maxHands = maxHands;
    this.detectIntervalMs = Math.max(0, detectIntervalMs);
    this.videoWidth = videoWidth;
    this.videoHeight = videoHeight;
    this.video = null;
    this.model = null;
    this.predictions = [];
    this.status = "idle";
    this.error = null;
    this.listeners = new Set();
    this.lastDetectAt = 0;
  }

  async init() {
    try {
      this.status = "requesting-camera";
      this.video = await this.createVideoElement();
      this.status = "loading-model";
      this.model = await this.createModel();
      this.startDetectionLoop();
      this.status = "ready";
      return this;
    } catch (error) {
      this.status = "error";
      this.error = error;
      throw error;
    }
  }

  async createVideoElement() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Este navegador no soporta acceso a camara");
    }

    const video = document.createElement("video");
    video.setAttribute("playsinline", "true");
    video.setAttribute("autoplay", "true");
    video.muted = true;
    video.className = "handpose-video";

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: this.videoWidth, height: this.videoHeight, facingMode: "user" },
      audio: false,
    });

    video.srcObject = stream;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play().catch(() => {});
        resolve();
      };
    });

    return video;
  }

  async createModel() {
    if (!window.ml5) {
      throw new Error("ml5.js no esta disponible");
    }

    if (typeof window.ml5.handPose === "function") {
      const optionSets = [
        {
          maxHands: this.maxHands,
          flipped: true,
          runtime: "mediapipe",
        },
        {
          maxHands: this.maxHands,
          flipHorizontal: true,
          runtime: "mediapipe",
        },
        {
          maxHands: this.maxHands,
          flipped: true,
          runtime: "tfjs",
        },
        {
          maxHands: this.maxHands,
          flipHorizontal: true,
          runtime: "tfjs",
        },
      ];

      const errors = [];

      for (const options of optionSets) {
        try {
          return await this.withTimeout(
            this.resolveHandPoseModel(options),
            12000,
            `HandPose tardo demasiado en cargar (${options.runtime})`
          );
        } catch (error) {
          errors.push(`${options.runtime}: ${error.message}`);
        }
      }

      throw new Error(`No fue posible inicializar HandPose. Intentos: ${errors.join(" | ")}`);
    }

    if (typeof window.ml5.handpose === "function") {
      return this.withTimeout(new Promise((resolve, reject) => {
        try {
          const model = window.ml5.handpose(this.video, { flipHorizontal: true }, () => resolve(model));
        } catch (error) {
          reject(error);
        }
      }), 12000, "handpose tardo demasiado en cargar");
    }

    throw new Error("La version actual de ml5 no expone HandPose/handpose");
  }

  startDetectionLoop() {
    if (!this.model) {
      throw new Error("HandPose no termino de cargar correctamente");
    }

    if (typeof this.model.detectStart === "function") {
      this.model.detectStart(this.video, (results) => {
        if (!this.canAcceptDetection()) {
          return;
        }

        this.predictions = Array.isArray(results) ? results : [];
        this.emit();
      });
      return;
    }

    if (typeof this.model.on === "function") {
      this.model.on("predict", (results) => {
        if (!this.canAcceptDetection()) {
          return;
        }

        this.predictions = Array.isArray(results) ? results : [];
        this.emit();
      });
      return;
    }

    if (typeof this.model.detect === "function") {
      const detectFrame = async () => {
        if (this.status === "disposed") {
          return;
        }

        if (document.hidden) {
          window.setTimeout(() => requestAnimationFrame(detectFrame), Math.max(120, this.detectIntervalMs));
          return;
        }

        if (!this.canAcceptDetection()) {
          requestAnimationFrame(detectFrame);
          return;
        }

        try {
          const results = await this.model.detect(this.video);
          this.predictions = Array.isArray(results) ? results : [];
          this.emit();
        } catch (error) {
          this.error = error;
        }

        requestAnimationFrame(detectFrame);
      };

      detectFrame();
    }
  }

  canAcceptDetection(now = performance.now()) {
    if (this.detectIntervalMs > 0 && now - this.lastDetectAt < this.detectIntervalMs) {
      return false;
    }

    this.lastDetectAt = now;
    return true;
  }

  async resolveHandPoseModel(options) {
    const attempts = [
      () => window.ml5.handPose(options),
      () => window.ml5.handPose("MediaPipeHands", options),
    ];

    let lastError = null;

    for (const attempt of attempts) {
      try {
        const result = attempt();
        const model = await Promise.resolve(result);
        if (model?.ready && typeof model.ready.then === "function") {
          await model.ready;
        }
        if (model) {
          return model;
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("No fue posible inicializar HandPose");
  }

  withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  }

  onPrediction(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    this.listeners.forEach((listener) => listener(this.predictions));
  }

  getPrimaryPrediction() {
    return this.predictions[0] ?? null;
  }

  getPredictions() {
    return [...this.predictions];
  }

  getPredictionsRef() {
    return this.predictions;
  }

  getDetectionState() {
    return {
      status: this.status,
      error: this.error,
      hasHand: this.predictions.length > 0,
      prediction: this.getPrimaryPrediction(),
    };
  }

  dispose() {
    this.status = "disposed";
    this.model?.detectStop?.();
    const tracks = this.video?.srcObject?.getTracks?.() ?? [];
    tracks.forEach((track) => track.stop());
    this.video?.remove();
    this.listeners.clear();
  }
}
