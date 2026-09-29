import Button from '../../../../shared/components/Button/Button';
import Select from '../../../../shared/components/Select/Select';
import { FiRefreshCw } from 'react-icons/fi';
import type { OperatorCopy } from '../../translations';
import type { AudioDeviceOption } from '../hooks/useAudioDevices';
import type { AudioTestResult } from '../hooks/useAudioTest';
import AudioTestPanel from './AudioTestPanel';
import styles from '../Settings.module.css';

interface AudioDeviceSectionProps {
  labels: OperatorCopy;
  options: AudioDeviceOption[];
  selectedDevice: string;
  isLoading: boolean;
  isSaving: boolean;
  isSessionBusy: boolean;
  hasLoadError: boolean;
  hasDevices: boolean;
  deviceSaveError: string | null;
  onDeviceChange: (device: string) => void;
  onRefresh: () => void;
  onRetry: () => void;
  result: AudioTestResult | null;
  liveInputLevel: number | null;
  runtimeInputLevel: number | null;
  runtimeInputLevelStale: boolean;
  error: string | null;
  isTesting: boolean;
  onRunTest: () => void;
  onStopTest: () => void;
}

export default function AudioDeviceSection({
  labels,
  options,
  selectedDevice,
  isLoading,
  isSaving,
  isSessionBusy,
  hasLoadError,
  hasDevices,
  deviceSaveError,
  onDeviceChange,
  onRefresh,
  onRetry,
  result,
  liveInputLevel,
  runtimeInputLevel,
  runtimeInputLevelStale,
  error,
  isTesting,
  onRunTest,
  onStopTest,
}: AudioDeviceSectionProps) {
  const canRun = selectedDevice
    ? options.some((option) => option.value === selectedDevice)
    : options.some((option) => option.value === 'default');

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        <h2>{labels.audioDevice}</h2>
        <Button
          variant="secondary"
          icon={<FiRefreshCw />}
          disabled={isLoading || isSaving}
          onClick={onRefresh}
        >
          {labels.audioDeviceRefresh}
        </Button>
      </div>

      <Select
        label={labels.audioDevice}
        options={options}
        value={selectedDevice}
        placeholder={labels.audioDevicePlaceholder}
        disabled={isLoading || isSaving || isSessionBusy}
        onChange={onDeviceChange}
      />

      {isLoading ? <p role="status">{labels.audioDeviceLoading}</p> : null}
      {!isLoading && hasLoadError ? (
        <div role="alert">
          <p>{labels.audioDeviceLoadFailed}</p>
          <Button variant="secondary" onClick={onRetry}>
            {labels.audioDeviceRetry}
          </Button>
        </div>
      ) : null}
      {!isLoading && !hasLoadError && !hasDevices ? (
        <p role="status">{labels.audioDeviceEmpty}</p>
      ) : null}
      {isSaving ? <p role="status">{labels.audioDeviceSaving}</p> : null}
      {deviceSaveError ? <p role="alert">{deviceSaveError}</p> : null}
      <AudioTestPanel
        labels={labels}
        result={result}
        liveInputLevel={liveInputLevel}
        runtimeInputLevel={runtimeInputLevel}
        runtimeInputLevelStale={runtimeInputLevelStale}
        error={error}
        isTesting={isTesting}
        canRun={canRun && !isSessionBusy}
        onRun={onRunTest}
        onStop={onStopTest}
      />
      {isSessionBusy ? (
        <p role="status">{labels.audioDeviceSessionConflict}</p>
      ) : null}
    </section>
  );
}
