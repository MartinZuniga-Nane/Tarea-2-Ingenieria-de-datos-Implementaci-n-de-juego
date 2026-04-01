export class Projectile {
  constructor({ start, end, duration = 300 }) {
    this.start = start;
    this.end = end;
    this.duration = duration;
    this.elapsed = 0;
    this.active = true;
  }

  update(dt) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.active = false;
    }
  }

  draw(p5) {
    if (!this.active) {
      return;
    }

    const t = Math.min(1, this.elapsed / this.duration);
    const x = this.start.x + (this.end.x - this.start.x) * t;
    const y = this.start.y + (this.end.y - this.start.y) * t;

    p5.push();
    p5.noStroke();
    p5.fill(255, 214, 120, 220);
    p5.circle(x, y, 20);
    p5.pop();
  }
}
