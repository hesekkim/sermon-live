import type { CSSProperties } from 'react';
import styles from './AudioLevelMeter.module.css';

const MIN_DBFS = -60;
const MAX_DBFS = 0;
const LEVEL_BANDS = [
  { threshold: 25, color: '#15803d' },
  { threshold: 50, color: '#a3e635' },
  { threshold: 75, color: '#facc15' },
  { threshold: 100, color: '#ef4444' },
];

export interface AudioLevelMeterProps {
  level: number | null;
  label?: string;
  className?: string;
  isActive?: boolean;
}

function clampLevel(level: number) {
  return Math.min(MAX_DBFS, Math.max(MIN_DBFS, level));
}

export default function AudioLevelMeter({
  level,
  label = 'Input level',
  className = '',
  isActive = false,
}: AudioLevelMeterProps) {
  const safeLevel = level === null ? null : clampLevel(level);
  const percent =
    safeLevel === null
      ? 0
      : ((safeLevel - MIN_DBFS) / (MAX_DBFS - MIN_DBFS)) * 100;
  const fillPercent =
    safeLevel === null ? 0 : Math.max(5, Math.min(100, percent));

  return (
    <div
      className={[
        styles.meter,
        className,
        safeLevel === null && !isActive ? styles.idle : '',
        isActive ? styles.active : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="meter"
      aria-label={label}
      aria-valuemin={MIN_DBFS}
      aria-valuemax={MAX_DBFS}
      aria-valuenow={safeLevel ?? MIN_DBFS}
      aria-valuetext={
        isActive
          ? 'measuring'
          : safeLevel === null
            ? 'idle'
            : `${safeLevel.toFixed(1)} dBFS`
      }
    >
      <div className={styles.fill} style={{ width: `${fillPercent}%` }}>
        {LEVEL_BANDS.map(({ threshold, color }, index) => (
          <span
            key={threshold}
            data-segment
            data-visible={String(fillPercent >= threshold)}
            className={styles.segment}
            style={
              {
                background: color,
                '--segment-color': color,
                '--next-segment-color': LEVEL_BANDS[index + 1]?.color ?? color,
                opacity: fillPercent >= threshold ? 1 : 0,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
