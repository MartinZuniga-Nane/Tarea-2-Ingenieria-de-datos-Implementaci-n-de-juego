export class FadeController {
  constructor() {
    this.alpha = 1;
    this.direction = -1;
    this.speed = 0;
    this.active = false;
  }

  fadeIn(durationMs = 600) {
    this.alpha = 1;
    this.direction = -1;
    this.speed = 1 / durationMs;
    this.active = true;
  }

  fadeOut(durationMs = 600) {
    this.alpha = 0;
    this.direction = 1;
    this.speed = 1 / durationMs;
    this.active = true;
  }

  update(dt) {
    if (!this.active) {
      return;
    }

    this.alpha += this.direction * this.speed * dt;

    if (this.alpha <= 0 || this.alpha >= 1) {
      this.alpha = Math.max(0, Math.min(1, this.alpha));
      this.active = false;
    }
  }

  draw(p5) {
    if (this.alpha <= 0) {
      return;
    }

    p5.push();
    p5.noStroke();
    p5.fill(3, 8, 14, 255 * this.alpha);
    p5.rect(0, 0, p5.width, p5.height);
    p5.pop();
  }
}
