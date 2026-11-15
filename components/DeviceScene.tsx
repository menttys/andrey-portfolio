'use client';

// Starts the three.js scene once the page's markup is on screen (it finds its canvases and sections by id).
// Renders nothing itself while the 3D runs; unmounting tears the scene down.
// If the 3D can't start, or the browser takes the WebGL context away later (iOS does under memory pressure), the
// scene is torn down and a still image of the devices takes the canvas's place in the stage.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function DeviceScene() {
  const [fallback, setFallback] = useState<{ stage: HTMLElement; label: string } | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    const fail = (error: unknown) => {
      if (ctl.signal.aborted) return;
      console.warn('[scene] showing the still image instead of the 3D:', error);
      ctl.abort();
      const stage = document.getElementById('stage');
      const canvas = document.getElementById('gl');
      if (canvas) canvas.style.visibility = 'hidden';
      if (stage) setFallback({ stage, label: canvas?.getAttribute('aria-label') ?? '' });
    };
    import('@/lib/scene')
      .then(({ startScene }) => (ctl.signal.aborted ? undefined : startScene(ctl.signal, { onFail: fail })))
      .catch(fail);
    return () => ctl.abort();
  }, []);

  if (!fallback) return null;
  // the images are the canvas itself, transparent, at its own framing (the stage's 2.1:1, or 1.5:1 on phones)
  return createPortal(
    <picture>
      <source media="(max-width: 760px)" srcSet="/devices-still-phone.webp" />
      <img
        src="/devices-still.webp"
        alt={fallback.label}
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '160%', display: 'block', pointerEvents: 'none' }}
      />
    </picture>,
    fallback.stage,
  );
}
