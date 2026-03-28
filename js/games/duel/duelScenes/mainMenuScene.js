import { MenuButton } from "../../../shared/ui/menuButton.js";

export class MainMenuScene {
  constructor(game) {
    this.game = game;
    this.buttons = [
      new MenuButton({ label: "Jugar", x: 240, y: 390, width: 310, height: 84, description: "Seleccion de jugadores y escenario" }),
      new MenuButton({ label: "Controles", x: 240, y: 490, width: 310, height: 84, description: "Ver gestos disponibles otra vez" }),
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
      p5.tint(255, 85);
      p5.image(background, 0, 0, p5.width, p5.height);
      p5.noTint();
    }

    p5.push();
    p5.noStroke();
    p5.fill("rgba(4, 9, 15, 0.48)");
    p5.rect(0, 0, p5.width, p5.height);
    p5.fill("rgba(6, 14, 24, 0.82)");
    p5.rect(80, 70, 420, p5.height - 140, 28);
    p5.pop();

    const logo = this.game.assets.shared.logo;
    if (logo) {
      p5.push();
      p5.imageMode(p5.CENTER);
      p5.image(logo, 860, 220, 420, 220);
      p5.pop();
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
    p5.text("Duel", 130, 148);
    p5.textFont("IBM Plex Sans");
    p5.textSize(18);
    p5.fill("#b5c0d3");
    p5.text("Duelo visual de reflejos. Elige combatientes, escenario y dispara con el gesto correcto en el momento exacto.", 130, 188, 320);
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
  getGestureMap() { return {}; }
}
