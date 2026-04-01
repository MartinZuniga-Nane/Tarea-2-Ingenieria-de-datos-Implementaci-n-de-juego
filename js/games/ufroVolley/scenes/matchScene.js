import { Ball } from "../entities/ball.js";
import { PlayerBody } from "../entities/playerBody.js";
import { World } from "../physics/world.js";
import { createCourtCollisionMap, sampleGroundY } from "../physics/collisionMap.js";
import { drawFlippedSprite, drawMessageBanner, drawScorePanel, drawShadow, getDrawableSource } from "../renderUtils.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandomZone(zones) {
  return zones[Math.floor(Math.random() * zones.length)] ?? zones[0];
}

export class MatchScene {
  constructor(game) {
    this.game = game;
    this.collisionMap = createCourtCollisionMap(game.config);
    this.world = new World(game.config, this.collisionMap);
    this.players = [];
    this.ball = null;
    this.message = "";
    this.lockedUntil = 0;
    this.roundSettled = false;
    this.serveReleaseAt = 0;
    this.countdownValue = 0;
    this.pendingJumpTeam = null;
    this.serveSpawn = { x: 0, y: 0 };
    this.awaitingIntroDismiss = false;
  }

  enter() {
    this.game.state.setPhase("match");
    this.createEntities();
    this.awaitingIntroDismiss = true;
    this.message = "";
    this.countdownValue = 0;
    this.lockedUntil = 0;
    this.serveReleaseAt = 0;
    this.game.showMatchControls({
      onClose: () => {
        if (this.game.currentSceneKey !== "match") {
          return;
        }
        this.awaitingIntroDismiss = false;
        this.spawnRally();
      },
    });
  }

  exit() {
    this.players = [];
    this.ball = null;
  }

  getStatusText() {
    return "UfroVolley - partido";
  }

  createEntities() {
    const config = this.game.config;
    const assets = this.game.assets;
    const floorLeftFront = sampleGroundY(this.collisionMap, config.formation.left.frontBaseX);
    const floorLeftBack = sampleGroundY(this.collisionMap, config.formation.left.backBaseX);
    const floorRightFront = sampleGroundY(this.collisionMap, config.formation.right.frontBaseX);
    const floorRightBack = sampleGroundY(this.collisionMap, config.formation.right.backBaseX);

    this.players = [
      new PlayerBody({
        id: "left-front",
        team: "left",
        slot: "front",
        side: "left",
        baseX: config.formation.left.frontBaseX,
        baseY: floorLeftFront,
        allowedMinX: config.formation.leftBoundary + 36,
        allowedMaxX: config.net.x - config.formation.midlinePadding - 24,
        phaseOffset: 0.4,
        spriteSet: assets.teams.left.front,
        renderProfile: config.render.spriteProfiles[assets.teams.left.front.id],
        config,
      }),
      new PlayerBody({
        id: "left-back",
        team: "left",
        slot: "back",
        side: "left",
        baseX: config.formation.left.backBaseX,
        baseY: floorLeftBack,
        allowedMinX: config.formation.leftBoundary + 12,
        allowedMaxX: config.net.x - config.formation.midlinePadding - 36,
        phaseOffset: 1.55,
        spriteSet: assets.teams.left.back,
        renderProfile: config.render.spriteProfiles[assets.teams.left.back.id],
        config,
      }),
      new PlayerBody({
        id: "right-front",
        team: "right",
        slot: "front",
        side: "right",
        baseX: config.formation.right.frontBaseX,
        baseY: floorRightFront,
        allowedMinX: config.net.x + config.formation.midlinePadding + 24,
        allowedMaxX: config.formation.rightBoundary - 36,
        phaseOffset: 2.2,
        spriteSet: assets.teams.right.front,
        renderProfile: config.render.spriteProfiles[assets.teams.right.front.id],
        config,
      }),
      new PlayerBody({
        id: "right-back",
        team: "right",
        slot: "back",
        side: "right",
        baseX: config.formation.right.backBaseX,
        baseY: floorRightBack,
        allowedMinX: config.net.x + config.formation.midlinePadding + 36,
        allowedMaxX: config.formation.rightBoundary - 12,
        phaseOffset: 3.15,
        spriteSet: assets.teams.right.back,
        renderProfile: config.render.spriteProfiles[assets.teams.right.back.id],
        config,
      }),
    ];

    this.ball = new Ball(config);
    this.world.setPlayers(this.players);
    this.world.setBall(this.ball);
    this.world.reset();
  }

  spawnRally() {
    const servingTeam = this.game.state.servingTeam;
    this.players.forEach((player) => player.reset());
    this.world.reset();
    const serveZones = servingTeam === "left"
      ? [
        { min: 290, max: 480 },
        { min: 520, max: 760 },
        { min: 770, max: 900 },
      ]
      : [
        { min: 1020, max: 1150 },
        { min: 1160, max: 1400 },
        { min: 1440, max: 1630 },
      ];
    const zone = pickRandomZone(serveZones);
    const serveX = clamp(
      randomRange(zone.min, zone.max) + randomRange(-this.game.config.ball.serveSpawnJitterX * 0.35, this.game.config.ball.serveSpawnJitterX * 0.35),
      servingTeam === "left" ? 250 : 1010,
      servingTeam === "left" ? 910 : 1670,
    );
    const serveY = this.game.config.ball.spawnY + randomRange(0, this.game.config.ball.serveSpawnJitterY);
    this.serveSpawn.x = serveX;
    this.serveSpawn.y = serveY;
    this.ball.reset(serveX, serveY);
    this.ball.velocity.x = 0;
    this.ball.velocity.y = 0;
    this.ball.grounded = false;
    this.message = servingTeam === "left" ? "Sacan los gatos" : "Sacan los perros";
    this.serveReleaseAt = performance.now() + this.game.config.match.serveDelayMs;
    this.lockedUntil = this.serveReleaseAt;
    this.countdownValue = Math.ceil(this.game.config.match.serveDelayMs / 1000);
    this.pendingJumpTeam = null;
    this.roundSettled = false;
  }

  handleAction(action) {
    if (action === "BACK") {
      this.game.sceneManager.change("main-menu");
      return;
    }

    if (this.awaitingIntroDismiss) {
      return;
    }

    if (performance.now() < this.lockedUntil) {
      if (action === "JUMP_LEFT_TEAM") {
        this.pendingJumpTeam = "left";
      } else if (action === "JUMP_RIGHT_TEAM") {
        this.pendingJumpTeam = "right";
      }
      return;
    }

    if (action === "JUMP_LEFT_TEAM") {
      this.jumpTeam("left");
      return;
    }

    if (action === "JUMP_RIGHT_TEAM") {
      this.jumpTeam("right");
    }
  }

  jumpTeam(team) {
    const now = performance.now();
    const config = this.game.config.players;
    this.players
      .filter((player) => player.team === team)
      .forEach((player) => {
        const baseImpulseX = player.slot === "front" ? config.jumpImpulseFrontX : config.jumpImpulseBackX;
        player.jump(now, {
          impulseY: config.jumpImpulseY + randomRange(-config.jumpImpulseVarianceY, config.jumpImpulseVarianceY),
          impulseX: baseImpulseX + randomRange(-config.jumpImpulseVarianceX, config.jumpImpulseVarianceX),
          angularBoost: (player.slot === "front" ? 3.55 : 2.45) + randomRange(-config.jumpAngularVariance, config.jumpAngularVariance),
        });
      });
  }

  update(dt) {
    if (this.awaitingIntroDismiss) {
      return;
    }

    const now = performance.now();

    if (!this.roundSettled && now < this.serveReleaseAt) {
      this.countdownValue = Math.max(1, Math.ceil((this.serveReleaseAt - now) / 1000));
      this.ball.position.x = this.serveSpawn.x;
      this.ball.position.y = this.serveSpawn.y;
      this.ball.velocity.x = 0;
      this.ball.velocity.y = 0;
    } else if (!this.roundSettled && this.serveReleaseAt > 0) {
      this.releaseServe();
    }

    this.world.step(dt, now);

    if (now < this.lockedUntil) {
      return;
    }

    if (this.roundSettled) {
      return;
    }

    this.message = "";

    if (this.world.lastGroundContact) {
      const winner = this.world.lastGroundContact === "left" ? "right" : "left";
      this.awardPoint(winner);
    }
  }

  releaseServe() {
    const servingTeam = this.game.state.servingTeam;
    this.serveReleaseAt = 0;
    this.lockedUntil = 0;
    this.countdownValue = 0;
    this.ball.velocity.x = (servingTeam === "left" ? 90 : -90)
      + randomRange(-this.game.config.ball.serveVelocityJitterX, this.game.config.ball.serveVelocityJitterX);
    this.ball.velocity.y = 55 + randomRange(-this.game.config.ball.serveVelocityJitterY, this.game.config.ball.serveVelocityJitterY);

    if (this.pendingJumpTeam) {
      this.jumpTeam(this.pendingJumpTeam);
      this.pendingJumpTeam = null;
    }
  }

  awardPoint(team) {
    const now = performance.now();
    this.roundSettled = true;
    this.game.state.awardPoint(team);
    this.message = team === "left" ? "Punto para gatos" : "Punto para perros";
    this.lockedUntil = now + this.game.config.match.pointFreezeMs;

    if (this.game.state.matchWinner) {
      window.setTimeout(() => {
        if (this.game.currentSceneKey === "match") {
          this.game.sceneManager.change("result");
        }
      }, this.game.config.match.resultDelayMs);
      return;
    }

    this.game.state.swapServe();
    window.setTimeout(() => {
      if (this.game.currentSceneKey === "match") {
        this.spawnRally();
      }
    }, this.game.config.match.pointFreezeMs);
  }

  render(p5) {
    this.game.drawCourtBackground(p5);
    this.drawBallShadow(p5);
    this.drawPlayers(p5, "back");
    this.drawBall(p5);
    this.drawPlayers(p5, "front");
    this.drawNetOverlay(p5);
    drawScorePanel(p5, this.game.config, this.game.state.score.left, this.game.state.score.right);
    drawMessageBanner(p5, this.getBannerMessage());
    this.drawControlsHint(p5);
  }

  getBannerMessage() {
    if (this.countdownValue > 0) {
      return `Empieza en ${this.countdownValue}`;
    }

    return this.message;
  }

  drawPlayers(p5, slot) {
    this.players
      .filter((player) => player.slot === slot)
      .forEach((player) => {
        const renderState = player.getRenderState();
        drawFlippedSprite(
          p5,
          renderState.image,
          renderState.x,
          renderState.y,
          renderState.width,
          renderState.height,
          renderState.flipX,
          renderState.rotation,
        );
      });
  }

  drawBall(p5) {
    const ballImage = getDrawableSource(this.game.assets.ball);
    if (!ballImage) {
      p5.push();
      p5.noStroke();
      p5.fill("#ffffff");
      p5.circle(this.ball.position.x, this.ball.position.y, this.ball.radius * 2);
      p5.pop();
      return;
    }

    p5.push();
    p5.translate(this.ball.position.x, this.ball.position.y);
    p5.rotate(this.ball.rotation);
    p5.drawingContext.drawImage(ballImage, -this.ball.radius * 1.15, -this.ball.radius * 1.15, this.ball.radius * 2.3, this.ball.radius * 2.3);
    p5.pop();
  }

  drawBallShadow(p5) {
    const floorY = sampleGroundY(this.collisionMap, this.ball.position.x);
    const heightAboveGround = clamp(floorY - this.ball.position.y, 0, 420);
    const amount = 1 - heightAboveGround / 420;
    const scale = this.game.config.render.shadows.ballMinScale
      + (this.game.config.render.shadows.ballMaxScale - this.game.config.render.shadows.ballMinScale) * amount;
    const alpha = this.game.config.render.shadows.alphaMin
      + (this.game.config.render.shadows.alphaMax - this.game.config.render.shadows.alphaMin) * amount;
    const shadowImage = amount > 0.64 ? this.game.assets.ballShadowLarge : this.game.assets.ballShadowSmall;
    const width = 220 * scale;
    const height = 68 * scale;
    drawShadow(p5, shadowImage, this.ball.position.x, floorY + 6, width, height, alpha);
  }

  drawNetOverlay(p5) {
    const netPost = getDrawableSource(this.game.assets.netPost);
    const postConfig = this.game.config.render.netPost;
    const floorY = sampleGroundY(this.collisionMap, this.game.config.net.x);
    const postX = this.game.config.net.x - postConfig.width / 2;
    const postBottom = postConfig.topY + postConfig.height;

    p5.push();
    if (netPost) {
      p5.drawingContext.drawImage(netPost, postX, postConfig.topY, postConfig.width, postConfig.height);
    }
    if (floorY > postBottom) {
      p5.noStroke();
      p5.fill(postConfig.extensionColor);
      p5.rect(this.game.config.net.x - postConfig.extensionWidth / 2, postBottom - 1, postConfig.extensionWidth, floorY - postBottom + 8, 8);
    }
    p5.pop();
  }

  drawControlsHint(p5) {
    p5.push();
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textFont("IBM Plex Sans");
    p5.textSize(22);
    p5.fill("rgba(245, 249, 255, 0.88)");
    p5.text("F o mano izquierda abierta = gatos | J o mano derecha abierta = perros | Esc menu", p5.width / 2, 1024);
    p5.pop();
  }
}
