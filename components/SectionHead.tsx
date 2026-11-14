// A section heading with its small caption on the right. The scene inks the caption (redraws it through the GPU so
// it softens into the paper like the header line); the text stays in the DOM, hidden, as its fallback.
export default function SectionHead({ title, caption, href }: { title: string; caption: string; href?: string }) {
  const text = <span className="ink-src">{caption}</span>;
  return (
    <div className="index-head">
      <h2>{title}</h2>
      {href ? (
        <a className="mono" id="gh-handle" href={href} target="_blank" rel="noopener" aria-label={caption}>{text}</a>
      ) : (
        <span className="mono" aria-label={caption}>{text}</span>
      )}
    </div>
  );
}
