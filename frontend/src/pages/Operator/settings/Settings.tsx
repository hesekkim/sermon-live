import { useMemo } from 'react';
import Select from '../../../shared/components/Select/Select';
import SlideToggle from '../../../shared/components/SlideToggle/SlideToggle';
import { useOperatorPrefs } from '../OperatorPrefs';
import styles from './Settings.module.css';

export default function Settings() {
  const { labels, language, theme, setLanguage, setTheme } = useOperatorPrefs();

  const languageOptions = useMemo(
    () => [
      { value: 'ko', label: labels.languageKo },
      { value: 'en', label: labels.languageEn },
      { value: 'de', label: labels.languageDe },
    ],
    [labels]
  );

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
          label={labels.language}
          options={languageOptions}
          value={language}
          onChange={(value) => setLanguage(value as 'ko' | 'en' | 'de')}
        />
      </div>
    </div>
  );
}
