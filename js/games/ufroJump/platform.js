export class Platform {
  constructor({ x, y, width, height, type = "normal", sprite = null } = {}) {
    this.x = x ?? 0;
    this.y = y ?? 0;
    this.width = width ?? 120;
    this.height = height ?? 20;
    this.type = type;
    this.seed = Math.random() * 1000;
    this.sprite = sprite;
  }

  static createRandom({ y, minX, maxX, width, height, sprite } = {}) {
    const span = Math.max(0, (maxX ?? 0) - (minX ?? 0));
    const x = (minX ?? 0) + Math.random() * span;
    return new Platform({ x, y, width, height, sprite });
  }

  getTop() {
    return this.y;
  }

  overlapsHorizontally(left, right, padding = 8) {
    return right > this.x + padding && left < this.x + this.width - padding;
  }

  isVisible(cameraY, screenHeight) {
    const screenY = this.y - cameraY;
    return screenY >= -30 && screenY <= screenHeight + 50;
  }

  draw(p5, cameraY) {
    const screenY = this.y - cameraY;

    p5.push();
    p5.translate(this.x, screenY);

    const hasDrawableSprite = typeof HTMLImageElement !== "undefined"
      && this.sprite instanceof HTMLImageElement
      && this.sprite.complete
      && this.sprite.naturalWidth > 0
      && this.sprite.naturalHeight > 0;

    if (hasDrawableSprite) {
      p5.drawingContext.imageSmoothingEnabled = true;
      p5.drawingContext.drawImage(this.sprite, 0, 0, this.width, this.height);
      p5.pop();
      return;
    }

    p5.noStroke();
    p5.fill(20, 80, 45, 90);
    p5.rect(3, 7, this.width, this.height, 8);

    p5.stroke(24, 98, 56);
    p5.strokeWeight(2);
    p5.fill(95, 229, 145);
    p5.rect(0, 0, this.width, this.height, 8);

    p5.noStroke();
    p5.fill(132, 244, 175, 130);
    p5.rect(8, 3, this.width - 16, this.height * 0.36, 6);

    p5.fill(58, 172, 106, 130);
    const stripWidth = 14;
    const stripGap = 10;
    const pulse = 0.65 + Math.sin((p5.frameCount + this.seed) * 0.12) * 0.15;
    for (let x = 10; x < this.width - 10; x += stripWidth + stripGap) {
      p5.rect(x, this.height - 7, stripWidth * pulse, 4, 2);
    }

    p5.pop();
  }
}
