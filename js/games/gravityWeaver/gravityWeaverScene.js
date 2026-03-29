import { Modal } from "../../shared/ui/modal.js";
import { Astronaut } from "./astronaut.js";
import { gravityWeaverConfig } from "./config.js";
import { LevelManager } from "./levelManager.js";
import { gravityWeaverLevels } from "./levels.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeLabel(rawLabel) {
  if (!rawLabel) {
    return "neutral";
  }

  return String(rawLabel)
    .trim()
    .toLowerCase();
}

function formatMs(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export class GravityWeaverScene {
  constructor({ root, router }) {
    this.root = root;
    this.router = router;
    this.config = gravityWeaverConfig;

    this.levels = gravityWeaverLevels;
    this.levelIndex = 0;
    this.levelStartedAt = 0;
    this.levelFinishedAt = 0;

    this.metrics = {
      attempts: 1,
      collisions: 0,
      bestByLevel: new Map(),
    };

    this.astronaut = new Astronaut({
      x: this.levels[0].spawn.x,
      y: this.levels[0].spawn.y,
      radius: this.config.astronaut.radius,
    });
    this.levelManager = new LevelManager(this.config);
    this.levelManager.loadLevel(this.levels[0]);

    this.currentGravity = { x: 0, y: 0 };
    this.targetGravity = { x: 0, y: 0 };
    this.predictedVector = { x: 0, y: 0 };
    this.currentLabel = "Neutral";
    this.inputSource = "keyboard";

    this.state = "idle";
    this.stateMessage = "Inicializando Gravity Weaver...";
    this.mlState = "idle";

    this.starLayers = {
      near: [],
      mid: [],
      far: [],
    };

    this.keyState = {
      ArrowUp: false,
      ArrowDown: false,
      ArrowLeft: false,
      ArrowRight: false,
    };

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    this.video = null;
    this.classifier = null;
    this.cameraStream = null;
    this.classifyTimeoutId = null;
    this.destroyed = false;
    this.modal = null;
  }

  mount() {
    this.root.innerHTML = `
      <main class="game-shell app-shell">
        <div class="game-shell__canvas"></div>
        <div class="game-shell__hud">
          <div class="game-shell__topbar">
            <div class="pill" data-role="status">Inicializando Gravity Weaver...</div>
            <div class="pill">Flechas = gravedad | R = reiniciar nivel | Esc = launcher</div>
          </div>
          <aside class="game-shell__debug" data-role="debug-panel">
            <h3>Gravity Weaver</h3>
            <dl>
              <dt>Nivel</dt><dd data-role="level-name">-</dd>
              <dt>Entrada</dt><dd data-role="input-source">-</dd>
              <dt>Etiqueta ML</dt><dd data-role="ml-label">-</dd>
              <dt>Gravedad objetivo</dt><dd data-role="gravity-target">0.00, 0.00</dd>
              <dt>Gravedad actual</dt><dd data-role="gravity-current">0.00, 0.00</dd>
              <dt>Tiempo</dt><dd data-role="level-time">00:00</dd>
              <dt>Par</dt><dd data-role="par-time">00:00</dd>
              <dt>Rebotes</dt><dd data-role="collision-count">0</dd>
              <dt>Intentos</dt><dd data-role="attempt-count">1</dd>
              <dt>Estado ML</dt><dd data-role="ml-state">-</dd>
            </dl>
          </aside>
          <aside class="game-shell__camera hidden" data-role="camera-panel"></aside>
        </div>
      </main>
    `;

    this.shell = this.root.querySelector(".game-shell");
    this.canvasContainer = this.root.querySelector(".game-shell__canvas");
    this.statusPill = this.root.querySelector('[data-role="status"]');
    this.cameraPanel = this.root.querySelector('[data-role="camera-panel"]');
    this.modal = new Modal(this.shell);

    this.start().catch((error) => {
      this.state = "error";
      this.stateMessage = error.message;
      this.statusPill.textContent = this.stateMessage;
      this.modal.show({
        title: "No se pudo iniciar Gravity Weaver",
        message: error.message,
      });
      console.error(error);
    });
  }

  async start() {
    const p5Promise = window.__p5Ready ?? (window.p5 ? Promise.resolve(window.p5) : Promise.reject(new Error("p5.js no pudo cargarse")));
    const ml5Promise = window.__ml5Ready ?? (window.ml5 ? Promise.resolve(window.ml5) : Promise.reject(new Error("ml5.js no pudo cargarse")));
    await Promise.all([p5Promise, ml5Promise]);

    this.setupKeyboardListeners();
    this.generateStars();
    this.enter();

    this.sketch = new window.p5(this.createSketch());
    this.initializeMachineLearning();
  }

  createSketch() {
    return (p5) => {
      let lastTime = 0;

      p5.setup = () => {
        const canvas = p5.createCanvas(this.config.canvas.width, this.config.canvas.height);
        canvas.parent(this.canvasContainer);
        p5.textFont("IBM Plex Sans");
        p5.background(this.config.visuals.backgroundColor);
        lastTime = performance.now();
        this.updateStatusText();
        resizeCanvas();
      };

      p5.draw = () => {
        try {
          const now = performance.now();
          const dt = clamp((now - lastTime) / 1000, 0, 0.042);
          lastTime = now;
          this.update(dt);
          this.render(p5);
        } catch (error) {
          p5.noLoop();
          this.handleRuntimeError(error);
        }
      };

      p5.windowResized = () => resizeCanvas();

      const resizeCanvas = () => {
        const parentWidth = this.canvasContainer.clientWidth || window.innerWidth;
        const parentHeight = this.canvasContainer.clientHeight || window.innerHeight;
        const scale = Math.min(parentWidth / this.config.canvas.width, parentHeight / this.config.canvas.height);
        const targetWidth = this.config.canvas.width * scale;
        const targetHeight = this.config.canvas.height * scale;
        p5.resizeCanvas(this.config.canvas.width, this.config.canvas.height);
        p5.canvas.style.width = `${targetWidth}px`;
        p5.canvas.style.height = `${targetHeight}px`;
        p5.canvas.style.margin = "0 auto";
      };
    };
  }

  enter() {
    this.state = "running";
    this.loadLevel(this.levelIndex);
  }

  loadLevel(index) {
    const safeIndex = clamp(index, 0, this.levels.length - 1);
    this.levelIndex = safeIndex;
    const level = this.getCurrentLevel();

    this.levelManager.loadLevel(level);
    this.astronaut.reset(level.spawn.x, level.spawn.y);
    this.levelStartedAt = performance.now();
    this.levelFinishedAt = 0;
    this.metrics.collisions = 0;

    this.currentGravity.x = 0;
    this.currentGravity.y = 0;
    this.targetGravity.x = 0;
    this.targetGravity.y = 0;

    this.updateStatusText();
    this.updateDebugPanel();
  }

  getCurrentLevel() {
    return this.levels[this.levelIndex];
  }

  update(dtSeconds) {
    if (this.state === "error") {
      return;
    }

    if (this.state === "won-level" || this.state === "campaign-complete") {
      this.updateDebugPanel();
      return;
    }

    const keyboardVector = this.getKeyboardVector();
    if (keyboardVector.x !== 0 || keyboardVector.y !== 0) {
      this.inputSource = "keyboard";
      this.targetGravity.x = keyboardVector.x;
      this.targetGravity.y = keyboardVector.y;
      this.currentLabel = "Teclado";
    } else {
      this.inputSource = this.mlState === "ready" ? "ml5 + Teachable Machine" : "keyboard";
      this.targetGravity.x = this.predictedVector.x;
      this.targetGravity.y = this.predictedVector.y;
    }

    const lerpFactor = 1 - Math.pow(1 - this.config.physics.gravityLerp, dtSeconds * 60);
    this.currentGravity.x += (this.targetGravity.x - this.currentGravity.x) * lerpFactor;
    this.currentGravity.y += (this.targetGravity.y - this.currentGravity.y) * lerpFactor;

    this.astronaut.applyForce({
      x: this.currentGravity.x * this.config.physics.gravityForce,
      y: this.currentGravity.y * this.config.physics.gravityForce,
    });

    this.astronaut.update(dtSeconds, this.config);
    const collisionsInFrame = this.levelManager.resolveCollisions(this.astronaut);
    this.metrics.collisions += collisionsInFrame;

    if (this.levelManager.checkPortal(this.astronaut)) {
      this.completeCurrentLevel();
    }

    this.updateDebugPanel();
  }

  completeCurrentLevel() {
    const now = performance.now();
    const level = this.getCurrentLevel();
    const elapsedMs = now - this.levelStartedAt;
    this.levelFinishedAt = now;

    const previousBest = this.metrics.bestByLevel.get(level.id);
    if (!previousBest || elapsedMs < previousBest.timeMs) {
      this.metrics.bestByLevel.set(level.id, {
        timeMs: elapsedMs,
        collisions: this.metrics.collisions,
      });
    }

    if (this.levelIndex < this.levels.length - 1) {
      this.state = "won-level";
      this.statusPill.textContent = `Nivel superado: ${level.title}. Presiona Enter para continuar`;
      return;
    }

    this.state = "campaign-complete";
    this.statusPill.textContent = "Campana completada. Presiona Enter para reiniciar";
  }

  render(p5) {
    this.drawGhostLayer(p5);
    this.drawNebula(p5);
    this.drawStars(p5);

    const pulse = (Math.sin(performance.now() / 1000 * this.config.level.glowPulseSpeed) + 1) * 0.5;
    this.levelManager.draw(p5, this.config.visuals, pulse);
    this.astronaut.draw(p5, this.config.astronaut);
    this.drawLevelOverlay(p5);

    if (this.state === "won-level") {
      this.drawEndCard(p5, "Nivel completado", "Enter: siguiente nivel | R: reintentar");
    }

    if (this.state === "campaign-complete") {
      this.drawEndCard(p5, "Gravity Weaver completado", "Enter: reiniciar campana | Esc: launcher");
    }
  }

  drawGhostLayer(p5) {
    p5.push();
    p5.noStroke();
    p5.fill(this.config.visuals.trailOverlay);
    p5.rect(0, 0, p5.width, p5.height);
    p5.pop();
  }

  drawNebula(p5) {
    const t = performance.now() / 1000;
    p5.push();
    p5.noStroke();
    p5.fill(this.config.visuals.nebulaColorA);
    p5.ellipse(290 + Math.sin(t * 0.16) * 38, 180, 560, 320);
    p5.ellipse(1030 + Math.cos(t * 0.12) * 36, 560, 460, 260);
    p5.fill(this.config.visuals.nebulaColorB);
    p5.ellipse(860 + Math.cos(t * 0.2) * 52, 160, 500, 270);
    p5.ellipse(430 + Math.sin(t * 0.23) * 42, 520, 420, 250);
    p5.pop();
  }

  drawStars(p5) {
    const time = performance.now() / 1000;
    this.drawStarLayer(p5, this.starLayers.far, 0.22, time);
    this.drawStarLayer(p5, this.starLayers.mid, 0.36, time);
    this.drawStarLayer(p5, this.starLayers.near, 0.5, time);
  }

  drawStarLayer(p5, stars, alphaBase, time) {
    p5.push();
    p5.noStroke();
    stars.forEach((star) => {
      const glow = alphaBase + Math.sin(time * star.speed + star.phase) * 0.2;
      p5.fill(`rgba(188, 220, 255, ${clamp(glow, 0.06, 0.86)})`);
      p5.circle(star.x, star.y, star.size);
    });
    p5.pop();
  }

  drawLevelOverlay(p5) {
    const level = this.getCurrentLevel();
    p5.push();
    p5.textAlign(p5.LEFT, p5.TOP);
    p5.fill(this.config.visuals.textColor);
    p5.textFont("Space Grotesk");
    p5.textSize(22);
    p5.text(level.title, 24, 24);
    p5.fill(this.config.visuals.textSoftColor);
    p5.textFont("IBM Plex Sans");
    p5.textSize(16);
    p5.text(level.hint, 24, 56);
    p5.text(this.config.level.objectiveText, 24, 78);
    p5.pop();
  }

  drawEndCard(p5, title, subtitle) {
    p5.push();
    p5.noStroke();
    p5.fill("rgba(4, 8, 18, 0.62)");
    p5.rect(0, 0, p5.width, p5.height);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.fill(this.config.visuals.textColor);
    p5.textFont("Space Grotesk");
    p5.textSize(58);
    p5.text(title, p5.width / 2, p5.height / 2 - 28);
    p5.textFont("IBM Plex Sans");
    p5.textSize(21);
    p5.fill(this.config.visuals.textSoftColor);
    p5.text(subtitle, p5.width / 2, p5.height / 2 + 30);
    p5.pop();
  }

  handleAction(action) {
    if (action === "BACK") {
      this.router.navigate("launcher");
      return;
    }

    if (action === "RESET_LEVEL") {
      this.metrics.attempts += 1;
      this.loadLevel(this.levelIndex);
      return;
    }

    if (action === "NEXT_LEVEL" && this.state === "won-level") {
      this.loadLevel(this.levelIndex + 1);
      this.state = "running";
      return;
    }

    if (action === "NEXT_LEVEL" && this.state === "campaign-complete") {
      this.metrics.attempts = 1;
      this.loadLevel(0);
      this.state = "running";
    }
  }

  exit() {
    this.clearClassifierTimer();
  }

  async initializeMachineLearning() {
    try {
      this.mlState = "requesting-camera";
      this.video = await this.createVideoElement();
      this.cameraPanel.classList.remove("hidden");
      this.cameraPanel.appendChild(this.video);

      this.mlState = "loading-model";
      this.classifier = await this.createImageClassifier();
      this.mlState = "ready";
      this.scheduleClassification(0);
    } catch (error) {
      this.mlState = "fallback";
      this.predictedVector = { x: 0, y: 0 };
      this.currentLabel = "Neutral";
      this.modal.show({
        title: "Modelo o camara no disponibles",
        message: "Gravity Weaver seguira con control de teclado (flechas).",
        dismissLabel: "Continuar",
        autoHideMs: 2600,
      });
      console.warn("Gravity Weaver fallback activo:", error?.message ?? error);
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

  async createImageClassifier() {
    if (!window.ml5?.imageClassifier) {
      throw new Error("ml5.imageClassifier no esta disponible");
    }

    const modelUrl = this.config.ml.teachableModelUrl;
    let classifier = null;

    const withVideo = await this.tryCreateClassifier(modelUrl, this.video);
    if (withVideo) {
      classifier = withVideo;
    } else {
      const withoutVideo = await this.tryCreateClassifier(modelUrl, null);
      classifier = withoutVideo;
    }

    if (!classifier) {
      throw new Error("No fue posible cargar el clasificador de Teachable Machine");
    }

    return classifier;
  }

  async tryCreateClassifier(modelUrl, video) {
    try {
      return await new Promise((resolve, reject) => {
        let settled = false;
        let instance = null;

        const complete = (value) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(value);
        };

        const fail = (error) => {
          if (settled) {
            return;
          }
          settled = true;
          reject(error);
        };

        try {
          if (video) {
            instance = window.ml5.imageClassifier(modelUrl, video, () => complete(instance));
          } else {
            instance = window.ml5.imageClassifier(modelUrl, () => complete(instance));
          }

          if (instance && typeof instance.then === "function") {
            instance.then((resolved) => complete(resolved)).catch(fail);
            return;
          }

          window.setTimeout(() => complete(instance), 70);
        } catch (error) {
          fail(error);
        }
      });
    } catch (error) {
      return null;
    }
  }

  scheduleClassification(delayMs = this.config.ml.classifyIntervalMs) {
    this.clearClassifierTimer();
    if (this.destroyed || this.mlState !== "ready" || !this.classifier) {
      return;
    }
    this.classifyTimeoutId = window.setTimeout(() => this.classifyFrame(), delayMs);
  }

  clearClassifierTimer() {
    if (this.classifyTimeoutId) {
      window.clearTimeout(this.classifyTimeoutId);
      this.classifyTimeoutId = null;
    }
  }

  classifyFrame() {
    if (this.destroyed || this.mlState !== "ready" || !this.classifier || !this.video) {
      return;
    }

    const finalize = (error, results) => {
      if (error) {
        this.mlState = "fallback";
        console.warn("Gravity Weaver classification error:", error?.message ?? error);
        return;
      }

      this.ingestClassificationResults(results);
      this.scheduleClassification();
    };

    try {
      if (this.classifier.classify.length >= 2) {
        this.classifier.classify(this.video, (arg1, arg2) => {
          const hasArrayFirst = Array.isArray(arg1);
          const hasArraySecond = Array.isArray(arg2);
          const results = hasArrayFirst ? arg1 : (hasArraySecond ? arg2 : []);
          const error = (arg1 instanceof Error) ? arg1 : ((arg2 instanceof Error) ? arg2 : null);
          finalize(error, results);
        });
        return;
      }

      Promise.resolve(this.classifier.classify(this.video))
        .then((results) => finalize(null, results))
        .catch((error) => finalize(error, []));
    } catch (error) {
      finalize(error, []);
    }
  }

  ingestClassificationResults(results) {
    const topResult = Array.isArray(results) ? results[0] : null;
    const normalized = normalizeLabel(topResult?.label);
    const mapped = this.config.input.labelsToVectors[normalized] ?? this.config.input.labelsToVectors.neutral;
    this.currentLabel = topResult?.label ?? "Neutral";
    this.predictedVector.x = mapped.x;
    this.predictedVector.y = mapped.y;
  }

  getKeyboardVector() {
    let x = 0;
    let y = 0;

    if (this.keyState.ArrowLeft) {
      x -= 1;
    }
    if (this.keyState.ArrowRight) {
      x += 1;
    }
    if (this.keyState.ArrowUp) {
      y -= 1;
    }
    if (this.keyState.ArrowDown) {
      y += 1;
    }

    return { x, y };
  }

  setupKeyboardListeners() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  teardownKeyboardListeners() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  handleKeyDown(event) {
    if (event.code === "Escape") {
      event.preventDefault();
      this.handleAction("BACK");
      return;
    }

    if (event.code === "KeyR") {
      event.preventDefault();
      this.handleAction("RESET_LEVEL");
      return;
    }

    if (event.code === "Enter") {
      event.preventDefault();
      this.handleAction("NEXT_LEVEL");
      return;
    }

    if (!(event.code in this.keyState)) {
      return;
    }

    event.preventDefault();
    this.keyState[event.code] = true;
  }

  handleKeyUp(event) {
    if (!(event.code in this.keyState)) {
      return;
    }

    event.preventDefault();
    this.keyState[event.code] = false;
  }

  generateStars() {
    this.starLayers.far = this.createStarLayer(this.config.stars.far);
    this.starLayers.mid = this.createStarLayer(this.config.stars.mid);
    this.starLayers.near = this.createStarLayer(this.config.stars.near);
  }

  createStarLayer(definition) {
    const stars = [];
    for (let i = 0; i < definition.count; i += 1) {
      stars.push({
        x: Math.random() * this.config.canvas.width,
        y: Math.random() * this.config.canvas.height,
        size: definition.minSize + Math.random() * (definition.maxSize - definition.minSize),
        phase: Math.random() * Math.PI * 2,
        speed: definition.minSpeed + Math.random() * (definition.maxSpeed - definition.minSpeed),
      });
    }
    return stars;
  }

  updateStatusText() {
    const level = this.getCurrentLevel();
    this.statusPill.textContent = `Gravity Weaver - ${level.title} (${this.levelIndex + 1}/${this.levels.length})`;
  }

  updateDebugPanel() {
    const level = this.getCurrentLevel();
    const now = this.levelFinishedAt || performance.now();
    const elapsedMs = now - this.levelStartedAt;

    this.root.querySelector('[data-role="level-name"]').textContent = `${this.levelIndex + 1}. ${level.title}`;
    this.root.querySelector('[data-role="input-source"]').textContent = this.inputSource;
    this.root.querySelector('[data-role="ml-label"]').textContent = this.currentLabel;
    this.root.querySelector('[data-role="gravity-target"]').textContent = `${this.targetGravity.x.toFixed(2)}, ${this.targetGravity.y.toFixed(2)}`;
    this.root.querySelector('[data-role="gravity-current"]').textContent = `${this.currentGravity.x.toFixed(2)}, ${this.currentGravity.y.toFixed(2)}`;
    this.root.querySelector('[data-role="level-time"]').textContent = formatMs(elapsedMs);
    this.root.querySelector('[data-role="par-time"]').textContent = formatMs(level.parTimeMs);
    this.root.querySelector('[data-role="collision-count"]').textContent = String(this.metrics.collisions);
    this.root.querySelector('[data-role="attempt-count"]').textContent = String(this.metrics.attempts);
    this.root.querySelector('[data-role="ml-state"]').textContent = this.mlState;
  }

  handleRuntimeError(error) {
    this.state = "error";
    this.stateMessage = error.message;
    this.statusPill.textContent = "Error de render en Gravity Weaver";
    this.modal.show({
      title: "Error de render en Gravity Weaver",
      message: error.message,
    });
    console.error(error);
  }

  destroy() {
    this.destroyed = true;
    this.exit();
    this.teardownKeyboardListeners();
    this.modal?.hide();
    this.sketch?.remove();
    this.video?.remove();

    const tracks = this.cameraStream?.getTracks?.() ?? [];
    tracks.forEach((track) => track.stop());
    this.cameraStream = null;
  }
}
