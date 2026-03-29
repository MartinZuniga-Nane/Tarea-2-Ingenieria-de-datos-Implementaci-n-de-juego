import { MenuButton } from "../../../shared/ui/menuButton.js";
import { createResultCopy } from "../systems/resultSystem.js";
import { drawImageRect } from "../renderUtils.js";

export class ResultScene {
  constructor(game) {
    this.game = game;
    this.buttons = [
      new MenuButton({ label: "Revancha", x: 640, y: 386, width: 452, height: 82, description: "Mismos personajes y mismo fondo" }),
      new MenuButton({ label: "Cambiar personajes", x: 640, y: 492, width: 452, height: 82, description: "Volver a la seleccion inicial" }),
      new MenuButton({ label: "Salir", x: 640, y: 598, width: 452, height: 82, description: "Regresar a la biblioteca" }),
    ];
    this.activeIndex = 0;
    this.copy = createResultCopy(null);
  }

  enter() {
    this.activeIndex = 0;
    this.copy = createResultCopy(this.game.state.lastBattle);
  }

  update() {}

  render(p5) {
    const stage = this.game.assets.shared.backgrounds[this.game.state.selectedStage];
    p5.background("#050b13");
    if (stage) {
      drawImageRect(p5, stage, 0, 0, p5.width, p5.height, { alpha: 0.28 });
    }

    p5.push();
    p5.fill("rgba(3, 8, 14, 0.62)");
    p5.noStroke();
    p5.rect(0, 0, p5.width, p5.height);
    p5.fill("rgba(6, 12, 20, 0.86)");
    p5.rect(170, 58, p5.width - 340, p5.height - 116, 34);
    p5.fill("rgba(11, 22, 35, 0.82)");
    p5.rect(214, 88, p5.width - 428, 170, 28);
    p5.pop();

    p5.push();
    p5.textAlign(p5.CENTER, p5.TOP);
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(48);
    p5.text(this.copy.title, p5.width / 2, 120);
    p5.textFont("IBM Plex Sans");
    p5.textSize(19);
    p5.fill("#b5c0d3");
    p5.text(this.copy.subtitle, p5.width / 2, 184);
    p5.textSize(15);
    p5.fill("#9fb1c8");
    p5.text("Elige la siguiente accion para continuar la partida.", p5.width / 2, 286);
    p5.pop();

    this.buttons.forEach((button, index) => button.draw(p5, { active: index === this.activeIndex }));

    p5.push();
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textFont("IBM Plex Sans");
    p5.textSize(14);
    p5.fill("rgba(181, 192, 211, 0.9)");
    p5.text("A/D/W/S navegar | Enter confirmar | Esc salir", p5.width / 2, 676);
    p5.pop();
  }

  handleAction(action) {
    if (action === "NAV_UP" || action === "NAV_LEFT") {
      this.activeIndex = (this.activeIndex - 1 + this.buttons.length) % this.buttons.length;
    }

    if (action === "NAV_DOWN" || action === "NAV_RIGHT") {
      this.activeIndex = (this.activeIndex + 1) % this.buttons.length;
    }

    if (action === "BACK") {
      this.game.goToLauncher();
      return;
    }

    if (action === "CONFIRM") {
      if (this.activeIndex === 0) {
        this.game.sceneManager.change("versus");
      }

      if (this.activeIndex === 1) {
        this.game.sceneManager.change("player-select");
      }

      if (this.activeIndex === 2) {
        this.game.goToLauncher();
      }
    }
  }

  exit() {}
  getStatusText() { return "Duel - Resultado"; }
  getGestureMap() {
    return {
      OPEN_PALM: "CONFIRM",
      OPEN_PALM_LEFT: "CONFIRM",
      OPEN_PALM_RIGHT: "CONFIRM",
    };
  }
}
