import Button from '../../../../shared/components/Button/Button';
import Select from '../../../../shared/components/Select/Select';
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
  hasLoadError: boolean;
  hasDevices: boolean;
  deviceSaveError: string | null;
  onDeviceChange: (device: string) => void;
  onRetry: () => void;
  result: AudioTestResult | null;
  liveInputLevel: number | null;
  error: string | null;
  isTesting: boolean;
  onRunTest: () => void;
}

export default function AudioDeviceSection({
  labels,
  options,
  selectedDevice,
  isLoading,
  isSaving,
  hasLoadError,
  hasDevices,
  deviceSaveError,
  onDeviceChange,
  onRetry,
  result,
  liveInputLevel,
  error,
  isTesting,
  onRunTest,
}: AudioDeviceSectionProps) {
  const canRun = Boolean(selectedDevice) && options.some((option) => option.value === selectedDevice);

  return (
    <section className={styles.section}>
      <h2>{labels.audioDevice}</h2>
      <Select
        label={labels.audioDevice}
        options={options}
        value={selectedDevice}
        placeholder={labels.audioDevicePlaceholder}
        disabled={isLoading || isSaving}
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
        error={error}
        isTesting={isTesting}
        canRun={canRun}
        onRun={onRunTest}
      />
    </section>
  );
}