export class PlayerBody {
  constructor({
    id,
    team,
    slot,
    side,
    baseX,
    baseY,
    allowedMinX,
    allowedMaxX,
    phaseOffset,
    spriteSet,
    renderProfile,
    config,
  }) {
    this.id = id;
    this.team = team;
    this.slot = slot;
    this.side = side;
    this.baseX = baseX;
    this.baseY = baseY;
    this.allowedMinX = allowedMinX;
    this.allowedMaxX = allowedMaxX;
    this.phaseOffset = phaseOffset;
    this.spriteSet = spriteSet;
    this.renderProfile = renderProfile;
    this.config = config;
    this.width = config.players.width;
    this.height = config.players.height;
    this.radius = config.players.colliderRadius;
    this.mass = config.players.mass;
    this.restitution = config.players.restitution;
    this.linearDamping = config.players.linearDamping;
    this.angularDamping = config.players.angularDamping;
    this.position = { x: baseX, y: baseY - this.height * 0.46 };
    this.velocity = { x: 0, y: 0 };
    this.angle = 0;
    this.angularVelocity = 0;
    this.jumpCooldownUntil = 0;
    this.grounded = false;
    this.impactUntil = 0;
    this.jumpVisualUntil = 0;
    this.frameIndex = 0;
  }

  reset() {
    this.position.x = this.baseX;
    this.position.y = this.baseY - this.height * 0.46;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.angle = 0;
    this.angularVelocity = 0;
    this.grounded = false;
    this.impactUntil = 0;
    this.jumpVisualUntil = 0;
    this.frameIndex = 0;
  }

  canJump(now) {
    return this.grounded && now >= this.jumpCooldownUntil;
  }

  jump(now, overrides = {}) {
    if (!this.canJump(now)) {
      return false;
    }

    const towardNet = this.side === "left" ? 1 : -1;
    const baseImpulseX = this.slot === "front" ? this.config.players.jumpImpulseFrontX : this.config.players.jumpImpulseBackX;
    const impulseX = overrides.impulseX ?? baseImpulseX;
    const impulseY = overrides.impulseY ?? this.config.players.jumpImpulseY;
    const angularBoost = overrides.angularBoost ?? (this.slot === "front" ? 3.5 : 2.4);
    this.velocity.y += impulseY;
    this.velocity.x += impulseX * towardNet;
    this.angularVelocity += towardNet * angularBoost;
    this.grounded = false;
    this.jumpCooldownUntil = now + this.config.players.jumpCooldownMs;
    this.impactUntil = now + 220;
    this.jumpVisualUntil = now + 220;
    return true;
  }

  applyPassiveMotion(timeSeconds) {
    const torqueAmplitude = this.slot === "front"
      ? this.config.wobble.frontTorqueAmplitude
      : this.config.wobble.backTorqueAmplitude;
    const torqueFrequency = this.slot === "front"
      ? this.config.wobble.frontTorqueFrequency
      : this.config.wobble.backTorqueFrequency;
    const microImpulse = this.slot === "front"
      ? this.config.wobble.frontMicroImpulse
      : this.config.wobble.backMicroImpulse;
    const direction = this.side === "left" ? 1 : -1;
    const wobble = Math.sin(timeSeconds * torqueFrequency + this.phaseOffset);
    const balanceStep = Math.sin(timeSeconds * this.config.wobble.microImpulseFrequency + this.phaseOffset * 0.7);
    this.angularVelocity += wobble * torqueAmplitude * 0.015;
    this.velocity.x += balanceStep * microImpulse * 0.013 * direction;
  }

  applyFormationCorrection() {
    const offsetX = this.baseX - this.position.x;
    const deadZone = this.config.formation.leashDeadZone ?? 0;
    if (Math.abs(offsetX) > deadZone) {
      const effectiveOffset = offsetX - Math.sign(offsetX) * deadZone;
      this.velocity.x += effectiveOffset * this.config.formation.slotLeashStrength * 0.0012;
    }
    this.velocity.x *= this.config.formation.slotLeashDamping;
    this.position.x = Math.max(this.allowedMinX, Math.min(this.allowedMaxX, this.position.x));
  }

  applyImpulse(ix, iy) {
    this.velocity.x += ix / this.mass;
    this.velocity.y += iy / this.mass;
    this.angularVelocity += ix * 0.0011;
  }

  updateFrameSelection(now) {
    const rising = this.velocity.y < -170;
    const falling = this.velocity.y > 160;
    const heavyTilt = Math.abs(this.angle) > 0.44;
    const jumpVisual = now < this.jumpVisualUntil;

    if (jumpVisual) {
      this.frameIndex = 4;
    } else if (rising) {
      this.frameIndex = 2;
    } else if (falling || heavyTilt) {
      this.frameIndex = 3;
    } else if (this.grounded && Math.abs(this.angularVelocity) > 0.24) {
      this.frameIndex = 1;
    } else {
      this.frameIndex = 0;
    }
  }

  getRenderState() {
    const image = this.spriteSet.frames[this.frameIndex] ?? this.spriteSet.frames[0] ?? null;
    const offsets = this.renderProfile.offsets[this.frameIndex] ?? { x: 0, y: 0 };
    return {
      image,
      x: this.position.x + offsets.x,
      y: this.position.y + offsets.y,
      width: image ? image.width * this.renderProfile.scale : this.width,
      height: image ? image.height * this.renderProfile.scale : this.height,
      flipX: this.side === "right",
      rotation: this.angle,
    };
  }
}
