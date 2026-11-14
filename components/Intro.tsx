import { Fragment } from 'react';
import { HEADLINE, INTRO } from '@/lib/content';
import GoButton from './GoButton';

export default function Intro() {
  const words = HEADLINE.split(/\s+/);
  return (
    <section className="wrap hero" aria-label="Introduction">
      <h1 className="headline">
        {words.map((w, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            <span className={i === 0 ? 'w first' : 'w'}>{w}</span>
          </Fragment>
        ))}
      </h1>
      <div className="intro">
        <GoButton />
        <p>{INTRO}</p>
        <div className="meta"><span className="mono">Based in Spain / UK</span><span className="mono">Let’s talk partnerships</span></div>
        {/* the small "open to work" status unit, rendered by the scene */}
        <div className="otw" role="img" aria-label="Status: open to work"><canvas id="otw" aria-hidden="true" /></div>
      </div>
    </section>
  );
}
