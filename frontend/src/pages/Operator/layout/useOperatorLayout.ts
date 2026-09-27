import { useEffect, useState } from 'react';

const DUAL_PANE_MIN_PX = 1024;

export function useOperatorLayout() {
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1920 : window.innerWidth
  );

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const showInputPane = viewportWidth >= DUAL_PANE_MIN_PX;

  return {
    showInputPane,
  };
}
