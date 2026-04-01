import { FadeController } from "../../../shared/ui/fade.js";

export class SplashScene {
  constructor(game) {
    this.game = game;
    this.fade = new FadeController();
    this.elapsed = 0;
  }

  enter() {
    this.elapsed = 0;
    this.fade.fadeIn(700);
  }

  update(dt) {
    this.elapsed += dt;
    this.fade.update(dt);

    if (this.elapsed >= 900) {
      this.game.sceneManager.change("controls", { fromMenu: false });
    }
  }

  render(p5) {
    p5.background("#08111d");
    p5.push();
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(74);
    p5.text("DUEL", p5.width / 2, p5.height / 2 - 20);
    p5.fill("#b5c0d3");
    p5.textFont("IBM Plex Sans");
    p5.textSize(20);
    p5.text("Launcher modular con p5.js y control por gestos", p5.width / 2, p5.height / 2 + 46);
    p5.pop();
    this.fade.draw(p5);
  }

  handleAction() {}
  exit() {}
  getStatusText() { return "Duel - Presentacion"; }
  getGestureMap() { return {}; }
}
