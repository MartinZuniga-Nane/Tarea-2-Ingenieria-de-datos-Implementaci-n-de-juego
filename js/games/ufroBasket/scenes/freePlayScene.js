import { BasketBall } from "../entities/ball.js";
import { BasketPlayer } from "../entities/player.js";
import { drawHud, drawPowerBar, getDrawableSource } from "../renderUtils.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function circleIntersectsRect(circleX, circleY, radius, rect) {
  const nearestX = clamp(circleX, rect.left, rect.right);
  const nearestY = clamp(circleY, rect.top, rect.bottom);
  const dx = circleX - nearestX;
  const dy = circleY - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

export class FreePlayScene {
  constructor(game) {
    this.game = game;
    this.player = null;
    this.ball = null;
    this.score = 0;
    this.charge = 0;
    this.chargeDirection = 1;
    this.isCharging = false;
    this.lastShotBand = "";
    this.pendingResetAt = 0;
  }

  enter() {
    this.score = 0;
    this.charge = 0;
    this.chargeDirection = 1;
    this.isCharging = false;
    this.lastShotBand = "";
    this.pendingResetAt = 0;
    this.player = new BasketPlayer(this.game.config, this.game.assets);
    this.ball = new BasketBall(this.game.config);
    this.resetBallToHands();
    this.game.modal.show({
      title: "Controles de UfroBasket",
      message: "Puño cerrado o mantener Espacio = cargar tiro.<br>Mano abierta o soltar Espacio = lanzar.<br>Enter confirma en menu y Esc vuelve.",
      dismissLabel: "Entendido",
      autoHideMs: 4200,
    });
  }

  exit() {}

  getStatusText() {
    return "UfroBasket - free play";
  }

  handleAction(action) {
    if (action === "BACK") {
      this.game.sceneManager.change("menu");
      return;
    }

    if (action === "START_CHARGE") {
      this.startCharge();
      return;
    }

    if (action === "RELEASE_SHOT") {
      this.releaseShot();
    }
  }

  startCharge() {
    if (this.ball.state !== "anchored" || this.pendingResetAt > 0) {
      return;
    }
    this.isCharging = true;
    this.player.setPose("charge");
  }

  releaseShot() {
    if (!this.isCharging || this.ball.state !== "anchored") {
      return;
    }

    this.isCharging = false;
    const now = performance.now();
    this.player.setPose("release", this.game.config.player.releasePoseMs, now);
    const hand = this.player.getHandPosition();
    const velocity = this.computeShotVelocity(hand.x, hand.y, this.charge);
    this.lastShotBand = this.resolveChargeBand(this.charge);
    this.ball.shoot(hand.x, hand.y, velocity.vx, velocity.vy);
  }

  computeShotVelocity(sourceX, sourceY, charge) {
    const config = this.game.config;
    const hoopGeometry = this.getHoopGeometry();
    const targetX = hoopGeometry.rimCenterX;
    const targetY = hoopGeometry.rimY - 28;
    const idealTime = config.shot.idealFlightTime;
    const idealVx = (targetX - sourceX) / idealTime;
    const idealVy = (targetY - sourceY - 0.5 * config.physics.gravity * idealTime * idealTime) / idealTime;
    const error = charge - config.ball.perfectCharge;
    return {
      vx: idealVx * (1 + error * config.shot.errorVelocityFactorX),
      vy: idealVy * (1 + error * config.shot.errorVelocityFactorY) - error * config.shot.errorVerticalBias,
    };
  }

  resolveChargeBand(charge) {
    if (Math.abs(charge - this.game.config.ball.perfectCharge) <= this.game.config.ball.perfectWindow) {
      return "Tiro perfecto";
    }
    if (charge < this.game.config.ball.shortThreshold) {
      return "Se queda corto";
    }
    if (charge > this.game.config.ball.longThreshold) {
      return "Se pasa del aro";
    }
    return "Toca aro y sale";
  }

  resetBallToHands() {
    this.charge = 0;
    this.chargeDirection = 1;
    this.isCharging = false;
    this.pendingResetAt = 0;
    this.player.setPose("idle");
    const hand = this.player.getHandPosition();
    this.ball.anchorTo(hand.x, hand.y);
  }

  scheduleReset() {
    if (this.pendingResetAt > 0) {
      return;
    }
    this.pendingResetAt = performance.now() + this.game.config.ball.resetDelayMs;
  }

  update(dt) {
    const now = performance.now();
    this.player.update(now);

    if (this.isCharging && this.ball.state === "anchored") {
      const nextCharge = this.charge + this.chargeDirection * this.game.config.ball.chargeSpeed * dt;
      if (nextCharge >= this.game.config.ball.chargeMax) {
        this.charge = this.game.config.ball.chargeMax;
        this.chargeDirection = -1;
      } else if (nextCharge <= this.game.config.ball.chargeMin) {
        this.charge = this.game.config.ball.chargeMin;
        this.chargeDirection = 1;
      } else {
        this.charge = nextCharge;
      }
    }

    if (this.ball.state === "anchored") {
      const hand = this.player.getHandPosition();
      this.ball.anchorTo(hand.x, hand.y);
      return;
    }

    this.ball.update(dt, this.game.config.physics.gravity, this.game.config.physics.airDrag);
    this.resolveHoopCollisions();
    this.resolvePostCollision();
    this.resolveGroundCollision();
    this.detectScore();

    if (this.pendingResetAt > 0 && now >= this.pendingResetAt) {
      this.resetBallToHands();
    }
  }

  resolveHoopCollisions() {
    const hoopGeometry = this.getHoopGeometry();
    this.resolveRimEdgeCollision(hoopGeometry.leftEdgeRect, -1);
    this.resolveRimEdgeCollision(hoopGeometry.rightEdgeRect, 1);
  }

  resolveRimEdgeCollision(edgeRect, direction) {
    if (!circleIntersectsRect(this.ball.x, this.ball.y, this.ball.radius, edgeRect)) {
      return;
    }

    if (direction < 0) {
      this.ball.x = edgeRect.left - this.ball.radius;
      this.ball.vx = -Math.abs(this.ball.vx) * this.game.config.physics.rimRestitution;
    } else {
      this.ball.x = edgeRect.right + this.ball.radius;
      this.ball.vx = Math.abs(this.ball.vx) * this.game.config.physics.rimRestitution;
    }

    if (this.ball.y < edgeRect.top) {
      this.ball.vy = -Math.abs(this.ball.vy) * 0.65;
    }
  }

  resolveGroundCollision() {
    const floorY = this.game.config.physics.floorY;
    if (this.ball.y + this.ball.radius < floorY) {
      return;
    }

    this.ball.y = floorY - this.ball.radius;
    if (Math.abs(this.ball.vy) < 110) {
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.scheduleReset();
      return;
    }

    this.ball.vy = -Math.abs(this.ball.vy) * this.game.config.physics.groundRestitution;
    this.ball.vx *= 0.88;
  }

  resolvePostCollision() {
    const hoop = this.getHoopGeometry();
    const postRect = {
      left: hoop.post.left,
      right: hoop.post.left + hoop.post.width,
      top: hoop.post.top,
      bottom: hoop.post.top + hoop.post.height,
    };

    if (!circleIntersectsRect(this.ball.x, this.ball.y, this.ball.radius, postRect)) {
      return;
    }

    const fromLeft = this.ball.lastY >= postRect.top - this.ball.radius
      && this.ball.lastY <= postRect.bottom + this.ball.radius
      && this.ball.x < (postRect.left + postRect.right) / 2;

    if (this.ball.vx >= 0 || fromLeft) {
      this.ball.x = postRect.left - this.ball.radius;
      this.ball.vx = -Math.abs(this.ball.vx) * this.game.config.physics.boardRestitution;
    } else {
      this.ball.x = postRect.right + this.ball.radius;
      this.ball.vx = Math.abs(this.ball.vx) * this.game.config.physics.boardRestitution;
    }
  }

  detectScore() {
    const hoop = this.getHoopGeometry();
    const crossedDownward = this.ball.lastY < hoop.scoreSensorY && this.ball.y >= hoop.scoreSensorY && this.ball.vy > 0;
    const withinHoop = this.ball.x > hoop.rimLeftX + hoop.scoreSensorPadding && this.ball.x < hoop.rimRightX - hoop.scoreSensorPadding;
    if (crossedDownward && withinHoop && !this.ball.hasScoredThisShot) {
      this.score += 2;
      this.ball.hasScoredThisShot = true;
      this.lastShotBand = "Enceste limpio";
      this.scheduleReset();
    }

    if (this.ball.x < -120 || this.ball.x > this.game.config.canvas.width + 120 || this.ball.y > this.game.config.canvas.height + 120) {
      this.scheduleReset();
    }
  }

  render(p5) {
    this.game.drawBackground(p5);
    this.game.drawClouds(p5, 1);
    this.drawCourtLayer(p5);
    this.drawHoop(p5);
    this.drawPlayer(p5);
    this.drawBall(p5);
    drawHud(p5, this.score, this.lastShotBand);
    drawPowerBar(p5, this.game.config, this.charge);
    this.drawDebugOverlay(p5);
  }

  drawCourtLayer(p5) {
    p5.push();
    p5.noStroke();
    p5.fill("rgba(0, 0, 0, 0.08)");
    p5.rect(0, this.game.config.physics.floorY, p5.width, p5.height - this.game.config.physics.floorY);
    p5.fill("rgba(255, 176, 86, 0.9)");
    p5.rect(0, this.game.config.physics.floorY - 8, p5.width, 8);
    p5.pop();
  }

  drawHoop(p5) {
    const hoop = this.getHoopGeometry();
    const rimImage = getDrawableSource(this.game.assets.hoop?.rim);
    const netImage = getDrawableSource(this.game.assets.hoop?.net);
    const connectorImage = getDrawableSource(this.game.assets.hoop?.connector);
    const postImage = getDrawableSource(this.game.assets.hoop?.post);
    const tripodImage = getDrawableSource(this.game.assets.hoop?.tripod);
    if (tripodImage) {
      p5.drawingContext.drawImage(tripodImage, hoop.tripod.left, hoop.tripod.top, hoop.tripod.width, hoop.tripod.height);
    }
    if (postImage) {
      p5.drawingContext.drawImage(postImage, hoop.post.left, hoop.post.top, hoop.post.width, hoop.post.height);
    }
    if (connectorImage) {
      p5.drawingContext.drawImage(connectorImage, hoop.connector.left, hoop.connector.top, hoop.connector.width, hoop.connector.height);
    }
    if (netImage) {
      p5.drawingContext.drawImage(netImage, hoop.net.left, hoop.net.top, hoop.net.width, hoop.net.height);
    }
    if (rimImage) {
      p5.drawingContext.drawImage(rimImage, hoop.rim.left, hoop.rim.top, hoop.rim.width, hoop.rim.height);
    }
  }

  drawPlayer(p5) {
    const render = this.player.getRenderState();
    const image = getDrawableSource(render.image);
    if (!image) {
      return;
    }
    p5.drawingContext.drawImage(image, render.left, render.top, render.width, render.height);
  }

  drawBall(p5) {
    const image = getDrawableSource(this.game.assets.ball);
    if (!image) {
      return;
    }

    p5.push();
    p5.translate(this.ball.x, this.ball.y);
    p5.rotate(this.ball.rotation);
    p5.drawingContext.drawImage(image, -this.ball.radius, -this.ball.radius, this.ball.radius * 2, this.ball.radius * 2);
    p5.pop();
  }

  getHoopGeometry() {
    const config = this.game.config.hoop;
    const rimSource = this.game.assets.hoop?.rim;
    const netSource = this.game.assets.hoop?.net;
    const connectorSource = this.game.assets.hoop?.connector;
    const postSource = this.game.assets.hoop?.post;
    const tripodSource = this.game.assets.hoop?.tripod;
    const rimWidth = (rimSource?.width ?? 400) * config.rimScale;
    const rimHeight = (rimSource?.height ?? 31) * config.rimScale;
    const rimLeftX = config.rimLeftX;
    const rimTopY = config.rimTopY;
    const rimRightX = rimLeftX + rimWidth;
    const rimY = rimTopY + rimHeight * 0.5;
    const edgeWidth = Math.max(6, rimWidth * config.edgeWidthScale);
    const edgeHeight = Math.max(18, rimHeight * 2.2);
    const netWidth = (netSource?.width ?? 371) * config.netScale;
    const netHeight = (netSource?.height ?? 282) * config.netScale;
    const connectorWidth = (connectorSource?.width ?? 152) * config.connectorScale;
    const connectorHeight = (connectorSource?.height ?? 198) * config.connectorScale;
    const postWidth = (postSource?.width ?? 34) * config.postScale;
    const postHeight = (postSource?.height ?? 907) * config.postScale;
    const tripodWidth = (tripodSource?.width ?? 22) * config.tripodScale;
    const tripodHeight = (tripodSource?.height ?? 312) * config.tripodScale;
    const connectorLeft = rimRightX + config.connectorOffsetX;
    const connectorTop = rimTopY + config.connectorOffsetY;
    const postLeft = connectorLeft + connectorWidth - 8;
    const postTop = this.game.config.physics.floorY - postHeight;
    const netRenderWidth = rimWidth * 0.88;
    return {
      rim: {
        left: rimLeftX,
        top: rimTopY,
        width: rimWidth,
        height: rimHeight,
      },
      rimLeftX,
      rimRightX,
      rimCenterX: rimLeftX + rimWidth / 2,
      rimY,
      scoreSensorY: rimY + config.scoreSensorYOffset,
      scoreSensorPadding: config.scoreSensorPadding,
      rimThickness: Math.max(4, config.rimThicknessScale * 7),
      leftEdgeRect: {
        left: rimLeftX - 2,
        right: rimLeftX + edgeWidth,
        top: rimTopY - 2,
        bottom: rimTopY + edgeHeight,
      },
      rightEdgeRect: {
        left: rimRightX - edgeWidth,
        right: rimRightX + 2,
        top: rimTopY - 2,
        bottom: rimTopY + edgeHeight,
      },
      net: {
        left: rimLeftX + (rimWidth - netRenderWidth) / 2,
        top: rimTopY + config.netOffsetY,
        width: netRenderWidth,
        height: netHeight,
      },
      connector: {
        left: connectorLeft,
        top: connectorTop,
        width: connectorWidth,
        height: connectorHeight,
      },
      post: {
        left: postLeft,
        top: postTop,
        width: postWidth,
        height: postHeight,
      },
      tripod: {
        left: postLeft + config.tripodOffsetX,
        top: this.game.config.physics.floorY - tripodHeight + config.tripodOffsetY,
        width: tripodWidth,
        height: tripodHeight,
      },
    };
  }

  drawDebugOverlay(p5) {
    if (!this.game.config.debug.showHoopOverlay) {
      return;
    }

    const hoop = this.getHoopGeometry();
    p5.push();
    p5.noFill();
    p5.strokeWeight(2);
    p5.stroke("rgba(255, 80, 80, 0.9)");
    p5.rect(hoop.leftEdgeRect.left, hoop.leftEdgeRect.top, hoop.leftEdgeRect.right - hoop.leftEdgeRect.left, hoop.leftEdgeRect.bottom - hoop.leftEdgeRect.top);
    p5.rect(hoop.rightEdgeRect.left, hoop.rightEdgeRect.top, hoop.rightEdgeRect.right - hoop.rightEdgeRect.left, hoop.rightEdgeRect.bottom - hoop.rightEdgeRect.top);
    p5.stroke("rgba(70, 255, 160, 0.9)");
    p5.line(hoop.rimLeftX + hoop.scoreSensorPadding, hoop.scoreSensorY, hoop.rimRightX - hoop.scoreSensorPadding, hoop.scoreSensorY);
    p5.stroke("rgba(60, 170, 255, 0.9)");
    p5.circle(hoop.rimCenterX, hoop.rimY - 28, 10);
    p5.pop();
  }
}
