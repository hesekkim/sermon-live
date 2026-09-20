import { useEffect, useMemo, useState } from 'react';
import Button from '../../../shared/components/Button/Button';
import InputField from '../../../shared/components/InputField/InputField';
import Select from '../../../shared/components/Select/Select';
import SlideToggle from '../../../shared/components/SlideToggle/SlideToggle';
import { useOperatorPrefs } from '../OperatorPrefs';
import styles from './Settings.module.css';

type InterpreterName = 'echo' | 'gemini' | 'openai';

interface SettingsResponse {
  interpreter: InterpreterName;
  gemini_key_set: boolean;
  openai_key_set: boolean;
}

export default function Settings() {
  const { labels, language, theme, setLanguage, setTheme } = useOperatorPrefs();
  const [interpreter, setInterpreter] = useState<InterpreterName>('echo');
  const [apiKey, setApiKey] = useState('');
  const [geminiKeySet, setGeminiKeySet] = useState(false);
  const [openaiKeySet, setOpenaiKeySet] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/v1/operator/settings');
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as SettingsResponse;
      setInterpreter(data.interpreter);
      setGeminiKeySet(data.gemini_key_set);
      setOpenaiKeySet(data.openai_key_set);
    })();
  }, []);

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

  const handleSave = async () => {
    setStatus('');
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
        setStatus(labels.saveFailed);
        return;
      }
      const data = (await response.json()) as SettingsResponse;
      setInterpreter(data.interpreter);
      setGeminiKeySet(data.gemini_key_set);
      setOpenaiKeySet(data.openai_key_set);
      setApiKey('');
      setStatus(labels.saved);
    } catch {
      setStatus(labels.saveFailed);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{labels.navSettings}</h1>
        <SlideToggle
          label={labels.darkMode}
          checked={theme === 'dark'}
          onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        />
      </div>
      <div className={styles.stack}>
        <Select
          label={labels.interpreter}
          options={interpreterOptions}
          value={interpreter}
          onChange={(value) => {
            setInterpreter(value as InterpreterName);
            setApiKey('');
            setStatus('');
          }}
        />
        <InputField
          label={labels.apiKey}
          type="password"
          value={apiKey}
          disabled={keyDisabled}
          placeholder={keyDisabled ? labels.echoNoKey : labels.apiKeyPlaceholder}
          onChange={setApiKey}
        />
        {keyHint ? <p className={styles.hint}>{keyHint}</p> : null}
        <Select
          label={labels.language}
          options={languageOptions}
          value={language}
          onChange={(value) => setLanguage(value as 'ko' | 'en' | 'de')}
        />
        <div>
          <Button onClick={() => void handleSave()}>{labels.save}</Button>
        </div>
        {status ? <p className={styles.status}>{status}</p> : null}
      </div>
    </div>
  );
}
