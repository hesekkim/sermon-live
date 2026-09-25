import { useEffect, useMemo } from 'react';
import Button from '../../../shared/components/Button/Button';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { useOperatorPrefs } from '../OperatorPrefs';
import AppearanceSection from './components/AppearanceSection';
import AudioDeviceSection from './components/AudioDeviceSection';
import InterpreterSection from './components/InterpreterSection';
import SafetySection from './components/SafetySection';
import { useAudioDevices } from './hooks/useAudioDevices';
import { useAudioTest } from './hooks/useAudioTest';
import { useOperatorSettings } from './hooks/useOperatorSettings';
import styles from './Settings.module.css';

export default function Settings() {
  const { labels, language, theme, setLanguage, setTheme } = useOperatorPrefs();
  const { deviceOptions, selectedDevice, setSelectedDevice, error: deviceError } =
    useAudioDevices();
  const { result, liveInputLevel, error: audioTestError, isTesting, runTest } =
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
    timerValues,
    setTimerValue,
    timerValidation,
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

  const languageOptions = useMemo(
    () => [
      { value: 'ko', label: labels.languageKo },
      { value: 'en', label: labels.languageEn },
      { value: 'de', label: labels.languageDe },
    ],
    [labels]
  );

  const currentKeyStatus =
    interpreter === 'openai' ? openaiKeyStatus : 'missing';

  return (
    <div className={styles.page}>
      <h1>{labels.navSettings}</h1>
      <div className={styles.stack}>
        <AppearanceSection
          title={labels.appearance}
          languageLabel={labels.language}
          languageOptions={languageOptions}
          language={draftLanguage}
          onLanguageChange={setDraftLanguage}
          darkModeLabel={labels.darkMode}
          theme={draftTheme}
          onThemeChange={setDraftTheme}
        />
        <AudioDeviceSection
          labels={labels}
          options={deviceOptions}
          selectedDevice={selectedDevice}
          onDeviceChange={setSelectedDevice}
          result={result}
          liveInputLevel={liveInputLevel}
          error={audioTestError}
          isTesting={isTesting}
          onRunTest={() => void runTest()}
        />
        <SafetySection
          labels={labels}
          values={timerValues}
          onChange={setTimerValue}
          validation={timerValidation}
        />
        <InterpreterSection
          labels={labels}
          interpreter={interpreter}
          onInterpreterChange={(value) => {
            setInterpreter(value);
            setApiKey('');
          }}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          keyStatus={currentKeyStatus}
          savedKeyPreview={openaiKeyMasked}
          keyWarning={keyWarning}
        />
        <div className={styles.applyActions}>
          <Button disabled={isSaving} onClick={() => void handleSave()}>
            {labels.apply}
          </Button>
        </div>
      </div>
    </div>
  );
}
