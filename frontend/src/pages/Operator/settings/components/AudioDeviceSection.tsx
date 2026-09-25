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
  onDeviceChange: (device: string) => void;
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
  onDeviceChange,
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
        disabled={options.length === 0}
        onChange={onDeviceChange}
      />
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