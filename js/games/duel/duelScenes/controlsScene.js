import { MenuButton } from "../../../shared/ui/menuButton.js";

const CONTROL_CARDS = [
  { gesture: "Mano abierta", detail: "Seleccionar / confirmar / continuar / disparar" },
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
      y: game.config.canvas.height - 84,
      width: 280,
      height: 76,
      description: "Tambien puedes usar Enter o mano abierta",
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
      p5.tint(255, 70);
      p5.image(background, 0, 0, p5.width, p5.height);
      p5.noTint();
    }

    p5.push();
    p5.noStroke();
    p5.fill("rgba(4, 10, 18, 0.72)");
    p5.rect(90, 70, p5.width - 180, p5.height - 140, 28);
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
    p5.text("Durante menus usas navegacion por gestos. En combate, la mano abierta dispara durante la ventana valida.", 132, 172, p5.width - 264);
    p5.pop();

    CONTROL_CARDS.forEach((item, index) => {
      const x = 132 + (index % 2) * 490;
      const y = 250 + Math.floor(index / 2) * 118;
      p5.push();
      p5.fill(index === 0 ? "rgba(62, 193, 182, 0.2)" : "rgba(17, 28, 45, 0.84)");
      p5.stroke("rgba(179, 202, 229, 0.18)");
      p5.rect(x, y, 420, 90, 18);
      p5.noStroke();
      p5.fill("#f4f7fb");
      p5.textFont("Space Grotesk");
      p5.textSize(26);
      p5.text(item.gesture, x + 24, y + 22);
      p5.textFont("IBM Plex Sans");
      p5.textSize(16);
      p5.fill("#b5c0d3");
      p5.text(item.detail, x + 24, y + 56);
      p5.pop();
    });

    this.continueButton.draw(p5, { active: true });
  }

  handleAction(action) {
    if (action === "CONFIRM" || action === "SHOOT" || action === "BACK") {
      this.game.sceneManager.change(this.returnScene);
    }
  }

  exit() {}
  getStatusText() { return "Duel - Controles"; }
  getGestureMap() {
    return { OPEN_PALM: "CONFIRM" };
  }
}
