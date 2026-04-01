function getDrawableSource(image) {
  if (!image) {
    return null;
  }

  return image.canvas || image.elt || image;
}

export { getDrawableSource };

function drawOutlinedText(p5, text, x, y, fillColor = "#fff", strokeColor = "rgba(13, 21, 33, 0.92)", strokeWeight = 6) {
  p5.stroke(strokeColor);
  p5.strokeWeight(strokeWeight);
  p5.strokeJoin(p5.ROUND);
  p5.fill(fillColor);
  p5.text(text, x, y);
  p5.noStroke();
}

export function drawBasketButton(p5, label, x, y, width, height, active) {
  p5.push();
  p5.rectMode(p5.CENTER);
  p5.noStroke();
  p5.fill(active ? "#ffdb73" : "rgba(17, 32, 54, 0.88)");
  p5.rect(x, y, width, height, 20);
  p5.fill(active ? "#b46d1f" : "#78bbff");
  p5.rect(x, y + height * 0.24, width - 40, height * 0.16, 12);
  p5.stroke(active ? "#fff4cf" : "rgba(214, 237, 255, 0.48)");
  p5.strokeWeight(4);
  p5.noFill();
  p5.rect(x, y, width, height, 20);
  p5.noStroke();
  p5.fill(active ? "#341a07" : "#eff8ff");
  p5.textAlign(p5.CENTER, p5.CENTER);
  p5.textFont("Space Grotesk");
  p5.textStyle(p5.BOLD);
  p5.textSize(Math.min(42, height * 0.48));
  drawOutlinedText(p5, label, x, y - 8, active ? "#341a07" : "#eff8ff", active ? "rgba(255, 247, 214, 0.82)" : "rgba(8, 20, 38, 0.92)", 5);
  p5.pop();
}

export function drawPowerBar(p5, config, charge) {
  const bar = config.render.powerBar;
  const normalized = Math.max(0, Math.min(1, charge / config.ball.chargeMax));
  const perfectMin = config.ball.perfectCharge - config.ball.perfectWindow;
  const perfectMax = config.ball.perfectCharge + config.ball.perfectWindow;
  const perfectX = bar.x + (perfectMin / config.ball.chargeMax) * bar.width;
  const perfectWidth = ((perfectMax - perfectMin) / config.ball.chargeMax) * bar.width;

  p5.push();
  p5.noStroke();
  p5.fill("rgba(7, 16, 31, 0.78)");
  p5.rect(bar.x, bar.y, bar.width, bar.height, 999);
  p5.fill("rgba(255, 240, 173, 0.92)");
  p5.rect(perfectX, bar.y, perfectWidth, bar.height, 999);
  p5.fill("#ff9341");
  p5.rect(bar.x, bar.y, bar.width * normalized, bar.height, 999);
  p5.stroke("rgba(255, 255, 255, 0.28)");
  p5.strokeWeight(3);
  p5.noFill();
  p5.rect(bar.x, bar.y, bar.width, bar.height, 999);
  p5.noStroke();
  p5.fill("#f4f8ff");
  p5.textAlign(p5.LEFT, p5.BOTTOM);
  p5.textFont("IBM Plex Sans");
  p5.textSize(18);
  drawOutlinedText(p5, `Potencia ${Math.round(charge)}%`, bar.x, bar.y - 10, "#f4f8ff", "rgba(8, 20, 38, 0.95)", 4);
  p5.textAlign(p5.RIGHT, p5.BOTTOM);
  drawOutlinedText(p5, "Perfecto", perfectX + perfectWidth, bar.y - 10, "#fff5bf", "rgba(8, 20, 38, 0.95)", 4);
  p5.pop();
}

export function drawHud(p5, score, chargeResult) {
  p5.push();
  p5.noStroke();
  p5.fill("rgba(6, 16, 31, 0.78)");
  p5.rect(34, 24, 244, 70, 22);
  p5.fill("#f5fbff");
  p5.textAlign(p5.LEFT, p5.TOP);
  p5.textFont("Space Grotesk");
  p5.textStyle(p5.BOLD);
  p5.textSize(28);
  drawOutlinedText(p5, `Puntaje: ${score}`, 54, 40, "#f5fbff", "rgba(8, 20, 38, 0.95)", 5);
  if (chargeResult) {
    p5.textFont("IBM Plex Sans");
    p5.textStyle(p5.NORMAL);
    p5.textSize(16);
    drawOutlinedText(p5, chargeResult, 54, 76, "rgba(240, 248, 255, 0.92)", "rgba(8, 20, 38, 0.95)", 4);
  }
  p5.pop();
}

export { drawOutlinedText };
