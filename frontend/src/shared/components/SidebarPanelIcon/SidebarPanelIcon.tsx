import type { CSSProperties } from 'react';

export interface SidebarPanelIconProps {
  collapsed?: boolean;
  mirrored?: boolean;
  className?: string;
}

export default function SidebarPanelIcon({
  collapsed = false,
  mirrored = false,
  className,
}: SidebarPanelIconProps) {
  const mirrorStyle: CSSProperties | undefined = mirrored
    ? { transform: 'scaleX(-1)' }
    : undefined;

  if (collapsed) {
    return (
      <svg
        className={className}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={mirrorStyle}
      >
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="2"
          ry="2"
          stroke="currentColor"
          strokeWidth="2"
          strokeMiterlimit="10"
          fill="none"
        />
        <line
          x1="9"
          y1="3"
          x2="9"
          y2="21"
          stroke="currentColor"
          strokeWidth="2"
          strokeMiterlimit="10"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={mirrorStyle}
    >
      <rect x="3" y="3" width="6" height="18" rx="2" ry="2" fill="currentColor" />
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        ry="2"
        stroke="currentColor"
        strokeWidth="2"
        strokeMiterlimit="10"
        fill="none"
      />
      <line
        x1="9"
        y1="3"
        x2="9"
        y2="21"
        stroke="currentColor"
        strokeWidth="2"
        strokeMiterlimit="10"
      />
    </svg>
  );
}
