function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isDrawableSprite(source) {
  return typeof HTMLImageElement !== "undefined"
    && source instanceof HTMLImageElement
    && source.complete
    && source.naturalWidth > 0
    && source.naturalHeight > 0;
}

export class Player {
  constructor({ x, y, size = 58, spriteFrames = [], frameDurationMs = 85 } = {}) {
    this.width = size;
    this.height = size;
    this.x = x ?? 0;
    this.y = y ?? 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.spriteFrames = Array.isArray(spriteFrames) ? spriteFrames : [];
    this.frameDurationMs = frameDurationMs;
    this.spriteFrameIndex = 0;
    this.spriteElapsedMs = 0;
  }

  reset({ x, y, velocityX = 0, velocityY = 0 } = {}) {
    this.x = x ?? this.x;
    this.y = y ?? this.y;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.spriteFrameIndex = 0;
    this.spriteElapsedMs = 0;
  }

  setSpriteFrames(frames = []) {
    this.spriteFrames = Array.isArray(frames) ? frames : [];
    this.spriteFrameIndex = 0;
    this.spriteElapsedMs = 0;
  }

  updateAnimation(deltaMs) {
    if (!this.spriteFrames.length || !Number.isFinite(deltaMs) || deltaMs <= 0) {
      return;
    }

    this.spriteElapsedMs += deltaMs;
    while (this.spriteElapsedMs >= this.frameDurationMs) {
      this.spriteElapsedMs -= this.frameDurationMs;
      this.spriteFrameIndex = (this.spriteFrameIndex + 1) % this.spriteFrames.length;
    }
  }

  updatePhysics(dt, physicsConfig) {
    this.velocityX = clamp(this.velocityX, -physicsConfig.maxHorizontalSpeed, physicsConfig.maxHorizontalSpeed);
    this.velocityX *= physicsConfig.horizontalDamping;
    this.velocityY = clamp(this.velocityY + physicsConfig.gravity * dt, -2000, physicsConfig.maxFallSpeed);

    this.x += this.velocityX * dt;
    this.y += this.velocityY * dt;
  }

  wrapHorizontal(worldWidth) {
    if (this.x < -this.width / 2) {
      this.x = worldWidth + this.width / 2;
    } else if (this.x > worldWidth + this.width / 2) {
      this.x = -this.width / 2;
    }
  }

  getBounds() {
    return {
      left: this.x - this.width / 2,
      right: this.x + this.width / 2,
      top: this.y - this.height / 2,
      bottom: this.y + this.height / 2,
    };
  }

  getBottom() {
    return this.y + this.height / 2;
  }

  bounceFromPlatform(platformTopY, jumpVelocity) {
    this.y = platformTopY - this.height / 2;
    this.velocityY = jumpVelocity;
  }

  draw(p5, cameraY) {
    const screenX = this.x;
    const screenY = this.y - cameraY;
    const tilt = clamp(this.velocityX / 280, -0.35, 0.35);

    p5.push();
    p5.translate(screenX, screenY);
    p5.rotate(tilt);

    const sprite = this.spriteFrames[this.spriteFrameIndex] ?? null;
    if (isDrawableSprite(sprite)) {
      p5.drawingContext.imageSmoothingEnabled = true;
      const size = this.width * 1.3;
      p5.drawingContext.drawImage(sprite, -size / 2, -size / 2, size, size);
      p5.pop();
      return;
    }

    p5.noStroke();
    p5.fill(255, 214, 82);
    p5.circle(0, 0, this.width);

    p5.fill(255, 235, 132, 180);
    p5.circle(-8, -10, this.width * 0.48);

    p5.fill(40, 29, 20);
    p5.circle(-10, -5, 6);
    p5.circle(10, -5, 6);

    p5.stroke(40, 29, 20);
    p5.strokeWeight(3);
    p5.noFill();
    p5.arc(0, 8, 20, 12, 0, Math.PI);

    p5.pop();
  }
}
