'use client';

import { useState } from 'react';
import { JOBS } from '@/lib/content';
import SectionHead from './SectionHead';

type Job = (typeof JOBS)[number];

// Everything from the top down to and including this entry shows on first view; the rest sits behind "See more".
const LAST_VISIBLE = 'Trik';
const cut = JOBS.findIndex((j) => j.name === LAST_VISIBLE) + 1 || JOBS.length;
const SHOWN = JOBS.slice(0, cut);
const MORE = JOBS.slice(cut);

function JobRow({ j }: { j: Job }) {
  return (
    <div className={j.quiet ? 'job quiet' : 'job'}>
      <span className="mono">{j.dates}</span>
      <div><h3>{j.name}</h3><p>{j.text}</p></div>
      <span className="mono">{j.kind}</span>
    </div>
  );
}

export default function Experience() {
  const [open, setOpen] = useState(false);

  return (
    <section className="wrap index cv" id="experience" aria-label="Experience">
      <SectionHead title="Experience" caption="Web and design since 2006" />
      {SHOWN.map((j) => <JobRow j={j} key={j.dates + j.name} />)}
      {MORE.length > 0 && (
        <>
          {/* grid rows 0fr -> 1fr animates to the content's real height; inert keeps it out of tab order and the a11y tree while shut */}
          <div className={open ? 'jobs-more open' : 'jobs-more'} id="experience-more" inert={!open}>
            <div className="jobs-more-inner">
              {MORE.map((j) => <JobRow j={j} key={j.dates + j.name} />)}
            </div>
          </div>
          <button
            type="button"
            className="jobs-toggle mono"
            aria-expanded={open}
            aria-controls="experience-more"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'See less' : `See more (${MORE.length})`}
            <span className="jobs-toggle-mark" aria-hidden="true">+</span>
          </button>
        </>
      )}
    </section>
  );
}
