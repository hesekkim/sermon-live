import { Outlet } from 'react-router-dom';
import Sidebar from '../../../shared/components/Sidebar/Sidebar';
import { useOperatorPrefs } from '../OperatorPrefs';
import { BroadcastIcon, GearIcon } from './OperatorNavIcons';
import { useOperatorLayout } from './useOperatorLayout';
import styles from './OperatorLayout.module.css';

export interface OperatorOutletContext {
  showInputPane: boolean;
}

export default function OperatorLayout() {
  const { labels } = useOperatorPrefs();
  const {
    isSidebarCollapsed,
    showInputPane,
    toggleSidebarCollapsed,
  } = useOperatorLayout();

  return (
    <div className={`cms-theme ${styles.shell}`}>
      <aside className={styles.sidebarDesktop} aria-label={labels.brand}>
        <Sidebar
          brandLabel={labels.brand}
          brandTo="/operator/broadcast"
          collapsed={isSidebarCollapsed}
          expandLabel={labels.expandSidebar}
          collapseLabel={labels.collapseSidebar}
          onToggleCollapsed={toggleSidebarCollapsed}
          items={[
            {
              id: 'broadcast',
              to: '/operator/broadcast',
              label: labels.navBroadcast,
              icon: BroadcastIcon,
            },
            {
              id: 'settings',
              to: '/operator/settings',
              label: labels.navSettings,
              icon: GearIcon,
            },
          ]}
        />
      </aside>
      <main className={styles.content}>
        <Outlet context={{ showInputPane } satisfies OperatorOutletContext} />
      </main>
    </div>
  );
}
