function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getDrawableSource(image) {
  if (!image) {
    return null;
  }

  return image.canvas || image.elt || image;
}

export class LevelManager {
  constructor(config) {
    this.config = config;
    this.bounds = {
      x: 0,
      y: 0,
      width: config.canvas.width,
      height: config.canvas.height,
    };
    this.level = null;
    this.obstacles = [];
    this.portal = { x: 0, y: 0, width: 80, height: 80 };
    this.collisionCount = 0;
    this.cachedPattern = null;
    this.cachedPatternKey = "";
  }

  loadLevel(levelDefinition) {
    this.level = levelDefinition;
    this.obstacles = levelDefinition.obstacles.map((obstacle) => ({ ...obstacle }));
    this.portal = { ...levelDefinition.portal };
    this.collisionCount = 0;
  }

  resolveCollisions(astronaut) {
    const before = this.collisionCount;
    this.resolveBoundsCollision(astronaut);
    this.obstacles.forEach((obstacle) => this.resolveObstacleCollision(astronaut, obstacle));
    return this.collisionCount - before;
  }

  resolveBoundsCollision(astronaut) {
    const radius = astronaut.radius;
    const maxX = this.bounds.x + this.bounds.width;
    const maxY = this.bounds.y + this.bounds.height;
    const elasticity = this.config.physics.elasticity;

    if (astronaut.position.x - radius < this.bounds.x) {
      astronaut.position.x = this.bounds.x + radius;
      astronaut.velocity.x = Math.abs(astronaut.velocity.x) * elasticity;
      this.collisionCount += 1;
    } else if (astronaut.position.x + radius > maxX) {
      astronaut.position.x = maxX - radius;
      astronaut.velocity.x = -Math.abs(astronaut.velocity.x) * elasticity;
      this.collisionCount += 1;
    }

    if (astronaut.position.y - radius < this.bounds.y) {
      astronaut.position.y = this.bounds.y + radius;
      astronaut.velocity.y = Math.abs(astronaut.velocity.y) * elasticity;
      this.collisionCount += 1;
    } else if (astronaut.position.y + radius > maxY) {
      astronaut.position.y = maxY - radius;
      astronaut.velocity.y = -Math.abs(astronaut.velocity.y) * elasticity;
      this.collisionCount += 1;
    }
  }

  resolveObstacleCollision(astronaut, obstacle) {
    const radius = astronaut.radius;
    const closestX = clamp(astronaut.position.x, obstacle.x, obstacle.x + obstacle.width);
    const closestY = clamp(astronaut.position.y, obstacle.y, obstacle.y + obstacle.height);
    let normalX = astronaut.position.x - closestX;
    let normalY = astronaut.position.y - closestY;
    const distance = Math.hypot(normalX, normalY);

    if (distance >= radius) {
      return;
    }

    this.collisionCount += 1;

    if (distance === 0) {
      const toLeft = Math.abs(astronaut.position.x - obstacle.x);
      const toRight = Math.abs(astronaut.position.x - (obstacle.x + obstacle.width));
      const toTop = Math.abs(astronaut.position.y - obstacle.y);
      const toBottom = Math.abs(astronaut.position.y - (obstacle.y + obstacle.height));
      const minDistance = Math.min(toLeft, toRight, toTop, toBottom);

      if (minDistance === toLeft) {
        normalX = -1;
        normalY = 0;
      } else if (minDistance === toRight) {
        normalX = 1;
        normalY = 0;
      } else if (minDistance === toTop) {
        normalX = 0;
        normalY = -1;
      } else {
        normalX = 0;
        normalY = 1;
      }
    } else {
      normalX /= distance;
      normalY /= distance;
    }

    const penetration = radius - (distance || 0);
    astronaut.position.x += normalX * penetration;
    astronaut.position.y += normalY * penetration;

    const velocityDotNormal = astronaut.velocity.x * normalX + astronaut.velocity.y * normalY;
    if (velocityDotNormal < 0) {
      const restitution = this.config.physics.elasticity;
      astronaut.velocity.x -= (1 + restitution) * velocityDotNormal * normalX;
      astronaut.velocity.y -= (1 + restitution) * velocityDotNormal * normalY;
    }
  }

  checkPortal(astronaut) {
    const centerX = astronaut.position.x;
    const centerY = astronaut.position.y;
    return (
      centerX >= this.portal.x
      && centerX <= this.portal.x + this.portal.width
      && centerY >= this.portal.y
      && centerY <= this.portal.y + this.portal.height
    );
  }

  draw(p5, visuals, pulse = 0, options = {}) {
    const {
      obstaclesSheet = null,
      wallType = null,
      tileSize = 64,
    } = options;

    const source = getDrawableSource(obstaclesSheet);

    if (source && wallType) {
      this.drawObstacleTiles(p5, source, wallType, tileSize);
    } else {
      p5.push();
      p5.noStroke();
      p5.fill(visuals.obstacleColor);
      this.obstacles.forEach((obstacle) => {
        p5.rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 12);
      });
      p5.pop();
    }

    p5.push();
    p5.stroke(visuals.obstacleStroke);
    p5.strokeWeight(1.4);
    p5.noFill();
    this.obstacles.forEach((obstacle) => {
      p5.rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 12);
    });
    p5.pop();

    const ctx = p5.drawingContext;
    const portalScale = 1 + pulse * 0.06;
    const portalWidth = this.portal.width * portalScale;
    const portalHeight = this.portal.height * portalScale;
    const portalX = this.portal.x - (portalWidth - this.portal.width) / 2;
    const portalY = this.portal.y - (portalHeight - this.portal.height) / 2;

    p5.push();
    ctx.shadowBlur = 22 + pulse * 16;
    ctx.shadowColor = visuals.portalGlowColor;
    p5.noStroke();
    p5.fill(visuals.portalColor);
    p5.rect(portalX, portalY, portalWidth, portalHeight, 16);
    p5.stroke(visuals.portalGlowColor);
    p5.strokeWeight(2);
    p5.noFill();
    p5.rect(portalX + 10, portalY + 10, portalWidth - 20, portalHeight - 20, 10);
    p5.pop();

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  drawObstacleTiles(p5, source, wallType, tileSize) {
    const sourceX = wallType.x;
    const sourceY = wallType.y;
    const sourceWidth = wallType.width;
    const sourceHeight = wallType.height;

    if (sourceWidth <= 0 || sourceHeight <= 0 || tileSize <= 0) {
      return;
    }

    const pattern = this.getOrCreatePattern(p5, source, wallType, tileSize);
    if (!pattern) {
      return;
    }

    const ctx = p5.drawingContext;
    p5.push();
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.imageSmoothingEnabled = false;

    this.obstacles.forEach((obstacle) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      ctx.clip();
      ctx.translate(obstacle.x, obstacle.y);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, obstacle.width, obstacle.height);
      ctx.restore();
    });

    ctx.restore();
    p5.pop();
  }

  getOrCreatePattern(p5, source, wallType, tileSize) {
    const key = `${source.width}x${source.height}:${wallType.x},${wallType.y},${wallType.width},${wallType.height}:${tileSize}`;
    if (this.cachedPattern && this.cachedPatternKey === key) {
      return this.cachedPattern;
    }

    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = tileSize;
    tileCanvas.height = tileSize;
    const tileCtx = tileCanvas.getContext("2d");
    if (!tileCtx) {
      return null;
    }

    tileCtx.imageSmoothingEnabled = false;
    tileCtx.clearRect(0, 0, tileSize, tileSize);
    tileCtx.drawImage(
      source,
      wallType.x,
      wallType.y,
      wallType.width,
      wallType.height,
      0,
      0,
      tileSize,
      tileSize,
    );

    const imageData = tileCtx.getImageData(0, 0, tileSize, tileSize);
    for (let index = 3; index < imageData.data.length; index += 4) {
      imageData.data[index] = 255;
    }
    tileCtx.putImageData(imageData, 0, 0);

    const pattern = p5.drawingContext.createPattern(tileCanvas, "repeat");
    if (!pattern) {
      return null;
    }

    this.cachedPattern = pattern;
    this.cachedPatternKey = key;
    return pattern;
  }
}
