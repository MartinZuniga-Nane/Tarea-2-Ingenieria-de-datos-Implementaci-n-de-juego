import { drawBasketButton, getDrawableSource } from "../renderUtils.js";

export class MainMenuScene {
  constructor(game) {
    this.game = game;
    this.options = ["JUGAR", "SALIR"];
    this.selectedIndex = 0;
  }

  enter() {
    this.selectedIndex = 0;
  }

  getStatusText() {
    return "UfroBasket - menu";
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
      this.game.sceneManager.change("free-play");
      return;
    }

    this.game.router.navigate("launcher");
  }

  update() {}

  render(p5) {
    this.game.drawBackground(p5);
    this.game.drawClouds(p5, 0.35);

    p5.push();
    const titleImage = getDrawableSource(this.game.assets?.title);
    if (titleImage) {
      const titleWidth = 410;
      const titleHeight = titleWidth * (titleImage.height / titleImage.width);
      p5.drawingContext.drawImage(titleImage, p5.width / 2 - titleWidth / 2, 92, titleWidth, titleHeight);
    }
    p5.pop();

    const playImage = getDrawableSource(this.game.assets?.menu?.play);
    const exitImage = getDrawableSource(this.game.assets?.menu?.exit);
    if (playImage && exitImage) {
      this.drawImageButton(p5, playImage, 452, 472, 280, this.selectedIndex === 0);
      this.drawImageButton(p5, exitImage, 832, 472, 280, this.selectedIndex === 1);
    } else {
      drawBasketButton(p5, "JUGAR", 452, 472, 320, 94, this.selectedIndex === 0);
      drawBasketButton(p5, "SALIR", 832, 472, 320, 94, this.selectedIndex === 1);
    }
  }

  drawImageButton(p5, image, centerX, centerY, width, active) {
    const height = width * (image.height / image.width);
    p5.push();
    p5.imageMode(p5.CENTER);
    if (active) {
      p5.drawingContext.shadowColor = "rgba(255, 214, 102, 0.55)";
      p5.drawingContext.shadowBlur = 22;
    }
    p5.drawingContext.drawImage(image, centerX - width / 2, centerY - height / 2, width, height);
    if (active) {
      p5.noFill();
      p5.stroke("rgba(255, 242, 205, 0.95)");
      p5.strokeWeight(4);
      p5.rect(centerX - width / 2 - 8, centerY - height / 2 - 8, width + 16, height + 16, 20);
    }
    p5.pop();
  }
}
