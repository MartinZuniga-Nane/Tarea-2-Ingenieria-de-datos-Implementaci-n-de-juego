function getDrawableSource(image) {
  if (!image) {
    return null;
  }

  return image.canvas || image.elt || image;
}

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

  draw(p5, {
    astronautConfig,
    spriteSheet = null,
    spriteFrame = null,
    flipX = false,
    rotation = 0,
    scaleX = 1,
    scaleY = 1,
    boostWeight = 0,
    impactFlashAlpha = 0,
  }) {
    p5.push();
    p5.noFill();

    p5.strokeCap(p5.ROUND);
    for (let index = 1; index < this.trail.length; index += 1) {
      const prev = this.trail[index - 1];
      const node = this.trail[index];
      const alpha = index / this.trail.length;
      p5.stroke(`rgba(93, 243, 255, ${0.04 + alpha * (0.2 + boostWeight * 0.12)})`);
      p5.strokeWeight(1.2 + alpha * (4.5 + boostWeight * 1.6));
      p5.line(prev.x, prev.y, node.x, node.y);
    }
    p5.pop();

    const spriteSource = getDrawableSource(spriteSheet);
    const hasSprite = Boolean(spriteSource && spriteFrame && spriteFrame.width > 0 && spriteFrame.height > 0);
    const ctx = p5.drawingContext;
    p5.push();
    ctx.shadowBlur = hasSprite ? 14 : 24;
    ctx.shadowColor = astronautConfig.glowColor;

    if (hasSprite) {
      p5.imageMode(p5.CENTER);
      p5.translate(this.position.x, this.position.y);
      p5.rotate(rotation);
      const signedScaleX = (flipX ? -1 : 1) * scaleX;
      p5.scale(signedScaleX, scaleY);
      const width = spriteFrame.width * astronautConfig.spriteScale;
      const height = spriteFrame.height * astronautConfig.spriteScale;
      ctx.drawImage(
        spriteSource,
        spriteFrame.x,
        spriteFrame.y,
        spriteFrame.width,
        spriteFrame.height,
        -width / 2,
        -height / 2,
        width,
        height,
      );

      if (impactFlashAlpha > 0) {
        p5.noStroke();
        p5.fill(`rgba(197, 243, 255, ${impactFlashAlpha})`);
        p5.ellipse(0, 0, width * 0.85, height * 0.85);
      }
    } else {
      p5.noStroke();
      p5.fill(astronautConfig.color);
      p5.circle(this.position.x, this.position.y, this.radius * 2);

      p5.fill("rgba(255, 255, 255, 0.74)");
      p5.circle(this.position.x - this.radius * 0.25, this.position.y - this.radius * 0.28, this.radius * 0.7);
    }

    p5.pop();

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }
}
