export class MenuButton {
  constructor({ label, x, y, width, height, description = "" }) {
    this.label = label;
    this.description = description;
    this.bounds = { x, y, width, height };
  }

  draw(p5, { active = false, alpha = 1 } = {}) {
    const { x, y, width, height } = this.bounds;
    const titleSize = Math.max(22, Math.min(38, width * 0.09));
    const subtitleSize = Math.max(12, Math.min(17, width * 0.04));
    p5.push();
    p5.rectMode(p5.CENTER);
    p5.noStroke();
    p5.fill(active ? `rgba(62, 193, 182, ${0.9 * alpha})` : `rgba(10, 19, 33, ${0.68 * alpha})`);
    p5.rect(x, y, width, height, 18);
    p5.stroke(active ? "rgba(208, 255, 251, 0.95)" : `rgba(174, 195, 222, ${0.35 * alpha})`);
    p5.noFill();
    p5.rect(x, y, width, height, 18);
    p5.noStroke();
    p5.fill(active ? "#061018" : "#f4f7fb");
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textFont("Space Grotesk");
    p5.textSize(titleSize);
    p5.text(this.label, x, y - (this.description ? 10 : 0));

    if (this.description) {
      p5.fill(active ? "rgba(6, 16, 24, 0.82)" : "rgba(181, 192, 211, 0.95)");
      p5.textFont("IBM Plex Sans");
      p5.textSize(subtitleSize);
      p5.text(this.description, x, y + 21, width - 36);
    }
    p5.pop();
  }
}
