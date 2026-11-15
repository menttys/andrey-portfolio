/* Shared 2D-canvas drawing: the palette, the fonts and the text/line helpers the screens are painted with. */

export const ORANGE = '#C8552F';
export const OLIVE = '#8C9F33';
export const LIME = '#D6E24A';
export const GREY = '#8F9093';
export const PALE = '#A9AAAE';
export const WAVE = '#C3C8E4';
export const PAPER_INK = 'rgba(120,120,120,0.9)';   // the grey the captions are printed in

export const DISPLAY = 'Unbounded, "Arial Black", Arial, sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';

const FONTS_TO_LOAD = [
  '200 100px Unbounded', '300 100px Unbounded', '400 100px Unbounded', '500 100px Unbounded', '600 100px Unbounded',
  '700 100px Unbounded', '800 100px Unbounded', '900 100px Unbounded',
  '500 30px Unbounded', '400 30px Unbounded',
  '700 30px "JetBrains Mono"', '500 30px "JetBrains Mono"', '400 30px "JetBrains Mono"',
];

export const loadFonts = () => Promise.all(FONTS_TO_LOAD.map((f) => document.fonts.load(f))).catch(() => {});

export const setLetterSpacing = (ctx, value) => { if ('letterSpacing' in ctx) ctx.letterSpacing = value; };

/** fit a string to an exact box so the layout matches whatever font metrics load */
export function fitText(ctx, text, x, yBase, width, capHeight, font, weight, color, spacing = 0) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  setLetterSpacing(ctx, spacing + 'px');
  ctx.font = `${weight} 100px ${font}`;
  const m = ctx.measureText(text);
  const cap = m.actualBoundingBoxAscent || 72, naturalWidth = m.width - spacing;
  const sy = capHeight / cap, sx = width / naturalWidth;
  ctx.translate(x - (m.actualBoundingBoxLeft || 0) * sx, yBase);
  ctx.scale(sx, sy);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function monoText(ctx, text, x, y, size, color, weight = 500) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${MONO}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

/** a row of slanted strokes, the PALESTRA mark */
export function hatch(ctx, x, yBottom, count, step, height, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'butt';
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * step, yBottom);
    ctx.lineTo(x + i * step + height * 0.5, yBottom - height);
    ctx.stroke();
  }
}

/** the dark screen ground with a faint vignette */
export function darkPanel(ctx, w, h) {
  ctx.fillStyle = '#0B0C10';
  ctx.fillRect(0, 0, w, h);
  const vignette = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.5, h * 0.5, w * 0.8);
  vignette.addColorStop(0, 'rgba(255,255,255,0.03)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}
