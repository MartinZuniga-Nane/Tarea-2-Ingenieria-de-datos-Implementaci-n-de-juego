import { SceneManager } from "../../shared/sceneManager.js";
import { Modal } from "../../shared/ui/modal.js";
import { createGameSidebar } from "../../shared/ui/gameSidebar.js";
import { ufroVolleyConfig } from "./config.js";
import { loadUfroVolleyAssets } from "./ufroVolleyAssets.js";
import { UfroVolleyState } from "./ufroVolleyState.js";
import { getDrawableSource } from "./renderUtils.js";
import { HandTrackingController } from "./handTrackingController.js";
import { MainMenuScene } from "./scenes/mainMenuScene.js";
import { MatchScene } from "./scenes/matchScene.js";
import { ResultScene } from "./scenes/resultScene.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class UfroVolleyGame {
  constructor({ root, router }) {
    this.root = root;
    this.router = router;
    this.config = ufroVolleyConfig;
    this.state = new UfroVolleyState(this.config);
    this.sceneManager = null;
    this.assets = null;
    this.modal = null;
    this.sketch = null;
    this.gameSidebar = null;
    this.handTrackingController = null;
    this.currentSceneKey = null;
    this.actionQueue = [];
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  mount() {
    this.root.innerHTML = `
      <main class="game-shell app-shell">
        <div class="game-shell__canvas"></div>
        <div class="game-shell__hud">
          <div class="game-shell__topbar">
            <div class="pill" data-role="status">Inicializando UfroVolley...</div>
            <div class="pill game-shell__controls-pill">F o mano izquierda abierta = gatos | J o mano derecha abierta = perros | Enter confirmar | Esc salir</div>
          </div>
          <aside class="game-shell__tm-panel soft-panel">
            <div class="game-shell__tm-title">Camara de manos</div>
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
      this.modal.show({
        title: "No se pudo iniciar UfroVolley",
        message: error.message,
      });
      console.error(error);
    });
  }

  async start() {
    const p5Promise = window.__p5Ready ?? (window.p5 ? Promise.resolve(window.p5) : Promise.reject(new Error("p5.js no pudo cargarse")));
    const ml5Promise = window.__ml5Ready ?? (window.ml5 ? Promise.resolve(window.ml5) : Promise.reject(new Error("ml5.js no pudo cargarse")));
    await Promise.all([p5Promise, ml5Promise]);
    this.assets = await loadUfroVolleyAssets();
    if (this.assets.meta.missing.length > 0) {
      console.warn("Assets faltantes detectados en UfroVolley:", this.assets.meta.missing);
    }
    this.configureScenes();
    window.addEventListener("keydown", this.handleKeyDown);
    this.setupTeachableMachine();
    this.sketch = new window.p5(this.createSketch());
  }

  setupTeachableMachine() {
    this.handTrackingController = new HandTrackingController({
      config: this.config.handTracking,
      webcamRoot: this.tmWebcamRoot,
      labelRoot: this.tmLabelRoot,
      statusNode: this.tmStatusNode,
      startButton: this.tmStartButton,
      getSceneKey: () => this.currentSceneKey,
      onAction: (action, source) => this.enqueueAction(action, source),
    });
    this.handTrackingController.mount();
    this.handTrackingController.tryAutoStart();
  }

  configureScenes() {
    this.sceneManager = new SceneManager({ game: this });
    this.sceneManager.register("main-menu", new MainMenuScene(this));
    this.sceneManager.register("match", new MatchScene(this));
    this.sceneManager.register("result", new ResultScene(this));
    this.sceneManager.onChange((scene, key) => {
      this.currentSceneKey = key;
      this.statusPill.textContent = scene.getStatusText?.() ?? `UfroVolley - ${key}`;
    });
  }

  startNewMatch() {
    this.state.resetMatch();
    this.state.setPhase("match");
  }

  handleKeyDown(event) {
    const code = event.code;
    const controls = this.config.controls;
    let action = null;

    if (code === controls.leftJumpKey) {
      action = "JUMP_LEFT_TEAM";
    } else if (code === controls.rightJumpKey) {
      action = "JUMP_RIGHT_TEAM";
    } else if (code === controls.confirmKey) {
      action = "CONFIRM";
    } else if (code === controls.backKey) {
      action = "BACK";
    } else if (controls.navPrev.includes(code)) {
      action = "NAV_LEFT";
    } else if (controls.navNext.includes(code)) {
      action = "NAV_RIGHT";
    }

    if (!action) {
      return;
    }

    event.preventDefault();
    this.enqueueAction(action, "keyboard");
  }

  enqueueAction(action, source = "system") {
    this.actionQueue.push({
      source,
      action,
      at: performance.now(),
    });
  }

  showMatchControls({ onClose } = {}) {
    this.modal.show({
      title: "Controles de UfroVolley",
      message: "Teclado: F saltan los gatos y J saltan los perros.<br>Camara: mano izquierda abierta controla gatos y mano derecha abierta controla perros.<br>Enter confirma y Esc vuelve al menu.",
      dismissLabel: "Entendido",
      autoHideMs: this.config.intro.controlsAutoHideMs,
      onHide: onClose,
    });
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
        this.sceneManager.change("main-menu");
      };

      p5.draw = () => {
        const now = performance.now();
        const frameTime = clamp((now - lastTime) / 1000, 0, this.config.physics.maxFrameTime);
        lastTime = now;
        accumulator += frameTime;

        const actions = this.consumeActions();
        actions.forEach((action) => this.sceneManager.handleAction(action.action, action));

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

  drawCourtBackground(p5) {
    p5.background("#122645");
    const background = getDrawableSource(this.assets?.background);
    const courtLine = getDrawableSource(this.assets?.courtLine);
    if (background) {
      p5.drawingContext.drawImage(background, 0, 0, p5.width, p5.height);
    }
    if (courtLine) {
      p5.drawingContext.drawImage(courtLine, 0, 0, p5.width, p5.height);
    }
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    this.currentSceneKey = null;
    this.modal?.hide();
    this.handTrackingController?.destroy();
    this.sketch?.remove();
    this.sceneManager?.destroy();
    this.gameSidebar?.destroy();
  }
}
