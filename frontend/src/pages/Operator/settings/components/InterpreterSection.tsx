import InputField from '../../../../shared/components/InputField/InputField';
import Select from '../../../../shared/components/Select/Select';
import StatusTag from '../../../../shared/components/StatusTag/StatusTag';
import type { OperatorCopy } from '../../translations';
import styles from '../Settings.module.css';

export type InterpreterName = 'echo' | 'openai';
type KeyStatus = 'valid' | 'missing' | 'invalid';

interface InterpreterSectionProps {
  labels: OperatorCopy;
  interpreter: InterpreterName;
  onInterpreterChange: (interpreter: InterpreterName) => void;
  apiKey: string;
  onApiKeyChange: (apiKey: string) => void;
  keyStatus: KeyStatus;
  savedKeyPreview: string;
  keyWarning: string;
}

export default function InterpreterSection({
  labels,
  interpreter,
  onInterpreterChange,
  apiKey,
  onApiKeyChange,
  keyStatus,
  savedKeyPreview,
  keyWarning,
}: InterpreterSectionProps) {
  const keyStatusLabel =
    keyStatus === 'valid'
      ? labels.keyStatusValid
      : keyStatus === 'invalid'
        ? labels.keyStatusInvalid
        : labels.keyStatusMissing;
  const keyStatusVariant =
    keyStatus === 'valid' ? 'decided' : keyStatus === 'invalid' ? 'deprecated' : 'readonly';
  const keyDisabled = interpreter === 'echo';

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {labels.interpreter}
        {interpreter !== 'echo' ? <StatusTag label={keyStatusLabel} variant={keyStatusVariant} /> : null}
      </h2>
      <Select
        label={labels.interpreter}
        options={[
          { value: 'echo', label: labels.echo },
          { value: 'openai', label: labels.openai },
        ]}
        value={interpreter}
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
            placeholder={keyDisabled ? labels.echoNoKey : savedKeyPreview || labels.apiKeyPlaceholder}
            onChange={onApiKeyChange}
          />
        </div>
      </div>
      {keyWarning && keyStatus === 'invalid' ? <p role="status">{keyWarning}</p> : null}
    </section>
  );
}