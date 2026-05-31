import { useState, useEffect } from 'react';

const STORAGE_KEY = 'pijulserv-theme';

const getInitial = (): boolean => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) return saved === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
};

const applyClass = (dark: boolean) => {
  if (dark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
};

export const useTheme = () => {
  const [isDark, setIsDark] = useState(getInitial);

  useEffect(() => { applyClass(isDark); }, [isDark]);

  /** Plain toggle — no animation */
  const toggle = () => setIsDark(d => !d);

  /**
   * Circular reveal via View Transitions API.
   * New theme expands outward from the click point.
   * Falls back to an instant switch on unsupported browsers.
   */
  const toggleWithAnimation = (e: React.MouseEvent<HTMLElement>) => {
    const x = e.clientX;
    const y = e.clientY;

    // Max radius that covers any corner of the screen from (x, y)
    const maxR = Math.hypot(
      Math.max(x, window.innerWidth  - x),
      Math.max(y, window.innerHeight - y),
    );

    // Respect prefers-reduced-motion / unsupported browsers
    const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (noMotion || !document.startViewTransition) {
      toggle();
      return;
    }

    const next = !isDark;

    const transition = document.startViewTransition(() => {
      applyClass(next);
      setIsDark(next);
    });

    transition.ready.then(() => {
      // Animate the incoming snapshot (new theme) expanding from click point
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxR}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 400,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    });
  };

  return { isDark, toggle, toggleWithAnimation };
};
