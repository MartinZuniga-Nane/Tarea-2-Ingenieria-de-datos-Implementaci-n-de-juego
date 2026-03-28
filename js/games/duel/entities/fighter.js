import { drawImageCentered } from "../renderUtils.js";

export class Fighter {
  constructor({ id, label, side, modelId, sprites, layout }) {
    this.id = id;
    this.label = label;
    this.side = side;
    this.modelId = modelId;
    this.sprites = sprites;
    this.layout = layout;
    this.visualState = "normal";
    this.entryOffset = side === "left" ? -260 : 260;
  }

  setState(state) {
    this.visualState = state;
  }

  getSprite() {
    return this.sprites[this.visualState] || this.sprites.normal || null;
  }

  getEffectPosition(kind) {
    const base = this.layout.effectOffsets?.[this.side]?.[kind] ?? { x: 0, y: 0 };
    return {
      x: this.layout.base.x + base.x,
      y: this.layout.base.y + base.y,
    };
  }

  draw(p5, { alpha = 1, slide = 0, scale = 1 } = {}) {
    const sprite = this.getSprite();
    const x = this.layout.base.x + this.entryOffset * slide;
    const y = this.layout.base.y;
    const width = this.layout.base.width * scale;
    const height = this.layout.base.height * scale;

    p5.push();

    if (sprite) {
      drawImageCentered(p5, sprite, x, y, width, height, {
        alpha,
        flipX: this.side === "right",
      });
    } else {
      p5.noStroke();
      p5.fill(this.side === "left" ? "#3ec1b6" : "#ff7676");
      p5.rectMode(p5.CENTER);
      p5.rect(x, y, width, height, 20);
    }

    p5.pop();
  }
}
