import InputField from '../../../../shared/components/InputField/InputField';
import type { OperatorCopy } from '../../translations';
import type { TimerDraftState, TimerValidationState } from '../hooks/useOperatorSettings';
import styles from '../Settings.module.css';

interface SafetySectionProps {
  labels: OperatorCopy;
  values: TimerDraftState;
  onChange: (field: keyof TimerDraftState, value: string) => void;
  validation: TimerValidationState;
}

export default function SafetySection({
  labels,
  values,
  onChange,
  validation,
}: SafetySectionProps) {
  const fields = [
    {
      key: 'autoStopMinutes' as const,
      name: 'translation_session_auto_stop_minutes',
      label: labels.autoStopMinutes,
      value: values.autoStopMinutes,
      error: validation.fieldErrors.autoStopMinutes,
    },
    {
      key: 'warningMinutes' as const,
      name: 'translation_session_warning_minutes',
      label: labels.warningMinutes,
      value: values.warningMinutes,
      error: validation.fieldErrors.warningMinutes,
    },
    {
      key: 'extensionMinutes' as const,
      name: 'translation_session_extension_minutes',
      label: labels.extensionMinutes,
      value: values.extensionMinutes,
      error: validation.fieldErrors.extensionMinutes,
    },
    {
      key: 'hardLimitMinutes' as const,
      name: 'translation_session_hard_limit_minutes',
      label: labels.hardLimitMinutes,
      value: values.hardLimitMinutes,
      error: validation.fieldErrors.hardLimitMinutes,
    },
  ];

  return (
    <section className={styles.section}>
      <h2>{labels.safety}</h2>
      <div className={styles.timerGrid}>
        {fields.map((field) => (
          <InputField
            key={field.key}
            label={field.label}
            type="number"
            inputMode="numeric"
            name={field.name}
            value={field.value}
            error={Boolean(field.error)}
            errorMessage={field.error ?? ''}
            onChange={(nextValue) => onChange(field.key, nextValue)}
          />
        ))}
      </div>
      <p className={styles.timerHint}>{labels.timerRangeHint}</p>
    </section>
  );
}
