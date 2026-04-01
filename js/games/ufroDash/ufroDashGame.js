import { GestureController } from "../../shared/input/gestureController.js";
import { HandposeAdapter } from "../../shared/input/handposeAdapter.js";
import { Modal } from "../../shared/ui/modal.js";
import { ufroDashLevel } from "./levelData.js";
import { loadUfroDashAssets } from "./ufroDashAssets.js";

const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 720;
const MENU_OPTIONS = ["JUGAR", "SALIR"];
const PAUSE_OPTIONS = ["Reiniciar nivel", "Volver al menu", "Salir a libreria"];
const MENU_ACTION_MAP = {
  OPEN_PALM: "CONFIRM",
  OPEN_PALM_LEFT: "CONFIRM",
  OPEN_PALM_RIGHT: "CONFIRM",
  LEFT_INDEX: "NAV_LEFT",
  RIGHT_INDEX: "NAV_RIGHT",
  TWO_FINGERS: "NAV_DOWN",
  THREE_FINGERS: "NAV_UP",
};
const PLAY_ACTION_MAP = {
  OPEN_PALM: "JUMP",
  OPEN_PALM_LEFT: "JUMP",
  OPEN_PALM_RIGHT: "JUMP",
  THREE_FINGERS: "MENU",
};
const MAX_FRAME_TIME = 0.1;
const FIXED_STEP = 1 / 60;
const MAX_SUBSTEPS = 6;
const MENU_GESTURE_PROFILE = {
  persistenceMs: 170,
  navigationCooldownMs: 170,
  confirmCooldownMs: 220,
  shootCooldownMs: 220,
};
const PLAY_GESTURE_PROFILE = {
  persistenceMs: 80,
  navigationCooldownMs: 120,
  confirmCooldownMs: 120,
  shootCooldownMs: 120,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerpColor(a, b, amount) {
  return a.map((value, index) => value + (b[index] - value) * amount);
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function setRect(rect, left, top, right, bottom) {
  rect.left = left;
  rect.top = top;
  rect.right = right;
  rect.bottom = bottom;
  return rect;
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export class UfroDashGame {
  constructor({ root, router }) {
    this.root = root;
    this.router = router;
    this.level = ufroDashLevel;
    this.prepareLevelData();
    this.assets = null;
    this.modal = null;
    this.audio = null;
    this.sketch = null;
    this.backgroundLayer = null;
    this.panelPattern = null;
    this.groundPattern = null;
    this.handpose = new HandposeAdapter({
      maxHands: 1,
      detectIntervalMs: 33,
      videoWidth: 320,
      videoHeight: 240,
    });
    this.gestureController = new GestureController(this.handpose, {
      ...MENU_GESTURE_PROFILE,
    });
    this.state = "boot";
    this.menuIndex = 0;
    this.pauseIndex = 0;
    this.progress = 0;
    this.cameraX = 0;
    this.statusMessage = "Inicializando UfroDash...";
    this.activeObstacleStart = 0;
    this.activeObstacleEnd = 0;
    this.visibleObstacles = [];
    this.playerRect = null;
    this.previousPlayerRect = { left: 0, top: 0, right: 0, bottom: 0 };
    this.obstacleRect = { left: 0, top: 0, right: 0, bottom: 0 };
    this.lastGroundedAt = 0;
    this.lastJumpPressedAt = 0;
    this.jumpQueued = false;
    this.coyoteTimeMs = 90;
    this.jumpBufferMs = 110;
    this.frameNow = 0;
    this.player = this.createPlayerState();

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  prepareLevelData() {
    this.level.obstacles.forEach((obstacle) => {
      obstacle.right = obstacle.x + obstacle.width;
      obstacle.bottom = obstacle.y + obstacle.height;
    });
  }

  createPlayerState() {
    const bottom = this.level.groundY - 10;
    return {
      worldX: this.level.playerStartX,
      y: bottom - this.level.playerSize / 2,
      velocityY: 0,
      rotation: 0,
      grounded: true,
      pulse: 0,
    };
  }

  mount() {
    this.root.innerHTML = `
      <main class="game-shell app-shell ufrodash-shell">
        <div class="game-shell__canvas"></div>
        <div class="game-shell__hud">
          <div class="game-shell__topbar">
            <div class="pill" data-role="status">Inicializando UfroDash...</div>
            <div class="pill game-shell__controls-pill">A/D mover menu | Space/W/Flecha arriba saltar | Enter confirmar | Esc volver</div>
          </div>
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
      this.modal.show({
        title: "No se pudo iniciar UfroDash",
        message: error.message,
      });
      console.error(error);
    });
  }

  async start() {
    const p5Promise = window.__p5Ready ?? (window.p5 ? Promise.resolve(window.p5) : Promise.reject(new Error("p5.js no pudo cargarse")));
    const ml5Promise = window.__ml5Ready ?? (window.ml5 ? Promise.resolve(window.ml5) : Promise.reject(new Error("ml5.js no pudo cargarse")));
    const [assets] = await Promise.all([loadUfroDashAssets(), p5Promise, ml5Promise]);

    this.assets = assets;
    this.audio = new Audio(this.assets.audioSrc);
    this.audio.preload = "auto";
    this.audio.volume = 0.45;
    this.audio.addEventListener("ended", () => {
      if (this.state === "playing") {
        this.completeLevel();
      }
    });

    window.addEventListener("keydown", this.handleKeyDown);
    this.sketch = new window.p5(this.createSketch());
    this.setState("controls");
    this.initializeCamera();
  }

  async initializeCamera() {
    try {
      await this.handpose.init();
      if (this.handpose.video && this.cameraPanel) {
        this.cameraPanel.classList.remove("hidden");
        this.cameraPanel.innerHTML = "";
        this.cameraPanel.appendChild(this.handpose.video);
      }
    } catch (error) {
      console.error("No se pudo inicializar HandPose en UfroDash:", error);
      this.modal.show({
        title: "Gestos no disponibles",
        message: `El juego sigue con teclado. Detalle: ${error.message}`,
        dismissLabel: "Seguir",
        autoHideMs: 4200,
      });
    }
  }

  createSketch() {
    return (p5) => {
      let lastTime = 0;
      let accumulator = 0;

      const resizeCanvas = () => {
        const parentWidth = this.canvasContainer.clientWidth || window.innerWidth;
        const parentHeight = this.canvasContainer.clientHeight || window.innerHeight;
        const scale = Math.min(parentWidth / DESIGN_WIDTH, parentHeight / DESIGN_HEIGHT);
        p5.resizeCanvas(DESIGN_WIDTH, DESIGN_HEIGHT);
        p5.canvas.style.width = `${DESIGN_WIDTH * scale}px`;
        p5.canvas.style.height = `${DESIGN_HEIGHT * scale}px`;
        p5.canvas.style.margin = "0 auto";
      };

      p5.setup = () => {
        const canvas = p5.createCanvas(DESIGN_WIDTH, DESIGN_HEIGHT);
        canvas.parent(this.canvasContainer);
        p5.noSmooth();
        p5.pixelDensity(1);
        this.prepareStaticLayers();
        this.groundPattern = this.panelPattern ? p5.drawingContext.createPattern(this.panelPattern, "repeat") : null;
        lastTime = performance.now();
        resizeCanvas();
      };

      p5.draw = () => {
        const now = performance.now();
        const frameTime = clamp((now - lastTime) / 1000, 0, MAX_FRAME_TIME);
        lastTime = now;
        accumulator += frameTime;
        this.updateInput(now);

        let substeps = 0;
        while (accumulator >= FIXED_STEP && substeps < MAX_SUBSTEPS) {
          this.stepSimulation(FIXED_STEP);
          accumulator -= FIXED_STEP;
          substeps += 1;
        }

        if (substeps === MAX_SUBSTEPS) {
          accumulator = 0;
        }

        this.render(p5);
      };

      p5.windowResized = () => resizeCanvas();
    };
  }

  prepareStaticLayers() {
    const backgroundLayer = createCanvas(DESIGN_WIDTH, DESIGN_HEIGHT);
    const bg = backgroundLayer.getContext("2d");
    bg.imageSmoothingEnabled = false;
    const gradient = bg.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
    gradient.addColorStop(0, "#2dc2ff");
    gradient.addColorStop(0.55, "#0b86e2");
    gradient.addColorStop(1, "#0461c6");
    bg.fillStyle = gradient;
    bg.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        const x = col * 140 + (row % 2) * 28;
        const y = 46 + row * 102;
        bg.fillStyle = row % 2 === 0 ? "rgba(17, 133, 227, 0.52)" : "rgba(13, 113, 209, 0.56)";
        bg.fillRect(x, y, 116, 84);
        bg.strokeStyle = "rgba(109, 214, 255, 0.34)";
        bg.lineWidth = 3;
        bg.strokeRect(x, y, 116, 84);
      }
    }

    const panelPattern = createCanvas(96, 96);
    const patternCtx = panelPattern.getContext("2d");
    patternCtx.imageSmoothingEnabled = false;
    patternCtx.fillStyle = "rgba(255, 255, 255, 0.06)";
    patternCtx.fillRect(0, 0, 96, 8);
    patternCtx.fillRect(0, 0, 8, 96);
    patternCtx.fillStyle = "rgba(0, 0, 0, 0.12)";
    patternCtx.fillRect(88, 0, 8, 96);
    patternCtx.fillRect(0, 88, 96, 8);

    this.backgroundLayer = backgroundLayer;
    this.panelPattern = panelPattern;
  }

  setState(nextState) {
    this.state = nextState;
    if (nextState !== "playing") {
      this.jumpQueued = false;
    }

    if (nextState === "playing") {
      this.gestureController.setActionMap(PLAY_ACTION_MAP);
      this.gestureController.setTimings(PLAY_GESTURE_PROFILE);
      this.updateStatus("Nivel 1 - UfroDash");
      return;
    }

    this.gestureController.setActionMap(MENU_ACTION_MAP);
    this.gestureController.setTimings(MENU_GESTURE_PROFILE);

    const labels = {
      controls: "UfroDash - Controles",
      menu: "UfroDash listo",
      paused: "Pausa",
      failed: "Intento fallido",
      complete: "Nivel completado",
    };
    this.updateStatus(labels[nextState] ?? "UfroDash");
  }

  updateInput(now = performance.now()) {
    this.frameNow = now;
    const actions = this.handpose.status === "ready" ? this.gestureController.update(now) : [];
    actions.forEach((event) => this.handleAction(event.action));

    if (this.state !== "playing") {
      this.jumpQueued = false;
    }
  }

  stepSimulation(dt) {
    if (this.state !== "playing") {
      return;
    }

    this.consumeQueuedJump();

    const previousRect = this.computePlayerRect(this.previousPlayerRect);
    this.player.worldX += this.level.speed * dt;
    this.player.velocityY += this.level.gravity * dt;
    this.player.y += this.player.velocityY * dt;
    this.player.rotation += this.player.grounded ? 0 : 520 * dt;
    this.player.pulse += dt * 7;

    this.cameraX = Math.max(0, this.player.worldX - 240);
    this.updateVisibleObstacles();

    let landingTop = this.level.groundY - 10;
    for (const obstacle of this.visibleObstacles) {
      if (obstacle.type !== "block") {
        continue;
      }

      const obstacleLeft = obstacle.x;
      const obstacleRight = obstacle.right;
      const horizontalOverlap = previousRect.right - 6 > obstacleLeft && previousRect.left + 6 < obstacleRight;

      if (horizontalOverlap && previousRect.bottom <= obstacle.y + 10 && this.player.velocityY >= 0) {
        landingTop = Math.min(landingTop, obstacle.y);
      }
    }

    if (this.player.y + this.level.playerSize / 2 >= landingTop) {
      this.player.y = landingTop - this.level.playerSize / 2;
      this.player.velocityY = 0;
      this.player.grounded = true;
      this.lastGroundedAt = this.frameNow;
      this.player.rotation = Math.round(this.player.rotation / 90) * 90;
    } else {
      if (this.player.grounded) {
        this.lastGroundedAt = this.frameNow;
      }
      this.player.grounded = false;
    }

    this.playerRect = this.computePlayerRect(this.playerRect);

    for (const obstacle of this.visibleObstacles) {
      const obstacleRect = setRect(this.obstacleRect, obstacle.x, obstacle.y, obstacle.right, obstacle.bottom);

      if (!rectsOverlap(this.playerRect, obstacleRect)) {
        continue;
      }

      if (obstacle.type === "spike") {
        this.failLevel();
        return;
      }

      const hitFromTop = previousRect.bottom <= obstacle.y + 10 && this.playerRect.bottom <= obstacle.y + 18;
      const hitFromBelow = previousRect.top >= obstacleRect.bottom - 10 && this.player.velocityY < 0;
      const hitFromFront = previousRect.right <= obstacleRect.left + 10 && this.playerRect.right >= obstacleRect.left + 6;

      if (!hitFromTop && (hitFromFront || hitFromBelow || !this.player.grounded)) {
        this.failLevel();
        return;
      }
    }

    this.progress = clamp(this.player.worldX / this.level.length, 0, 1);
    if (this.player.worldX >= this.level.length) {
      this.completeLevel();
    }
  }

  queueJump() {
    this.lastJumpPressedAt = this.frameNow || performance.now();
    this.jumpQueued = true;
  }

  canUseCoyoteTime() {
    return (this.frameNow - this.lastGroundedAt) <= this.coyoteTimeMs;
  }

  consumeQueuedJump() {
    if (!this.jumpQueued) {
      return;
    }

    if ((this.frameNow - this.lastJumpPressedAt) > this.jumpBufferMs) {
      this.jumpQueued = false;
      return;
    }

    if (!this.player.grounded && !this.canUseCoyoteTime()) {
      return;
    }

    this.player.velocityY = this.level.jumpVelocity;
    this.player.grounded = false;
    this.jumpQueued = false;
    this.lastGroundedAt = -Infinity;
  }

  updateVisibleObstacles() {
    const leftBound = this.cameraX - 120;
    const rightBound = this.cameraX + 1480;
    const obstacles = this.level.obstacles;
    const previousStart = this.activeObstacleStart;
    const previousEnd = this.activeObstacleEnd;

    while (
      this.activeObstacleStart < obstacles.length &&
      obstacles[this.activeObstacleStart].right < leftBound
    ) {
      this.activeObstacleStart += 1;
    }

    this.activeObstacleEnd = Math.max(this.activeObstacleEnd, this.activeObstacleStart);
    while (
      this.activeObstacleEnd < obstacles.length &&
      obstacles[this.activeObstacleEnd].x <= rightBound
    ) {
      this.activeObstacleEnd += 1;
    }

    if (previousStart === this.activeObstacleStart && previousEnd === this.activeObstacleEnd) {
      return;
    }

    this.visibleObstacles.length = 0;
    for (let index = this.activeObstacleStart; index < this.activeObstacleEnd; index += 1) {
      this.visibleObstacles.push(obstacles[index]);
    }
  }

  computePlayerRect(target = null) {
    const nextTarget = target ?? { left: 0, top: 0, right: 0, bottom: 0 };
    const half = this.level.playerSize / 2 - 4;
    return setRect(
      nextTarget,
      this.player.worldX - half,
      this.player.y - half,
      this.player.worldX + half,
      this.player.y + half,
    );
  }

  handleKeyDown(event) {
    if (["Space", "ArrowUp", "KeyW", "Enter"].includes(event.code)) {
      event.preventDefault();
      if (this.state === "playing") {
        this.handleAction("JUMP");
      } else {
        this.handleAction("CONFIRM");
      }
      return;
    }

    if (["ArrowLeft", "KeyA"].includes(event.code)) {
      this.handleAction("NAV_LEFT");
      return;
    }

    if (["ArrowRight", "KeyD"].includes(event.code)) {
      this.handleAction("NAV_RIGHT");
      return;
    }

    if (["Escape", "KeyM"].includes(event.code)) {
      this.handleAction(this.state === "playing" ? "MENU" : "BACK");
    }
  }

  handleAction(action) {
    if (this.state === "controls") {
      if (["CONFIRM", "BACK"].includes(action)) {
        this.setState("menu");
      }
      return;
    }

    if (this.state === "menu") {
      if (["NAV_LEFT", "NAV_UP"].includes(action)) {
        this.menuIndex = 0;
      }
      if (["NAV_RIGHT", "NAV_DOWN"].includes(action)) {
        this.menuIndex = 1;
      }
      if (action === "BACK") {
        this.router.navigate("launcher");
      }
      if (action === "CONFIRM") {
        if (this.menuIndex === 0) {
          this.beginLevel();
        } else {
          this.router.navigate("launcher");
        }
      }
      return;
    }

    if (this.state === "playing") {
      if (action === "JUMP") {
        this.queueJump();
      }
      if (action === "MENU") {
        this.openPauseMenu();
      }
      return;
    }

    if (["paused", "failed", "complete"].includes(this.state)) {
      if (["NAV_LEFT", "NAV_UP"].includes(action)) {
        this.pauseIndex = (this.pauseIndex - 1 + PAUSE_OPTIONS.length) % PAUSE_OPTIONS.length;
      }
      if (["NAV_RIGHT", "NAV_DOWN"].includes(action)) {
        this.pauseIndex = (this.pauseIndex + 1) % PAUSE_OPTIONS.length;
      }
      if (action === "BACK") {
        if (this.state === "paused") {
          this.resumeLevel();
        } else {
          this.stopAudio();
          this.pauseIndex = 0;
          this.setState("menu");
        }
      }
      if (action === "CONFIRM") {
        if (this.pauseIndex === 0) {
          this.restartLevel();
        } else if (this.pauseIndex === 1) {
          this.stopAudio();
          this.pauseIndex = 0;
          this.setState("menu");
        } else {
          this.router.navigate("launcher");
        }
      }
    }
  }

  beginLevel() {
    this.pauseIndex = 0;
    this.resetPlayer();
    this.playAudioFromStart();
    this.setState("playing");
  }

  resetPlayer() {
    this.player = this.createPlayerState();
    this.cameraX = 0;
    this.progress = 0;
    this.activeObstacleStart = 0;
    this.activeObstacleEnd = 0;
    this.visibleObstacles.length = 0;
    this.frameNow = performance.now();
    this.lastGroundedAt = this.frameNow;
    this.lastJumpPressedAt = 0;
    this.jumpQueued = false;
    this.playerRect = this.computePlayerRect();
    this.updateVisibleObstacles();
  }

  restartLevel() {
    this.beginLevel();
  }

  failLevel() {
    if (this.state !== "playing") {
      return;
    }

    this.pauseIndex = 0;
    this.stopAudio();
    this.setState("failed");
  }

  completeLevel() {
    if (this.state !== "playing") {
      return;
    }

    this.pauseIndex = 0;
    this.stopAudio();
    this.setState("complete");
  }

  openPauseMenu() {
    this.pauseIndex = 0;
    this.audio?.pause();
    this.setState("paused");
  }

  resumeLevel() {
    this.audio?.play().catch(() => {});
    this.setState("playing");
  }

  playAudioFromStart() {
    if (!this.audio) {
      return;
    }

    this.audio.currentTime = 0;
    this.audio.play().catch(() => {});
  }

  stopAudio() {
    if (!this.audio) {
      return;
    }

    this.audio.pause();
    this.audio.currentTime = 0;
  }

  updateStatus(message) {
    this.statusMessage = message;
    if (this.statusPill) {
      this.statusPill.textContent = message;
    }
  }

  render(p5) {
    this.drawBackground(p5);

    if (this.state === "playing" || ["paused", "failed", "complete"].includes(this.state)) {
      this.drawGround(p5);
      this.drawLevel(p5);
      this.drawPlayer(p5);
      this.drawHud(p5);
    }

    if (this.state === "controls") {
      this.drawControlsScreen(p5);
    }

    if (this.state === "menu") {
      this.drawMainMenu(p5);
    }

    if (["paused", "failed", "complete"].includes(this.state)) {
      this.drawPauseOverlay(p5);
    }
  }

  drawBackground(p5) {
    p5.background("#0b84df");
    if (this.backgroundLayer) {
      p5.drawingContext.drawImage(this.backgroundLayer, 0, 0, p5.width, p5.height);
    }

    const offset = -((this.cameraX * 0.1) % 144);
    p5.push();
    p5.noStroke();
    for (let x = offset - 144; x < p5.width + 144; x += 144) {
      p5.fill("rgba(120, 228, 255, 0.09)");
      p5.rect(x, 0, 32, p5.height);
      p5.fill("rgba(255, 255, 255, 0.08)");
      p5.rect(x + 82, 0, 10, p5.height);
    }
    p5.fill("rgba(0, 0, 0, 0.08)");
    p5.rect(0, 0, p5.width, p5.height);
    p5.pop();
  }

  drawGround(p5) {
    const groundTop = this.level.groundY;
    p5.push();
    p5.noStroke();
    p5.fill("#1d2bd1");
    p5.rect(0, groundTop, p5.width, p5.height - groundTop);
    p5.fill("#394cff");
    p5.rect(0, groundTop - 12, p5.width, 12);
    p5.fill("rgba(145, 255, 255, 0.26)");
    p5.rect(0, groundTop - 18, p5.width, 6);
    p5.pop();

    if (this.groundPattern) {
      const ctx = p5.drawingContext;
      ctx.save();
      ctx.fillStyle = this.groundPattern;
      ctx.globalAlpha = 0.24;
      ctx.fillRect(0, groundTop + 6, p5.width, p5.height - groundTop);
      ctx.restore();
    }
  }

  drawLevel(p5) {
    for (const obstacle of this.visibleObstacles) {
      const drawX = Math.round(obstacle.x - this.cameraX);
      if (obstacle.type === "block") {
        this.drawBlock(p5, drawX, obstacle.y, obstacle.width, obstacle.height);
      } else {
        for (let index = 0; index < obstacle.count; index += 1) {
          this.drawSpike(p5, drawX + index * this.level.tile, obstacle.y, this.level.tile);
        }
      }
    }
  }

  drawBlock(p5, x, y, width, height) {
    p5.push();
    p5.noStroke();
    p5.fill("#56f86e");
    p5.rect(x, y, width, height, 4);
    p5.fill("#1bb033");
    p5.rect(x + 5, y + 5, width - 10, height - 10, 3);
    p5.fill("rgba(255, 255, 255, 0.22)");
    p5.rect(x + 7, y + 7, width - 14, 7, 2);
    p5.fill("rgba(8, 32, 17, 0.26)");
    p5.rect(x + 8, y + height - 14, width - 16, 7, 2);
    p5.pop();
  }

  drawSpike(p5, x, y, size) {
    p5.push();
    p5.noStroke();
    p5.fill("#ffef75");
    p5.triangle(x, y + size, x + size / 2, y, x + size, y + size);
    p5.fill("#ff9a17");
    p5.triangle(x + 8, y + size - 2, x + size / 2, y + 12, x + size - 8, y + size - 2);
    p5.fill("rgba(255,255,255,0.32)");
    p5.triangle(x + size / 2 - 5, y + 13, x + size / 2 + 5, y + 13, x + size / 2, y + 3);
    p5.pop();
  }

  drawPlayer(p5) {
    const size = this.level.playerSize;
    const drawX = Math.round(this.player.worldX - this.cameraX);
    const pulse = Math.sin(this.player.pulse) * 2;

    p5.push();
    p5.translate(drawX, Math.round(this.player.y));
    p5.rotate(p5.radians(this.player.rotation));
    p5.rectMode(p5.CENTER);
    p5.noStroke();
    p5.fill("rgba(0, 0, 0, 0.22)");
    p5.rect(4, 6, size, size, 8);
    p5.fill("#ffe94e");
    p5.rect(0, 0, size, size, 8);
    p5.fill("#ffb400");
    p5.rect(0, 0, size - 12, size - 12, 6);
    p5.fill("#283c22");
    p5.rect(-10, -6, 8, 8, 2);
    p5.rect(10, -6, 8, 8, 2);
    p5.fill("#fff5bb");
    p5.rect(-10, -6 + pulse * 0.12, 3, 3, 1);
    p5.rect(10, -6 + pulse * 0.12, 3, 3, 1);
    p5.fill("#283c22");
    p5.rect(0, 12, 20, 5, 3);
    p5.pop();
  }

  drawHud(p5) {
    const progressLabel = `${Math.round(this.progress * 100)}%`;
    p5.push();
    p5.noStroke();
    p5.fill("rgba(4, 12, 24, 0.42)");
    p5.rect(28, 72, 240, 20, 999);
    p5.fill("#8dff4d");
    p5.rect(28, 72, 240 * this.progress, 20, 999);
    p5.fill("#f4f7fb");
    p5.textAlign(p5.RIGHT, p5.CENTER);
    p5.textFont("IBM Plex Sans");
    p5.textSize(16);
    p5.text(progressLabel, 260, 82);
    p5.pop();
  }

  drawControlsScreen(p5) {
    p5.push();
    p5.fill("rgba(3, 12, 24, 0.34)");
    p5.rect(0, 0, p5.width, p5.height);
    p5.fill("rgba(4, 16, 30, 0.78)");
    p5.rect(118, 72, p5.width - 236, p5.height - 144, 26);
    p5.pop();

    this.drawTitleBlock(p5, "UFRODASH", 640, 106, 72);

    p5.push();
    p5.fill("#dcf9ff");
    p5.textAlign(p5.CENTER, p5.TOP);
    p5.textFont("Space Grotesk");
    p5.textSize(30);
    p5.text("Controles", p5.width / 2, 184);
    p5.textFont("IBM Plex Sans");
    p5.textSize(18);
    p5.fill("#d2eef8");
    p5.text("Antes de empezar: puedes jugar con teclado aunque la camara falle.", p5.width / 2, 226);
    p5.pop();

    const cards = [
      { x: 170, y: 280, title: "Teclado", lines: ["A / D: mover menu", "Space / W / Flecha arriba: saltar", "Enter: confirmar", "Esc: volver o pausar"] },
      { x: 660, y: 280, title: "Gestos", lines: ["Mano abierta: confirmar o saltar", "2 dedos: bajar en menu o pausa", "3 dedos: subir en menu o pausa", "Durante el nivel, 3 dedos abre el menu"] },
    ];

    cards.forEach((card) => {
      p5.push();
      p5.noStroke();
      p5.fill("rgba(12, 36, 62, 0.92)");
      p5.rect(card.x, card.y, 450, 190, 18);
      p5.fill("rgba(108, 255, 106, 0.88)");
      p5.rect(card.x, card.y, 450, 18, 18, 18, 0, 0);
      p5.fill("#f4ffcf");
      p5.textAlign(p5.LEFT, p5.TOP);
      p5.textFont("Space Grotesk");
      p5.textSize(26);
      p5.text(card.title, card.x + 26, card.y + 34);
      p5.textFont("IBM Plex Sans");
      p5.textSize(18);
      p5.fill("#d6eaf8");
      card.lines.forEach((line, index) => {
        p5.text(line, card.x + 26, card.y + 82 + index * 28);
      });
      p5.pop();
    });

    this.drawActionButton(p5, "Continuar", p5.width / 2, 586, 320, 74, true);

    p5.push();
    p5.fill("#c9f3ff");
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textFont("IBM Plex Sans");
    p5.textSize(17);
    p5.text("Enter o mano abierta para continuar", p5.width / 2, 670);
    p5.pop();
  }

  drawMainMenu(p5) {
    p5.push();
    p5.noStroke();
    p5.fill("rgba(0, 0, 0, 0.16)");
    p5.rect(0, 0, p5.width, p5.height);
    p5.pop();

    this.drawMenuOrb(p5, 88, 82, [153, 255, 88], [52, 159, 35]);
    this.drawMenuOrb(p5, 1188, 82, [255, 203, 78], [223, 127, 28]);
    this.drawTitleBlock(p5, "UFRODASH", p5.width / 2, 62, 84);

    p5.push();
    p5.fill("rgba(0, 0, 0, 0.09)");
    p5.rect(368, 208, 544, 250, 24);
    p5.pop();

    this.drawPlayButton(p5, p5.width / 2, 326, 152, 152, this.menuIndex === 0);
    this.drawActionButton(p5, MENU_OPTIONS[0], 488, 594, 250, 78, this.menuIndex === 0);
    this.drawActionButton(p5, MENU_OPTIONS[1], 792, 594, 250, 78, this.menuIndex === 1);

    p5.push();
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textFont("IBM Plex Sans");
    p5.textSize(19);
    p5.fill("#d8f5ff");
    p5.text("Enter o mano abierta para elegir", p5.width / 2, 674);
    p5.textSize(16);
    p5.fill("rgba(235, 250, 255, 0.82)");
    p5.text("A / D o indice lateral para cambiar. 2 dedos baja y 3 dedos sube en menu.", p5.width / 2, 706);
    p5.pop();
  }

  drawTitleBlock(p5, text, x, y, size) {
    const letters = text.split("");
    const step = size * 0.76;
    const totalWidth = step * (letters.length - 1);
    let cursor = x - totalWidth / 2;

    letters.forEach((letter) => {
      if (letter === " ") {
        cursor += step * 0.55;
        return;
      }

      this.drawPixelLetter(p5, letter, cursor, y, size);
      cursor += step;
    });
  }

  drawPixelLetter(p5, letter, centerX, y, size) {
    p5.push();
    p5.textAlign(p5.CENTER, p5.TOP);
    p5.textFont("Space Grotesk");
    p5.textStyle(p5.BOLD);
    p5.textSize(size);

    for (let outline = 10; outline >= 4; outline -= 3) {
      p5.fill(outline === 10 ? "#314112" : "#4d7f15");
      p5.text(letter, centerX + outline / 2, y + outline / 2);
    }

    p5.fill("#98ff54");
    p5.text(letter, centerX, y);
    p5.fill("rgba(249, 255, 195, 0.82)");
    p5.text(letter, centerX - 1, y - 4);
    p5.pop();
  }

  drawMenuOrb(p5, x, y, innerColor, outerColor) {
    p5.push();
    p5.noStroke();
    p5.fill(...outerColor, 255);
    p5.circle(x, y, 58);
    p5.fill(...innerColor, 255);
    p5.circle(x, y, 44);
    p5.fill("rgba(255,255,255,0.75)");
    p5.circle(x - 7, y - 7, 12);
    p5.pop();
  }

  drawPlayButton(p5, x, y, width, height, active) {
    const glow = active ? 1 : 0;
    const outer = lerpColor([92, 204, 44], [134, 255, 88], glow);
    const inner = lerpColor([63, 170, 24], [92, 208, 42], glow);

    p5.push();
    p5.rectMode(p5.CENTER);
    p5.noStroke();
    p5.fill(...outer, 255);
    p5.rect(x, y, width, height, 18);
    p5.fill(...inner, 255);
    p5.rect(x, y, width - 26, height - 26, 14);
    p5.fill(active ? "#f7ffcf" : "#dff8a0");
    p5.triangle(x - 16, y - 31, x - 16, y + 31, x + 40, y);
    p5.pop();

  }

  drawActionButton(p5, label, x, y, width, height, active) {
    p5.push();
    p5.rectMode(p5.CENTER);
    p5.noStroke();
    p5.fill(active ? "rgba(151, 255, 95, 0.96)" : "rgba(12, 57, 96, 0.9)");
    p5.rect(x, y, width, height, 16);
    p5.stroke(active ? "rgba(250,255,215,0.95)" : "rgba(181, 214, 255, 0.54)");
    p5.strokeWeight(3);
    p5.noFill();
    p5.rect(x, y, width, height, 16);
    p5.noStroke();
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textFont("Space Grotesk");
    p5.textStyle(p5.BOLD);
    p5.textSize(30);
    p5.fill(active ? "#133412" : "#f3fbff");
    p5.text(label, x, y + 1);
    p5.pop();
  }

  drawPauseOverlay(p5) {
    p5.push();
    p5.fill("rgba(4, 8, 18, 0.72)");
    p5.rect(0, 0, p5.width, p5.height);
    p5.fill("rgba(8, 24, 42, 0.92)");
    p5.rect(302, 122, 676, 462, 24);
    p5.pop();

    const titleMap = {
      paused: "PAUSA",
      failed: "FALLASTE",
      complete: "GANASTE",
    };

    const subtitleMap = {
      paused: "Reinicia el nivel, vuelve al menu o sal a la libreria.",
      failed: "Tocaste un obstaculo. Intentalo otra vez.",
      complete: "Buen trabajo. Llegaste al final del recorrido.",
    };

    p5.push();
    p5.fill("#f7ffca");
    p5.textAlign(p5.CENTER, p5.TOP);
    p5.textFont("Space Grotesk");
    p5.textStyle(p5.BOLD);
    p5.textSize(56);
    p5.text(titleMap[this.state], p5.width / 2, 160);
    p5.textFont("IBM Plex Sans");
    p5.textStyle(p5.NORMAL);
    p5.textSize(18);
    p5.fill("#d5deeb");
    p5.text(subtitleMap[this.state], p5.width / 2, 240);
    p5.pop();

    PAUSE_OPTIONS.forEach((label, index) => {
      this.drawActionButton(p5, label, p5.width / 2, 354 + index * 92, 370, 70, this.pauseIndex === index);
    });
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    this.stopAudio();
    this.audio = null;
    this.handpose.dispose();
    this.modal?.hide();
    this.sketch?.remove();
  }
}
