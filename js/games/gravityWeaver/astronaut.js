export class Astronaut {
  constructor({ x, y, radius }) {
    this.radius = radius;
    this.position = { x, y };
    this.velocity = { x: 0, y: 0 };
    this.acceleration = { x: 0, y: 0 };
    this.trail = [];
  }

  reset(x, y) {
    this.position.x = x;
    this.position.y = y;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.acceleration.x = 0;
    this.acceleration.y = 0;
    this.trail.length = 0;
  }

  applyForce(force) {
    this.acceleration.x += force.x;
    this.acceleration.y += force.y;
  }

  update(dtSeconds, config) {
    this.velocity.x += this.acceleration.x * dtSeconds;
    this.velocity.y += this.acceleration.y * dtSeconds;

    const frictionFactor = Math.pow(config.physics.friction, dtSeconds * 60);
    this.velocity.x *= frictionFactor;
    this.velocity.y *= frictionFactor;

    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    if (speed > config.physics.maxSpeed && speed > 0) {
      const ratio = config.physics.maxSpeed / speed;
      this.velocity.x *= ratio;
      this.velocity.y *= ratio;
    }

    this.position.x += this.velocity.x * dtSeconds;
    this.position.y += this.velocity.y * dtSeconds;

    this.acceleration.x = 0;
    this.acceleration.y = 0;

    this.trail.push({ x: this.position.x, y: this.position.y, life: 1 });
    if (this.trail.length > 28) {
      this.trail.shift();
    }
  }

  draw(p5, astronautConfig) {
    p5.push();
    p5.noFill();

    p5.strokeCap(p5.ROUND);
    for (let index = 1; index < this.trail.length; index += 1) {
      const prev = this.trail[index - 1];
      const node = this.trail[index];
      const alpha = index / this.trail.length;
      p5.stroke(`rgba(93, 243, 255, ${0.04 + alpha * 0.2})`);
      p5.strokeWeight(1.2 + alpha * 4.5);
      p5.line(prev.x, prev.y, node.x, node.y);
    }
    p5.pop();

    const ctx = p5.drawingContext;
    p5.push();
    ctx.shadowBlur = 24;
    ctx.shadowColor = astronautConfig.glowColor;
    p5.noStroke();
    p5.fill(astronautConfig.color);
    p5.circle(this.position.x, this.position.y, this.radius * 2);

    p5.fill("rgba(255, 255, 255, 0.74)");
    p5.circle(this.position.x - this.radius * 0.25, this.position.y - this.radius * 0.28, this.radius * 0.7);
    p5.pop();

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }
}
