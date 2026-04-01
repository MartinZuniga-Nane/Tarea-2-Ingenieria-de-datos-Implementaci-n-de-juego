import { Modal } from "../../shared/ui/modal.js";
import { createGameSidebar } from "../../shared/ui/gameSidebar.js";
import { Platform } from "./platform.js";
import { Player } from "./player.js";

const UFRO_JUMP_CONFIG = {
  canvas: {
    width: 640,
    height: 960,
  },
  physics: {
    gravity: 2200,
    jumpVelocity: -1320,
    maxFallSpeed: 1500,
    horizontalDamping: 0.84,
    maxHorizontalSpeed: 520,
  },
  platform: {
    width: 118,
    height: 20,
    minGap: 86,
    maxGap: 132,
    sidePadding: 24,
    spawnAheadPx: 1200,
    despawnBelowPx: 220,
  },
  camera: {
    followLine: 0.36,
  },
  controls: {
    leftImpulse: 264,
    rightImpulse: 264,
    neutralBrake: 0.78,
  },
  model: {
    basePath: "./assets/games/ufroJump/modelo/",
    modelFile: "model.json",
    metadataFile: "metadata.json",
    weightsFile: "weights.bin",
    classifyIntervalMs: 100,
    minConfidence: 0.34,
    leftLabels: ["izquierda"],
    rightLabels: ["derecha"],
    neutralLabels: ["reposo", "reposo2", "fondo"],
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function normalizeLabel(rawLabel) {
  if (!rawLabel) {
    return "";
  }

  return String(rawLabel).trim().toLowerCase();
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
      return [{
        label,
        confidence: Number.isFinite(confidence) ? confidence : 0,
      }];
    }
  }

  return [];
}

function resolveDrawableVideoSource(videoLike) {
  if (!videoLike) {
    return null;
  }

  return videoLike.elt || videoLike;
}

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

export class UfroJumpScene {
  constructor({ root, router }) {
    this.root = root;
    this.router = router;
    this.config = UFRO_JUMP_CONFIG;

    this.state = "boot";
    this.statusText = "Inicializando Ufro Jump...";
    this.currentLabel = "-";
    this.confidence = 0;
    this.availableLabels = [];
    this.highestReachedY = 0;
    this.controlAction = "none";
    this.score = 0;
    this.bestScore = 0;

    this.video = null;
    this.cameraStream = null;
    this.classifier = null;
    this.classifyTimeoutId = null;
    this.sketch = null;
    this.destroyed = false;
    this.mlAvailable = false;
    this.modelError = "";
    this.modelLabelSet = null;
    this.flipCanvas = null;
    this.flipContext = null;
    this.assets = {
      playerFrames: [],
      platformSprite: null,
      backgroundSprite: null,
      playerFramesPromise: null,
    };

    this.modal = null;
    this.gameSidebar = null;

    this.cameraY = 0;
    this.nextPlatformY = 0;
    this.platforms = [];
    this.player = new Player({
      x: this.config.canvas.width / 2,
      y: this.config.canvas.height - 130,
      size: 58,
    });

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  mount() {
    this.root.innerHTML = `
      <main class="game-shell app-shell ufro-jump-shell">
        <div class="game-shell__canvas"></div>
        <div class="game-shell__hud">
          <div class="game-shell__topbar">
            <div class="pill" data-role="status">Inicializando Ufro Jump...</div>
            <div class="pill">Modelo TM: Izquierda, Derecha, Reposo, Reposo2, Fondo | Esc = launcher</div>
          </div>
          <aside class="game-shell__debug" data-role="debug-panel">
            <h3>Ufro Jump</h3>
            <dl>
              <dt>Estado</dt><dd data-role="state">-</dd>
              <dt>Puntaje</dt><dd data-role="score">0</dd>
              <dt>Record</dt><dd data-role="best-score">0</dd>
              <dt>Etiqueta</dt><dd data-role="label">-</dd>
              <dt>Confianza</dt><dd data-role="confidence">0%</dd>
              <dt>Control</dt><dd data-role="control">-</dd>
              <dt>Labels</dt><dd data-role="labels">-</dd>
            </dl>
          </aside>
          <aside class="game-shell__camera hidden" data-role="camera-panel"></aside>
        </div>
      </main>
    `;

    this.shell = this.root.querySelector(".ufro-jump-shell");
    this.canvasContainer = this.root.querySelector(".game-shell__canvas");
    this.statusPill = this.root.querySelector('[data-role="status"]');
    this.cameraPanel = this.root.querySelector('[data-role="camera-panel"]');
    this.modal = new Modal(this.shell);

    this.gameSidebar = createGameSidebar({
      onNavigate: (route) => this.router.navigate(route),
      onBack: () => this.router.back(),
    });
    this.shell.appendChild(this.gameSidebar.element);
    window.addEventListener("keydown", this.handleKeyDown);

    this.enter().catch((error) => {
      this.state = "error";
      this.statusText = error.message;
      this.updateHud();
      this.modal.show({
        title: "No se pudo iniciar Ufro Jump",
        message: error.message,
      });
      console.error(error);
    });
  }

  async enter() {
    const p5Promise = window.__p5Ready ?? (window.p5 ? Promise.resolve(window.p5) : Promise.reject(new Error("p5.js no pudo cargarse")));
    const ml5Promise = window.__ml5Ready ?? (window.ml5 ? Promise.resolve(window.ml5) : Promise.reject(new Error("ml5.js no pudo cargarse")));

    await Promise.all([p5Promise, ml5Promise]);

    await this.loadVisualAssets();

    this.sketch = new window.p5(this.createSketch());
    this.state = "loading-model";
    this.statusText = "Cargando archivos del modelo...";
    this.updateHud();

    try {
      await this.initializeMachineLearning();
      this.mlAvailable = true;
    } catch (error) {
      this.mlAvailable = false;
      this.modelError = error?.message ?? "No se pudo cargar el modelo";
      this.modal.show({
        title: "Modelo de Ufro Jump no disponible",
        message: `Se mantiene el juego con salto automatico. Detalle: ${this.modelError}`,
        dismissLabel: "Continuar",
        autoHideMs: 3600,
      });
      console.warn("Ufro Jump fallback sin modelo:", this.modelError);
    }

    this.initializeWorld();
    this.state = "playing";
    this.statusText = this.mlAvailable
      ? "Ufro Jump activo: guia lateral con Izquierda y Derecha."
      : "Ufro Jump activo sin ML: revisa permisos/ruta del modelo.";
    this.updateHud();
  }

  async loadVisualAssets() {
    if (this.assets.playerFramesPromise) {
      await this.assets.playerFramesPromise;
      return;
    }

    const framePaths = [
      "./assets/games/ufroJump/character/1.png",
      "./assets/games/ufroJump/character/2.png",
      "./assets/games/ufroJump/character/3.png",
      "./assets/games/ufroJump/character/4.png",
      "./assets/games/ufroJump/character/5.png",
      "./assets/games/ufroJump/character/6.png",
      "./assets/games/ufroJump/character/7.png",
      "./assets/games/ufroJump/character/8.png",
    ];

    this.assets.playerFramesPromise = Promise.all(framePaths.map((path) => this.loadImage(path)))
      .then((frames) => {
        this.assets.playerFrames = frames.filter((frame) => Boolean(frame));
        this.player.setSpriteFrames(this.assets.playerFrames);
      })
      .catch((error) => {
        console.warn("Ufro Jump no pudo cargar sprites del personaje:", error?.message ?? error);
        this.assets.playerFrames = [];
        this.player.setSpriteFrames([]);
      });

    await this.assets.playerFramesPromise;

    this.assets.platformSprite = await this.loadImage("./assets/games/ufroJump/platforms/plataforma.png");
    this.assets.backgroundSprite = await this.loadImage("./assets/games/ufroJump/backgrounds/background.png");
  }

  loadImage(path) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = path;
    });
  }

  createSketch() {
    return (p5) => {
      let lastTime = performance.now();

      p5.setup = () => {
        const canvas = p5.createCanvas(this.config.canvas.width, this.config.canvas.height);
        canvas.parent(this.canvasContainer);
        p5.textAlign(p5.CENTER, p5.CENTER);
        p5.textFont("IBM Plex Sans");
      };

      p5.draw = () => {
        const now = performance.now();
        const deltaMs = now - lastTime;
        lastTime = now;

        this.update(deltaMs);
        this.render(p5);
      };
    };
  }

  update(deltaMs) {
    if (this.state === "playing") {
      const dt = clamp(deltaMs / 1000, 0, 0.033);
      this.player.updateAnimation(deltaMs);
      this.updatePhysics(dt);
      this.updateCamera();
      this.spawnPlatformsAhead();
      this.despawnPlatformsBehind();
      this.updateScore();
      this.checkDefeatCondition();
    }

    this.updateHud();
  }

  render(p5) {
    this.renderWorld(p5);

    p5.fill(0, 0, 0, 120);
    p5.rect(0, p5.height - 146, p5.width, 146);

    p5.fill(240);
    p5.textSize(20);
    p5.text("UFRO JUMP", p5.width / 2, p5.height - 104);
    p5.textSize(17);
    p5.text(`Etiqueta: ${this.currentLabel}`, p5.width / 2, p5.height - 74);
    p5.text(`Control: ${this.controlAction}`, p5.width / 2, p5.height - 61);
    p5.text(`Confianza: ${(this.confidence * 100).toFixed(1)}%`, p5.width / 2, p5.height - 48);

    if (this.state === "game-over") {
      p5.noStroke();
      p5.fill(0, 0, 0, 150);
      p5.rect(0, 0, p5.width, p5.height);
      p5.fill(255);
      p5.textSize(42);
      p5.text("Game Over", p5.width / 2, p5.height * 0.42);
      p5.textSize(22);
      p5.text(`Puntaje ${this.score} | Record ${this.bestScore}`, p5.width / 2, p5.height * 0.48);
      p5.text("Presiona Enter para reintentar", p5.width / 2, p5.height * 0.54);
    }
  }

  initializeWorld() {
    const { width, height } = this.config.canvas;
    this.platforms = [];
    this.cameraY = 0;
    this.nextPlatformY = height - 44;
    this.highestReachedY = this.player.y;
    this.score = 0;
    this.controlAction = "neutral";

    this.player.reset({
      x: width / 2,
      y: height - 130,
      velocityX: 0,
      velocityY: this.config.physics.jumpVelocity,
    });

    this.platforms.push(new Platform({
      x: this.player.x - this.config.platform.width / 2,
      y: this.player.y + this.player.height / 2 + 12,
      width: this.config.platform.width,
      height: this.config.platform.height,
      sprite: this.assets.platformSprite,
    }));

    this.nextPlatformY = this.player.y + 30;
    this.spawnPlatformsAhead();
  }

  updateScore() {
    const altitude = Math.max(0, (this.config.canvas.height - this.highestReachedY) * 0.12);
    this.score = Math.max(this.score, Math.floor(altitude));
    this.bestScore = Math.max(this.bestScore, this.score);
  }

  checkDefeatCondition() {
    const playerScreenY = this.player.y - this.cameraY;
    if (playerScreenY <= this.config.canvas.height + 120) {
      return;
    }

    this.state = "game-over";
    this.statusText = `Ufro Jump terminado con ${this.score} puntos. Enter para reiniciar.`;
    this.controlAction = "down";
  }

  updatePhysics(dt) {
    const { width } = this.config.canvas;
    const physics = this.config.physics;
    const previousBottom = this.player.getBottom();

    this.player.updatePhysics(dt, physics);
    this.player.wrapHorizontal(width);

    if (this.player.velocityY > 0) {
      const currentBottom = this.player.getBottom();
      const bounds = this.player.getBounds();

      for (const platform of this.platforms) {
        const platformTop = platform.getTop();
        const crossesTop = previousBottom <= platformTop && currentBottom >= platformTop;
        const overlapsX = platform.overlapsHorizontally(bounds.left, bounds.right, 8);
        if (!crossesTop || !overlapsX) {
          continue;
        }

        this.player.bounceFromPlatform(platformTop, physics.jumpVelocity);
        break;
      }
    }

    this.highestReachedY = Math.min(this.highestReachedY, this.player.y);
  }

  updateCamera() {
    const followScreenY = this.config.canvas.height * this.config.camera.followLine;
    const playerScreenY = this.player.y - this.cameraY;
    if (playerScreenY < followScreenY) {
      this.cameraY = this.player.y - followScreenY;
    }
  }

  spawnPlatformsAhead() {
    const spawnTargetY = this.cameraY - this.config.platform.spawnAheadPx;
    const minX = this.config.platform.sidePadding;
    const maxX = this.config.canvas.width - this.config.platform.width - this.config.platform.sidePadding;

    while (this.nextPlatformY > spawnTargetY) {
      this.nextPlatformY -= randomRange(this.config.platform.minGap, this.config.platform.maxGap);
      this.platforms.push(Platform.createRandom({
        minX,
        maxX,
        y: this.nextPlatformY,
        width: this.config.platform.width,
        height: this.config.platform.height,
        sprite: this.assets.platformSprite,
      }));
    }
  }

  despawnPlatformsBehind() {
    const cutoffY = this.cameraY + this.config.canvas.height + this.config.platform.despawnBelowPx;
    this.platforms = this.platforms.filter((platform) => platform.y < cutoffY);
  }

  renderWorld(p5) {
    const width = this.config.canvas.width;
    const height = this.config.canvas.height;

    const backgroundSprite = this.assets.backgroundSprite;
    const hasDrawableBackground = typeof HTMLImageElement !== "undefined"
      && backgroundSprite instanceof HTMLImageElement
      && backgroundSprite.complete
      && backgroundSprite.naturalWidth > 0
      && backgroundSprite.naturalHeight > 0;

    if (hasDrawableBackground) {
      p5.drawingContext.imageSmoothingEnabled = true;
      p5.drawingContext.drawImage(backgroundSprite, 0, 0, width, height);
    } else {
      p5.background(14, 18, 34);
      p5.noStroke();
      for (let i = 0; i < 7; i += 1) {
        const y = ((i * 170) - (this.cameraY * 0.25)) % (height + 220);
        p5.fill(20, 32, 54, 92);
        p5.circle((i * 97 + 120) % width, y - 90, 120);
        p5.circle((i * 157 + 200) % width, y + 30, 70);
      }
    }

    for (const platform of this.platforms) {
      if (!platform.isVisible(this.cameraY, height)) {
        continue;
      }
      platform.draw(p5, this.cameraY);
    }

    this.player.draw(p5, this.cameraY);
  }

  async initializeMachineLearning() {
    await this.preloadModelFiles();

    this.video = await this.createVideoElement();
    this.cameraPanel.classList.remove("hidden");
    this.cameraPanel.innerHTML = "";
    this.cameraPanel.appendChild(this.video);

    this.classifier = await this.createClassifier();
    this.scheduleClassification(0);
  }

  getModelUrl(fileName) {
    const { basePath } = this.config.model;
    return new URL(`${basePath}${fileName}`, window.location.href).href;
  }

  async preloadModelFiles() {
    const modelUrl = this.getModelUrl(this.config.model.modelFile);
    const metadataUrl = this.getModelUrl(this.config.model.metadataFile);
    const weightsUrl = this.getModelUrl(this.config.model.weightsFile);

    const [modelResponse, metadataResponse, weightsResponse] = await Promise.all([
      fetch(modelUrl, { cache: "no-store" }),
      fetch(metadataUrl, { cache: "no-store" }),
      fetch(weightsUrl, { cache: "no-store" }),
    ]);

    if (!modelResponse.ok) {
      throw new Error(`No se encontro model.json (${modelResponse.status})`);
    }
    if (!metadataResponse.ok) {
      throw new Error(`No se encontro metadata.json (${metadataResponse.status})`);
    }
    if (!weightsResponse.ok) {
      throw new Error(`No se encontro weights.bin (${weightsResponse.status})`);
    }

    const metadata = await metadataResponse.json();
    const labels = Array.isArray(metadata?.labels) ? metadata.labels : [];
    this.availableLabels = labels.map((label) => normalizeLabel(label));
    this.modelLabelSet = new Set(this.availableLabels);
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

    const modelUrl = this.getModelUrl(this.config.model.modelFile);
    const classifier = await new Promise((resolve, reject) => {
      let settled = false;
      let instance = null;

      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error("El clasificador tardo demasiado en cargar"));
      }, 12000);

      const finish = (classifierInstance) => {
        if (settled || !classifierInstance) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);
        resolve(classifierInstance);
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
        instance = window.ml5.imageClassifier(modelUrl, () => finish(instance));
        if (instance && typeof instance.then === "function") {
          instance.then((resolvedClassifier) => finish(resolvedClassifier)).catch(fail);
        }
      } catch (error) {
        fail(error);
      }
    });

    if (typeof classifier.classify !== "function") {
      throw new Error("El clasificador no expone el metodo classify");
    }

    return classifier;
  }

  scheduleClassification(delayMs = this.config.model.classifyIntervalMs) {
    this.clearClassificationTimer();
    if (this.destroyed || !this.classifier || !this.video) {
      return;
    }

    this.classifyTimeoutId = window.setTimeout(() => this.classifyFrame(), delayMs);
  }

  clearClassificationTimer() {
    if (!this.classifyTimeoutId) {
      return;
    }

    window.clearTimeout(this.classifyTimeoutId);
    this.classifyTimeoutId = null;
  }

  classifyFrame() {
    if (this.destroyed || !this.classifier || !this.video) {
      return;
    }

    const onResults = (error, results) => {
      if (error) {
        console.warn("Ufro Jump classifier error:", error?.message ?? error);
        this.statusText = "Clasificador en reintento...";
        this.scheduleClassification(250);
        return;
      }

      const normalizedResults = normalizeClassificationResults(results);
      const topResult = normalizedResults[0];
      if (topResult) {
        const label = topResult.label ?? topResult.className ?? "-";
        const confidence = topResult.confidence ?? topResult.probability ?? 0;
        this.currentLabel = label;
        this.confidence = Number.isFinite(confidence) ? confidence : 0;
        const normalizedLabel = normalizeLabel(label);
        if (this.isKnownModelLabel(normalizedLabel)) {
          this.applyControlFromLabel(label, this.confidence);
        } else {
          this.controlAction = "hold";
        }
        this.statusText = "Ufro Jump activo: guia lateral con Izquierda y Derecha.";
      } else {
        this.controlAction = "hold";
      }

      this.scheduleClassification();
    };

    try {
      const source = this.buildMirroredFrameSource();
      if (!source) {
        this.scheduleClassification(120);
        return;
      }

      if (this.classifier.classify.length >= 2) {
        this.classifier.classify(source, (arg1, arg2) => {
          const maybeError = (arg1 instanceof Error) ? arg1 : ((arg2 instanceof Error) ? arg2 : null);
          const resultsCandidate = (arg1 instanceof Error) ? arg2 : arg1;
          const fallbackCandidate = (arg2 instanceof Error) ? arg1 : arg2;
          const normalizedPrimary = normalizeClassificationResults(resultsCandidate);
          const normalizedFallback = normalizeClassificationResults(fallbackCandidate);
          const results = normalizedPrimary.length > 0 ? normalizedPrimary : normalizedFallback;
          onResults(maybeError, results);
        });
        return;
      }

      Promise.resolve(this.classifier.classify(source))
        .then((results) => onResults(null, results))
        .catch((error) => onResults(error, []));
    } catch (error) {
      onResults(error, []);
    }
  }

  buildMirroredFrameSource() {
    const videoElement = resolveDrawableVideoSource(this.video);
    const isHtmlVideo = typeof HTMLVideoElement !== "undefined" && videoElement instanceof HTMLVideoElement;
    if (!isHtmlVideo) {
      return null;
    }

    if (!isFinitePositive(videoElement.videoWidth) || !isFinitePositive(videoElement.videoHeight)) {
      return null;
    }

    if (!this.flipCanvas) {
      this.flipCanvas = document.createElement("canvas");
      this.flipContext = this.flipCanvas.getContext("2d", { willReadFrequently: false });
    }

    if (!this.flipContext) {
      return null;
    }

    if (this.flipCanvas.width !== videoElement.videoWidth || this.flipCanvas.height !== videoElement.videoHeight) {
      this.flipCanvas.width = videoElement.videoWidth;
      this.flipCanvas.height = videoElement.videoHeight;
    }

    this.flipContext.save();
    this.flipContext.clearRect(0, 0, this.flipCanvas.width, this.flipCanvas.height);
    this.flipContext.translate(this.flipCanvas.width, 0);
    this.flipContext.scale(-1, 1);
    this.flipContext.drawImage(videoElement, 0, 0, this.flipCanvas.width, this.flipCanvas.height);
    this.flipContext.restore();

    return this.flipCanvas;
  }

  isKnownModelLabel(normalizedLabel) {
    if (!normalizedLabel) {
      return false;
    }

    if (this.modelLabelSet?.size) {
      return this.modelLabelSet.has(normalizedLabel);
    }

    const fallbackLabels = [
      ...this.config.model.leftLabels,
      ...this.config.model.rightLabels,
      ...this.config.model.neutralLabels,
    ];

    return fallbackLabels.includes(normalizedLabel);
  }

  applyControlFromLabel(label, confidence) {
    if (this.state !== "playing") {
      return;
    }

    const normalizedLabel = normalizeLabel(label);
    if (!normalizedLabel || !Number.isFinite(confidence) || confidence < this.config.model.minConfidence) {
      this.controlAction = "hold";
      return;
    }

    const modelConfig = this.config.model;
    const controlsConfig = this.config.controls;
    const maxSpeed = this.config.physics.maxHorizontalSpeed;

    const isLeft = modelConfig.leftLabels.includes(normalizedLabel);
    const isRight = modelConfig.rightLabels.includes(normalizedLabel);
    const isNeutral = modelConfig.neutralLabels.includes(normalizedLabel);

    if (isLeft) {
      this.controlAction = "left";
      this.player.velocityX = clamp(
        this.player.velocityX - controlsConfig.leftImpulse,
        -maxSpeed,
        maxSpeed,
      );
      return;
    }

    if (isRight) {
      this.controlAction = "right";
      this.player.velocityX = clamp(
        this.player.velocityX + controlsConfig.rightImpulse,
        -maxSpeed,
        maxSpeed,
      );
      return;
    }

    if (isNeutral) {
      this.controlAction = "neutral";
      this.player.velocityX *= controlsConfig.neutralBrake;
      if (Math.abs(this.player.velocityX) < 6) {
        this.player.velocityX = 0;
      }
      return;
    }

    this.controlAction = "unknown";
  }

  handleKeyDown(event) {
    if (event.key === "Escape") {
      this.router.navigate("launcher");
      return;
    }

    if (event.key === "Enter" && this.state === "game-over") {
      this.initializeWorld();
      this.state = "playing";
      this.statusText = "Nueva partida iniciada. Sigue subiendo.";
    }
  }

  updateHud() {
    if (this.statusPill) {
      this.statusPill.textContent = this.statusText;
    }

    const stateElement = this.root.querySelector('[data-role="state"]');
    const scoreElement = this.root.querySelector('[data-role="score"]');
    const bestScoreElement = this.root.querySelector('[data-role="best-score"]');
    const labelElement = this.root.querySelector('[data-role="label"]');
    const confidenceElement = this.root.querySelector('[data-role="confidence"]');
    const controlElement = this.root.querySelector('[data-role="control"]');
    const labelsElement = this.root.querySelector('[data-role="labels"]');

    if (stateElement) {
      const altitude = Math.max(0, Math.floor((this.config.canvas.height - this.highestReachedY) / 10));
      stateElement.textContent = `${this.state} | altura ${altitude}`;
    }
    if (scoreElement) {
      scoreElement.textContent = String(this.score);
    }
    if (bestScoreElement) {
      bestScoreElement.textContent = String(this.bestScore);
    }
    if (labelElement) {
      labelElement.textContent = this.currentLabel;
    }
    if (confidenceElement) {
      confidenceElement.textContent = `${(this.confidence * 100).toFixed(1)}%`;
    }
    if (controlElement) {
      controlElement.textContent = this.controlAction;
    }
    if (labelsElement) {
      if (!this.mlAvailable && this.modelError) {
        labelsElement.textContent = `ml off: ${this.modelError}`;
      } else {
        labelsElement.textContent = this.availableLabels.length > 0 ? this.availableLabels.join(", ") : "-";
      }
    }
  }

  exit() {
    this.destroyed = true;
    this.clearClassificationTimer();
    this.sketch?.remove();
    this.video?.remove();
    this.flipCanvas?.remove();
    this.flipCanvas = null;
    this.flipContext = null;
    this.classifier = null;
    this.modal?.hide();
    this.gameSidebar?.destroy();
    window.removeEventListener("keydown", this.handleKeyDown);

    const tracks = this.cameraStream?.getTracks?.() ?? [];
    tracks.forEach((track) => track.stop());
    this.cameraStream = null;
    if (this.cameraPanel) {
      this.cameraPanel.innerHTML = "";
    }
  }

  destroy() {
    this.exit();
  }
}
