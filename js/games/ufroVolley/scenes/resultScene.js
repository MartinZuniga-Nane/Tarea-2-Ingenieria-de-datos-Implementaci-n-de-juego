import { drawMessageBanner, drawPixelButton, drawPixelTitle } from "../renderUtils.js";

export class ResultScene {
  constructor(game) {
    this.game = game;
    this.options = ["REVANCHA", "SALIR"];
    this.selectedIndex = 0;
  }

  enter() {
    this.selectedIndex = 0;
    this.game.state.setPhase("result");
  }

  getStatusText() {
    return "UfroVolley - resultado";
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
    const winner = this.game.state.matchWinner === "left" ? "GANAN LOS GATOS" : "GANAN LOS PERROS";
    this.game.drawCourtBackground(p5);

    p5.push();
    p5.noStroke();
    p5.fill("rgba(5, 10, 20, 0.48)");
    p5.rect(0, 0, p5.width, p5.height);
    p5.fill("rgba(8, 18, 34, 0.84)");
    p5.rect(350, 160, 1220, 760, 42);
    p5.pop();

    drawPixelTitle(p5, "RESULTADO", p5.width / 2, 196, 88, this.game.config.render.titlePalette);
    drawMessageBanner(p5, winner);

    p5.push();
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textFont("Space Grotesk");
    p5.textStyle(p5.BOLD);
    p5.textSize(78);
    p5.fill("#f5fbff");
    p5.text(`${this.game.state.score.left} - ${this.game.state.score.right}`, p5.width / 2, 464);
    p5.textFont("IBM Plex Sans");
    p5.textStyle(p5.NORMAL);
    p5.textSize(28);
    p5.fill("rgba(237, 247, 255, 0.88)");
    p5.text("Partida a 5 puntos completada.", p5.width / 2, 554);
    p5.pop();

    drawPixelButton(p5, "REVANCHA", 720, 734, 390, 96, this.selectedIndex === 0);
    drawPixelButton(p5, "SALIR", 1200, 734, 320, 96, this.selectedIndex === 1);
  }
}
