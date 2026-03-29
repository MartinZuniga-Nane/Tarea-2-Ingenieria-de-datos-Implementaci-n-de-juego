import { Modal } from "../../shared/ui/modal.js";
import { createGameSidebar } from "../../shared/ui/gameSidebar.js";
import { Astronaut } from "./astronaut.js";
import { gravityWeaverConfig } from "./config.js";
import { loadGravityWeaverAssets } from "./gravityWeaverAssets.js";
import { LevelManager } from "./levelManager.js";
import { loadLeaderboard, pushLeaderboardEntry } from "./scoreboard.js";
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

function getDrawableSource(image) {
  if (!image) {
    return null;
  }

  return image.canvas || image.elt || image;
}

function sanitizeAlias(input) {
  return String(input ?? "")
    .trim()
    .replace(/\s+/g, " ");
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

    this.assets = {
      images: {},
      missing: [],
    };

    this.currentGravity = { x: 0, y: 0 };
    this.targetGravity = { x: 0, y: 0 };
    this.predictedVector = { x: 0, y: 0 };
    this.currentLabel = "Neutral";
    this.inputSource = "keyboard";

    this.state = "idle";
    this.stateMessage = "Inicializando Gravity Weaver...";
    this.mlState = "idle";
    this.playerAlias = "";
    this.aliasConfirmed = false;
    this.leaderboard = [];

    this.score = {
      campaignTotal: 0,
      levelCurrent: 0,
      levelLive: 0,
      campaignProjected: 0,
      levelOrbs: 0,
      campaignOrbs: 0,
      campaignCollisions: 0,
      campaignSaved: false,
      levelBreakdowns: [],
      liveBreakdown: {
        timePenalty: 0,
        collisionPenalty: 0,
        orbBonus: 0,
      },
    };

    this.animation = {
      state: "idle",
      baseState: "idle",
      frameIndex: 0,
      elapsedMs: 0,
      holdUntil: 0,
      flipX: false,
      boostWeight: 0,
      impactUntil: 0,
      tilt: 0,
      impactFlashAlpha: 0,
      screenShakeUntil: 0,
      screenShakeStrength: 0,
      gravityDelta: 0,
    };

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
    this.handleAliasSubmit = this.handleAliasSubmit.bind(this);
    this.handleAliasKeyDown = this.handleAliasKeyDown.bind(this);

    this.video = null;
    this.classifier = null;
    this.cameraStream = null;
    this.classifyTimeoutId = null;
    this.destroyed = false;
    this.modal = null;
    this.gameSidebar = null;
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
              <dt>Animacion</dt><dd data-role="anim-state">-</dd>
              <dt>Boost</dt><dd data-role="boost-weight">0.00</dd>
              <dt>Alias</dt><dd data-role="player-alias">-</dd>
              <dt>Score nivel</dt><dd data-role="level-score">0</dd>
              <dt>Score campana</dt><dd data-role="campaign-score">0</dd>
              <dt>Orbes nivel</dt><dd data-role="level-orbs">0</dd>
              <dt>Orbes campana</dt><dd data-role="campaign-orbs">0</dd>
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
          <section data-role="alias-overlay" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(4,8,18,0.8);z-index:12;pointer-events:auto;">
            <form data-role="alias-form" style="width:min(520px,92vw);padding:24px;border-radius:16px;background:rgba(8,13,28,0.95);border:1px solid rgba(120,170,255,0.45);display:flex;flex-direction:column;gap:12px;pointer-events:auto;">
              <h3 style="margin:0;color:#ebf2ff;font-size:28px;font-family:'Space Grotesk',sans-serif;">Ingresa tu alias</h3>
              <p style="margin:0;color:#aebad9;">Se usara para registrar tu score al finalizar la campana.</p>
              <input data-role="alias-input" type="text" maxlength="16" placeholder="Ejemplo: AstroRunner" style="padding:10px 12px;border-radius:10px;border:1px solid rgba(140,173,255,0.45);background:rgba(10,16,34,0.9);color:#ebf2ff;" required />
              <button type="submit" style="padding:10px 14px;border:none;border-radius:10px;background:#5f92ff;color:#f2f7ff;font-weight:600;cursor:pointer;">Comenzar Campana</button>
              <small data-role="alias-error" style="min-height:18px;color:#ffb8a7;"></small>
            </form>
          </section>
        </div>
      </main>
    `;

    this.shell = this.root.querySelector(".game-shell");
    this.canvasContainer = this.root.querySelector(".game-shell__canvas");
    this.statusPill = this.root.querySelector('[data-role="status"]');
    this.topbar = this.root.querySelector(".game-shell__topbar");
    this.debugPanel = this.root.querySelector('[data-role="debug-panel"]');
    this.cameraPanel = this.root.querySelector('[data-role="camera-panel"]');
    this.aliasOverlay = this.root.querySelector('[data-role="alias-overlay"]');
    this.aliasForm = this.root.querySelector('[data-role="alias-form"]');
    this.aliasInput = this.root.querySelector('[data-role="alias-input"]');
    this.aliasError = this.root.querySelector('[data-role="alias-error"]');
    this.modal = new Modal(this.shell);
    this.gameSidebar = createGameSidebar({
      onNavigate: (route) => this.router.navigate(route),
      onBack: () => this.router.back(),
    });
    this.shell.appendChild(this.gameSidebar.element);
    this.topbar?.classList.add("hidden");
    this.debugPanel?.classList.add("hidden");
    this.cameraPanel?.classList.add("hidden");
    this.aliasForm?.addEventListener("submit", this.handleAliasSubmit);
    this.aliasInput?.addEventListener("keydown", this.handleAliasKeyDown);

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
    const assetsPromise = loadGravityWeaverAssets(this.config);

    const [assets] = await Promise.all([
      assetsPromise,
      p5Promise,
      ml5Promise,
    ]);

    this.assets = assets;
    if (this.assets.missing.length > 0) {
      console.warn("Gravity Weaver assets faltantes:", this.assets.missing);
    }

    this.leaderboard = loadLeaderboard(this.config.score.storageKey);

    this.setupKeyboardListeners();
    this.generateStars();
    this.state = "awaiting-alias";
    this.statusPill.textContent = "Ingresa tu alias para comenzar";

    this.sketch = new window.p5(this.createSketch());
    this.initializeMachineLearning();
    this.aliasInput?.focus();
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
          this.update(dt, now);
          this.render(p5, now);
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

  handleAliasSubmit(event) {
    event.preventDefault();
    const alias = sanitizeAlias(this.aliasInput?.value ?? "");
    const isValid = /^[A-Za-z0-9_-]{3,16}$/.test(alias);

    if (!isValid) {
      if (this.aliasError) {
        this.aliasError.textContent = "Alias invalido. Usa 3-16 caracteres: letras, numeros, guion o underscore.";
      }
      return;
    }

    this.playerAlias = alias;
    this.aliasConfirmed = true;
    if (this.aliasError) {
      this.aliasError.textContent = "";
    }
    this.aliasOverlay?.classList.add("hidden");
    this.resetCampaignProgress();
    this.enter();
  }

  handleAliasKeyDown(event) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    this.aliasForm?.requestSubmit();
  }

  resetCampaignProgress() {
    this.levelIndex = 0;
    this.metrics.attempts = 1;
    this.score.campaignTotal = 0;
    this.score.levelCurrent = 0;
    this.score.levelLive = 0;
    this.score.campaignProjected = 0;
    this.score.levelOrbs = 0;
    this.score.campaignOrbs = 0;
    this.score.campaignCollisions = 0;
    this.score.campaignSaved = false;
    this.score.levelBreakdowns = [];
    this.score.liveBreakdown.timePenalty = 0;
    this.score.liveBreakdown.collisionPenalty = 0;
    this.score.liveBreakdown.orbBonus = 0;
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
    this.score.levelOrbs = 0;
    this.score.levelCurrent = 0;
    this.score.levelLive = this.config.score.baseLevelScore;
    this.score.campaignProjected = this.score.campaignTotal + this.score.levelLive;
    this.score.liveBreakdown.timePenalty = 0;
    this.score.liveBreakdown.collisionPenalty = 0;
    this.score.liveBreakdown.orbBonus = 0;

    this.currentGravity.x = 0;
    this.currentGravity.y = 0;
    this.targetGravity.x = 0;
    this.targetGravity.y = 0;

    this.animation.state = "idle";
    this.animation.baseState = "idle";
    this.animation.frameIndex = 0;
    this.animation.elapsedMs = 0;
    this.animation.boostWeight = 0;
    this.animation.impactUntil = 0;
    this.animation.impactFlashAlpha = 0;
    this.animation.holdUntil = performance.now();

    this.updateStatusText();
    this.updateDebugPanel();
  }

  getCurrentLevel() {
    return this.levels[this.levelIndex];
  }

  update(dtSeconds, now) {
    if (this.state === "error") {
      return;
    }

    if (this.state === "awaiting-alias") {
      this.updateDebugPanel();
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

    const deltaX = this.targetGravity.x - this.currentGravity.x;
    const deltaY = this.targetGravity.y - this.currentGravity.y;
    this.animation.gravityDelta = Math.hypot(deltaX, deltaY);

    const lerpFactor = 1 - Math.pow(1 - this.config.physics.gravityLerp, dtSeconds * 60);
    this.currentGravity.x += deltaX * lerpFactor;
    this.currentGravity.y += deltaY * lerpFactor;

    this.astronaut.applyForce({
      x: this.currentGravity.x * this.config.physics.gravityForce,
      y: this.currentGravity.y * this.config.physics.gravityForce,
    });

    this.astronaut.update(dtSeconds, this.config);
    const collisionsInFrame = this.levelManager.resolveCollisions(this.astronaut);
    this.metrics.collisions += collisionsInFrame;

    const collectedOrbs = this.levelManager.collectOrbs(this.astronaut);
    if (collectedOrbs > 0) {
      this.score.levelOrbs += collectedOrbs;
      this.score.campaignOrbs += collectedOrbs;
    }

    this.computeLiveLevelScore(now);

    if (collisionsInFrame > 0) {
      this.animation.impactUntil = now + this.config.assets.impactMs;
      this.animation.screenShakeUntil = now + this.config.assets.impactMs;
      this.animation.screenShakeStrength = 2.6;
    }

    this.resolveAnimationState(now);
    this.advanceAnimation(dtSeconds * 1000, now);

    if (this.levelManager.checkPortal(this.astronaut)) {
      this.completeCurrentLevel(now);
    }

    this.updateDebugPanel();
  }

  resolveAnimationState(now) {
    const velocity = this.astronaut.velocity;
    const speed = Math.hypot(velocity.x, velocity.y);
    const gravityMagnitude = Math.hypot(this.currentGravity.x, this.currentGravity.y);
    const boostTarget = (
      gravityMagnitude > this.config.assets.boostThreshold
      || this.animation.gravityDelta > this.config.assets.gravityDeltaThreshold
    ) ? 1 : 0;

    const boostLerp = boostTarget > this.animation.boostWeight ? 0.2 : 0.1;
    this.animation.boostWeight += (boostTarget - this.animation.boostWeight) * boostLerp;
    this.animation.boostWeight = clamp(this.animation.boostWeight, 0, 1);

    let baseState = "idle";
    if (speed > this.config.assets.deadzoneSpeed) {
      if (Math.abs(velocity.x) >= Math.abs(velocity.y)) {
        baseState = velocity.x < 0 ? "left" : "right";
      } else {
        baseState = velocity.y < 0 ? "up" : "down";
      }
    }

    this.animation.baseState = baseState;

    let nextState = baseState;
    if (now < this.animation.impactUntil) {
      nextState = "impact";
    } else if (this.animation.boostWeight > 0.55 && baseState !== "idle") {
      nextState = "boost";
    }

    const holdElapsed = now >= this.animation.holdUntil;
    if (nextState !== this.animation.state && (holdElapsed || nextState === "impact")) {
      this.animation.state = nextState;
      this.animation.frameIndex = 0;
      this.animation.elapsedMs = 0;
      this.animation.holdUntil = now + this.config.assets.stateHoldMs;
    }

    const targetTilt = clamp(velocity.x / this.config.physics.maxSpeed, -1, 1)
      * (this.config.assets.tiltMaxDeg * Math.PI / 180);
    this.animation.tilt += (targetTilt - this.animation.tilt) * this.config.assets.tiltLerp;
  }

  advanceAnimation(dtMs, now) {
    const spriteResolution = this.resolveSpriteFrames(this.animation.state);
    const frames = spriteResolution.frames;
    this.animation.flipX = spriteResolution.flip;

    if (!frames || frames.length === 0) {
      this.animation.frameIndex = 0;
      this.animation.elapsedMs = 0;
      return;
    }

    const frameDuration = this.config.assets.frameDurationByState[this.animation.state] ?? this.config.assets.frameDurationMs;
    this.animation.elapsedMs += dtMs;
    while (this.animation.elapsedMs >= frameDuration) {
      this.animation.elapsedMs -= frameDuration;
      this.animation.frameIndex = (this.animation.frameIndex + 1) % frames.length;
    }

    const impactLeft = Math.max(0, this.animation.impactUntil - now);
    const impactDuration = Math.max(1, this.config.assets.impactMs);
    const impactRatio = impactLeft / impactDuration;
    this.animation.impactFlashAlpha = impactRatio * this.config.assets.impactFlashAlpha;

    if (now >= this.animation.screenShakeUntil) {
      this.animation.screenShakeStrength = 0;
    }
  }

  resolveSpriteFrames(state) {
    const map = this.config.assets.spriteMap;
    if (state === "right" && this.config.assets.flipRightFromLeft && !map.right?.length) {
      return {
        frames: map.left ?? map.idle,
        flip: true,
      };
    }

    return {
      frames: map[state] ?? map.idle,
      flip: false,
    };
  }

  getActiveSpriteFrame() {
    const resolution = this.resolveSpriteFrames(this.animation.state);
    const frames = resolution.frames;
    if (!frames || frames.length === 0) {
      return {
        frame: null,
        flip: resolution.flip,
      };
    }

    const safeIndex = clamp(this.animation.frameIndex, 0, frames.length - 1);
    return {
      frame: frames[safeIndex],
      flip: resolution.flip,
    };
  }

  computeLiveLevelScore(now) {
    const elapsedMs = Math.max(0, now - this.levelStartedAt);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const timePenalty = elapsedSeconds * this.config.score.timePenaltyPerSecond;
    const collisionPenalty = this.metrics.collisions * this.config.score.collisionPenaltyEach;
    const orbBonus = this.score.levelOrbs * this.config.score.orbBonusEach;
    const levelLive = Math.max(
      0,
      this.config.score.baseLevelScore - timePenalty - collisionPenalty + orbBonus,
    );

    this.score.liveBreakdown.timePenalty = timePenalty;
    this.score.liveBreakdown.collisionPenalty = collisionPenalty;
    this.score.liveBreakdown.orbBonus = orbBonus;
    this.score.levelLive = levelLive;
    this.score.campaignProjected = this.score.campaignTotal + levelLive;

    return {
      elapsedMs,
      levelLive,
      timePenalty,
      collisionPenalty,
      orbBonus,
    };
  }

  completeCurrentLevel(now) {
    const level = this.getCurrentLevel();
    const live = this.computeLiveLevelScore(now);
    const elapsedMs = live.elapsedMs;
    const levelScore = live.levelLive;
    const timePenalty = live.timePenalty;
    const collisionPenalty = live.collisionPenalty;
    const orbBonus = live.orbBonus;

    this.score.levelCurrent = levelScore;
    this.score.campaignTotal += levelScore;
    this.score.campaignProjected = this.score.campaignTotal;
    this.score.campaignCollisions += this.metrics.collisions;
    this.score.levelBreakdowns.push({
      levelId: level.id,
      title: level.title,
      elapsedMs,
      collisions: this.metrics.collisions,
      orbs: this.score.levelOrbs,
      levelScore,
      penalties: {
        timePenalty,
        collisionPenalty,
      },
      bonuses: {
        orbBonus,
      },
    });

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
      this.statusPill.textContent = `Nivel superado: ${level.title} (+${levelScore} pts). Presiona Enter para continuar`;
      return;
    }

    this.state = "campaign-complete";
    this.statusPill.textContent = `Campana completada con ${this.score.campaignTotal} pts. Presiona Enter para reiniciar`;

    if (!this.score.campaignSaved) {
      this.leaderboard = pushLeaderboardEntry(
        this.config.score.storageKey,
        {
          alias: this.playerAlias,
          totalScore: this.score.campaignTotal,
          completedAt: Date.now(),
          totalCollisions: this.score.campaignCollisions,
          totalOrbs: this.score.campaignOrbs,
          levels: this.score.levelBreakdowns.length,
        },
        this.config.score.leaderboardSize,
      );
      this.score.campaignSaved = true;
    }
  }

  render(p5, now) {
    this.drawGhostLayer(p5);

    const shake = this.getScreenShakeOffset(now);
    p5.push();
    p5.translate(shake.x, shake.y);

    this.drawBackgroundCover(p5, this.assets.images.backgroundMain ?? null);
    this.drawNebula(p5);
    this.drawStars(p5, now / 1000);

    const pulse = (Math.sin(now / 1000 * this.config.level.glowPulseSpeed) + 1) * 0.5;
    this.levelManager.draw(p5, this.config.visuals, pulse, {
      obstaclesSheet: this.assets.images.obstaclesSheet ?? null,
      wallType: this.config.assets.obstacleSolidCrop,
      tileSize: this.config.assets.obstacleTileSize,
      now,
      orbConfig: this.config.orbs,
      portalImage: this.assets.images.portalImage ?? null,
    });

    const spriteData = this.getActiveSpriteFrame();
    const boostStretch = this.animation.boostWeight;
    this.astronaut.draw(p5, {
      astronautConfig: {
        ...this.config.astronaut,
        spriteScale: this.config.assets.astronautScale,
      },
      spriteSheet: this.assets.images.astronautSheet ?? null,
      spriteFrame: spriteData.frame,
      flipX: spriteData.flip,
      rotation: this.animation.tilt,
      scaleX: 1 + boostStretch * 0.09,
      scaleY: 1 - boostStretch * 0.05,
      boostWeight: this.animation.boostWeight,
      impactFlashAlpha: this.animation.impactFlashAlpha,
    });

    this.drawLevelOverlay(p5);
    p5.pop();

    if (this.state === "won-level") {
      this.drawEndCard(
        p5,
        "Nivel completado",
        `+${this.score.levelCurrent} pts | Enter: siguiente nivel | R: reintentar`,
      );
    }

    if (this.state === "campaign-complete") {
      this.drawEndCard(
        p5,
        `Score final: ${this.score.campaignTotal}`,
        "Enter: reiniciar campana | Esc: launcher",
      );
      this.drawLeaderboard(p5);
    }
  }

  drawLeaderboard(p5) {
    const leaderboardTop = this.leaderboard.slice(0, this.config.score.leaderboardSize);
    const panelX = p5.width / 2 - 260;
    const panelY = p5.height / 2 + 72;
    const panelWidth = 520;
    const rowHeight = 28;
    const panelHeight = 56 + (leaderboardTop.length * rowHeight);

    p5.push();
    p5.noStroke();
    p5.fill("rgba(7, 11, 26, 0.84)");
    p5.rect(panelX, panelY, panelWidth, panelHeight, 12);
    p5.fill(this.config.visuals.textColor);
    p5.textAlign(p5.LEFT, p5.TOP);
    p5.textFont("Space Grotesk");
    p5.textSize(20);
    p5.text("Scoreboard", panelX + 16, panelY + 12);

    p5.textFont("IBM Plex Sans");
    p5.textSize(14);
    leaderboardTop.forEach((entry, index) => {
      const isCurrent = entry.alias === this.playerAlias && entry.totalScore === this.score.campaignTotal;
      p5.fill(isCurrent ? "#ffe7b1" : this.config.visuals.textSoftColor);
      p5.text(
        `${index + 1}. ${entry.alias} - ${entry.totalScore} pts`,
        panelX + 16,
        panelY + 40 + (index * rowHeight),
      );
    });
    p5.pop();
  }

  drawBackgroundCover(p5, image) {
    const source = getDrawableSource(image);
    if (!source) {
      return;
    }

    const canvasRatio = p5.width / p5.height;
    const imageRatio = image.width / image.height;
    let sx = 0;
    let sy = 0;
    let sw = image.width;
    let sh = image.height;

    if (imageRatio > canvasRatio) {
      sw = image.height * canvasRatio;
      sx = (image.width - sw) / 2;
    } else {
      sh = image.width / canvasRatio;
      sy = (image.height - sh) / 2;
    }

    p5.push();
    p5.drawingContext.save();
    p5.drawingContext.globalAlpha = this.config.assets.backgroundAlpha;
    p5.drawingContext.drawImage(
      source,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      p5.width,
      p5.height,
    );
    p5.drawingContext.restore();
    p5.pop();
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

  drawStars(p5, time) {
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
    p5.textSize(24);
    p5.text(`Nivel ${this.levelIndex + 1} - ${level.title}`, 24, 24);
    p5.fill(this.config.visuals.textSoftColor);
    p5.textFont("IBM Plex Sans");
    p5.textSize(20);
    p5.text(`Puntos: ${this.score.levelLive}`, 24, 62);
    p5.text(`Total: ${this.score.campaignTotal}`, 24, 90);
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

  getScreenShakeOffset(now) {
    if (now >= this.animation.screenShakeUntil || this.animation.screenShakeStrength <= 0) {
      return { x: 0, y: 0 };
    }

    const ratio = (this.animation.screenShakeUntil - now) / Math.max(this.config.assets.impactMs, 1);
    const amplitude = this.animation.screenShakeStrength * ratio;
    return {
      x: (Math.random() * 2 - 1) * amplitude,
      y: (Math.random() * 2 - 1) * amplitude,
    };
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
      this.resetCampaignProgress();
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

    if (!this.aliasConfirmed || this.state === "awaiting-alias") {
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
    if (!this.aliasConfirmed || this.state === "awaiting-alias") {
      return;
    }

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
    if (this.state === "awaiting-alias") {
      this.statusPill.textContent = "Ingresa tu alias para comenzar";
      return;
    }

    const level = this.getCurrentLevel();
    this.statusPill.textContent = `Gravity Weaver - ${level.title} (${this.levelIndex + 1}/${this.levels.length})`;
  }

  updateDebugPanel() {
    const level = this.getCurrentLevel();
    const now = this.levelFinishedAt || performance.now();
    const elapsedMs = this.levelStartedAt > 0 ? now - this.levelStartedAt : 0;

    this.root.querySelector('[data-role="level-name"]').textContent = `${this.levelIndex + 1}. ${level.title}`;
    this.root.querySelector('[data-role="input-source"]').textContent = this.inputSource;
    this.root.querySelector('[data-role="ml-label"]').textContent = this.currentLabel;
    this.root.querySelector('[data-role="anim-state"]').textContent = this.animation.state;
    this.root.querySelector('[data-role="boost-weight"]').textContent = this.animation.boostWeight.toFixed(2);
    this.root.querySelector('[data-role="player-alias"]').textContent = this.playerAlias || "-";
    this.root.querySelector('[data-role="level-score"]').textContent = String(this.score.levelLive);
    this.root.querySelector('[data-role="campaign-score"]').textContent = String(this.score.campaignProjected);
    this.root.querySelector('[data-role="level-orbs"]').textContent = String(this.score.levelOrbs);
    this.root.querySelector('[data-role="campaign-orbs"]').textContent = String(this.score.campaignOrbs);
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
    this.aliasForm?.removeEventListener("submit", this.handleAliasSubmit);
    this.aliasInput?.removeEventListener("keydown", this.handleAliasKeyDown);
    this.modal?.hide();
    this.gameSidebar?.destroy();
    this.sketch?.remove();
    this.video?.remove();

    const tracks = this.cameraStream?.getTracks?.() ?? [];
    tracks.forEach((track) => track.stop());
    this.cameraStream = null;
  }
}
