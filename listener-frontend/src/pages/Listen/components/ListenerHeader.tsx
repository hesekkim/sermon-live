import { FiMoon, FiSun } from 'react-icons/fi';
import type { ListenerCopy } from '../translations';
import type { ListenerTheme } from '../useListenerPreferences';
import styles from '../Listen.module.css';

interface ListenerHeaderProps {
  badgeStateClass: string;
  copy: ListenerCopy;
  onThemeChange: () => void;
  statusLabel: string;
  theme: ListenerTheme;
}

export function ListenerHeader({
  badgeStateClass,
  copy,
  onThemeChange,
  statusLabel,
  theme,
}: ListenerHeaderProps) {
  return (
    <header className={styles.header}>
      <h1>Sermon Live</h1>
      <div
        className={`${styles.sessionBadge} ${badgeStateClass}`}
        role="status"
        aria-live="polite"
      >
        <span className={styles.statusDot} />
        {statusLabel}
      </div>
      <button
        type="button"
        className={styles.themeButton}
        aria-label={theme === 'light' ? copy.changeToDark : copy.changeToLight}
        onClick={onThemeChange}
      >
        {theme === 'light' ? (
          <FiMoon aria-hidden="true" />
        ) : (
          <FiSun aria-hidden="true" />
        )}
      </button>
    </header>
  );
}
