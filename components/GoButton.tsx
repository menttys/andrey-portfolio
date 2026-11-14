'use client';

export default function GoButton() {
  return (
    <button className="go" aria-label="See selected work" onClick={() => document.getElementById('work')?.scrollIntoView({ behavior: 'smooth' })}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
    </button>
  );
}
