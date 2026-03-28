import { MenuButton } from "../../../shared/ui/menuButton.js";
import { createResultCopy } from "../systems/resultSystem.js";

export class ResultScene {
  constructor(game) {
    this.game = game;
    this.buttons = [
      new MenuButton({ label: "Revancha", x: 240, y: 430, width: 310, height: 84, description: "Mismos personajes y mismo fondo" }),
      new MenuButton({ label: "Cambiar personajes", x: 240, y: 530, width: 310, height: 84, description: "Volver a la seleccion inicial" }),
      new MenuButton({ label: "Salir", x: 240, y: 630, width: 310, height: 84, description: "Regresar a la biblioteca" }),
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
      p5.tint(255, 55);
      p5.image(stage, 0, 0, p5.width, p5.height);
      p5.noTint();
    }

    p5.push();
    p5.fill("rgba(4, 9, 15, 0.82)");
    p5.noStroke();
    p5.rect(64, 52, p5.width - 128, p5.height - 104, 28);
    p5.pop();

    p5.push();
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(52);
    p5.text(this.copy.title, 102, 118);
    p5.textFont("IBM Plex Sans");
    p5.textSize(20);
    p5.fill("#b5c0d3");
    p5.text(this.copy.subtitle, 102, 172);
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
  getGestureMap() { return {}; }
}
