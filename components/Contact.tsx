'use client';

import { useEffect, useRef, useState } from 'react';
import { EMAIL } from '@/lib/content';

function Clock() {
  const [now, setNow] = useState('--:--:--');
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Madrid' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span id="clock">{now}</span>;
}

export default function Contact() {
  const [label, setLabel] = useState('Copy email');
  const emailRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(EMAIL.user + EMAIL.domain);
      setLabel('Copied');
    } catch {
      const r = document.createRange(); r.selectNodeContents(emailRef.current!);
      const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
      setLabel('Selected, press Ctrl+C');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLabel('Copy email'), 1800);
  }

  return (
    <section className="wrap contact" id="contact" aria-label="Contact">
      <span className="mono">Contact / Open for new work</span>
      <div className="big" id="email" ref={emailRef}>{EMAIL.user}<span>{EMAIL.domain}</span></div>
      <button className="copy" id="copy" onClick={copy}>{label}</button>
      <footer>
        <span className="mono">Andrey Furlan de Souza — Senior software engineer</span>
        <span className="mono">Local time <Clock /></span>
        <nav className="social" aria-label="Elsewhere">
          <a className="mono" href="https://github.com/menttys" target="_blank" rel="noopener">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>GitHub
          </a>
          <a className="mono" href="https://linkedin.com/in/andrey-furlan-souza" target="_blank" rel="noopener">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M13.63 0H2.37A2.37 2.37 0 000 2.37v11.26A2.37 2.37 0 002.37 16h11.26A2.37 2.37 0 0016 13.63V2.37A2.37 2.37 0 0013.63 0zM4.94 13.5H2.6V6h2.34zM3.77 4.97a1.36 1.36 0 110-2.71 1.36 1.36 0 010 2.71zM13.5 13.5h-2.33V9.85c0-.87-.02-1.99-1.21-1.99-1.22 0-1.4.95-1.4 1.93v3.71H6.23V6h2.24v1.02h.03c.31-.59 1.07-1.21 2.21-1.21 2.36 0 2.8 1.55 2.8 3.57z" /></svg>LinkedIn
          </a>
        </nav>
      </footer>
    </section>
  );
}
