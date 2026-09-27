import Select from '../../../../shared/components/Select/Select';
import type { UiLanguage } from '../../translations';
import styles from '../Settings.module.css';

interface AppearanceSectionProps {
  title: string;
  languageLabel: string;
  languageOptions: { value: string; label: string }[];
  language: UiLanguage;
  onLanguageChange: (language: UiLanguage) => void;
}

export default function AppearanceSection({
  title,
  languageLabel,
  languageOptions,
  language,
  onLanguageChange,
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
    </section>
  );
}