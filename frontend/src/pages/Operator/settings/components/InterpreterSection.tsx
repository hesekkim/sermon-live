import InputField from '../../../../shared/components/InputField/InputField';
import Select from '../../../../shared/components/Select/Select';
import StatusTag from '../../../../shared/components/StatusTag/StatusTag';
import type { OperatorCopy } from '../../translations';
import styles from '../Settings.module.css';

export type InterpreterName = 'echo' | 'openai';
type KeyStatus = 'valid' | 'missing' | 'invalid' | 'unverified';

interface InterpreterSectionProps {
  labels: OperatorCopy;
  interpreter: InterpreterName;
  onInterpreterChange: (interpreter: InterpreterName) => void;
  apiKey: string;
  onApiKeyChange: (apiKey: string) => void;
  keyStatus: KeyStatus;
  keyWarning: string;
  isValidatingKey: boolean;
  keyValidationFailed: boolean;
  savedKeyPreview: string;
  disabled: boolean;
}

export default function InterpreterSection({
  labels,
  interpreter,
  onInterpreterChange,
  apiKey,
  onApiKeyChange,
  keyStatus,
  keyWarning,
  isValidatingKey,
  keyValidationFailed,
  savedKeyPreview,
  disabled,
}: InterpreterSectionProps) {
  const keyStatusLabel = isValidatingKey
    ? labels.keyStatusChecking
    : keyStatus === 'valid'
      ? labels.keyStatusValid
      : keyStatus === 'invalid'
        ? labels.keyStatusInvalid
        : keyStatus === 'unverified'
          ? labels.keyStatusUnverified
          : labels.keyStatusMissing;
  const keyStatusVariant =
    !isValidatingKey && keyStatus === 'valid'
      ? 'decided'
      : !isValidatingKey && keyStatus === 'invalid'
        ? 'deprecated'
        : 'readonly';
  const keyDisabled = disabled || interpreter === 'echo';

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {labels.interpreter}
        {interpreter !== 'echo' ? (
          <StatusTag label={keyStatusLabel} variant={keyStatusVariant} />
        ) : null}
      </h2>
      {interpreter !== 'echo' ? (
        <p className={styles.timerHint}>{labels.keyStatusNote}</p>
      ) : null}
      {keyValidationFailed ? (
        <p className={styles.timerHint}>{labels.keyValidationFailed}</p>
      ) : keyWarning ? (
        <p className={styles.timerHint}>{keyWarning}</p>
      ) : null}
      <Select
        label={labels.interpreter}
        options={[
          { value: 'echo', label: labels.echo },
          { value: 'openai', label: labels.openai },
        ]}
        value={interpreter}
        disabled={disabled}
        onChange={(value) => onInterpreterChange(value as InterpreterName)}
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
            onChange={onApiKeyChange}
          />
        </div>
      </div>
      <div
        className={`${styles.transcriptOption} ${styles.transcriptOptionDisabled}`}
      >
        <label className={styles.transcriptToggle}>
          <input
            type="checkbox"
            name="input_transcript_enabled"
            defaultChecked={false}
            disabled
          />
          <span>{labels.inputTranscript}</span>
        </label>
        <p className={styles.timerHint}>{labels.inputTranscriptDescription}</p>
      </div>
    </section>
  );
}
