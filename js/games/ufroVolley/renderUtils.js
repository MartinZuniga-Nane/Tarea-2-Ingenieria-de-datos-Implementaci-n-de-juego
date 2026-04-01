function getDrawableSource(image) {
  if (!image) {
    return null;
  }

  return image.canvas || image.elt || image;
}

export { getDrawableSource };

export function drawFlippedSprite(p5, image, x, y, width, height, flipX = false, rotation = 0) {
  const source = getDrawableSource(image);
  if (!source) {
    return;
  }

  p5.push();
  p5.translate(x, y);
  p5.rotate(rotation);
  p5.scale(flipX ? -1 : 1, 1);
  p5.drawingContext.drawImage(source, -width / 2, -height / 2, width, height);
  p5.pop();
}

export function drawShadow(p5, image, x, y, width, height, alpha = 1) {
  const source = getDrawableSource(image);
  if (!source) {
    return;
  }

  p5.push();
  p5.drawingContext.globalAlpha = alpha;
  p5.drawingContext.drawImage(source, x - width / 2, y - height / 2, width, height);
  p5.pop();
}

export function drawPixelTitle(p5, text, x, y, size, palette) {
  const letters = String(text ?? "").split("");
  const step = size * 0.73;
  const totalWidth = step * Math.max(0, letters.length - 1);
  let cursor = x - totalWidth / 2;

  letters.forEach((letter) => {
    if (letter === " ") {
      cursor += step * 0.6;
      return;
    }

    p5.push();
    p5.textAlign(p5.CENTER, p5.TOP);
    p5.textFont("Space Grotesk");
    p5.textStyle(p5.BOLD);
    p5.textSize(size);
    p5.fill(palette.shadow);
    p5.text(letter, cursor + 12, y + 12);
    p5.fill(palette.edge);
    p5.text(letter, cursor + 6, y + 6);
    p5.fill(palette.fill);
    p5.text(letter, cursor, y);
    p5.fill(palette.glow);
    p5.text(letter, cursor - 2, y - 4);
    p5.pop();
    cursor += step;
  });
}

export function drawPixelButton(p5, label, x, y, width, height, active) {
  p5.push();
  p5.rectMode(p5.CENTER);
  p5.noStroke();
  p5.fill(active ? "#ffd764" : "rgba(26, 43, 67, 0.9)");
  p5.rect(x, y, width, height, 18);
  p5.fill(active ? "#7c4b20" : "#7bb4db");
  p5.rect(x, y + height * 0.24, width - 42, height * 0.15, 10);
  p5.stroke(active ? "#fff5c4" : "rgba(220, 240, 255, 0.5)");
  p5.strokeWeight(4);
  p5.noFill();
  p5.rect(x, y, width, height, 18);
  p5.noStroke();
  p5.fill(active ? "#301a0b" : "#f0f8ff");
  p5.textAlign(p5.CENTER, p5.CENTER);
  p5.textFont("Space Grotesk");
  p5.textStyle(p5.BOLD);
  p5.textSize(Math.min(42, height * 0.5));
  p5.text(label, x, y - 10);
  p5.pop();
}

export function drawScorePanel(p5, config, scoreLeft, scoreRight) {
  const leftTeam = config.render.teams.left;
  const rightTeam = config.render.teams.right;

  p5.push();
  p5.rectMode(p5.CENTER);
  p5.noStroke();
  p5.fill("rgba(6, 16, 28, 0.72)");
  p5.rect(p5.width / 2, 86, 760, 102, 24);
  p5.fill(leftTeam.color);
  p5.rect(660, 86, 220, 72, 18);
  p5.fill(rightTeam.color);
  p5.rect(1260, 86, 220, 72, 18);
  p5.fill("rgba(255, 255, 255, 0.16)");
  p5.rect(p5.width / 2, 86, 180, 72, 18);
  p5.pop();

  p5.push();
  p5.textAlign(p5.CENTER, p5.CENTER);
  p5.textFont("Space Grotesk");
  p5.textStyle(p5.BOLD);
  p5.textSize(34);
  p5.fill(leftTeam.dark);
  p5.text(leftTeam.label, 660, 86);
  p5.fill(rightTeam.dark);
  p5.text(rightTeam.label, 1260, 86);
  p5.fill("#f5fbff");
  p5.textSize(48);
  p5.text(`${scoreLeft} - ${scoreRight}`, p5.width / 2, 86);
  p5.pop();
}

export function drawMessageBanner(p5, text) {
  if (!text) {
    return;
  }

  p5.push();
  p5.rectMode(p5.CENTER);
  p5.noStroke();
  p5.fill("rgba(9, 22, 38, 0.78)");
  p5.rect(p5.width / 2, 180, 520, 70, 18);
  p5.fill("#f8f1c0");
  p5.textAlign(p5.CENTER, p5.CENTER);
  p5.textFont("Space Grotesk");
  p5.textStyle(p5.BOLD);
  p5.textSize(32);
  p5.text(text, p5.width / 2, 180);
  p5.pop();
}
