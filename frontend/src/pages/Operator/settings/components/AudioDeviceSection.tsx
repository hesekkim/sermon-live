import Button from '../../../../shared/components/Button/Button';
import LoadingSpinner from '../../../../shared/components/LoadingSpinner/LoadingSpinner';
import Select from '../../../../shared/components/Select/Select';
import SlideToggle from '../../../../shared/components/SlideToggle/SlideToggle';
import { FiRefreshCw } from 'react-icons/fi';
import type { OperatorCopy } from '../../translations';
import type {
  AudioDeviceListMode,
  AudioDeviceOption,
} from '../hooks/useAudioDevices';
import type { AudioTestResult } from '../hooks/useAudioTest';
import AudioTestPanel from './AudioTestPanel';
import styles from '../Settings.module.css';

interface AudioDeviceSectionProps {
  labels: OperatorCopy;
  options: AudioDeviceOption[];
  selectedDevice: string;
  channelOptions: AudioDeviceOption[];
  showChannelSelector: boolean;
  selectedChannel: number;
  isChannelStale: boolean;
  listMode: AudioDeviceListMode;
  isSelectionStale: boolean;
  isLoading: boolean;
  isSettingsLoaded: boolean;
  isSaving: boolean;
  isSessionBusy: boolean;
  hasLoadError: boolean;
  hasDevices: boolean;
  deviceSaveError: string | null;
  onDeviceChange: (device: string) => void;
  onChannelChange: (channel: number) => void;
  onListModeChange: (mode: AudioDeviceListMode) => void;
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
  channelOptions,
  showChannelSelector,
  selectedChannel,
  isChannelStale,
  listMode,
  isSelectionStale,
  isLoading,
  isSettingsLoaded,
  isSaving,
  isSessionBusy,
  hasLoadError,
  hasDevices,
  deviceSaveError,
  onDeviceChange,
  onChannelChange,
  onListModeChange,
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
  const canRun =
    !isChannelStale &&
    Boolean(selectedDevice) &&
    options.some((option) => option.value === selectedDevice);

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        <h2>{labels.audioDevice}</h2>
        <div className={styles.deviceActions}>
          <SlideToggle
            label={labels.audioDeviceShowAll}
            checked={listMode === 'all'}
            disabled={isLoading || isSaving}
            onChange={(checked) =>
              onListModeChange(checked ? 'all' : 'standard')
            }
          />
          <Button
            variant="secondary"
            icon={<FiRefreshCw />}
            disabled={isLoading || isSaving}
            onClick={onRefresh}
          >
            {labels.audioDeviceRefresh}
          </Button>
        </div>
      </div>

      <Select
        label={labels.audioDevice}
        options={options}
        value={selectedDevice}
        placeholder={labels.audioDevicePlaceholder}
        disabled={!isSettingsLoaded || isLoading || isSaving || isSessionBusy}
        onChange={onDeviceChange}
      />
      {showChannelSelector ? (
        <Select
          label={labels.audioChannel}
          options={channelOptions}
          value={String(selectedChannel)}
          disabled={!isSettingsLoaded || isLoading || isSaving || isSessionBusy}
          onChange={(value) => onChannelChange(Number(value))}
        />
      ) : null}
      {isSaving ? (
        <div
          className={styles.audioDeviceSaving}
          role="status"
          aria-live="polite"
        >
          <LoadingSpinner size="small" />
          <span>{labels.audioDeviceSaving}</span>
        </div>
      ) : null}
      {isChannelStale ? (
        <p role="alert">{labels.audioChannelReselect}</p>
      ) : null}
      {isSelectionStale ? (
        <p role="alert">{labels.audioDeviceReselect}</p>
      ) : null}

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
