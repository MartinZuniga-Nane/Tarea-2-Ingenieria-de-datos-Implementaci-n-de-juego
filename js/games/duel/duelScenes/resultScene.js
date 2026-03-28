import { MenuButton } from "../../../shared/ui/menuButton.js";
import { createResultCopy } from "../systems/resultSystem.js";
import { drawImageRect } from "../renderUtils.js";

export class ResultScene {
  constructor(game) {
    this.game = game;
    this.buttons = [
      new MenuButton({ label: "Revancha", x: 334, y: 418, width: 398, height: 84, description: "Mismos personajes y mismo fondo" }),
      new MenuButton({ label: "Cambiar personajes", x: 334, y: 522, width: 398, height: 84, description: "Volver a la seleccion inicial" }),
      new MenuButton({ label: "Salir", x: 334, y: 626, width: 398, height: 84, description: "Regresar a la biblioteca" }),
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
      drawImageRect(p5, stage, 0, 0, p5.width, p5.height, { alpha: 0.22 });
    }

    p5.push();
    p5.fill("rgba(4, 9, 15, 0.82)");
    p5.noStroke();
    p5.rect(86, 54, p5.width - 172, p5.height - 108, 30);
    p5.pop();

    p5.push();
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(52);
    p5.text(this.copy.title, 164, 136);
    p5.textFont("IBM Plex Sans");
    p5.textSize(20);
    p5.fill("#b5c0d3");
    p5.text(this.copy.subtitle, 164, 196);
    p5.pop();

    this.buttons.forEach((button, index) => button.draw(p5, { active: index === this.activeIndex }));
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
