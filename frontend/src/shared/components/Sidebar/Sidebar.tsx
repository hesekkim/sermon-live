import type { ComponentType, ReactNode } from 'react';
import logoUrl from '../../../assets/sermon-live-logo.png';
import SidebarPanelIcon from '../SidebarPanelIcon/SidebarPanelIcon';
import SidebarItem from './SidebarItem';
import styles from './Sidebar.module.css';

export interface SidebarNavItem {
  id: string;
  to: string;
  label: string;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  end?: boolean;
}

export interface SidebarProps {
  brandLabel: string;
  brandImageSrc?: string;
  brandTo?: string;
  items?: SidebarNavItem[];
  children?: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  onToggleCollapsed?: () => void;
}

export default function Sidebar({
  brandLabel,
  brandImageSrc = logoUrl,
  brandTo,
  items = [],
  children,
  footer,
  ariaLabel,
  collapsible = true,
  collapsed = false,
  expandLabel = 'Expand sidebar',
  collapseLabel = 'Collapse sidebar',
  onToggleCollapsed,
}: SidebarProps) {
  const collapseControl = collapsible ? (
    <button
      type="button"
      className={collapsed ? styles.link : styles.collapseToggle}
      onClick={(event) => {
        event.stopPropagation();
        onToggleCollapsed?.();
      }}
      aria-expanded={!collapsed}
      aria-label={collapsed ? expandLabel : collapseLabel}
      title={collapsed ? expandLabel : collapseLabel}
    >
      <SidebarPanelIcon
        collapsed={collapsed}
        className={collapsed ? styles.linkIcon : undefined}
      />
    </button>
  ) : null;

  return (
    <aside
      className={[
        styles.sidebar,
        collapsed ? styles.collapsed : '',
        collapsible ? styles.collapsible : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={ariaLabel}
    >
      <div className={styles.panel}>
        <div className={styles.lead}>
          {collapsible && collapsed ? (
            collapseControl
          ) : brandTo ? (
            <SidebarItem
              variant="brand"
              label={brandLabel}
              brandImageSrc={brandImageSrc}
              to={brandTo}
              collapsed={collapsed}
            />
          ) : (
            <div className={styles.brandStatic}>
              <span className={styles.brandLogoBadge}>
                <img className={styles.brandLogo} src={brandImageSrc} alt="" />
              </span>
              <span className={styles.brandLabel}>{brandLabel}</span>
            </div>
          )}
        </div>

        <div className={styles.sections}>
          {items.length > 0 ? (
            <div className={styles.sectionItems}>
              {items.map((item) => (
                <SidebarItem
                  key={item.id}
                  nav
                  to={item.to}
                  end={item.end}
                  label={item.label}
                  icon={item.icon}
                  collapsed={collapsed}
                />
              ))}
            </div>
          ) : null}
          {children}
        </div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>

      {collapsible && !collapsed ? (
        <div className={styles.dividerSlot}>{collapseControl}</div>
      ) : null}
    </aside>
  );
}
