import { useEffect, useMemo, useState } from 'react';
import Button from '../../../shared/components/Button/Button';
import InputField from '../../../shared/components/InputField/InputField';
import Select from '../../../shared/components/Select/Select';
import SlideToggle from '../../../shared/components/SlideToggle/SlideToggle';
import StatusTag from '../../../shared/components/StatusTag/StatusTag';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { useOperatorPrefs } from '../OperatorPrefs';
import styles from './Settings.module.css';

type InterpreterName = 'echo' | 'gemini' | 'openai';
type KeyStatus = 'valid' | 'missing' | 'invalid';

interface SettingsResponse {
  interpreter: InterpreterName;
  gemini_key_set: boolean;
  openai_key_set: boolean;
  gemini_key_masked?: string;
  openai_key_masked?: string;
  gemini_key_status?: KeyStatus;
  openai_key_status?: KeyStatus;
  gemini_key_warning?: string | null;
  openai_key_warning?: string | null;
}

export default function Settings() {
  const { labels, language, theme, setLanguage, setTheme } = useOperatorPrefs();
  const [interpreter, setInterpreter] = useState<InterpreterName>('echo');
  const [apiKey, setApiKey] = useState('');
  const [geminiKeyStatus, setGeminiKeyStatus] = useState<KeyStatus>('missing');
  const [openaiKeyStatus, setOpenaiKeyStatus] = useState<KeyStatus>('missing');
  const [geminiKeyMasked, setGeminiKeyMasked] = useState('');
  const [openaiKeyMasked, setOpenaiKeyMasked] = useState('');
  const [keyWarning, setKeyWarning] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { info, warning, error } = useToast();

  const applySettingsResponse = (data: SettingsResponse) => {
    setInterpreter(data.interpreter);
    setGeminiKeyStatus(data.gemini_key_status ?? 'missing');
    setOpenaiKeyStatus(data.openai_key_status ?? 'missing');
    setGeminiKeyMasked(data.gemini_key_masked ?? '');
    setOpenaiKeyMasked(data.openai_key_masked ?? '');
    setKeyWarning(getSelectedWarning(data));
  };

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/v1/operator/settings');
        if (!response.ok) {
          error(labels.settingsLoadFailed);
          return;
        }
        const data = (await response.json()) as SettingsResponse;
        applySettingsResponse(data);
        if (data.gemini_key_status === 'invalid' && data.gemini_key_warning) {
          warning(summarizeWarning(data.gemini_key_warning));
        } else if (data.openai_key_status === 'invalid' && data.openai_key_warning) {
          warning(summarizeWarning(data.openai_key_warning));
        }
      } catch {
        error(labels.settingsLoadFailed);
      }
    })();
  }, [error, labels.settingsLoadFailed]);

  const interpreterOptions = useMemo(
    () => [
      { value: 'echo', label: labels.echo },
      { value: 'gemini', label: labels.gemini },
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
    interpreter === 'gemini'
      ? geminiKeyStatus
      : interpreter === 'openai'
        ? openaiKeyStatus
        : 'missing';
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
  const savedKeyPreview =
    interpreter === 'gemini' ? geminiKeyMasked : openaiKeyMasked;

  const handleSave = async () => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      const trimmedKey = apiKey.trim();
      const body: Record<string, string> = { interpreter };
      if (interpreter === 'gemini' && trimmedKey) {
        body.gemini_api_key = trimmedKey;
      }
      if (interpreter === 'openai' && trimmedKey) {
        body.openai_api_key = trimmedKey;
      }
      const response = await fetch('/api/v1/operator/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        error(labels.applyFailed);
        return;
      }
      const data = (await response.json()) as SettingsResponse;
      applySettingsResponse(data);
      setApiKey('');
      const responseWarning = getSelectedWarning(data);
      if (responseWarning && data.interpreter !== 'echo') {
        warning(summarizeWarning(responseWarning));
      }
      info(labels.applySaved);
    } catch {
      error(labels.applyFailed);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1>{labels.navSettings}</h1>
      <div className={styles.stack}>
        <section className={styles.section}>
          <h2>{labels.appearance}</h2>
          <Select
            label={labels.language}
            options={languageOptions}
            value={language}
            onChange={(value) => setLanguage(value as 'ko' | 'en' | 'de')}
          />
          <SlideToggle
            label={labels.darkMode}
            checked={theme === 'dark'}
            onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
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
          <div>
            {keyWarning && currentKeyStatus === 'invalid' ? (
              <p role="status">{keyWarning}</p>
            ) : null}
            <Button disabled={isSaving} onClick={() => void handleSave()}>
              {labels.apply}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function getSelectedWarning(data: SettingsResponse): string {
  const warning =
    data.interpreter === 'gemini'
      ? data.gemini_key_warning
      : data.interpreter === 'openai'
        ? data.openai_key_warning
        : null;
  return warning ? summarizeWarning(warning) : '';
}

function summarizeWarning(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 160
    ? `${normalized.slice(0, 157).trimEnd()}...`
    : normalized;
}
