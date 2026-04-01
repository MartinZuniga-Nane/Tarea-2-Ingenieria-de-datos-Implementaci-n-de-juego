import { MenuButton } from "../../../shared/ui/menuButton.js";
import { drawImageCentered, drawImageRect } from "../renderUtils.js";

export class MainMenuScene {
  constructor(game) {
    this.game = game;
    this.buttons = [
      new MenuButton({ label: "Jugar", x: 340, y: 440, width: 400, height: 88, description: "Seleccion de jugadores y escenario" }),
      new MenuButton({ label: "Controles", x: 340, y: 546, width: 400, height: 88, description: "Ver gestos disponibles otra vez" }),
    ];
    this.activeIndex = 0;
  }

  enter() {
    this.activeIndex = 0;
  }

  update() {}

  render(p5) {
    const background = this.game.assets.shared.menuBackground;
    p5.background("#08111d");

    if (background) {
      drawImageRect(p5, background, 0, 0, p5.width, p5.height, { alpha: 0.33 });
    }

    p5.push();
    p5.noStroke();
    p5.fill("rgba(4, 9, 15, 0.48)");
    p5.rect(0, 0, p5.width, p5.height);
    p5.fill("rgba(6, 14, 24, 0.82)");
    p5.rect(120, 60, 520, p5.height - 120, 32);
    p5.pop();

    const logo = this.game.assets.shared.logo;
    p5.push();
    p5.noStroke();
    p5.fill("rgba(8, 16, 28, 0.78)");
    p5.rect(720, 116, 412, 238, 28);
    p5.pop();

    if (logo) {
      drawImageCentered(p5, logo, 926, 235, 360, 190);
    } else {
      p5.push();
      p5.fill("#f4f7fb");
      p5.textFont("Space Grotesk");
      p5.textSize(82);
      p5.textAlign(p5.CENTER, p5.CENTER);
      p5.text("DUEL", 860, 220);
      p5.pop();
    }

    p5.push();
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(56);
    p5.text("Duel", 176, 156);
    p5.textFont("IBM Plex Sans");
    p5.textSize(18);
    p5.fill("#b5c0d3");
    p5.text("Duelo visual 1v1 local. Elige combatientes, escenario y dispara con el gesto correcto en el momento exacto.", 176, 202, 360);
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

    if (action === "CONFIRM") {
      if (this.activeIndex === 0) {
        this.game.sceneManager.change("player-select");
      } else {
        this.game.sceneManager.change("controls", { fromMenu: true });
      }
    }

    if (action === "BACK") {
      this.game.goToLauncher();
    }
  }

  exit() {}
  getStatusText() { return "Duel - Menu principal"; }
  getGestureMap() {
    return {
      OPEN_PALM: "CONFIRM",
      OPEN_PALM_LEFT: "CONFIRM",
      OPEN_PALM_RIGHT: "CONFIRM",
    };
  }
}
