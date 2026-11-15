/* Small ink icons for the header line, drawn as strokes on a 26px grid centred on (x, y). */

const dot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };

export const icons = {
  sun(g, x, y) {
    g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
      g.lineTo(x + Math.cos(a) * 12.5, y + Math.sin(a) * 12.5);
      g.stroke();
    }
  },

  moon(g, x, y) {
    g.beginPath();
    g.arc(x, y, 10, 0.32 * Math.PI, 1.68 * Math.PI, false);
    g.arc(x + 6.5, y - 2.5, 8.2, 1.52 * Math.PI, 0.52 * Math.PI, true);
    g.closePath();
    g.stroke();
  },

  cloud(g, x, y) {
    g.beginPath();
    g.moveTo(x - 9, y + 6);
    g.arc(x - 8.5, y + 1.5, 4.6, 0.5 * Math.PI, 1.4 * Math.PI);
    g.arc(x - 0.5, y - 2, 6.6, 1.12 * Math.PI, 1.95 * Math.PI);
    g.arc(x + 8.5, y + 2, 4.2, 1.5 * Math.PI, 0.5 * Math.PI);
    g.closePath();
    g.stroke();
  },

  rain(g, x, y) {
    icons.cloud(g, x, y - 5);
    [-6, 0, 6].forEach((d) => { g.beginPath(); g.moveTo(x + d + 1.5, y + 6); g.lineTo(x + d - 1.5, y + 12); g.stroke(); });
  },

  drizzle(g, x, y) {
    icons.cloud(g, x, y - 5);
    [-6, 0, 6].forEach((d, i) => dot(g, x + d, y + 9 + (i % 2) * 2, 1.2));
  },

  storm(g, x, y) {
    icons.cloud(g, x, y - 5);
    g.beginPath();
    g.moveTo(x + 1.5, y + 3); g.lineTo(x - 2.5, y + 9); g.lineTo(x + 1.5, y + 9); g.lineTo(x - 1.5, y + 15);
    g.stroke();
  },

  snow(g, x, y) {
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3 + Math.PI / 2;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
      g.lineTo(x - Math.cos(a) * 11, y - Math.sin(a) * 11);
      g.stroke();
    }
    dot(g, x, y, 2);
  },

  fog(g, x, y) {
    [[-7, 11, 0], [0, 13, 3], [7, 9, -2]].forEach(([dy, w, dx]) => {
      g.beginPath(); g.moveTo(x - w + dx, y + dy); g.lineTo(x + w + dx, y + dy); g.stroke();
    });
  },
};
