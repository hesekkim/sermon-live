import { useEffect, useMemo } from 'react';
import Button from '../../../shared/components/Button/Button';
import InputField from '../../../shared/components/InputField/InputField';
import Select from '../../../shared/components/Select/Select';
import SlideToggle from '../../../shared/components/SlideToggle/SlideToggle';
import StatusTag from '../../../shared/components/StatusTag/StatusTag';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { useOperatorPrefs } from '../OperatorPrefs';
import type { UiLanguage } from '../translations';
import { useAudioDevices } from './useAudioDevices';
import { useOperatorSettings } from './useOperatorSettings';
import styles from './Settings.module.css';

type InterpreterName = 'echo' | 'openai';

export default function Settings() {
  const { labels, language, theme, setLanguage, setTheme } = useOperatorPrefs();
  const { deviceOptions, selectedDevice, setSelectedDevice, error: deviceError } =
    useAudioDevices();
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
  const currentKeyStatus =
    interpreter === 'openai' ? openaiKeyStatus : 'missing';
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
