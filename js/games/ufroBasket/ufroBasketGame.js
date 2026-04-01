import { SceneManager } from "../../shared/sceneManager.js";
import { Modal } from "../../shared/ui/modal.js";
import { createGameSidebar } from "../../shared/ui/gameSidebar.js";
import { ufroBasketConfig } from "./config.js";
import { loadUfroBasketAssets } from "./ufroBasketAssets.js";
import { BasketInputController } from "./basketInputController.js";
import { MainMenuScene } from "./scenes/mainMenuScene.js";
import { FreePlayScene } from "./scenes/freePlayScene.js";
import { getDrawableSource } from "./renderUtils.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class UfroBasketGame {
  constructor({ root, router }) {
    this.root = root;
    this.router = router;
    this.config = ufroBasketConfig;
    this.assets = null;
    this.modal = null;
    this.sketch = null;
    this.sceneManager = null;
    this.currentSceneKey = null;
    this.inputController = null;
    this.gameSidebar = null;
    this.actionQueue = [];
    this.spaceHeld = false;
    this.cloudPhase = 0;
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  mount() {
    this.root.innerHTML = `
      <main class="game-shell app-shell ufrobasket-shell">
        <div class="game-shell__canvas"></div>
        <div class="game-shell__hud">
          <div class="game-shell__topbar">
            <div class="pill" data-role="status">Inicializando UfroBasket...</div>
            <div class="pill game-shell__controls-pill">Espacio o puño cerrado = cargar | Soltar espacio o mano abierta = lanzar | Enter confirmar | Esc salir</div>
          </div>
          <aside class="game-shell__tm-panel soft-panel">
            <div class="game-shell__tm-title">Camara de tiro</div>
            <div class="game-shell__tm-webcam" data-role="tm-webcam"></div>
            <div class="game-shell__tm-status" data-role="tm-status">Preparando camara...</div>
            <button class="launcher-btn game-shell__tm-button" type="button" data-role="tm-start">Iniciar camara</button>
            <div class="game-shell__tm-labels" data-role="tm-labels"></div>
          </aside>
        </div>
      </main>
    `;

    this.shell = this.root.querySelector(".game-shell");
    this.canvasContainer = this.root.querySelector(".game-shell__canvas");
    this.statusPill = this.root.querySelector('[data-role="status"]');
    this.tmWebcamRoot = this.root.querySelector('[data-role="tm-webcam"]');
    this.tmStatusNode = this.root.querySelector('[data-role="tm-status"]');
    this.tmStartButton = this.root.querySelector('[data-role="tm-start"]');
    this.tmLabelRoot = this.root.querySelector('[data-role="tm-labels"]');
    this.modal = new Modal(this.shell);
    this.gameSidebar = createGameSidebar({
      onNavigate: (route) => this.router.navigate(route),
      onBack: () => this.router.back(),
    });
    this.shell.appendChild(this.gameSidebar.element);

    this.start().catch((error) => {
      this.modal.show({ title: "No se pudo iniciar UfroBasket", message: error.message });
      console.error(error);
    });
  }

  async start() {
    const p5Promise = window.__p5Ready ?? (window.p5 ? Promise.resolve(window.p5) : Promise.reject(new Error("p5.js no pudo cargarse")));
    const ml5Promise = window.__ml5Ready ?? (window.ml5 ? Promise.resolve(window.ml5) : Promise.reject(new Error("ml5.js no pudo cargarse")));
    await Promise.all([p5Promise, ml5Promise]);
    this.assets = await loadUfroBasketAssets();
    if (this.assets.meta.missing.length > 0) {
      console.warn("Assets faltantes detectados en UfroBasket:", this.assets.meta.missing);
    }
    this.configureScenes();
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.setupInputController();
    this.sketch = new window.p5(this.createSketch());
  }

  configureScenes() {
    this.sceneManager = new SceneManager({ game: this });
    this.sceneManager.register("menu", new MainMenuScene(this));
    this.sceneManager.register("free-play", new FreePlayScene(this));
    this.sceneManager.onChange((scene, key) => {
      this.currentSceneKey = key;
      this.statusPill.textContent = scene.getStatusText?.() ?? `UfroBasket - ${key}`;
    });
  }

  setupInputController() {
    this.inputController = new BasketInputController({
      config: this.config,
      webcamRoot: this.tmWebcamRoot,
      labelRoot: this.tmLabelRoot,
      statusNode: this.tmStatusNode,
      startButton: this.tmStartButton,
      getSceneKey: () => this.currentSceneKey,
      onAction: (action, source) => this.enqueueAction(action, source),
    });
    this.inputController.mount();
    this.inputController.tryAutoStart();
  }

  handleKeyDown(event) {
    const code = event.code;
    let action = null;

    if (code === this.config.controls.chargeKey) {
      if (!this.spaceHeld) {
        this.spaceHeld = true;
        action = "START_CHARGE";
      }
    } else if (code === this.config.controls.confirmKey) {
      action = "CONFIRM";
    } else if (code === this.config.controls.backKey) {
      action = "BACK";
    } else if (this.config.controls.navPrev.includes(code)) {
      action = "NAV_LEFT";
    } else if (this.config.controls.navNext.includes(code)) {
      action = "NAV_RIGHT";
    }

    if (!action) {
      return;
    }

    event.preventDefault();
    this.enqueueAction(action, "keyboard");
  }

  handleKeyUp(event) {
    if (event.code !== this.config.controls.chargeKey) {
      return;
    }

    event.preventDefault();
    if (this.spaceHeld) {
      this.spaceHeld = false;
      this.enqueueAction("RELEASE_SHOT", "keyboard");
    }
  }

  enqueueAction(action, source = "system") {
    this.actionQueue.push({ action, source, at: performance.now() });
  }

  consumeActions() {
    const actions = [...this.actionQueue];
    this.actionQueue.length = 0;
    return actions;
  }

  createSketch() {
    return (p5) => {
      let lastTime = 0;
      let accumulator = 0;

      const resizeCanvas = () => {
        const parentWidth = this.canvasContainer.clientWidth || window.innerWidth;
        const parentHeight = this.canvasContainer.clientHeight || window.innerHeight;
        const scale = Math.min(parentWidth / this.config.canvas.width, parentHeight / this.config.canvas.height);
        p5.resizeCanvas(this.config.canvas.width, this.config.canvas.height);
        p5.canvas.style.width = `${this.config.canvas.width * scale}px`;
        p5.canvas.style.height = `${this.config.canvas.height * scale}px`;
        p5.canvas.style.margin = "0 auto";
      };

      p5.setup = () => {
        const canvas = p5.createCanvas(this.config.canvas.width, this.config.canvas.height);
        canvas.parent(this.canvasContainer);
        p5.noSmooth();
        p5.pixelDensity(1);
        lastTime = performance.now();
        resizeCanvas();
        this.sceneManager.change("menu");
      };

      p5.draw = () => {
        const now = performance.now();
        const frameTime = clamp((now - lastTime) / 1000, 0, this.config.physics.maxFrameTime);
        lastTime = now;
        accumulator += frameTime;
        this.cloudPhase += frameTime;

        const actions = this.consumeActions();
        actions.forEach((entry) => this.sceneManager.handleAction(entry.action, entry));

        let substeps = 0;
        while (accumulator >= this.config.physics.fixedStep && substeps < this.config.physics.maxSubsteps) {
          this.sceneManager.update(this.config.physics.fixedStep);
          accumulator -= this.config.physics.fixedStep;
          substeps += 1;
        }

        if (substeps === this.config.physics.maxSubsteps) {
          accumulator = 0;
        }

        this.sceneManager.render(p5);
      };

      p5.windowResized = () => resizeCanvas();
    };
  }

  drawBackground(p5) {
    p5.background("#7ec7ff");
    const image = getDrawableSource(this.assets?.background);
    if (image) {
      p5.drawingContext.drawImage(image, 0, 0, p5.width, p5.height);
    }
  }

  drawClouds(p5, intensity = 1) {
    const cloud = getDrawableSource(this.assets?.cloud);
    if (!cloud) {
      return;
    }

    const baseY = 82;
    const drift = this.cloudPhase * 24 * intensity;
    [
      { x: 120, y: baseY },
      { x: 520, y: baseY + 34 },
      { x: 930, y: baseY - 12 },
    ].forEach((entry, index) => {
      const width = 180 + index * 28;
      const height = width * 0.48;
      const x = (entry.x + drift * (0.28 + index * 0.08)) % (p5.width + 280) - 140;
      p5.drawingContext.drawImage(cloud, x, entry.y, width, height);
    });
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.modal?.hide();
    this.inputController?.destroy();
    this.sketch?.remove();
    this.sceneManager?.destroy();
    this.gameSidebar?.destroy();
  }
}
