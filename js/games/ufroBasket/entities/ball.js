export class BasketBall {
  constructor(config) {
    this.config = config;
    this.radius = config.ball.radius;
    this.reset(0, 0);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.lastY = y;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.angularVelocity = 0;
    this.state = "anchored";
    this.hasScoredThisShot = false;
  }

  anchorTo(x, y) {
    this.state = "anchored";
    this.x = x;
    this.y = y;
    this.lastY = y;
    this.vx = 0;
    this.vy = 0;
  }

  shoot(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.lastY = y;
    this.vx = vx;
    this.vy = vy;
    this.rotation = 0;
    this.angularVelocity = vx * 0.012;
    this.state = "flying";
    this.hasScoredThisShot = false;
  }

  update(dt, gravity, airDrag) {
    if (this.state !== "flying") {
      return;
    }

    this.lastY = this.y;
    this.vy += gravity * dt;
    this.vx *= 1 - airDrag;
    this.vy *= 1 - airDrag * 0.35;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.angularVelocity * dt;
  }
}
