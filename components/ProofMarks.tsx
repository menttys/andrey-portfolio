'use client';
/* Print-proof furniture around the page, replacing the old "Portfolio / 11.26" header label.
   - Crop marks in the four corners (fixed to the viewport).
   - A printed slug down the LEFT edge: PORTFOLIO / 11.26 · ANDREY® · PROOF 01 · APPROVED ✓ · SHEET n/6 · R G B.
     Hidden under 700px wide. A pencil bracket marks PORTFOLIO.
   - Pencil notes beside the green unit: "Portfolio / 11.26" written vertically with a bracket the unit's height,
     11.26 circled, "stet ✓". They follow the unit through a `proof:anchor` event from the scene (its box in document
     px; the last one is on window.__proofAnchor), so they scroll with it and keep the same gap at every width.
     Under 1100px wide, or where the vertical note wouldn't fit, it runs sideways just under the unit instead.
     Under 700px (phones) it is hidden, like the slug: the headline leaves no room under the unit.
   Everything is SVG/DOM on the paper: no WebGL, no extra GPU load. Strokes draw on once (skipped with reduced motion).
   SHEET follows the section knob through a `proof:sheet` event ({ detail: index }) sent from the scene. */
import { useEffect, useRef, useState } from 'react';

const LABEL = 'PORTFOLIO';
const MONTH = '11.26';
const SHEETS = 6;

// a seeded wobble so the pencil lines look drawn but stay the same on every load
function wobble(seed = 17) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; }; }
function linePath(pts: [number, number][], j = 1.2, r = wobble()) {
  return 'M' + pts.map(([x, y]) => `${(x + r() * j).toFixed(1)},${(y + r() * j).toFixed(1)}`).join(' L');
}
// a hand-drawn loop: a little more than one turn, not closed
function loopPath(cx: number, cy: number, rx: number, ry: number) {
  let d = '';
  for (let k = 0; k <= 46; k++) {
    const a = -Math.PI / 2 + (k / 40) * Math.PI * 2, jx = 1 + 0.04 * Math.sin(k * 0.7);
    d += `${k ? ' L' : 'M'}${(cx + rx * jx * Math.cos(a)).toFixed(1)},${(cy + ry * Math.sin(a) + k * 0.06).toFixed(1)}`;
  }
  return d;
}

type Stroke = { d: string; transform?: string };
type Box = { left: number; top: number; right: number; bottom: number };
declare global { interface Window { __proofAnchor?: Box } }

const NOTE_GAP = 50;        // px from the unit's right edge to the vertical note
const NOTE_DROP = 14;       // px from the unit's top to the note's top
const STET_UP = 40;         // px "stet" sits above the bracket's lower end
const SIDE_GAP = 12;        // px under the unit for the sideways note
const EDGE = 24;            // px the vertical note keeps clear of the window's right edge
const NOTE_W = 56;          // px the vertical note and its "stet" take up across

export default function ProofMarks() {
  const [sheet, setSheet] = useState(1);
  const [strokes, setStrokes] = useState<Stroke[]>([]);       // fixed to the window (the slug)
  const [noteStrokes, setNoteStrokes] = useState<Stroke[]>([]);   // in document px, following the unit
  const [wide, setWide] = useState(true);
  const portRef = useRef<HTMLElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLSpanElement>(null);
  const followRef = useRef<HTMLDivElement>(null);

  // the section knob tells us which sheet we're on
  useEffect(() => {
    const on = (e: Event) => setSheet(((e as CustomEvent<number>).detail ?? 0) + 1);
    addEventListener('proof:sheet', on);
    return () => removeEventListener('proof:sheet', on);
  }, []);

  // place the note beside the unit, then measure the pencil strokes against the real text; after the fonts have
  // loaded, on resize, and whenever the unit moves
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const follow = followRef.current;
      if (!follow) return;
      const a = window.__proofAnchor;
      const W = document.documentElement.clientWidth;
      const vertical = innerWidth >= 1100 && (!a || a.right + NOTE_GAP + NOTE_W <= W - EDGE);
      setWide(vertical);
      const set = (k: string, v: number | null) => (v === null ? follow.style.removeProperty(k) : follow.style.setProperty(k, `${Math.round(v)}px`));
      if (a && vertical) {
        set('--proof-note-left', a.right + NOTE_GAP);
        set('--proof-note-top', a.top + NOTE_DROP);
        set('--proof-stet-left', a.right + NOTE_GAP - 2);
        set('--proof-stet-top', a.bottom - STET_UP);
      } else if (a) {
        set('--proof-note-right', W - a.right);
        set('--proof-note-top', a.bottom + SIDE_GAP);
        set('--proof-stet-right', W - a.right + 160);
        set('--proof-stet-top', a.bottom + SIDE_GAP + 4);
      } else ['--proof-note-left', '--proof-note-top', '--proof-note-right', '--proof-stet-left', '--proof-stet-top', '--proof-stet-right'].forEach((k) => set(k, null));

      requestAnimationFrame(() => {
        const r = wobble();
        const pt = portRef.current?.getBoundingClientRect();
        setStrokes(pt && pt.width ? [{ d: linePath([[pt.right + 4, pt.y - 2], [pt.right + 11, pt.y - 2], [pt.right + 11, pt.bottom + 2], [pt.right + 4, pt.bottom + 2]], 0.8, r) }] : []);

        // the note's strokes live in document px, like the note itself
        const n = noteRef.current?.getBoundingClientRect(), y = yearRef.current?.getBoundingClientRect();
        if (!n || !y) return;
        const hb = { x: n.x + scrollX, y: n.y + scrollY, bottom: n.bottom + scrollY };
        const yb = { cx: y.x + y.width / 2 + scrollX, cy: y.y + y.height / 2 + scrollY, w: y.width, h: y.height };
        const out: Stroke[] = [];
        const rotate = `rotate(-4 ${yb.cx} ${yb.cy})`;
        if (vertical) {
          const bot = a ? a.bottom : hb.bottom + 150;
          out.push({ d: linePath([[hb.x - 4, hb.y - 2], [hb.x - 14, hb.y], [hb.x - 15, (hb.y + bot) / 2], [hb.x - 14, bot], [hb.x - 2, bot + 2]], 1.3, r) });
          out.push({ d: loopPath(yb.cx, yb.cy, yb.w / 2 + 5, yb.h / 2 + 8), transform: rotate });
        } else {
          out.push({ d: linePath([[hb.x - 6, hb.y + 2], [hb.x - 12, hb.y + 3], [hb.x - 12, hb.bottom + 4], [hb.x - 5, hb.bottom + 5]], 0.8, r) });
          out.push({ d: loopPath(yb.cx, yb.cy + 1, yb.w / 2 + 7, yb.h / 2 + 2), transform: rotate });
        }
        setNoteStrokes(out);
      });
    };
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
    document.fonts.ready.then(later);
    addEventListener('resize', later);
    addEventListener('proof:anchor', later);
    return () => { removeEventListener('resize', later); removeEventListener('proof:anchor', later); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
    <div className="proof" aria-hidden="true">
      <i className="crop bl" /><i className="crop br" />

      <div className="proof-slug">
        <b ref={portRef}>{LABEL}</b><b> / {MONTH}</b>
        <span className="dot">·</span><span>ANDREY®</span>
        <span className="dot">·</span><span>PROOF 01</span>
        <span className="dot">·</span><span>APPROVED <span className="ok">✓</span></span>
        <span className="dot">·</span><span>SHEET {sheet}/{SHEETS}</span>
        <span className="dot">·</span><span className="rgb">R G B</span>
      </div>

      <svg className="proof-pencil" width="100%" height="100%">
        <defs>
          <filter id="proof-grain" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="1.7" numOctaves={1} seed={5} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.45" result="m" />
            <feComposite in="SourceGraphic" in2="m" operator="in" />
          </filter>
        </defs>
        <g filter="url(#proof-grain)">
          {strokes.map((s, i) => <path key={i} d={s.d} transform={s.transform} pathLength={1} style={{ animationDelay: '0.5s' }} />)}
        </g>
      </svg>
    </div>

    <div ref={followRef} className="proof-follow" aria-hidden="true">
      <div ref={noteRef} className={`proof-note ${wide ? 'v' : 'h'}`}>
        Portfolio / <span ref={yearRef}>{MONTH}</span>
      </div>
      <div className={`proof-stet ${wide ? 'v' : 'h'}`}>stet ✓</div>
      <svg className="proof-pencil">
        <g filter="url(#proof-grain)">
          {noteStrokes.map((s, i) => <path key={i} d={s.d} transform={s.transform} pathLength={1} style={{ animationDelay: `${0.85 + i * 0.35}s` }} />)}
        </g>
      </svg>
    </div>
    </>
  );
}
