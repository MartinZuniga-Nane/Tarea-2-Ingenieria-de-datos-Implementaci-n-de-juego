import { Modal } from "../../shared/ui/modal.js";
import { createGameSidebar } from "../../shared/ui/gameSidebar.js";
import { ufroNinjaConfig } from "./config.js";

function normalizeLabel(rawLabel) {
  if (!rawLabel) {
    return "";
  }

  return String(rawLabel).trim().toLowerCase();
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) {
    return outMin;
  }
  const normalized = (value - inMin) / (inMax - inMin);
  return outMin + normalized * (outMax - outMin);
}

function resolveDrawableVideoSource(videoLike) {
  if (!videoLike) {
    return null;
  }

  return videoLike.elt || videoLike;
}

function isDrawableImageSource(source) {
  return typeof HTMLImageElement !== "undefined"
    && source instanceof HTMLImageElement
    && source.complete
    && source.naturalWidth > 0;
}

function isDrawableVideoSource(source) {
  return typeof HTMLVideoElement !== "undefined"
    && source instanceof HTMLVideoElement
    && source.readyState >= 2
    && source.videoWidth > 0
    && source.videoHeight > 0;
}

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
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

class Fruit {
  constructor(iconos, p5, gravity) {
    this.r = 30;
    this.x = p5.random(this.r + 40, p5.width - this.r - 40);
    this.y = p5.height + this.r;
    this.vy = p5.random(-18, -14);
    this.vx = p5.random(-2, 2);
    this.icon = p5.random(iconos);
    this.rotation = 0;
    this.rotationSpeed = p5.random(-0.1, 0.1);
    this.gravity = gravity;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.rotation += this.rotationSpeed;
  }

  draw(p5) {
    p5.push();
    p5.translate(this.x, this.y);
    p5.rotate(this.rotation);
    if (isDrawableImageSource(this.icon)) {
      const size = this.r * 2;
      p5.drawingContext.drawImage(this.icon, -size / 2, -size / 2, size, size);
    } else {
      p5.textSize(this.r * 2);
      p5.text(this.icon, 0, 0);
    }
    p5.pop();
  }
}

class Particle {
  constructor(x, y, icon, p5, gravity) {
    this.x = x;
    this.y = y;
    this.vx = p5.random(-6, 6);
    this.vy = p5.random(-6, 6);
    this.icon = icon;
    this.life = 255;
    this.size = p5.random(20, 40);
    this.gravity = gravity;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.life -= 15;
  }

  draw(p5) {
    p5.push();
    p5.translate(this.x, this.y);
    const alpha = Math.max(this.life, 0);
    if (isDrawableImageSource(this.icon)) {
      const previousAlpha = p5.drawingContext.globalAlpha;
      p5.drawingContext.globalAlpha = alpha / 255;
      p5.drawingContext.drawImage(this.icon, -this.size / 2, -this.size / 2, this.size, this.size);
      p5.drawingContext.globalAlpha = previousAlpha;
    } else {
      p5.drawingContext.globalAlpha = alpha / 255;
      p5.textSize(this.size);
      p5.text(this.icon, 0, 0);
      p5.drawingContext.globalAlpha = 1;
    }
    p5.pop();
  }
}

export class UfroNinjaScene {
  constructor({ root, router }) {
    this.root = root;
    this.router = router;
    this.config = ufroNinjaConfig;

    this.video = null;
    this.classifier = null;
    this.classifyTimeoutId = null;
    this.audioCtx = null;

    this.gameState = "loading";
    this.currentLabel = this.config.ui.statusLoading;
    this.confidence = 0;
    this.canCut = true;
    this.score = 0;
    this.lives = this.config.game.initialLives;
    this.fruits = [];
    this.particles = [];
    this.icons = ["🍎", "🍌", "🍉", "🍍", "🥥", "🥝", "🍊"];
    this.backgroundImage = null;
    this.fruitImages = [];

    this.destroyed = false;
    this.modal = null;
    this.gameSidebar = null;
    this.mlAvailable = false;
    this.drawCameraInCanvas = true;
    this.drawBackgroundInCanvas = true;
    this.modelMetadata = null;
    this.modelLabelSet = null;
    this.lastRawLabel = "-";
    this.lastRawConfidence = 0;
    this.flipCanvas = null;
    this.flipContext = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  mount() {
    this.root.innerHTML = `
      <main class="game-shell app-shell ufro-ninja-shell">
        <div class="game-shell__canvas"></div>
        <div class="game-shell__hud">
          <div class="game-shell__topbar">
            <div class="pill" data-role="status">Inicializando Ufro Ninja...</div>
            <div class="pill">Ataque = Mano abierta| Reposo = Mano cerrada/puño | Enter = iniciar/reiniciar | Esc = launcher</div>
          </div>
          <aside class="game-shell__debug" data-role="debug-panel">
            <h3>Ufro Ninja</h3>
            <dl>
              <dt>Estado</dt><dd data-role="game-state">-</dd>
              <dt>Etiqueta ML</dt><dd data-role="ml-label">-</dd>
              <dt>Confianza</dt><dd data-role="ml-confidence">0%</dd>
              <dt>Puntuacion</dt><dd data-role="score">0</dd>
              <dt>Vidas</dt><dd data-role="lives">3</dd>
            </dl>
          </aside>
          <aside class="game-shell__camera hidden" data-role="camera-panel"></aside>
        </div>
      </main>
    `;

    this.shell = this.root.querySelector(".ufro-ninja-shell");
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

    this.start().catch((error) => {
      this.modal.show({
        title: "No se pudo iniciar Ufro Ninja",
        message: error.message,
      });
      console.error(error);
    });
  }

  async start() {
    const p5Promise = window.__p5Ready ?? (window.p5 ? Promise.resolve(window.p5) : Promise.reject(new Error("p5.js no pudo cargarse")));
    const ml5Promise = window.__ml5Ready ?? (window.ml5 ? Promise.resolve(window.ml5) : Promise.reject(new Error("ml5.js no pudo cargarse")));
    await Promise.all([p5Promise, ml5Promise]);

    await this.loadVisualAssets();

    this.sketch = new window.p5(this.createSketch());

    try {
      await this.initializeML();
      this.mlAvailable = true;
    } catch (error) {
      this.mlAvailable = false;
      this.gameState = "ready";
      this.currentLabel = "Reposo";
      this.modal.show({
        title: "Modelo o camara no disponibles",
        message: "Ufro Ninja seguira en modo teclado: Enter para cortar/iniciar.",
        dismissLabel: "Continuar",
        autoHideMs: 2800,
      });
      console.warn("Ufro Ninja fallback a teclado:", error?.message ?? error);
    }

    this.updateStatus();
  }

  async loadVisualAssets() {
    const assetsConfig = this.config.assets ?? {};
    const backgroundPath = assetsConfig.backgroundPath;
    const fruitPaths = Array.isArray(assetsConfig.fruitPaths) ? assetsConfig.fruitPaths : [];

    if (backgroundPath) {
      try {
        this.backgroundImage = await this.loadImageAsset(backgroundPath);
      } catch (error) {
        console.warn("Ufro Ninja no pudo cargar background:", error?.message ?? error);
      }
    }

    if (fruitPaths.length > 0) {
      const results = await Promise.all(
        fruitPaths.map(async (path) => {
          try {
            return await this.loadImageAsset(path);
          } catch (error) {
            console.warn(`Ufro Ninja no pudo cargar fruta ${path}:`, error?.message ?? error);
            return null;
          }
        }),
      );
      this.fruitImages = results.filter(Boolean);
    }
  }

  loadImageAsset(relativePath) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`No se pudo cargar ${relativePath}`));
      image.src = new URL(relativePath, window.location.href).href;
    });
  }

  createSketch() {
    return (p5) => {
      p5.setup = () => {
        const canvas = p5.createCanvas(this.config.canvas.width, this.config.canvas.height);
        canvas.parent(this.canvasContainer);
        p5.textAlign(p5.CENTER, p5.CENTER);
        p5.textFont("IBM Plex Sans");
      };

      p5.draw = () => {
        try {
          this.renderFrame(p5);
        } catch (error) {
          p5.noLoop();
          this.handleRuntimeError(error);
        }
      };
    };
  }

  async initializeML() {
    await this.loadModelMetadata();
    this.video = await this.createVideoElement();
    this.cameraPanel.classList.remove("hidden");
    this.cameraPanel.appendChild(this.video);

    this.classifier = await this.createClassifier();
    this.gameState = "ready";
    this.currentLabel = "Reposo";
    this.scheduleClassification(0);
  }

  async loadModelMetadata() {
    const metadataPath = this.config.model.metadataPath;
    if (!metadataPath) {
      return;
    }

    try {
      const response = await fetch(metadataPath, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`No se pudo leer metadata (${response.status})`);
      }
      const metadata = await response.json();
      const labels = Array.isArray(metadata?.labels) ? metadata.labels : [];
      this.modelMetadata = metadata;
      this.modelLabelSet = new Set(labels.map((label) => normalizeLabel(label)));
      if (this.modelLabelSet.size > 0) {
        console.info("Ufro Ninja labels del modelo:", [...this.modelLabelSet]);
      }
    } catch (error) {
      this.modelMetadata = null;
      this.modelLabelSet = null;
      console.warn("Ufro Ninja no pudo cargar metadata del modelo:", error?.message ?? error);
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
      let classifierInstance = null;
      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        reject(new Error("El clasificador tardo demasiado en cargar"));
      }, 12000);

      const finish = (instance) => {
        if (settled || !instance) {
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(instance);
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
        classifierInstance = window.ml5.imageClassifier(modelPath, () => finish(classifierInstance));
        if (classifierInstance && typeof classifierInstance.then === "function") {
          classifierInstance.then((resolved) => finish(resolved)).catch(fail);
        }
      } catch (error) {
        fail(error);
      }
    });

    if (typeof classifier.classify !== "function") {
      throw new Error("El clasificador no expone el metodo classify");
    }

    console.info("Ufro Ninja cargo clasificador desde:", modelPath);

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
    if (this.classifyTimeoutId) {
      window.clearTimeout(this.classifyTimeoutId);
      this.classifyTimeoutId = null;
    }
  }

  classifyFrame() {
    if (this.destroyed || !this.classifier || !this.video) {
      return;
    }

    const handleResults = (error, results) => {
      if (error) {
        console.warn("Ufro Ninja classifier error:", error?.message ?? error);
        this.scheduleClassification(300);
        return;
      }

      this.ingestClassification(normalizeClassificationResults(results));
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
          const resultsCandidate = (arg1 instanceof Error) ? arg2 : arg1;
          const fallbackCandidate = (arg2 instanceof Error) ? arg1 : arg2;
          const normalizedPrimary = normalizeClassificationResults(resultsCandidate);
          const normalizedFallback = normalizeClassificationResults(fallbackCandidate);
          const results = normalizedPrimary.length > 0 ? normalizedPrimary : normalizedFallback;
          const error = (arg1 instanceof Error) ? arg1 : ((arg2 instanceof Error) ? arg2 : null);
          handleResults(error, results);
        });
        return;
      }

      Promise.resolve(this.classifier.classify(source))
        .then((results) => handleResults(null, results))
        .catch((error) => handleResults(error, []));
    } catch (error) {
      handleResults(error, []);
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

    const targetWidth = videoElement.videoWidth;
    const targetHeight = videoElement.videoHeight;
    if (this.flipCanvas.width !== targetWidth || this.flipCanvas.height !== targetHeight) {
      this.flipCanvas.width = targetWidth;
      this.flipCanvas.height = targetHeight;
    }

    if (!this.flipContext) {
      return null;
    }

    this.flipContext.save();
    this.flipContext.clearRect(0, 0, targetWidth, targetHeight);
    this.flipContext.translate(targetWidth, 0);
    this.flipContext.scale(-1, 1);
    this.flipContext.drawImage(videoElement, 0, 0, targetWidth, targetHeight);
    this.flipContext.restore();
    return this.flipCanvas;
  }

  ingestClassification(results) {
    const topResult = Array.isArray(results) ? results[0] : null;
    const rawLabel = topResult?.label ?? "Reposo";
    const normalizedLabel = normalizeLabel(rawLabel);
    const rawConfidence = topResult?.confidence ?? 0;

    this.lastRawLabel = rawLabel;
    this.lastRawConfidence = rawConfidence;

    if (!this.isKnownModelLabel(normalizedLabel)) {
      this.currentLabel = rawLabel;
      this.confidence = rawConfidence;
      this.updateStatus();
      return;
    }

    this.currentLabel = rawLabel;
    this.confidence = rawConfidence;
    this.updateStatus();
  }

  isKnownModelLabel(normalizedLabel) {
    if (!normalizedLabel) {
      return false;
    }

    if (this.modelLabelSet?.size) {
      return this.modelLabelSet.has(normalizedLabel);
    }

    const fallbackExpected = this.config.input.expectedLabels ?? [];
    return fallbackExpected.includes(normalizedLabel);
  }

  isAttackGesture() {
    const normalized = normalizeLabel(this.currentLabel);
    return this.config.input.attackLabels.includes(normalized);
  }

  isRestGesture() {
    const normalized = normalizeLabel(this.currentLabel);
    return this.config.input.restLabels.includes(normalized);
  }

  restartGame() {
    this.fruits = [];
    this.particles = [];
    this.score = 0;
    this.lives = this.config.game.initialLives;
    this.canCut = false;
    this.gameState = "playing";
    this.updateStatus();
  }

  handleGameStateTransitions() {
    if (!this.mlAvailable) {
      return;
    }

    if (this.gameState === "ready" && this.isAttackGesture()) {
      this.restartGame();
      return;
    }

    if (this.gameState === "game-over") {
      if (this.isRestGesture()) {
        this.canCut = true;
      }

      if (this.isAttackGesture() && this.canCut) {
        this.restartGame();
        this.canCut = false;
      }
    }
  }

  handleKeyDown(event) {
    if (event.code === "Escape") {
      event.preventDefault();
      this.router.navigate("launcher");
      return;
    }

    if (event.code !== "Enter") {
      return;
    }

    event.preventDefault();
    if (this.gameState === "ready") {
      this.restartGame();
      return;
    }

    if (this.gameState === "playing") {
      this.cutFruit();
      return;
    }

    if (this.gameState === "game-over") {
      this.restartGame();
    }
  }

  renderFrame(p5) {
    p5.background("#08090d");

    const hasBackgroundImage = isDrawableImageSource(this.backgroundImage);

    if (hasBackgroundImage && this.drawBackgroundInCanvas) {
      try {
        p5.drawingContext.drawImage(this.backgroundImage, 0, 0, p5.width, p5.height);
      } catch (error) {
        this.drawBackgroundInCanvas = false;
        console.warn("Ufro Ninja desactivo background de imagen:", error?.message ?? error);
      }
    }

    const drawableVideo = resolveDrawableVideoSource(this.video);
    const canDrawVideo = isDrawableVideoSource(drawableVideo);

    if ((!hasBackgroundImage || !this.drawBackgroundInCanvas) && canDrawVideo && this.drawCameraInCanvas) {
      try {
        p5.drawingContext.save();
        p5.drawingContext.translate(p5.width, 0);
        p5.drawingContext.scale(-1, 1);
        p5.drawingContext.drawImage(drawableVideo, 0, 0, p5.width, p5.height);
        p5.drawingContext.restore();
      } catch (error) {
        this.drawCameraInCanvas = false;
        console.warn("Ufro Ninja desactivo fondo de camara en canvas:", error?.message ?? error);
      }
    }

    this.handleGameStateTransitions();

    if (this.gameState !== "playing") {
      p5.fill(0, 0, 0, 160);
      p5.rect(0, 0, p5.width, p5.height);
    }

    if (this.gameState === "loading") {
      this.drawLoading(p5);
      this.updateDebugPanel();
      return;
    }

    if (this.gameState === "ready") {
      this.drawReadyScreen(p5);
      this.updateDebugPanel();
      return;
    }

    if (this.gameState === "game-over") {
      this.drawGameOver(p5);
      this.updateDebugPanel();
      return;
    }

    this.runGameplay(p5);
    this.updateDebugPanel();
  }

  drawLoading(p5) {
    p5.fill(255);
    p5.textSize(30);
    p5.text("Conectando Vision Artificial...", p5.width / 2, p5.height / 2 - 20);
    p5.textSize(18);
    p5.fill(150, 150, 255);
    p5.text("Cargando modelo con ml5.js", p5.width / 2, p5.height / 2 + 20);
  }

  drawReadyScreen(p5) {
    p5.fill(0, 255, 0);
    p5.textSize(45);
    p5.text(this.config.ui.title, p5.width / 2, p5.height / 2 - 50);
    p5.fill(255);
    p5.textSize(20);
    p5.text('Haz el gesto "Ataque" para EMPEZAR', p5.width / 2, p5.height / 2 + 20);
    p5.textSize(16);
    p5.fill(200);
    p5.text(
      `ML5 Radar: ${this.currentLabel} (${p5.nf(this.confidence * 100, 1, 1)}%)`,
      p5.width / 2,
      p5.height / 2 + 60,
    );
  }

  drawGameOver(p5) {
    p5.fill(255, 50, 50);
    p5.textSize(50);
    p5.text("GAME OVER", p5.width / 2, p5.height / 2 - 50);
    p5.fill(255);
    p5.textSize(30);
    p5.text(`Puntuacion final: ${this.score}`, p5.width / 2, p5.height / 2 + 10);
    p5.textSize(20);
    p5.fill(255, 255, 0);
    p5.text('Vuelve a "Reposo" y haz "Ataque" para REINICIAR', p5.width / 2, p5.height / 2 + 60);
  }

  runGameplay(p5) {
    if (this.isRestGesture()) {
      this.canCut = true;
    } else if (this.isAttackGesture() && this.canCut) {
      this.cutFruit();
      this.canCut = false;
      p5.fill(255, 255, 255, 100);
      p5.rect(0, 0, p5.width, p5.height);
    }

    let spawnRate = mapRange(
      this.score,
      0,
      this.config.game.spawnRampScore,
      this.config.game.spawnSlowFrames,
      this.config.game.spawnFastFrames,
    );
    spawnRate = p5.constrain(
      spawnRate,
      this.config.game.spawnFastFrames,
      this.config.game.spawnSlowFrames,
    );

    if (p5.frameCount % Math.floor(spawnRate) === 0) {
      const fruitAssets = this.fruitImages.length > 0 ? this.fruitImages : this.icons;
      this.fruits.push(new Fruit(fruitAssets, p5, this.config.game.gravity));
    }

    for (let index = this.fruits.length - 1; index >= 0; index -= 1) {
      const fruit = this.fruits[index];
      fruit.update();
      fruit.draw(p5);
      if (fruit.y > p5.height + fruit.r) {
        this.lives -= 1;
        this.fruits.splice(index, 1);
        this.playErrorSound();
        if (this.lives <= 0) {
          this.gameState = "game-over";
          this.updateStatus();
        }
      }
    }

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.update();
      particle.draw(p5);
      if (particle.life <= 0) {
        this.particles.splice(index, 1);
      }
    }

    p5.fill(this.config.ui.hudTextColor);
    p5.textSize(24);
    p5.textAlign(p5.LEFT, p5.TOP);
    p5.text(`Puntuacion: ${this.score}`, 20, 20);
    p5.textAlign(p5.RIGHT, p5.TOP);
    p5.text("❤️".repeat(this.lives), p5.width - 20, 20);

    p5.textAlign(p5.CENTER, p5.BOTTOM);
    p5.textSize(16);
    if (this.isRestGesture()) {
      p5.fill(0, 255, 0);
    } else {
      p5.fill(255, 100, 100);
    }
    const inputHint = this.mlAvailable
      ? `ML5: ${this.currentLabel} (${p5.nf(this.confidence * 100, 1, 1)}%)`
      : "Teclado: Enter para cortar";
    p5.text(inputHint, p5.width / 2, p5.height - 10);
  }

  cutFruit() {
    if (this.fruits.length === 0) {
      return;
    }

    this.playSlashSound();

    let lowestIndex = 0;
    for (let index = 1; index < this.fruits.length; index += 1) {
      if (this.fruits[index].y > this.fruits[lowestIndex].y) {
        lowestIndex = index;
      }
    }

    const fruit = this.fruits[lowestIndex];
    this.score += 1;
    for (let index = 0; index < 3; index += 1) {
      this.particles.push(new Particle(fruit.x, fruit.y, fruit.icon, this.sketch, this.config.game.gravity));
    }
    this.fruits.splice(lowestIndex, 1);
    this.updateStatus();
  }

  ensureAudioContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
  }

  playSlashSound() {
    this.ensureAudioContext();
    if (!this.audioCtx) {
      return;
    }
    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
    oscillator.start(this.audioCtx.currentTime);
    oscillator.stop(this.audioCtx.currentTime + 0.1);
  }

  playErrorSound() {
    this.ensureAudioContext();
    if (!this.audioCtx) {
      return;
    }
    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(150, this.audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
    oscillator.start(this.audioCtx.currentTime);
    oscillator.stop(this.audioCtx.currentTime + 0.3);
  }

  updateStatus() {
    if (!this.statusPill) {
      return;
    }

    if (this.gameState === "loading") {
      this.statusPill.textContent = "Inicializando Ufro Ninja...";
      return;
    }

    if (this.gameState === "ready") {
      this.statusPill.textContent = this.mlAvailable
        ? "Haz gesto Ataque para iniciar"
        : "Modo teclado activo: Enter para iniciar";
      return;
    }

    if (this.gameState === "game-over") {
      this.statusPill.textContent = `Game over con ${this.score} pts - Reposo + Ataque para reiniciar`;
      return;
    }

    this.statusPill.textContent = `Ufro Ninja - Puntos ${this.score} - Vidas ${this.lives}`;
  }

  updateDebugPanel() {
    this.root.querySelector('[data-role="game-state"]').textContent = this.gameState;
    this.root.querySelector('[data-role="ml-label"]').textContent = this.mlAvailable ? this.currentLabel : "fallback-teclado";
    this.root.querySelector('[data-role="ml-confidence"]').textContent = this.mlAvailable ? `${(this.confidence * 100).toFixed(1)}%` : "-";
    this.root.querySelector('[data-role="score"]').textContent = String(this.score);
    this.root.querySelector('[data-role="lives"]').textContent = String(this.lives);
  }

  handleRuntimeError(error) {
    this.modal.show({
      title: "Error de render en Ufro Ninja",
      message: error.message,
    });
    console.error(error);
  }

  destroy() {
    this.destroyed = true;
    this.clearClassificationTimer();
    this.sketch?.remove();
    this.video?.remove();
    this.flipCanvas?.remove();
    this.flipCanvas = null;
    this.flipContext = null;
    this.modal?.hide();
    this.gameSidebar?.destroy();
    window.removeEventListener("keydown", this.handleKeyDown);

    const tracks = this.cameraStream?.getTracks?.() ?? [];
    tracks.forEach((track) => track.stop());
    this.cameraStream = null;
  }
}
