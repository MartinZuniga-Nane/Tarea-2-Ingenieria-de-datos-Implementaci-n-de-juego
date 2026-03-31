import { drawPixelButton, drawPixelTitle } from "../renderUtils.js";

export class MainMenuScene {
  constructor(game) {
    this.game = game;
    this.options = ["JUGAR", "SALIR"];
    this.selectedIndex = 0;
  }

  enter() {
    this.selectedIndex = 0;
    this.game.state.setPhase("menu");
  }

  getStatusText() {
    return "UfroVolley - menu";
  }

  handleAction(action) {
    if (action === "NAV_LEFT" || action === "NAV_UP") {
      this.selectedIndex = (this.selectedIndex + this.options.length - 1) % this.options.length;
      return;
    }

    if (action === "NAV_RIGHT" || action === "NAV_DOWN") {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
      return;
    }

    if (action === "BACK") {
      this.game.router.navigate("launcher");
      return;
    }

    if (action !== "CONFIRM") {
      return;
    }

    if (this.selectedIndex === 0) {
      this.game.startNewMatch();
      this.game.sceneManager.change("match");
      return;
    }

    this.game.router.navigate("launcher");
  }

  update() {}

  render(p5) {
    this.game.drawCourtBackground(p5);

    p5.push();
    p5.noStroke();
    p5.fill("rgba(6, 12, 24, 0.34)");
    p5.rect(0, 0, p5.width, p5.height);
    p5.fill("rgba(10, 20, 34, 0.76)");
    p5.rect(390, 180, 1140, 700, 42);
    p5.pop();

    drawPixelTitle(p5, "UFROVOLLEY", p5.width / 2, 200, 102, this.game.config.render.titlePalette);

    p5.push();
    p5.fill("#f7fbff");
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textFont("IBM Plex Sans");
    p5.textSize(32);
    p5.text("Voleibol 2v2 torpe, fisico y sin azar.", p5.width / 2, 398);
    p5.textSize(24);
    p5.fill("rgba(230, 244, 255, 0.86)");
    p5.text("F o mano izquierda abierta = gatos | J o mano derecha abierta = perros", p5.width / 2, 448);
    p5.text("Enter confirma | A-D o W-S navegan | Esc vuelve", p5.width / 2, 486);
    p5.pop();

    drawPixelButton(p5, "JUGAR", 740, 690, 350, 96, this.selectedIndex === 0);
    drawPixelButton(p5, "SALIR", 1180, 690, 350, 96, this.selectedIndex === 1);
  }
}
