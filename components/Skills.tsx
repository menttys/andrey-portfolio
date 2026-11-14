import { SKILLS } from '@/lib/content';
import SectionHead from './SectionHead';

export default function Skills() {
  return (
    <section className="wrap index cv" id="skills" aria-label="Skills and tools">
      <SectionHead title="Skills & tools" caption="Techs || interests" />
      <div className="skills">
        {SKILLS.map((s) => (
          <div className="skill" key={s.num}><span className="mono">{s.num}</span><h3>{s.name}</h3><p>{s.text}</p></div>
        ))}
      </div>
    </section>
  );
}
