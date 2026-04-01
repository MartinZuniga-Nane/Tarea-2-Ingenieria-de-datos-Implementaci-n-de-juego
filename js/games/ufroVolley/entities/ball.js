export class Ball {
  constructor(config) {
    this.config = config;
    this.radius = config.ball.radius;
    this.mass = config.ball.mass;
    this.restitution = config.ball.restitution;
    this.linearDamping = config.ball.linearDamping;
    this.position = { x: config.net.x, y: config.ball.spawnY };
    this.velocity = { x: 0, y: 0 };
    this.rotation = 0;
    this.angularVelocity = 0;
    this.lastTouchTeam = null;
    this.grounded = false;
    this.impactStrength = 0;
  }

  reset(x, y) {
    this.position.x = x;
    this.position.y = y;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.rotation = 0;
    this.angularVelocity = 0;
    this.lastTouchTeam = null;
    this.grounded = false;
    this.impactStrength = 0;
  }

  updateRotation(dt) {
    this.rotation += this.angularVelocity * dt;
    this.angularVelocity *= 0.996;
    this.impactStrength *= 0.92;
  }

  applyImpulse(ix, iy) {
    this.velocity.x += ix / this.mass;
    this.velocity.y += iy / this.mass;
    this.angularVelocity += ix * 0.00032;
    this.impactStrength = Math.min(1, this.impactStrength + Math.abs(ix + iy) * 0.00012);
  }

  markTouch(team) {
    this.lastTouchTeam = team;
  }
}
