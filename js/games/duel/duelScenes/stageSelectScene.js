export class StageSelectScene {
  constructor(game) {
    this.game = game;
    this.activeStageIndex = 0;
  }

  enter() {
    const currentStage = this.game.state.selectedStage;
    this.activeStageIndex = this.game.config.stageSelect.stages.indexOf(currentStage);
    if (this.activeStageIndex < 0) {
      this.activeStageIndex = 0;
    }
  }

  update() {}

  render(p5) {
    p5.background("#08111d");
    p5.push();
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(42);
    p5.text("Seleccion de escenario", 86, 86);
    p5.textFont("IBM Plex Sans");
    p5.textSize(18);
    p5.fill("#b5c0d3");
    p5.text("Elige uno de los tres fondos disponibles y confirma para entrar al versus.", 86, 130);
    p5.pop();

    this.game.config.stageSelect.stages.forEach((stageId, index) => {
      const image = this.game.assets.shared.backgrounds[stageId];
      const active = this.activeStageIndex === index;
      const x = 86 + index * 390;
      const y = 190;

      p5.push();
      p5.fill(active ? "rgba(62, 193, 182, 0.2)" : "rgba(11, 18, 29, 0.84)");
      p5.stroke(active ? "rgba(220, 255, 250, 0.95)" : "rgba(164, 187, 220, 0.16)");
      p5.rect(x, y, 320, 360, 24);
      if (image) {
        p5.image(image, x + 18, y + 18, 284, 230);
      }
      p5.noStroke();
      p5.fill("#f4f7fb");
      p5.textFont("Space Grotesk");
      p5.textSize(26);
      p5.text(`BG ${index + 1}`, x + 22, y + 286);
      p5.textFont("IBM Plex Sans");
      p5.textSize(16);
      p5.fill("#b5c0d3");
      p5.text(active ? "Escenario activo" : "Disponible", x + 22, y + 318);
      p5.pop();
    });
  }

  handleAction(action) {
    if (action === "NAV_LEFT" || action === "NAV_UP") {
      this.activeStageIndex = (this.activeStageIndex - 1 + this.game.config.stageSelect.stages.length) % this.game.config.stageSelect.stages.length;
    }

    if (action === "NAV_RIGHT" || action === "NAV_DOWN") {
      this.activeStageIndex = (this.activeStageIndex + 1) % this.game.config.stageSelect.stages.length;
    }

    if (action === "BACK") {
      this.game.sceneManager.change("player-select");
      return;
    }

    if (action === "CONFIRM") {
      const selectedStage = this.game.config.stageSelect.stages[this.activeStageIndex];
      this.game.state.setStage(selectedStage);
      this.game.sceneManager.change("versus");
    }
  }

  exit() {}
  getStatusText() { return "Duel - Seleccion de escenario"; }
  getGestureMap() { return {}; }
}
