import type { ComponentType } from 'react';
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
  brandTo: string;
  items: SidebarNavItem[];
  collapsed?: boolean;
  expandLabel: string;
  collapseLabel: string;
  onToggleCollapsed?: () => void;
}

export default function Sidebar({
  brandLabel,
  brandTo,
  items,
  collapsed = false,
  expandLabel,
  collapseLabel,
  onToggleCollapsed,
}: SidebarProps) {
  const collapseControl = (
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
  );

  return (
    <div
      className={[
        styles.sidebar,
        collapsed ? styles.collapsed : '',
        styles.collapsible,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.panel}>
        <div className={styles.lead}>
          {collapsed ? (
            collapseControl
          ) : (
            <SidebarItem
              variant="brand"
              label={brandLabel}
              to={brandTo}
              collapsed={collapsed}
            />
          )}
        </div>

        <div className={styles.sections}>
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
        </div>
      </div>

      {!collapsed ? (
        <div className={styles.dividerSlot}>{collapseControl}</div>
      ) : null}
    </div>
  );
}
