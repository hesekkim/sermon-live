import { useEffect, useMemo, useState } from 'react';
import Button from '../../../shared/components/Button/Button';
import InputField from '../../../shared/components/InputField/InputField';
import Select from '../../../shared/components/Select/Select';
import SlideToggle from '../../../shared/components/SlideToggle/SlideToggle';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import { useOperatorPrefs } from '../OperatorPrefs';
import styles from './Settings.module.css';

type InterpreterName = 'echo' | 'gemini' | 'openai';

interface SettingsResponse {
  interpreter: InterpreterName;
  gemini_key_set: boolean;
  openai_key_set: boolean;
  gemini_key_masked?: string;
  openai_key_masked?: string;
}

export default function Settings() {
  const { labels, language, theme, setLanguage, setTheme } = useOperatorPrefs();
  const [interpreter, setInterpreter] = useState<InterpreterName>('echo');
  const [apiKey, setApiKey] = useState('');
  const [geminiKeySet, setGeminiKeySet] = useState(false);
  const [openaiKeySet, setOpenaiKeySet] = useState(false);
  const [geminiKeyMasked, setGeminiKeyMasked] = useState('');
  const [openaiKeyMasked, setOpenaiKeyMasked] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { info, error } = useToast();

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/v1/operator/settings');
        if (!response.ok) {
          error(labels.settingsLoadFailed);
          return;
        }
        const data = (await response.json()) as SettingsResponse;
        setInterpreter(data.interpreter);
        setGeminiKeySet(data.gemini_key_set);
        setOpenaiKeySet(data.openai_key_set);
        setGeminiKeyMasked(data.gemini_key_masked ?? '');
        setOpenaiKeyMasked(data.openai_key_masked ?? '');
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
  const keyHint =
    interpreter === 'echo'
      ? labels.echoNoKey
      : interpreter === 'openai'
        ? openaiKeySet
          ? labels.apiKeySaved
          : labels.openaiUnavailable
        : geminiKeySet
          ? labels.apiKeySaved
          : undefined;
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
      setInterpreter(data.interpreter);
      setGeminiKeySet(data.gemini_key_set);
      setOpenaiKeySet(data.openai_key_set);
      setGeminiKeyMasked(data.gemini_key_masked ?? '');
      setOpenaiKeyMasked(data.openai_key_masked ?? '');
      setApiKey('');
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
          <h2>{labels.interpreter}</h2>
          <Select
            label={labels.interpreter}
            options={interpreterOptions}
            value={interpreter}
            onChange={(value) => {
              setInterpreter(value as InterpreterName);
              setApiKey('');
            }}
          />
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
          {keyHint ? <p className={styles.hint}>{keyHint}</p> : null}
          <div>
            <Button disabled={isSaving} onClick={() => void handleSave()}>
              {labels.apply}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
