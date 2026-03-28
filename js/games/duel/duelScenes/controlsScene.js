import { MenuButton } from "../../../shared/ui/menuButton.js";
import { drawImageRect } from "../renderUtils.js";

const CONTROL_CARDS = [
  { gesture: "Mano abierta izquierda", detail: "Disparo de Player 1. En menus, mano abierta confirma" },
  { gesture: "Mano abierta derecha", detail: "Disparo de Player 2. Si no hay handedness, usa cuatro dedos como respaldo" },
  { gesture: "Indice a la izquierda", detail: "Mover seleccion a la izquierda" },
  { gesture: "Indice a la derecha", detail: "Mover seleccion a la derecha" },
  { gesture: "Dos dedos", detail: "Bajar" },
  { gesture: "Tres dedos", detail: "Subir" },
];

export class ControlsScene {
  constructor(game) {
    this.game = game;
    this.continueButton = new MenuButton({
      label: "Continuar",
      x: game.config.canvas.width / 2,
      y: game.config.canvas.height - 96,
      width: 340,
      height: 82,
      description: "Enter o mano abierta para continuar",
    });
  }

  enter(payload = {}) {
    this.returnScene = payload.fromMenu ? "main-menu" : "main-menu";
    this.game.state.hasSeenControls = true;
  }

  update() {}

  render(p5) {
    const background = this.game.assets.shared.menuBackground;
    p5.background("#050b13");

    if (background) {
      drawImageRect(p5, background, 0, 0, p5.width, p5.height, { alpha: 0.28 });
    }

    p5.push();
    p5.noStroke();
    p5.fill("rgba(4, 10, 18, 0.78)");
    p5.rect(120, 56, p5.width - 240, p5.height - 112, 30);
    p5.pop();

    p5.push();
    p5.textAlign(p5.LEFT, p5.TOP);
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(44);
    p5.text("Controles y reglas base", 132, 114);
    p5.textFont("IBM Plex Sans");
    p5.textSize(18);
    p5.fill("#b5c0d3");
    p5.text("Durante menus usas navegacion por gestos. En combate local, cada jugador tiene su propio disparo y solo cuenta un disparo por jugador dentro de la ventana valida.", 132, 172, p5.width - 264);
    p5.pop();

    CONTROL_CARDS.forEach((item, index) => {
      const x = 132 + (index % 2) * 500;
      const y = 242 + Math.floor(index / 2) * 104;
      p5.push();
      p5.fill(index < 2 ? "rgba(62, 193, 182, 0.2)" : "rgba(17, 28, 45, 0.84)");
      p5.stroke("rgba(179, 202, 229, 0.18)");
      p5.rect(x, y, 460, 78, 18);
      p5.noStroke();
      p5.fill("#f4f7fb");
      p5.textFont("Space Grotesk");
      p5.textSize(22);
      p5.text(item.gesture, x + 24, y + 22);
      p5.textFont("IBM Plex Sans");
      p5.textSize(15);
      p5.fill("#b5c0d3");
      p5.text(item.detail, x + 24, y + 48, 400);
      p5.pop();
    });

    p5.push();
    p5.fill("#9fb1c8");
    p5.textFont("IBM Plex Sans");
    p5.textSize(17);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text("Teclado local: F dispara Player 1, K dispara Player 2", p5.width / 2, p5.height - 162);
    p5.pop();

    this.continueButton.draw(p5, { active: true });
  }

  handleAction(action) {
    if (["CONFIRM", "SHOOT", "SHOOT_LEFT", "SHOOT_RIGHT", "BACK"].includes(action)) {
      this.game.sceneManager.change(this.returnScene);
    }
  }

  exit() {}
  getStatusText() { return "Duel - Controles"; }
  getGestureMap() {
    return {
      OPEN_PALM: "CONFIRM",
      OPEN_PALM_LEFT: "CONFIRM",
      OPEN_PALM_RIGHT: "CONFIRM",
    };
  }
}
