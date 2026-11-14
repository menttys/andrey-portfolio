'use client';

// Starts the three.js scene once the page's markup is on screen (it finds its canvases and sections by id).
// Renders nothing itself; unmounting tears the scene down.
import { useEffect } from 'react';

export default function DeviceScene() {
  useEffect(() => {
    const ctl = new AbortController();
    import('@/lib/scene').then(({ startScene }) => { if (!ctl.signal.aborted) startScene(ctl.signal); });
    return () => ctl.abort();
  }, []);
  return null;
}
