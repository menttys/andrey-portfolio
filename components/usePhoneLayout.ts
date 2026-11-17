'use client';

import { useEffect, useState } from 'react';
import { PHONE } from '@/lib/scene/budget';

/** Counts how many times the page has crossed the phone breakpoint (a rotated phone, a resized window).
    The hero is a different unit on each side of it, so the canvas and the scene are both rebuilt when this changes. */
export function usePhoneLayout() {
  const [crossings, setCrossings] = useState(0);
  useEffect(() => {
    const phone = matchMedia(PHONE);
    const crossed = () => setCrossings((n) => n + 1);
    phone.addEventListener('change', crossed);
    return () => phone.removeEventListener('change', crossed);
  }, []);
  return crossings;
}
