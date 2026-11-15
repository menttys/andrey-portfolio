'use client';

// Makes the paper feel less static on desktop: the tooth tile sits on its own composited layer and shifts a few
// pixels with the pointer (and lags a touch behind fast scrolling), and a soft light follows the cursor.
// Only transform and opacity change, never background-position or filters, and the loop sleeps once it settles.
// Off on touch / coarse pointers and under prefers-reduced-motion: there the page keeps the static body::after tooth.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const SHIFT = 5;      // px the tooth moves at the viewport edges
const SCROLL = 4;     // px it can lag behind a fast scroll

export default function PaperMotion() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const calm = matchMedia('(prefers-reduced-motion: reduce)');
    const check = () => setOn(fine.matches && !calm.matches);
    check();
    fine.addEventListener('change', check);
    calm.addEventListener('change', check);
    return () => { fine.removeEventListener('change', check); calm.removeEventListener('change', check); };
  }, []);

  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    const grain = document.getElementById('paper-grain');
    const light = document.getElementById('paper-light');
    const header = document.querySelector<HTMLElement>('header.bar');
    if (!grain || !light) return;
    root.classList.add('paper-live');

    let tx = 0, ty = 0, gx = 0, gy = 0;                 // tooth offset: target, current
    let lx = innerWidth / 2, ly = innerHeight / 3, cx = lx, cy = ly;   // light: target, current
    let lag = 0, lastY = scrollY, raf = 0;

    const frame = () => {
      raf = 0;
      gx += (tx - gx) * 0.08;
      gy += (ty + lag - gy) * 0.08;
      lag *= 0.9;
      cx += (lx - cx) * 0.14;
      cy += (ly - cy) * 0.14;
      const t = `translate3d(${gx.toFixed(2)}px, ${gy.toFixed(2)}px, 0)`;
      grain.style.transform = t;
      header?.style.setProperty('--paper-t', t);
      light.style.transform = `translate3d(${(cx - 320).toFixed(1)}px, ${(cy - 320).toFixed(1)}px, 0)`;
      const busy = Math.abs(tx - gx) + Math.abs(ty + lag - gy) > 0.02 || Math.abs(lx - cx) + Math.abs(ly - cy) > 0.3;
      if (busy) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      tx = (e.clientX / innerWidth - 0.5) * 2 * SHIFT;
      ty = (e.clientY / innerHeight - 0.5) * 2 * SHIFT;
      lx = e.clientX; ly = e.clientY;
      light.classList.add('on');
      wake();
    };
    const leave = () => light.classList.remove('on');
    const scroll = () => {
      const d = scrollY - lastY; lastY = scrollY;
      lag = Math.max(-SCROLL, Math.min(SCROLL, lag - d * 0.04));
      wake();
    };

    addEventListener('pointermove', move, { passive: true });
    addEventListener('scroll', scroll, { passive: true });
    document.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', move);
      removeEventListener('scroll', scroll);
      document.removeEventListener('pointerleave', leave);
      root.classList.remove('paper-live');
      header?.style.removeProperty('--paper-t');
    };
  }, [on]);

  if (!on) return null;
  return createPortal(
    <>
      <div id="paper-grain" aria-hidden="true" />
      <div id="paper-light" aria-hidden="true" />
    </>,
    document.body,
  );
}
