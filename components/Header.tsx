export default function Header() {
  return (
    <header className="wrap bar">
      <div className="logo">Andrey<sup>®</sup></div>
      {/* the weather / greeting line; drawn into the canvas by the scene, the label is kept in step for screen readers */}
      <div className="mono center" role="img" aria-label="Portfolio, 11.26">
        <canvas id="topcap" aria-hidden="true" />
      </div>
      <div className="menu" aria-hidden="true">
        <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="14" cy="14" r="6.5" />
          <path d="M14 1v26M1 14h26" />
          <circle cx="14" cy="14" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </div>
    </header>
  );
}
