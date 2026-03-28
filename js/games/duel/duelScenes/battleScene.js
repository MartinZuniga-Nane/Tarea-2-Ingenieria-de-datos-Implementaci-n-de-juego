import { StateMachine } from "../../../shared/stateMachine.js";
import { Fighter } from "../entities/fighter.js";
import { HitEffect } from "../entities/hitEffect.js";
import { Projectile } from "../entities/projectile.js";
import { BattleResolver } from "../systems/battleResolver.js";

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
    this.aiShotAt = null;
  }

  enter() {
    this.machine = new StateMachine("intro", TRANSITIONS);
    this.resolver.reset();
    this.effects = [];
    this.projectiles = [];
    this.result = null;
    this.countdownLabel = "3";
    this.aiShotAt = null;
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
      const { min, max } = this.game.config.battle.opponentReactionMs;
      this.aiShotAt = min + Math.random() * (max - min);
      this.machine.transition("shoot-window");
      return;
    }

    if (this.machine.state === "shoot-window") {
      if (this.aiShotAt !== null && timeInState >= this.aiShotAt && !this.resolver.validShots.some((shot) => shot.playerId === "right")) {
        this.resolver.registerShot("right", performance.now(), true);
      }

      if (this.resolver.validShots.length >= 2) {
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

    this.aiShotAt = null;
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
      p5.image(stage, 0, 0, p5.width, p5.height);
    }
    const shadow = this.game.assets.shared.shadow;
    if (shadow) {
      p5.tint(255, 120);
      p5.image(shadow, 0, 0, p5.width, p5.height);
      p5.noTint();
    }

    this.fighters.forEach((fighter) => fighter.draw(p5));
    this.projectiles.forEach((projectile) => projectile.draw(p5));
    this.effects.forEach((effect) => effect.draw(p5));

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
        return "Ventana de disparo activa";
      case "resolve":
        return this.result?.winner ? `${this.result.winner.label} conecto el disparo` : "Nadie acerto a tiempo";
      default:
        return "Resultado";
    }
  }

  handleAction(action) {
    if (action === "BACK") {
      this.game.sceneManager.change("main-menu");
      return;
    }

    if (action !== "SHOOT") {
      return;
    }

    const now = performance.now();

    if (this.machine.state === "shoot-window") {
      if (!this.resolver.validShots.some((shot) => shot.playerId === "left")) {
        this.resolver.registerShot("left", now, true);
      }

      if (this.resolver.validShots.length >= 2) {
        this.resolveBattle();
      }
      return;
    }

    if (["intro", "prepare", "countdown", "armed"].includes(this.machine.state)) {
      this.resolver.registerShot("left", now, false);
      this.resolveBattle();
    }
  }

  exit() {}
  getStatusText() { return "Duel - Combate"; }
  getGestureMap() { return { OPEN_PALM: "SHOOT" }; }
}
