import AudioLevelMeter from '../../../../shared/components/AudioLevelMeter/AudioLevelMeter';
import Button from '../../../../shared/components/Button/Button';
import type { OperatorCopy } from '../../translations';
import type { AudioTestResult } from '../hooks/useAudioTest';
import { formatAudioFormat } from '../utils/audioFormat';
import styles from '../Settings.module.css';

interface AudioTestPanelProps {
  labels: OperatorCopy;
  result: AudioTestResult | null;
  liveInputLevel: number | null;
  error: string | null;
  isTesting: boolean;
  canRun: boolean;
  onRun: () => void;
}

export default function AudioTestPanel({
  labels,
  result,
  liveInputLevel,
  error,
  isTesting,
  canRun,
  onRun,
}: AudioTestPanelProps) {
  const statusLabel = result
    ? result.status === 'signal'
      ? labels.audioTestSignal
      : result.status === 'silent'
        ? labels.audioTestSilent
        : labels.audioTestDisconnected
    : labels.audioTestNotRun;
  const captureFormat = result
    ? formatAudioFormat(
        result.capture_sample_rate,
        result.capture_channels,
        result.capture_sample_width
      )
    : labels.audioTestNotRun;
  const processingFormat = result
    ? formatAudioFormat(
        result.processing_sample_rate,
        result.processing_channels,
        result.processing_sample_width
      )
    : labels.audioTestNotRun;

  return (
    <div
      className={[
        styles.audioTestPanel,
        isTesting ? styles.audioTestPanelTesting : '',
        !canRun ? styles.audioTestPanelDisabled : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-busy={isTesting}
      aria-disabled={!canRun}
    >
      <div className={styles.audioTestGrid}>
        <div className={styles.audioTestRow}>
          <span>{labels.audioTestStatus}</span>
          <strong>{statusLabel}</strong>
        </div>
        <div className={styles.audioTestRow}>
          <span>{labels.audioTestInputLevel}</span>
          <div className={styles.audioTestMeter}>
            <AudioLevelMeter
              level={
                isTesting
                  ? liveInputLevel
                  : canRun && result?.status === 'signal'
                    ? result.input_level_dbfs
                    : null
              }
              label={labels.audioTestInputLevel}
              isActive={isTesting}
            />
          </div>
        </div>
        <div className={styles.audioTestRow}>
          <span>{labels.audioTestCaptureFormat}</span>
          <strong>{canRun ? captureFormat : '—'}</strong>
        </div>
        <div className={styles.audioTestRow}>
          <span>{labels.audioTestProcessingFormat}</span>
          <strong>{canRun ? processingFormat : '—'}</strong>
        </div>
      </div>
      <div className={styles.audioTestAction}>
        <Button variant="secondary" disabled={isTesting || !canRun} onClick={onRun}>
          {isTesting ? labels.audioTestRunning : labels.audioTest}
        </Button>
      </div>
      {error ? (
        <p className={[styles.audioTestMessage, styles.audioTestMessageError].join(' ')} role="alert">
          {error}
        </p>
      ) : null}
      {result?.message ? (
        <p
          className={[
            styles.audioTestMessage,
            result.status === 'signal'
              ? styles.audioTestMessageSuccess
              : result.status === 'silent'
                ? styles.audioTestMessageWarning
                : styles.audioTestMessageError,
          ].join(' ')}
          role="status"
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}