'use client';

// The canvas the scene draws the devices on. It is a fresh element (and so a fresh WebGL context) each time the page
// crosses the phone breakpoint: a second three.js renderer on a used context comes up with its materials washed out.
import { usePhoneLayout } from './usePhoneLayout';

export default function HeroCanvas({ label }: { label: string }) {
  const layout = usePhoneLayout();
  return <canvas key={layout} id="gl" aria-label={label} />;
}
