import { StateMachine } from "../../../shared/stateMachine.js";
import { Fighter } from "../entities/fighter.js";
import { HitEffect } from "../entities/hitEffect.js";
import { Projectile } from "../entities/projectile.js";
import { BattleResolver } from "../systems/battleResolver.js";
import { drawImageRect } from "../renderUtils.js";

const TRANSITIONS = {
  intro: ["prepare"],
  prepare: ["countdown"],
  countdown: ["armed"],
  armed: ["shoot-window"],
  "shoot-window": ["resolve"],
  resolve: ["result"],
};

export class BattleScene {
  constructor(game) {
    this.game = game;
    this.machine = new StateMachine("intro", TRANSITIONS);
    this.resolver = new BattleResolver(game.config.battle);
    this.fighters = [];
    this.effects = [];
    this.projectiles = [];
    this.result = null;
    this.countdownLabel = "3";
    this.firstShotAt = null;
  }

  enter() {
    this.machine = new StateMachine("intro", TRANSITIONS);
    this.resolver.reset();
    this.effects = [];
    this.projectiles = [];
    this.result = null;
    this.countdownLabel = "3";
    this.firstShotAt = null;
    this.fighters = this.buildFighters();
    this.fighters.forEach((fighter) => fighter.setState("normal"));
  }

  buildFighters() {
    const leftSelection = this.game.state.selectedPlayers.left;
    const rightSelection = this.game.state.selectedPlayers.right;
    return [
      new Fighter({
        id: "left",
        label: "Player 1",
        side: "left",
        modelId: leftSelection.modelId,
        sprites: this.game.assets.models[leftSelection.modelId],
        layout: { base: this.game.config.fighter.left, effectOffsets: this.game.config.fighter.effectOffsets },
      }),
      new Fighter({
        id: "right",
        label: "Player 2",
        side: "right",
        modelId: rightSelection.modelId,
        sprites: this.game.assets.models[rightSelection.modelId],
        layout: { base: this.game.config.fighter.right, effectOffsets: this.game.config.fighter.effectOffsets },
      }),
    ];
  }

  update(dt) {
    const timeInState = this.machine.timeInState();
    this.effects.forEach((effect) => effect.update(dt));
    this.effects = this.effects.filter((effect) => effect.active);
    this.projectiles.forEach((projectile) => projectile.update(dt));
    this.projectiles = this.projectiles.filter((projectile) => projectile.active);

    if (this.machine.state === "intro" && timeInState >= this.game.config.battle.introMs) {
      this.fighters.forEach((fighter) => fighter.setState("prepare"));
      this.machine.transition("prepare");
      return;
    }

    if (this.machine.state === "prepare" && timeInState >= this.game.config.battle.prepareMs) {
      this.machine.transition("countdown");
      return;
    }

    if (this.machine.state === "countdown") {
      const step = Math.floor(timeInState / this.game.config.battle.countdownStepMs);
      this.countdownLabel = ["3", "2", "1", "DRAW"][step] ?? "DRAW";
      if (step >= 3) {
        this.machine.transition("armed");
      }
      return;
    }

    if (this.machine.state === "armed" && timeInState >= this.game.config.battle.armedMs) {
      this.machine.transition("shoot-window");
      return;
    }

    if (this.machine.state === "shoot-window") {
      if (this.firstShotAt !== null && timeInState - this.firstShotAt >= this.game.config.battle.simultaneousMarginMs) {
        this.resolveBattle();
        return;
      }

      if (timeInState >= this.game.config.battle.shootWindowMs) {
        this.resolveBattle();
        return;
      }
    }

    if (this.machine.state === "resolve" && timeInState >= this.game.config.battle.resolveMs) {
      this.machine.transition("result");
      this.game.state.setBattleResult(this.result);
      return;
    }

    if (this.machine.state === "result" && timeInState >= this.game.config.battle.resultDelayMs) {
      this.game.sceneManager.change("result");
    }
  }

  resolveBattle() {
    this.result = this.resolver.resolve(this.fighters);

    if (this.result.winner) {
      const winner = this.result.winner;
      const loser = this.result.loser;
      winner.setState("attack");
      loser?.setState("defeat");
      this.fighters.filter((fighter) => fighter !== winner && fighter !== loser).forEach((fighter) => fighter.setState("normal"));
      if (winner && loser) {
        this.spawnAttackEffects(winner, loser);
      }
    } else {
      this.fighters.forEach((fighter) => fighter.setState("normal"));
    }

    if (this.result.winner && this.result.loser) {
      this.result.winner.setState("victory");
      this.result.loser.setState("defeat");
    }

    this.firstShotAt = null;
    this.machine.transition("resolve");
  }

  spawnAttackEffects(attacker, target) {
    this.effects.push(new HitEffect({
      image: attacker.sprites.effect1,
      position: attacker.getEffectPosition("attack"),
      duration: 280,
      scale: 1,
    }));

    this.projectiles.push(new Projectile({
      start: attacker.getEffectPosition("attack"),
      end: target.getEffectPosition("hit"),
      duration: 240,
    }));

    this.effects.push(new HitEffect({
      image: attacker.sprites.effect2,
      position: target.getEffectPosition("hit"),
      duration: 360,
      scale: 1.1,
      delay: 170,
    }));
  }

  render(p5) {
    const stage = this.game.assets.shared.backgrounds[this.game.state.selectedStage];
    p5.background("#08111d");
    if (stage) {
      drawImageRect(p5, stage, 0, 0, p5.width, p5.height);
    }
    const shadow = this.game.assets.shared.shadow;
    if (shadow) {
      drawImageRect(p5, shadow, 0, 0, p5.width, p5.height, { alpha: 0.47 });
    }

    this.fighters.forEach((fighter) => fighter.draw(p5));
    this.projectiles.forEach((projectile) => projectile.draw(p5));
    this.effects.forEach((effect) => effect.draw(p5));

    p5.push();
    p5.noStroke();
    p5.fill("rgba(6, 14, 24, 0.62)");
    p5.rect(68, 118, 248, 94, 20);
    p5.rect(p5.width - 316, 118, 248, 94, 20);
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(28);
    p5.text("Player 1", 96, 154);
    p5.text("Player 2", p5.width - 288, 154);
    p5.textFont("IBM Plex Sans");
    p5.textSize(15);
    p5.fill("#b5c0d3");
    p5.text("F o mano abierta izquierda", 96, 182);
    p5.text("K o mano abierta derecha", p5.width - 288, 182);
    p5.pop();

    p5.push();
    p5.fill("rgba(4, 9, 15, 0.5)");
    p5.rect(0, 0, p5.width, 112);
    p5.fill("#f4f7fb");
    p5.textFont("Space Grotesk");
    p5.textSize(34);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text(this.getBattleBanner(), p5.width / 2, 56);
    p5.pop();

    if (this.machine.state === "countdown" || this.machine.state === "armed" || this.machine.state === "shoot-window") {
      p5.push();
      p5.textAlign(p5.CENTER, p5.CENTER);
      p5.textFont("Space Grotesk");
      p5.textSize(this.machine.state === "shoot-window" ? 82 : 118);
      p5.fill(this.machine.state === "shoot-window" ? "#ffd27d" : "#f4f7fb");
      p5.text(this.machine.state === "shoot-window" ? "DISPARA" : this.countdownLabel, p5.width / 2, 220);
      p5.pop();
    }
  }

  getBattleBanner() {
    switch (this.machine.state) {
      case "intro":
        return "Preparando escenario";
      case "prepare":
        return "Combatientes listos";
      case "countdown":
        return "Cuenta regresiva";
      case "armed":
        return "Preparados";
      case "shoot-window":
        return "Ventana de disparo activa - solo cuenta el primer tiro";
      case "resolve":
        return this.result?.winner ? `${this.result.winner.label} conecto el disparo` : "Nadie acerto a tiempo";
      default:
        return "Resultado";
    }
  }

  handleAction(action, payload = {}) {
    if (action === "BACK") {
      this.game.sceneManager.change("main-menu");
      return;
    }

    if (!["SHOOT_LEFT", "SHOOT_RIGHT", "SHOOT"].includes(action)) {
      return;
    }

    const now = performance.now();
    const playerId = action === "SHOOT_RIGHT" ? "right" : "left";

    if (this.machine.state === "shoot-window") {
      if (this.resolver.validShots.some((shot) => shot.playerId === playerId)) {
        return;
      }

      this.resolver.registerShot(playerId, payload.at ?? now, true);
      if (this.firstShotAt === null) {
        this.firstShotAt = this.machine.timeInState();
      }

      if (this.resolver.validShots.length >= 2) {
        this.resolveBattle();
      }
      return;
    }
  }

  exit() {}
  getStatusText() { return "Duel - Combate"; }
  getGestureMap() {
    return {
      OPEN_PALM_LEFT: "SHOOT_LEFT",
      OPEN_PALM_RIGHT: "SHOOT_RIGHT",
      FOUR_FINGERS: "SHOOT_RIGHT",
    };
  }
}
