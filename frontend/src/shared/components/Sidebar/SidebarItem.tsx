import type { ComponentType, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';

type IconComponent = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

export interface SidebarItemProps {
  label: string;
  brandImageSrc?: string;
  collapsed?: boolean;
  icon?: IconComponent;
  to?: string;
  end?: boolean;
  nav?: boolean;
  variant?: 'nav' | 'brand';
  onClick?: () => void;
  title?: string;
}

export default function SidebarItem({
  label,
  brandImageSrc,
  collapsed = false,
  icon: Icon,
  to,
  end,
  nav = false,
  variant = 'nav',
  onClick,
  title,
}: SidebarItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigateTo = () => {
    onClick?.();
    if (to) {
      navigate(to);
    }
  };

  if (variant === 'brand') {
    if (collapsed || !to) {
      return null;
    }

    return (
      <button
        type="button"
        className={styles.brand}
        onClick={navigateTo}
        aria-label={label}
        title={title}
      >
        {brandImageSrc ? (
          <span className={styles.brandLogoBadge}>
            <img className={styles.brandLogo} src={brandImageSrc} alt="" />
          </span>
        ) : null}
        <span className={styles.brandLabel}>{label}</span>
      </button>
    );
  }

  const content: ReactNode = (
    <>
      {Icon ? <Icon className={styles.linkIcon} aria-hidden /> : null}
      {!collapsed ? <span className={styles.linkLabel}>{label}</span> : null}
    </>
  );

  const commonProps = {
    className: styles.link,
    title: title ?? label,
    'aria-label': label,
    onClick,
  };

  if (to && nav) {
    return (
      <button
        type="button"
        title={commonProps.title}
        aria-label={commonProps['aria-label']}
        onClick={navigateTo}
        className={[
          styles.link,
          location.pathname === to ||
          (!end && location.pathname.startsWith(`${to}/`))
            ? styles.active
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {content}
      </button>
    );
  }

  if (to) {
    return (
      <button type="button" {...commonProps} onClick={navigateTo}>
        {content}
      </button>
    );
  }

  return (
    <button type="button" {...commonProps}>
      {content}
    </button>
  );
}
