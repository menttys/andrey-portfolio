'use client';

/* GitHub contributions, one square per day. Live data comes from /api/commits (the token stays on the server; set
   GITHUB_USER and optionally GITHUB_TOKEN). If that isn't reachable it asks the public calendar at
   github-contributions-api.jogruber.de directly. Shows the last four calendar years in one strip.
   Until data arrives empty years are drawn. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GH_USER } from '@/lib/content';
import SectionHead from './SectionHead';

type Day = { date: string; count: number; level: number };

const YEARS = 4;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const thisYear = () => new Date().getFullYear();
const firstYear = () => thisYear() - YEARS + 1;

// every day from Jan 1 of the oldest year up to today, all empty: drawn until the data arrives
function emptyYears(): Day[] {
  const days: Day[] = [], end = iso(new Date());
  for (let d = new Date(Date.UTC(firstYear(), 0, 1)); iso(d) <= end; d.setUTCDate(d.getUTCDate() + 1)) days.push({ date: iso(d), count: 0, level: 0 });
  return days;
}

const getJSON = (url: string) => fetch(url, { signal: AbortSignal.timeout(6000) })
  .then((r) => (r.ok ? r.json() : Promise.reject()))
  .then((j) => (j && j.contributions && j.contributions.length ? j : Promise.reject()));

export default function Contributions() {
  const [days, setDays] = useState<Day[] | null>(null);
  const [live, setLive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDays(emptyYears());
    let gone = false;
    const ys = Array.from({ length: YEARS }, (_, i) => 'y=' + (firstYear() + i)).join('&');
    getJSON('/api/commits?user=' + encodeURIComponent(GH_USER))
      .catch(() => getJSON('https://github-contributions-api.jogruber.de/v4/' + GH_USER + '?' + ys))
      .then((j) => {
        if (gone) return;
        const today = iso(new Date());
        setDays((j.contributions as Day[]).filter((d) => d.date <= today && d.date >= firstYear() + '-01-01'));
        setLive(true);
      })
      .catch(() => {}); // keep the empty grid
    return () => { gone = true; };
  }, []);

  // on narrow screens the strip scrolls sideways; start at the newest days
  useLayoutEffect(() => {
    const sc = scrollRef.current; if (sc) sc.scrollLeft = sc.scrollWidth;
  }, [days]);

  // one continuous strip, Jan 1 of the oldest year to today; a week per column, Sunday on top
  const all = days ?? [];
  const lead = all.length ? new Date(all[0].date + 'T00:00:00').getDay() : 0;
  const cols = Math.ceil((all.length + lead) / 7) || 1;
  const sum = all.reduce((s, d) => s + d.count, 0);
  // a label over the column each year starts in, with that year's total
  const years = Array.from({ length: YEARS }, (_, i) => firstYear() + i).map((year) => {
    const i = all.findIndex((d) => d.date.startsWith(year + '-'));
    const n = all.filter((d) => d.date.startsWith(year + '-')).reduce((s, d) => s + d.count, 0);
    return { year, col: i < 0 ? 0 : Math.floor((i + lead) / 7), sum: n };
  });

  return (
    <section className="wrap index cv" id="github" aria-label="GitHub contributions">
      <SectionHead title="Contributions" caption={`github.com/${GH_USER} ↗`} href={`https://github.com/${GH_USER}`} />
      <div className="gh">
        <div className="gh-total"><span className="gh-num" id="gh-total">{live ? sum.toLocaleString('en-GB') : '—'}</span><span className="mono">contributions in the last {YEARS} years</span></div>
        <div className="gh-scroll" ref={scrollRef}>
          <div className="gh-strip" style={{ '--cols': cols } as React.CSSProperties}>
            <div className="gh-years mono">
              {years.map((y) => (
                <span key={y.year} style={{ left: (y.col / cols) * 100 + '%' }}>{y.year}<em>{live ? y.sum.toLocaleString('en-GB') : '—'}</em></span>
              ))}
            </div>
            <div className="gh-grid gh-grid--strip" id="gh-grid" role="img"
              aria-label={live ? `${sum} GitHub contributions in the last ${YEARS} years` : 'GitHub contribution calendar'}>
              {Array.from({ length: lead }, (_, k) => <span key={'pad' + k} />)}
              {all.map((d) => <i key={d.date} className={d.level ? 'l' + d.level : undefined} title={`${d.count} contributions · ${d.date}`} />)}
            </div>
          </div>
        </div>
        <div className="gh-legend mono"><span>Less</span><i className="l0" /><i className="l1" /><i className="l2" /><i className="l3" /><i className="l4" /><span>More</span></div>
      </div>
    </section>
  );
}
