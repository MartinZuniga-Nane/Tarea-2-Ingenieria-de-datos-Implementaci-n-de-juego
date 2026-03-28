import { SceneManager } from "../../shared/sceneManager.js";
import { GestureController } from "../../shared/input/gestureController.js";
import { HandposeAdapter } from "../../shared/input/handposeAdapter.js";
import { KeyboardFallback } from "../../shared/input/keyboardFallback.js";
import { Modal } from "../../shared/ui/modal.js";
import { duelConfig } from "./config.js";
import { DuelState } from "./duelState.js";
import { loadDuelAssets } from "./duelAssets.js";
import { createDuelSketch } from "./duelSketch.js";
import { SplashScene } from "./duelScenes/splashScene.js";
import { ControlsScene } from "./duelScenes/controlsScene.js";
import { MainMenuScene } from "./duelScenes/mainMenuScene.js";
import { PlayerSelectScene } from "./duelScenes/playerSelectScene.js";
import { StageSelectScene } from "./duelScenes/stageSelectScene.js";
import { VersusScene } from "./duelScenes/versusScene.js";
import { BattleScene } from "./duelScenes/battleScene.js";
import { ResultScene } from "./duelScenes/resultScene.js";

export class DuelGame {
  constructor({ root, router }) {
    this.root = root;
    this.router = router;
    this.config = duelConfig;
    this.state = new DuelState(duelConfig);
    this.keyboard = new KeyboardFallback();
    this.handpose = new HandposeAdapter({ debug: duelConfig.debug.enabled });
    this.gestureController = new GestureController(this.handpose, {
      persistenceMs: duelConfig.input.gesturePersistenceMs,
      navigationCooldownMs: duelConfig.input.navigationCooldownMs,
      confirmCooldownMs: duelConfig.input.confirmCooldownMs,
      shootCooldownMs: duelConfig.input.shootCooldownMs,
    });
    this.modal = null;
    this.assets = null;
    this.sceneManager = null;
    this.currentSceneKey = null;
    this.cameraOverlayCanvas = null;
    this.runtimeError = null;
  }

  mount() {
    this.root.innerHTML = `
      <main class="game-shell app-shell">
        <div class="game-shell__canvas"></div>
        <div class="game-shell__hud">
          <div class="game-shell__topbar">
            <div class="pill" data-role="status">Inicializando Duel...</div>
            <div class="pill">A/D/W/S navegar | Enter confirmar | F dispara P1 | K dispara P2 | Esc volver</div>
          </div>
          <aside class="game-shell__debug ${this.config.debug.enabled ? "" : "hidden"}" data-role="debug-panel">
            <h3>Debug HandPose</h3>
            <dl>
              <dt>Gesto</dt><dd data-role="debug-gesture">-</dd>
              <dt>Confianza</dt><dd data-role="debug-confidence">-</dd>
              <dt>Accion</dt><dd data-role="debug-action">-</dd>
              <dt>Camara</dt><dd data-role="debug-camera">-</dd>
            </dl>
          </aside>
          <aside class="game-shell__camera ${this.config.debug.showVideo ? "" : "hidden"}" data-role="camera-panel"></aside>
        </div>
      </main>
    `;

    this.shell = this.root.querySelector(".game-shell");
    this.canvasContainer = this.root.querySelector(".game-shell__canvas");
    this.statusPill = this.root.querySelector('[data-role="status"]');
    this.debugPanel = this.root.querySelector('[data-role="debug-panel"]');
    this.cameraPanel = this.root.querySelector('[data-role="camera-panel"]');
    this.modal = new Modal(this.shell);

    this.start().catch((error) => {
      this.modal.show({
        title: "No se pudo iniciar Duel",
        message: error.message,
      });
      console.error(error);
    });
  }

  async start() {
    const p5Promise = window.__p5Ready ?? (window.p5 ? Promise.resolve(window.p5) : Promise.reject(new Error("p5.js no pudo cargarse")));
    const ml5Promise = window.__ml5Ready ?? (window.ml5 ? Promise.resolve(window.ml5) : Promise.reject(new Error("ml5.js no pudo cargarse")));
    await Promise.all([p5Promise, ml5Promise]);

    this.assets = await loadDuelAssets();
    if (this.assets.meta.missing.length > 0) {
      console.warn("Assets faltantes detectados:", this.assets.meta.missing);
    }
    this.keyboard.start();

    this.configureScenes();
    this.sketch = new window.p5(createDuelSketch(this));
    this.initializeCamera();
  }

  async initializeCamera() {
    try {
      await this.handpose.init();
      this.modal.hide();
      if (this.handpose.video) {
        this.cameraPanel.classList.remove("hidden");
        this.cameraPanel.appendChild(this.handpose.video);
      }
    } catch (error) {
      this.modal.show({
        title: "Camara no disponible",
        message: "El juego seguira funcionando con teclado. Si quieres gestos, habilita permisos de camara y recarga la pagina.",
        dismissLabel: "Seguir sin camara",
        autoHideMs: 3200,
      });
    }
  }

  configureScenes() {
    this.sceneManager = new SceneManager({ game: this });

    this.sceneManager.register("splash", new SplashScene(this));
    this.sceneManager.register("controls", new ControlsScene(this));
    this.sceneManager.register("main-menu", new MainMenuScene(this));
    this.sceneManager.register("player-select", new PlayerSelectScene(this));
    this.sceneManager.register("stage-select", new StageSelectScene(this));
    this.sceneManager.register("versus", new VersusScene(this));
    this.sceneManager.register("battle", new BattleScene(this));
    this.sceneManager.register("result", new ResultScene(this));

    this.sceneManager.onChange((scene, key) => {
      this.currentSceneKey = key;
      this.statusPill.textContent = scene.getStatusText?.() ?? `Duel - ${key}`;
      this.gestureController.setActionMap(scene.getGestureMap?.() ?? {});
    });
  }

  onSketchReady() {
    this.sceneManager.change("splash");
  }

  update(dt) {
    const now = performance.now();
    const gestureActions = this.handpose.status === "ready" ? this.gestureController.update(now) : [];
    const keyboardActions = this.keyboard.consumeActions();
    const actions = [...gestureActions, ...keyboardActions];

    actions.forEach((event) => this.sceneManager.handleAction(event.action, event));
    this.sceneManager.update(dt);
    this.updateDebugPanel();
  }

  render(p5) {
    this.sceneManager.render(p5);
    this.drawGestureOverlay(p5);
  }

  updateDebugPanel() {
    if (!this.config.debug.enabled) {
      return;
    }

    const snapshot = this.gestureController.getDebugSnapshot();
    this.root.querySelector('[data-role="debug-gesture"]').textContent = snapshot.gesture;
    this.root.querySelector('[data-role="debug-confidence"]').textContent = snapshot.confidence.toFixed(2);
    this.root.querySelector('[data-role="debug-action"]').textContent = snapshot.action;
    this.root.querySelector('[data-role="debug-camera"]').textContent = snapshot.cameraStatus;
  }

  drawGestureOverlay(p5) {
    if (!this.handpose.video || !this.cameraPanel || (!this.config.debug.enabled && this.handpose.status !== "ready")) {
      return;
    }

    const snapshot = this.gestureController.getDebugSnapshot();
    const panel = this.cameraPanel;
    let canvas = this.cameraOverlayCanvas;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      canvas.className = "game-shell__camera-overlay";
      panel.appendChild(canvas);
      this.cameraOverlayCanvas = canvas;
    }

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!this.config.debug.enabled || !snapshot.landmarks?.length) {
      return;
    }

    ctx.fillStyle = "rgba(3, 8, 14, 0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#3ec1b6";
    snapshot.landmarks.forEach((point) => {
      const x = (point.x ?? point[0]) * (canvas.width / (this.handpose.video?.videoWidth || 640));
      const y = (point.y ?? point[1]) * (canvas.height / (this.handpose.video?.videoHeight || 480));
      ctx.beginPath();
      ctx.arc(canvas.width - x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  handleRuntimeError(error) {
    this.runtimeError = error;
    this.modal.show({
      title: "Error de render en Duel",
      message: error.message,
      dismissLabel: "Cerrar",
    });
    console.error(error);
  }

  goToLauncher() {
    this.router.navigate("launcher");
  }

  destroy() {
    this.keyboard.stop();
    this.handpose.dispose();
    this.sceneManager?.destroy();
    this.sketch?.remove();
    this.modal?.hide();
    this.cameraOverlayCanvas?.remove();
  }
}
