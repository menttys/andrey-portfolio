'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import Image from 'next/image';
import { PROJECTS, type Project } from '@/lib/content';
import SectionHead from './SectionHead';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Full-screen view of one image. A native modal <dialog>: the page behind goes inert (so focus stays inside), Escape
// closes it, and focus goes back to the image button that opened it. The backdrop closes it too; arrow keys, the
// buttons and a horizontal swipe step through the project's images.
function Lightbox({ p, index, onIndex, onClose }: { p: Project; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const n = p.images.length;
  const img = p.images[index];

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    closeBtn.current?.focus();
    document.documentElement.classList.add('lightbox-open');
    return () => document.documentElement.classList.remove('lightbox-open');
  }, []);

  const step = (by: number) => onIndex(Math.max(0, Math.min(n - 1, index + by)));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  };
  // one finger only: a two-finger pinch (zooming into the image) must not page to the next one
  const onTouchStart = (e: TouchEvent) => { touchX.current = e.touches.length === 1 ? e.touches[0].clientX : null; };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current === null || e.touches.length > 0) { touchX.current = null; return; }
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
  };

  return (
    <dialog
      ref={dialog}
      className="lightbox"
      aria-label={`${p.title}, image ${index + 1} of ${n}`}
      onClose={onClose}
      onKeyDown={onKey}
      onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('lightbox-stage')) dialog.current?.close(); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="lightbox-stage">
        <Image key={img.src} src={img.src} alt={img.alt} width={2400} height={1600} sizes="100vw" className="lightbox-img" />
      </div>
      <div className="lightbox-bar">
        <span className="mono" aria-live="polite">{p.title} · {index + 1} / {n}</span>
        <div className="lightbox-btns">
          <button type="button" className="proj-btn light" onClick={() => step(-1)} disabled={index === 0} aria-label="Previous image">←</button>
          <button type="button" className="proj-btn light" onClick={() => step(1)} disabled={index === n - 1} aria-label="Next image">→</button>
          <button type="button" className="proj-btn light" onClick={() => dialog.current?.close()} aria-label="Close" ref={closeBtn}>×</button>
        </div>
      </div>
    </dialog>
  );
}

// The image strip for one project: native horizontal scroll with snap points (touch swipe for free), arrow buttons and
// arrow keys step one image at a time, and the counter follows the image the strip is snapped to. Pressing an image
// opens it in the lightbox.
function Gallery({ p }: { p: Project }) {
  const strip = useRef<HTMLUListElement>(null);
  const [at, setAt] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);

  // the image whose left edge is nearest the strip's left edge; at the end of the scroll, the last one
  const onScroll = () => {
    const el = strip.current;
    if (!el) return;
    const items = [...el.children] as HTMLElement[];
    if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 2) return setAt(items.length - 1);
    let best = 0;
    items.forEach((li, i) => {
      if (Math.abs(li.offsetLeft - el.offsetLeft - el.scrollLeft) < Math.abs(items[best].offsetLeft - el.offsetLeft - el.scrollLeft)) best = i;
    });
    setAt(best);
  };

  const go = (i: number) => {
    const el = strip.current;
    const li = el?.children[Math.max(0, Math.min(p.images.length - 1, i))] as HTMLElement | undefined;
    if (!el || !li) return;
    el.scrollTo({ left: li.offsetLeft - el.offsetLeft, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;   // arrows on a focused image button are the button's own
    if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
  };

  return (
    <div className="proj-gallery">
      <ul
        className="proj-strip"
        ref={strip}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${p.title} images`}
        onKeyDown={onKey}
        onScroll={onScroll}
      >
        {p.images.map((img, i) => (
          <li key={img.src + i}>
            <button type="button" className="proj-zoom" onClick={() => setZoom(i)} aria-label={`Enlarge image ${i + 1} of ${p.images.length}: ${img.alt}`}>
              <Image src={img.src} alt="" width={2400} height={1600} sizes="(max-width: 760px) 84vw, 40vw" />
            </button>
          </li>
        ))}
      </ul>
      <div className="proj-nav">
        <button type="button" className="proj-btn" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Previous image">←</button>
        <button type="button" className="proj-btn solid" onClick={() => go(at + 1)} disabled={at === p.images.length - 1} aria-label="Next image">→</button>
        <span className="mono" aria-live="polite">{at + 1} / {p.images.length}</span>
      </div>
      {zoom !== null && (
        <Lightbox
          p={p}
          index={zoom}
          onIndex={(i) => { setZoom(i); go(i); }}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  );
}

export default function Projects() {
  const [open, setOpen] = useState<string | null>(null);
  // images load only once a project has been opened, so the first page load carries none of them
  const [seen, setSeen] = useState<Set<string>>(() => new Set());

  const toggle = (slug: string) => {
    setOpen((o) => (o === slug ? null : slug));
    setSeen((s) => (s.has(slug) ? s : new Set(s).add(slug)));
  };

  return (
    <section className="wrap index cv" id="projects" aria-label="Personal projects">
      <SectionHead title="Personal projects" caption="Side work, built for fun" />
      {PROJECTS.map((p, i) => {
        const hasImages = p.images.length > 0;
        const isOpen = hasImages && open === p.slug;
        const panel = `proj-${p.slug}`;
        return (
          <div className={`proj${isOpen ? ' open' : ''}${hasImages ? '' : ' still'}`} key={p.slug}>
            <div className="proj-row" onClick={hasImages ? () => toggle(p.slug) : undefined}>
              <div className="num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</div>
              <div className="meta">
                <h3>
                  {hasImages ? (
                    <button type="button" className="proj-toggle" aria-expanded={isOpen} aria-controls={panel} onClick={(e) => { e.stopPropagation(); toggle(p.slug); }}>
                      {p.title}
                    </button>
                  ) : p.title}
                </h3>
                <p>{p.text}</p>
                <ul className="chips" aria-label="Technologies">
                  {p.tech.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
              <div className="meta mono">
                <span>{p.kind}</span>
                <span>Year / {p.year}</span>
              </div>
              <span className="proj-mark" aria-hidden="true">{hasImages ? '+' : ''}</span>
            </div>
            {hasImages && (
              <div className="proj-panel" id={panel} inert={!isOpen}>
                <div className="proj-panel-inner">{seen.has(p.slug) && <Gallery p={p} />}</div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
