import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
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
import type { OperatorOutletContext } from '../layout/OperatorLayout';
import styles from './Settings.module.css';

type SettingsTab = 'appearance' | 'devices' | 'safety' | 'api';

export default function Settings() {
  const navigate = useNavigate();
  const outletContext = useOutletContext<OperatorOutletContext | null>();
  const isSessionBusy = outletContext?.isSessionBusy ?? false;
  const { labels, language, setLanguage } = useOperatorPrefs();
  const {
    devices,
    deviceOptions,
    selectedDevice,
    setSelectedDevice,
    isLoading: isLoadingDevices,
    error: deviceLoadError,
    refresh: refreshDevices,
  } = useAudioDevices();
  const {
    result,
    liveInputLevel,
    error: audioTestError,
    isTesting,
    runTest,
    stopTest,
  } = useAudioTest(selectedDevice, labels.audioTestTimeout);
  const { error, info } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [deviceSaveError, setDeviceSaveError] = useState<string | null>(null);
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
    timerValues,
    setTimerValue,
    timerValidation,
    isSaving,
    isSafetyDirty,
    isApiModelDirty,
    saveDevice,
    saveSafety,
    saveApiModel,
  } = useOperatorSettings({
    labels,
    language,
    setSelectedDevice,
  });

  const languageOptions = useMemo(
    () => [
      { value: 'ko', label: labels.languageKo },
      { value: 'en', label: labels.languageEn },
      { value: 'de', label: labels.languageDe },
    ],
    [labels],
  );
  const allDeviceOptions = useMemo(
    () => [
      { value: 'default', label: labels.audioDeviceDefault },
      ...deviceOptions,
    ],
    [deviceOptions, labels.audioDeviceDefault],
  );

  const currentKeyStatus =
    interpreter === 'openai' ? openaiKeyStatus : 'missing';

  const tabs = [
    { id: 'appearance' as const, label: labels.appearance },
    { id: 'devices' as const, label: labels.audioDevice },
    { id: 'safety' as const, label: labels.safety },
    { id: 'api' as const, label: labels.interpreter },
  ];

  const handleDeviceChange = async (nextDevice: string) => {
    const previousDevice = selectedDevice;
    setDeviceSaveError(null);
    setSelectedDevice(nextDevice);
    const result = await saveDevice(nextDevice);
    if (!result.success) {
      setSelectedDevice(previousDevice);
      setDeviceSaveError(
        result.status === 409
          ? labels.audioDeviceSessionConflict
          : result.message,
      );
    }
  };

  const renderContent = () => {
    if (activeTab === 'appearance') {
      return (
        <AppearanceSection
          title={labels.appearance}
          languageLabel={labels.language}
          languageOptions={languageOptions}
          language={draftLanguage}
          onLanguageChange={(nextLanguage) => {
            setDraftLanguage(nextLanguage);
            setLanguage(nextLanguage);
          }}
        />
      );
    }

    if (activeTab === 'devices') {
      return (
        <AudioDeviceSection
          labels={labels}
          options={allDeviceOptions}
          selectedDevice={selectedDevice}
          isLoading={isLoadingDevices}
          isSaving={isSaving}
          isSessionBusy={isSessionBusy}
          hasLoadError={deviceLoadError}
          hasDevices={devices.length > 0}
          deviceSaveError={deviceSaveError}
          onDeviceChange={(value) => {
            void handleDeviceChange(value);
          }}
          onRefresh={() => void refreshDevices()}
          onRetry={() => void refreshDevices()}
          result={result}
          liveInputLevel={liveInputLevel}
          runtimeInputLevel={outletContext?.audioLevel ?? null}
          error={audioTestError}
          isTesting={isTesting}
          onRunTest={() => void runTest()}
          onStopTest={stopTest}
        />
      );
    }

    if (activeTab === 'safety') {
      return (
        <>
          <SafetySection
            labels={labels}
            values={timerValues}
            onChange={setTimerValue}
            validation={timerValidation}
          />
          <div className={styles.applyActions}>
            <Button
              disabled={isSaving || timerValidation.hasErrors || !isSafetyDirty}
              onClick={async () => {
                const saved = await saveSafety();
                if (saved.success) {
                  info(labels.applySaved);
                } else {
                  error(saved.message);
                }
              }}
            >
              {labels.apply}
            </Button>
          </div>
        </>
      );
    }

    return (
      <>
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
          <Button
            disabled={isSaving || !isApiModelDirty}
            onClick={async () => {
              const saved = await saveApiModel();
              if (saved.success) {
                info(labels.applySaved);
              } else {
                error(saved.message);
              }
            }}
          >
            {labels.apply}
          </Button>
        </div>
      </>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Button
          variant="ghost"
          type="button"
          aria-label={labels.back}
          title={labels.back}
          onClick={() => navigate('/operator/broadcast', { replace: true })}
        >
          {labels.back}
        </Button>
      </div>
      <h1>{labels.navSettings}</h1>
      <div
        role="tablist"
        className={styles.tabList}
        aria-label={labels.navSettings}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`settings-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.stack}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={`settings-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`settings-tab-${tab.id}`}
            hidden={activeTab !== tab.id}
            className={
              activeTab === tab.id ? styles.panelVisible : styles.panelHidden
            }
          >
            {activeTab === tab.id ? renderContent() : null}
          </div>
        ))}
      </div>
    </div>
  );
}
