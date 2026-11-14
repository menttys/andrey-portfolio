import Header from '@/components/Header';
import Intro from '@/components/Intro';
import Work from '@/components/Work';
import Experience from '@/components/Experience';
import Contributions from '@/components/Contributions';
import Skills from '@/components/Skills';
import Contact from '@/components/Contact';
import DeviceScene from '@/components/DeviceScene';

export default function Home() {
  return (
    <>
      <div className="wash" id="wash" aria-hidden="true" />
      <div id="dim" aria-hidden="true" />
      <Header />
      <main>
        <div className="wrap pin">
          <div className="stage" id="stage">
            <canvas
              id="gl"
              aria-label="Two tactile hardware devices on grey paper: a concrete-grey unit with a tan rim, an orange screen showing the current section number and two dark knobs, and an olive green unit with a waveform screen showing 35 and two white knobs. The first knob on the grey unit is a six-position selector: each click brings the next page section up under the devices."
            />
          </div>
        </div>
        {/* .flow is what the section knob slides up under the devices */}
        <div className="flow" id="flow">
          <Intro />
          <Work />
          <Experience />
          <Contributions />
          <Skills />
          <Contact />
        </div>
      </main>
      <DeviceScene />
    </>
  );
}
