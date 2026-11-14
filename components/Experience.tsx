import { JOBS } from '@/lib/content';
import SectionHead from './SectionHead';

export default function Experience() {
  return (
    <section className="wrap index cv" id="experience" aria-label="Experience">
      <SectionHead title="Experience" caption="Web and design since 2006" />
      {JOBS.map((j) => (
        <div className={j.quiet ? 'job quiet' : 'job'} key={j.dates + j.name}>
          <span className="mono">{j.dates}</span>
          <div><h3>{j.name}</h3><p>{j.text}</p></div>
          <span className="mono">{j.kind}</span>
        </div>
      ))}
    </section>
  );
}
