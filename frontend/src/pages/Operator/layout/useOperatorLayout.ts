import { useEffect, useState } from 'react';

const COLLAPSED_KEY = 'operatorSidebarCollapsed';
const DUAL_PANE_MIN_PX = 1600;

export function useOperatorLayout() {
  const [userCollapsed, setUserCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  });
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1920 : window.innerWidth
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(userCollapsed));
  }, [userCollapsed]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const showInputPane = viewportWidth >= DUAL_PANE_MIN_PX;
  const isSidebarCollapsed = userCollapsed || !showInputPane;

  const toggleSidebarCollapsed = () => {
    if (!showInputPane) {
      return;
    }
    setUserCollapsed((collapsed) => !collapsed);
  };

  return {
    isSidebarCollapsed,
    showInputPane,
    toggleSidebarCollapsed,
  };
}
