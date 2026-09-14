import styles from './TocItem.module.css';

export interface TocItemProps {
  title: string;
  progress?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
}

export default function TocItem({
  title,
  progress,
  isActive = false,
  isDisabled = false,
  onClick,
}: TocItemProps) {
  return (
    <button
      type="button"
      className={`${styles['toc-item']} ${isActive ? styles['toc-item--active'] : ''}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={title}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className={styles['toc-item__info']}>
        <span className={styles['toc-item__title']}>{title}</span>
        {progress !== undefined && (
          <span className={styles['toc-item__progress']}>{progress}</span>
        )}
      </div>
    </button>
  );
}
