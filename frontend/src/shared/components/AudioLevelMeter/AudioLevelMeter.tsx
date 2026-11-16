import type { CSSProperties } from 'react';
import styles from './AudioLevelMeter.module.css';

const MIN_DBFS = -60;
const MAX_DBFS = 0;
const SIGNAL_THRESHOLD_DBFS = -50;
const SEGMENT_COUNT = 24;
const LEVEL_BANDS = [
  { color: '#15803d' },
  { color: '#a3e635' },
  { color: '#facc15' },
  { color: '#ef4444' },
];

export interface AudioLevelMeterProps {
  level: number | null;
  label?: string;
  className?: string;
  isActive?: boolean;
  isStale?: boolean;
  staleLabel?: string;
}

function clampLevel(level: number) {
  return Math.min(MAX_DBFS, Math.max(MIN_DBFS, level));
}

export default function AudioLevelMeter({
  level,
  label = 'Input level',
  className = '',
  isActive = false,
  isStale = false,
  staleLabel = 'Stale measurement',
}: AudioLevelMeterProps) {
  const safeLevel = level === null ? null : clampLevel(level);
  const percent =
    safeLevel === null
      ? 0
      : ((safeLevel - MIN_DBFS) / (MAX_DBFS - MIN_DBFS)) * 100;
  const isSignal = safeLevel !== null && safeLevel > SIGNAL_THRESHOLD_DBFS;
  const litSegments = Math.ceil((percent / 100) * SEGMENT_COUNT);

  return (
    <div
      className={[
        styles.meter,
        className,
        isSignal ? styles.signal : '',
        isActive ? styles.active : '',
        isStale ? styles.stale : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-mode={isSignal ? 'signal' : 'idle'}
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
            : `${safeLevel.toFixed(1)} dBFS${isStale ? `, ${staleLabel}` : ''}`
      }
    >
      <div className={styles.bar} aria-hidden="true">
        {Array.from({ length: SEGMENT_COUNT }, (_, index) => {
          const color =
            LEVEL_BANDS[
              Math.floor(index / (SEGMENT_COUNT / LEVEL_BANDS.length))
            ].color;
          const isVisible = isSignal && index < litSegments;

          return (
            <span
              key={index}
              data-segment
              data-visible={String(isVisible)}
              className={styles.segment}
              style={
                {
                  '--segment-color': color,
                  opacity: isVisible ? 1 : 0.3,
                } as CSSProperties
              }
            />
          );
        })}
      </div>
    </div>
  );
}
