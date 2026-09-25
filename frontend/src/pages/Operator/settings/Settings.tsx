import { useEffect, useMemo } from 'react';
import AudioLevelMeter from '../../../shared/components/AudioLevelMeter/AudioLevelMeter';
import Button from '../../../shared/components/Button/Button';
import InputField from '../../../shared/components/InputField/InputField';
import Select from '../../../shared/components/Select/Select';
import SlideToggle from '../../../shared/components/SlideToggle/SlideToggle';
import StatusTag from '../../../shared/components/StatusTag/StatusTag';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { useOperatorPrefs } from '../OperatorPrefs';
import type { UiLanguage } from '../translations';
import { useAudioDevices } from './useAudioDevices';
import { useAudioTest } from './useAudioTest';
import { useOperatorSettings } from './useOperatorSettings';
import styles from './Settings.module.css';

type InterpreterName = 'echo' | 'openai';

export default function Settings() {
  const { labels, language, theme, setLanguage, setTheme } = useOperatorPrefs();
  const { deviceOptions, selectedDevice, setSelectedDevice, error: deviceError } =
    useAudioDevices();
  const { result, error: audioTestError, isTesting, runTest } =
    useAudioTest(selectedDevice);
  const { error } = useToast();
  const {
    interpreter,
    setInterpreter,
    apiKey,
    setApiKey,
    openaiKeyStatus,
    openaiKeyMasked,
    keyWarning,
    draftLanguage,
    setDraftLanguage,
    draftTheme,
    setDraftTheme,
    isSaving,
    handleSave,
  } = useOperatorSettings({
    labels,
    language,
    theme,
    setLanguage,
    setTheme,
    selectedDevice,
    setSelectedDevice,
  });

  useEffect(() => {
    if (deviceError) {
      error(labels.audioDeviceLoadFailed);
    }
  }, [deviceError, error, labels.audioDeviceLoadFailed]);

  const interpreterOptions = useMemo(
    () => [
      { value: 'echo', label: labels.echo },
      { value: 'openai', label: labels.openai },
    ],
    [labels]
  );

  const languageOptions = useMemo(
    () => [
      { value: 'ko', label: labels.languageKo },
      { value: 'en', label: labels.languageEn },
      { value: 'de', label: labels.languageDe },
    ],
    [labels]
  );

  const keyDisabled = interpreter === 'echo';
  const canRunAudioTest =
    Boolean(selectedDevice) &&
    deviceOptions.some((option) => option.value === selectedDevice);
  const currentKeyStatus =
    interpreter === 'openai' ? openaiKeyStatus : 'missing';
  const audioStatusLabel = result
    ? result.status === 'signal'
      ? labels.audioTestSignal
      : result.status === 'silent'
        ? labels.audioTestSilent
        : labels.audioTestDisconnected
    : labels.audioTestNotRun;
  const detectedFormatText = result
    ? formatAudioFormat(
        result.detected_sample_rate,
        result.detected_channels,
        result.detected_sample_width
      )
    : labels.audioTestNotRun;
  const processingFormatText = formatAudioFormat(
    result?.processing_sample_rate ?? 24000,
    result?.processing_channels ?? 1,
    result?.processing_sample_width ?? 2
  );
  const keyStatusLabel =
    currentKeyStatus === 'valid'
      ? labels.keyStatusValid
      : currentKeyStatus === 'invalid'
        ? labels.keyStatusInvalid
        : labels.keyStatusMissing;
  const keyStatusVariant =
    currentKeyStatus === 'valid'
      ? 'decided'
      : currentKeyStatus === 'invalid'
        ? 'deprecated'
        : 'readonly';
  const savedKeyPreview = openaiKeyMasked;

  return (
    <div className={styles.page}>
      <h1>{labels.navSettings}</h1>
      <div className={styles.stack}>
        <section className={styles.section}>
          <h2>{labels.appearance}</h2>
          <Select
            label={labels.language}
            options={languageOptions}
            value={draftLanguage}
            onChange={(value) => setDraftLanguage(value as UiLanguage)}
          />
          <SlideToggle
            label={labels.darkMode}
            checked={draftTheme === 'dark'}
            onChange={(checked) => setDraftTheme(checked ? 'dark' : 'light')}
          />
        </section>
        <section className={styles.section}>
          <h2>{labels.audioDevice}</h2>
          <Select
            label={labels.audioDevice}
            options={deviceOptions}
            value={selectedDevice}
            placeholder={labels.audioDevicePlaceholder}
            disabled={deviceOptions.length === 0}
            onChange={setSelectedDevice}
          />

          <div
            className={[
              styles.audioTestPanel,
              !canRunAudioTest ? styles.audioTestPanelDisabled : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-disabled={!canRunAudioTest}
          >
            <div className={styles.audioTestGrid}>
              <div className={styles.audioTestRow}>
                <span>{labels.audioTestStatus}</span>
                <strong>{audioStatusLabel}</strong>
              </div>
              <div className={styles.audioTestRow}>
                <span>{labels.audioTestInputLevel}</span>
                <div className={styles.audioTestMeter}>
                  <AudioLevelMeter
                    level={canRunAudioTest ? result?.input_level_dbfs ?? null : null}
                    label={labels.audioTestInputLevel}
                  />
                </div>
              </div>
              <div className={styles.audioTestRow}>
                <span>{labels.audioTestDetectedFormat}</span>
                <strong>{canRunAudioTest ? detectedFormatText : '—'}</strong>
              </div>
              <div className={styles.audioTestRow}>
                <span>{labels.audioTestProcessingFormat}</span>
                <strong>{canRunAudioTest ? processingFormatText : '—'}</strong>
              </div>
            </div>
            <div className={styles.audioTestAction}>
              <Button
                variant="secondary"
                disabled={isTesting || !canRunAudioTest}
                onClick={() => void runTest()}
              >
                {isTesting ? labels.audioTestRunning : labels.audioTest}
              </Button>
            </div>
            {audioTestError ? <p role="alert">{audioTestError}</p> : null}
            {result?.message ? <p role="status">{result.message}</p> : null}
          </div>
        </section>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {labels.interpreter}
            {interpreter !== 'echo' ? (
              <StatusTag
                label={keyStatusLabel}
                variant={keyStatusVariant}
              />
            ) : null}
          </h2>
          <Select
            label={labels.interpreter}
            options={interpreterOptions}
            value={interpreter}
            onChange={(value) => {
              setInterpreter(value as InterpreterName);
              setApiKey('');
            }}
          />
          <div className={styles.keyRow}>
            <div className={styles.inputWrap}>
              <InputField
                label={labels.apiKey}
                type="password"
                showPasswordToggle
                showPasswordLabel={labels.showApiKey}
                hidePasswordLabel={labels.hideApiKey}
                value={apiKey}
                disabled={keyDisabled}
                placeholder={
                  keyDisabled
                    ? labels.echoNoKey
                    : savedKeyPreview || labels.apiKeyPlaceholder
                }
                onChange={setApiKey}
              />
            </div>
          </div>
          {keyWarning && currentKeyStatus === 'invalid' ? (
            <p role="status">{keyWarning}</p>
          ) : null}
        </section>
        <div className={styles.applyActions}>
          <Button disabled={isSaving} onClick={() => void handleSave()}>
            {labels.apply}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatAudioFormat(
  sampleRate: number | null | undefined,
  channels: number | null | undefined,
  sampleWidth: number | null | undefined
) {
  if (sampleRate == null || channels == null || sampleWidth == null) {
    return '—';
  }

  return `${sampleRate} Hz / ${channels} ch / ${sampleWidth} bytes`;
}
