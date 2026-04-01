import { sampleGroundY } from "./collisionMap.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export class World {
  constructor(config, collisionMap) {
    this.config = config;
    this.collisionMap = collisionMap;
    this.players = [];
    this.ball = null;
    this.netCollider = collisionMap.netCollider;
    this.netFloorCollider = collisionMap.netFloorCollider;
    this.ballBounds = collisionMap.ballBounds;
    this.lastGroundContact = null;
  }

  setPlayers(players) {
    this.players = players;
  }

  setBall(ball) {
    this.ball = ball;
  }

  reset() {
    this.lastGroundContact = null;
  }

  step(dt, now) {
    this.lastGroundContact = null;
    this.players.forEach((player) => this.stepPlayer(player, dt, now));
    if (this.ball) {
      this.stepBall(this.ball, dt);
    }
    this.resolvePlayerPairs();
    if (this.ball) {
      this.resolveBallVsPlayers();
      this.resolveBallVsNet();
      this.resolveBallVsBounds();
      this.resolveBallVsGround();
    }
  }

  stepPlayer(player, dt, now) {
    player.applyPassiveMotion(now / 1000);
    player.applyFormationCorrection();
    player.velocity.x += this.config.physics.gravity.x * dt;
    player.velocity.y += this.config.physics.gravity.y * dt;
    player.velocity.x *= 1 - player.linearDamping;
    player.velocity.y *= 1 - this.config.physics.airDrag;
    player.angularVelocity *= 1 - player.angularDamping;
    player.position.x += player.velocity.x * dt;
    player.position.y += player.velocity.y * dt;
    player.angle += player.angularVelocity * dt;
    player.angle = clamp(player.angle, -this.config.players.maxTilt, this.config.players.maxTilt);
    this.resolvePlayerVsGround(player);
    this.resolvePlayerVsNet(player);
    player.position.x = clamp(player.position.x, player.allowedMinX, player.allowedMaxX);
    player.updateFrameSelection(now);
  }

  stepBall(ball, dt) {
    ball.grounded = false;
    ball.velocity.x += this.config.physics.gravity.x * dt;
    ball.velocity.y += this.config.physics.gravity.y * dt;
    ball.velocity.x *= 1 - ball.linearDamping;
    ball.velocity.y *= 1 - this.config.physics.airDrag;
    const speed = Math.sqrt(ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y);
    if (speed > this.config.ball.maxSpeed && speed > 0) {
      const ratio = this.config.ball.maxSpeed / speed;
      ball.velocity.x *= ratio;
      ball.velocity.y *= ratio;
    }
    ball.position.x += ball.velocity.x * dt;
    ball.position.y += ball.velocity.y * dt;
    ball.updateRotation(dt);
  }

  resolvePlayerVsGround(player) {
    const floorY = sampleGroundY(this.collisionMap, player.position.x);
    const footY = player.position.y + player.height * 0.46;
    if (footY >= floorY) {
      player.position.y = floorY - player.height * 0.46;
      if (player.velocity.y > 0) {
        player.velocity.y = -player.velocity.y * player.restitution * 0.3;
      }
      player.velocity.x *= this.config.physics.groundFriction;
      player.angularVelocity *= 0.9;
      player.angularVelocity += clamp(player.velocity.x * this.config.players.groundAngularBounce, -4.2, 4.2);
      player.grounded = true;
      return;
    }
    player.grounded = false;
  }

  resolvePlayerVsNet(player) {
    const halfWidth = this.netCollider.width / 2;
    const left = this.netCollider.x - halfWidth;
    const right = this.netCollider.x + halfWidth;
    const playerLeft = player.position.x - player.radius * 0.72;
    const playerRight = player.position.x + player.radius * 0.72;
    const playerBottom = player.position.y + player.height * 0.4;
    const playerTop = player.position.y - player.height * 0.4;
    const netTop = this.netCollider.y - this.netCollider.height / 2;
    const netBottom = this.netCollider.y + this.netCollider.height / 2;
    if (playerBottom < netTop || playerTop > netBottom || playerRight < left || playerLeft > right) {
      return;
    }

    if (player.side === "left") {
      player.position.x = left - player.radius * 0.74;
      player.velocity.x = Math.min(player.velocity.x, -Math.abs(player.velocity.x) * 0.24);
    } else {
      player.position.x = right + player.radius * 0.74;
      player.velocity.x = Math.max(player.velocity.x, Math.abs(player.velocity.x) * 0.24);
    }
    player.angularVelocity *= 0.8;
  }

  resolvePlayerPairs() {
    for (let i = 0; i < this.players.length; i += 1) {
      for (let j = i + 1; j < this.players.length; j += 1) {
        const a = this.players[i];
        const b = this.players[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const minDistance = a.radius + b.radius - (a.team === b.team ? 6 : 10);
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        if (dist >= minDistance) {
          continue;
        }

        const overlap = minDistance - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        a.position.x -= nx * overlap * 0.5;
        a.position.y -= ny * overlap * 0.5;
        b.position.x += nx * overlap * 0.5;
        b.position.y += ny * overlap * 0.5;
        a.velocity.x -= nx * overlap * 4.4;
        a.velocity.y -= ny * overlap * 3.1;
        b.velocity.x += nx * overlap * 4.4;
        b.velocity.y += ny * overlap * 3.1;
        a.angularVelocity -= nx * 0.18;
        b.angularVelocity += nx * 0.18;
      }
    }
  }

  resolveBallVsPlayers() {
    this.players.forEach((player) => {
      const playerCenter = { x: player.position.x, y: player.position.y - 12 };
      const radius = player.radius + this.ball.radius;
      const dist = distance(this.ball.position, playerCenter);
      if (dist >= radius) {
        return;
      }

      const dx = this.ball.position.x - playerCenter.x;
      const dy = this.ball.position.y - playerCenter.y;
      const nx = dx / (dist || 0.0001);
      const ny = dy / (dist || 0.0001);
      const overlap = radius - dist;
      this.ball.position.x += nx * overlap;
      this.ball.position.y += ny * overlap;
      const relativeVelocityX = this.ball.velocity.x - player.velocity.x;
      const relativeVelocityY = this.ball.velocity.y - player.velocity.y;
      const separatingVelocity = relativeVelocityX * nx + relativeVelocityY * ny;
      const impulse = Math.max(0, -(1 + this.ball.restitution) * separatingVelocity + 260);
      this.ball.velocity.x += nx * impulse + player.velocity.x * 0.18;
      this.ball.velocity.y += ny * impulse + player.velocity.y * 0.1;
      this.ball.angularVelocity += nx * 0.18;
      player.velocity.x -= nx * impulse * 0.11;
      player.velocity.y -= ny * impulse * 0.04;
      player.angularVelocity -= nx * (0.45 + this.config.players.ballAngularImpactBoost);
      player.angularVelocity += clamp(this.ball.velocity.y * 0.0012, -1.9, 1.9);
      player.impactUntil = performance.now() + 180;
      this.ball.markTouch(player.team);
    });
  }

  resolveBallVsNet() {
    this.resolveBallVsCollider(this.netCollider);
    this.resolveBallVsCollider(this.netFloorCollider);
  }

  resolveBallVsCollider(collider) {
    if (!collider) {
      return;
    }

    const left = collider.x - collider.width / 2;
    const right = collider.x + collider.width / 2;
    const top = collider.y - collider.height / 2;
    const bottom = collider.y + collider.height / 2;
    const ballLeft = this.ball.position.x - this.ball.radius;
    const ballRight = this.ball.position.x + this.ball.radius;
    const ballTop = this.ball.position.y - this.ball.radius;
    const ballBottom = this.ball.position.y + this.ball.radius;
    if (ballRight < left || ballLeft > right || ballBottom < top || ballTop > bottom) {
      return;
    }

    const overlapLeft = ballRight - left;
    const overlapRight = right - ballLeft;
    const overlapTop = ballBottom - top;
    const overlapBottom = bottom - ballTop;
    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
    if (minOverlap === overlapLeft) {
      this.ball.position.x = left - this.ball.radius;
      this.ball.velocity.x = -Math.abs(this.ball.velocity.x) * (1 + collider.restitution);
    } else if (minOverlap === overlapRight) {
      this.ball.position.x = right + this.ball.radius;
      this.ball.velocity.x = Math.abs(this.ball.velocity.x) * (1 + collider.restitution);
    } else if (minOverlap === overlapTop) {
      this.ball.position.y = top - this.ball.radius;
      this.ball.velocity.y = -Math.abs(this.ball.velocity.y) * (1 + collider.restitution);
    } else {
      this.ball.position.y = bottom + this.ball.radius;
      this.ball.velocity.y = Math.abs(this.ball.velocity.y) * 0.4;
    }
  }

  resolveBallVsBounds() {
    if (!this.ballBounds) {
      return;
    }

    const leftLimit = this.ballBounds.left + this.ball.radius;
    const rightLimit = this.ballBounds.right - this.ball.radius;
    if (this.ball.position.x <= leftLimit) {
      this.ball.position.x = leftLimit;
      this.ball.velocity.x = Math.abs(this.ball.velocity.x) * this.config.ball.wallRestitution;
    } else if (this.ball.position.x >= rightLimit) {
      this.ball.position.x = rightLimit;
      this.ball.velocity.x = -Math.abs(this.ball.velocity.x) * this.config.ball.wallRestitution;
    }
  }

  resolveBallVsGround() {
    const floorY = sampleGroundY(this.collisionMap, this.ball.position.x);
    if (this.ball.position.y + this.ball.radius < floorY) {
      return;
    }

    this.ball.position.y = floorY - this.ball.radius;
    const impactSpeed = Math.abs(this.ball.velocity.y);
    this.ball.grounded = true;
    this.lastGroundContact = this.ball.position.x < this.netCollider.x ? "left" : "right";
    if (impactSpeed < 140) {
      this.ball.velocity.y = 0;
      this.ball.velocity.x *= 0.9;
      return;
    }

    this.ball.velocity.y = -impactSpeed * this.ball.restitution;
    this.ball.velocity.x *= 0.98;
  }
}
