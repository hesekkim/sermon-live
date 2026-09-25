import Select from '../../../../shared/components/Select/Select';
import SlideToggle from '../../../../shared/components/SlideToggle/SlideToggle';
import type { UiLanguage, UiTheme } from '../../translations';
import styles from '../Settings.module.css';

interface AppearanceSectionProps {
  title: string;
  languageLabel: string;
  languageOptions: { value: string; label: string }[];
  language: UiLanguage;
  onLanguageChange: (language: UiLanguage) => void;
  darkModeLabel: string;
  theme: UiTheme;
  onThemeChange: (theme: UiTheme) => void;
}

export default function AppearanceSection({
  title,
  languageLabel,
  languageOptions,
  language,
  onLanguageChange,
  darkModeLabel,
  theme,
  onThemeChange,
}: AppearanceSectionProps) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      <Select
        label={languageLabel}
        options={languageOptions}
        value={language}
        onChange={(value) => onLanguageChange(value as UiLanguage)}
      />
      <SlideToggle
        label={darkModeLabel}
        checked={theme === 'dark'}
        onChange={(checked) => onThemeChange(checked ? 'dark' : 'light')}
      />
    </section>
  );
}