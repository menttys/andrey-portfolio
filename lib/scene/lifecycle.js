/* Everything the scene starts has to be undone when the page unmounts or hot-reloads. This module owns that:
   every listener, frame, timer, observer and renderer is registered through it and torn down when `signal` aborts,
   along with the inline styles the knobs leave on the page. */

export function createLifecycle(signal) {
  const cleanups = [];
  const renderers = [];
  const observers = [];

  // `true` is shorthand for a capture listener; everything is tied to the signal
  const listenerOptions = (o) => (o === true ? { capture: true, signal } : { ...(o || {}), signal });

  const lifecycle = {
    signal,

    /** register an extra teardown callback */
    onCleanup: (fn) => cleanups.push(fn),

    on(target, type, fn, options) {
      target.addEventListener?.(type, fn, listenerOptions(options));
    },
    onWindow(type, fn, options) {
      lifecycle.on(window, type, fn, options);
    },

    requestFrame(fn) {
      return window.requestAnimationFrame((t) => { if (!signal.aborted) fn(t); });
    },
    timeout(fn, ms) {
      return window.setTimeout(() => { if (!signal.aborted) fn(); }, ms);
    },

    observeResize(element, callback) {
      const observer = new window.ResizeObserver(callback);
      observers.push(observer);
      observer.observe(element);
    },
    observeVisibility(element, callback) {
      const observer = new window.IntersectionObserver(callback);
      observers.push(observer);
      observer.observe(element);
    },

    /** keep a renderer so it is disposed with everything else */
    track(renderer) {
      renderers.push(renderer);
      return renderer;
    },

    /** call `fn` once if the browser takes this renderer's WebGL context away (iOS does under memory pressure) */
    onContextLost(renderer, fn) {
      lifecycle.on(renderer.domElement, 'webglcontextlost', () => fn(), { once: true });
    },
  };

  signal.addEventListener('abort', () => {
    observers.forEach((o) => o.disconnect());
    renderers.forEach((r) => r.dispose());
    cleanups.forEach((fn) => fn());
    resetPageStyles();
  }, { once: true });

  return lifecycle;
}

// the styles and classes the knobs set on the page's own elements
function resetPageStyles() {
  const html = document.documentElement;
  html.classList.remove('knob-drag');
  html.style.removeProperty('--wght');
  html.style.removeProperty('--paper');

  const wash = document.getElementById('wash');
  if (wash) wash.replaceChildren();

  const dim = document.getElementById('dim');
  if (dim) { dim.className = ''; dim.style.opacity = ''; }

  const flow = document.getElementById('flow');
  if (flow) { flow.style.transform = ''; flow.style.marginBottom = ''; }

  const stage = document.getElementById('stage');
  if (stage) {
    stage.style.pointerEvents = '';
    stage.classList.remove('knob-hover', 'knob-drag');
  }
}
