import { Fighter } from "../entities/fighter.js";
import { AnimationSystem } from "../systems/animationSystem.js";
import { drawImageRect } from "../renderUtils.js";

export class VersusScene {
  constructor(game) {
    this.game = game;
    this.elapsed = 0;
    this.fighters = [];
  }

  enter() {
    this.elapsed = 0;
    this.fighters = this.buildFighters();
  }

  buildFighters() {
    const leftSelection = this.game.state.selectedPlayers.left;
    const rightSelection = this.game.state.selectedPlayers.right;
    const leftLayout = { base: this.game.config.fighter.left, effectOffsets: this.game.config.fighter.effectOffsets };
    const rightLayout = { base: this.game.config.fighter.right, effectOffsets: this.game.config.fighter.effectOffsets };

    return [
      new Fighter({
        id: "left",
        label: "Player 1",
        side: "left",
        modelId: leftSelection.modelId,
        sprites: this.game.assets.models[leftSelection.modelId],
        layout: leftLayout,
      }),
      new Fighter({
        id: "right",
        label: "Player 2",
        side: "right",
        modelId: rightSelection.modelId,
        sprites: this.game.assets.models[rightSelection.modelId],
        layout: rightLayout,
      }),
    ];
  }

  update(dt) {
    this.elapsed += dt;
    if (this.elapsed >= 1800) {
      this.game.sceneManager.change("battle");
    }
  }

  render(p5) {
    const stage = this.game.assets.shared.backgrounds[this.game.state.selectedStage];
    p5.background("#08111d");
    if (stage) {
      drawImageRect(p5, stage, 0, 0, p5.width, p5.height, { alpha: 0.43 });
    }

    const t = AnimationSystem.easeOutCubic(AnimationSystem.normalized(this.elapsed, 1200));
    const overlayAlpha = 1 - AnimationSystem.normalized(this.elapsed, 1800);

    this.fighters[0]?.draw(p5, { slide: 1 - t, scale: 0.92 });
    this.fighters[1]?.draw(p5, { slide: 1 - t, scale: 0.92 });

    p5.push();
    p5.noStroke();
    p5.fill("rgba(3, 8, 14, 0.24)");
    p5.rect(94, 92, p5.width - 188, p5.height - 144, 30);
    p5.pop();

    p5.push();
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textFont("Space Grotesk");
    p5.textSize(72);
    p5.fill(244, 247, 251, 220);
    p5.text("VERSUS", p5.width / 2, 110);
    p5.textSize(24);
    p5.text("Player 1", 240, 132);
    p5.text("Player 2", p5.width - 240, 132);
    p5.pop();

    p5.push();
    p5.fill(3, 8, 14, overlayAlpha * 180);
    p5.rect(0, 0, p5.width, p5.height);
    p5.pop();
  }

  handleAction() {}
  exit() {}
  getStatusText() { return "Duel - Versus"; }
  getGestureMap() { return {}; }
}
