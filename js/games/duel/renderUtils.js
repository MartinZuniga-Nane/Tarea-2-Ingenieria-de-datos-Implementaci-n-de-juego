export function getDrawableSource(image) {
  if (!image) {
    return null;
  }

  return image.canvas || image.elt || image;
}

export function drawImageRect(p5, image, x, y, width, height, options = {}) {
  const source = getDrawableSource(image);
  if (!source) {
    return false;
  }

  const { alpha = 1, flipX = false } = options;
  p5.push();
  p5.drawingContext.save();
  p5.drawingContext.globalAlpha = alpha;

  if (flipX) {
    p5.translate(x + width / 2, y + height / 2);
    p5.scale(-1, 1);
    p5.drawingContext.drawImage(source, -width / 2, -height / 2, width, height);
  } else {
    p5.drawingContext.drawImage(source, x, y, width, height);
  }

  p5.drawingContext.restore();
  p5.pop();
  return true;
}

export function drawImageCentered(p5, image, x, y, width, height, options = {}) {
  return drawImageRect(p5, image, x - width / 2, y - height / 2, width, height, options);
}
