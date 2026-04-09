import { useEffect } from 'react';

let activeLocks = 0;
let previousBodyOverflow = '';
let previousBodyOverscrollBehavior = '';
let previousHtmlOverflow = '';

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;

    const body = document.body;
    const html = document.documentElement;

    if (activeLocks === 0) {
      previousBodyOverflow = body.style.overflow;
      previousBodyOverscrollBehavior = body.style.overscrollBehavior;
      previousHtmlOverflow = html.style.overflow;

      body.style.overflow = 'hidden';
      body.style.overscrollBehavior = 'none';
      html.style.overflow = 'hidden';
    }

    activeLocks += 1;

    return () => {
      activeLocks = Math.max(0, activeLocks - 1);
      if (activeLocks === 0) {
        body.style.overflow = previousBodyOverflow;
        body.style.overscrollBehavior = previousBodyOverscrollBehavior;
        html.style.overflow = previousHtmlOverflow;
      }
    };
  }, [locked]);
}
