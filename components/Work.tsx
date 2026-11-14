import { WORK } from '@/lib/content';
import SectionHead from './SectionHead';

export default function Work() {
  return (
    <section className="wrap index" id="work" aria-label="Selected work">
      <SectionHead title="Selected work" caption="Mobile & web · 2018 — 2026" />
      {WORK.map((w) => (
        <a className="row" tabIndex={0} key={w.num} style={{ '--c': w.color } as React.CSSProperties}>
          <div className="num">{w.num}</div>
          <div className="meta"><h3>{w.name}</h3><p>{w.text}</p></div>
          <div className="meta mono"><span>Role / {w.role}</span><span>Year / {w.year}</span></div>
        </a>
      ))}
    </section>
  );
}
