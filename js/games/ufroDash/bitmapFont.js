const GLYPHS = {
  A: { x: 1480, y: 433, width: 82, height: 82 },
  C: { x: 783, y: 655, width: 74, height: 82 },
  D: { x: 1398, y: 655, width: 71, height: 82 },
  E: { x: 783, y: 544, width: 81, height: 82 },
  F: { x: 1234, y: 766, width: 59, height: 82 },
  G: { x: 1435, y: 544, width: 77, height: 82 },
  H: { x: 783, y: 766, width: 63, height: 82 },
  I: { x: 1496, y: 766, width: 38, height: 82 },
  J: { x: 1147, y: 301, width: 33, height: 103 },
  L: { x: 875, y: 766, width: 61, height: 82 },
  M: { x: 894, y: 544, width: 80, height: 82 },
  N: { x: 1003, y: 544, width: 79, height: 82 },
  O: { x: 1111, y: 544, width: 79, height: 82 },
  P: { x: 1425, y: 169, width: 75, height: 103 },
  R: { x: 1368, y: 433, width: 83, height: 82 },
  S: { x: 1541, y: 544, width: 77, height: 82 },
  T: { x: 1410, y: 766, width: 57, height: 82 },
  U: { x: 886, y: 655, width: 73, height: 82 },
  Y: { x: 1322, y: 766, width: 59, height: 82 },
};

function isDrawableImage(image) {
  return Boolean(image && typeof image.width === "number" && typeof image.height === "number");
}

export class BitmapFont {
  constructor(image) {
    this.image = image;
  }

  measure(text, size, spacing = 0.08) {
    const scale = size / 82;
    const glyphs = String(text ?? "").toUpperCase().split("");
    let width = 0;

    glyphs.forEach((char, index) => {
      const glyph = GLYPHS[char];
      if (!glyph) {
        width += size * 0.38;
        return;
      }

      width += glyph.width * scale;
      if (index < glyphs.length - 1) {
        width += size * spacing;
      }
    });

    return width;
  }

  draw(p5, text, x, y, size, options = {}) {
    if (!isDrawableImage(this.image)) {
      return;
    }

    const { align = "left", tint = null, spacing = 0.08 } = options;
    const glyphs = String(text ?? "").toUpperCase().split("");
    const scale = size / 82;
    const totalWidth = this.measure(text, size, spacing);
    let cursor = x;

    if (align === "center") {
      cursor -= totalWidth / 2;
    } else if (align === "right") {
      cursor -= totalWidth;
    }

    p5.push();
    p5.noSmooth();
    if (tint) {
      p5.tint(...tint);
    }

    glyphs.forEach((char, index) => {
      const glyph = GLYPHS[char];
      if (!glyph) {
        cursor += size * 0.38;
        return;
      }

      const drawWidth = glyph.width * scale;
      const drawHeight = glyph.height * scale;
      p5.drawingContext.drawImage(
        this.image,
        glyph.x,
        glyph.y,
        glyph.width,
        glyph.height,
        cursor,
        y,
        drawWidth,
        drawHeight,
      );

      cursor += drawWidth;
      if (index < glyphs.length - 1) {
        cursor += size * spacing;
      }
    });

    p5.pop();
  }
}
