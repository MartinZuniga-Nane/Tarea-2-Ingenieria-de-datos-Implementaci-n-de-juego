export class HitEffect {
  constructor({ image, position, duration = 320, scale = 1, delay = 0 }) {
    this.image = image;
    this.position = position;
    this.duration = duration;
    this.scale = scale;
    this.delay = delay;
    this.elapsed = 0;
    this.active = true;
  }

  update(dt) {
    this.elapsed += dt;
    if (this.elapsed >= this.delay + this.duration) {
      this.active = false;
    }
  }

  draw(p5) {
    if (!this.active || this.elapsed < this.delay) {
      return;
    }

    const life = 1 - (this.elapsed - this.delay) / this.duration;

    p5.push();
    p5.imageMode(p5.CENTER);
    p5.tint(255, life * 255);
    if (this.image) {
      p5.image(this.image, this.position.x, this.position.y, 160 * this.scale, 160 * this.scale);
    } else {
      p5.noStroke();
      p5.fill(255, 208, 129, 220 * life);
      p5.circle(this.position.x, this.position.y, 70 * this.scale);
    }
    p5.pop();
  }
}
