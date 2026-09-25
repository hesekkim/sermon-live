import Button from '../../../shared/components/Button/Button';
import InputField from '../../../shared/components/InputField/InputField';
import { useOperatorPrefs } from '../OperatorPrefs';
import { useSermonSession } from './useSermonSession';
import styles from './SermonSession.module.css';

const LIFECYCLE_LABELS = {
  prepare: 'sermonPrepare',
  ready: 'sermonReady',
  live: 'sermonLive',
  ended: 'sermonEnded',
} as const;

export default function SermonSession() {
  const { labels } = useOperatorPrefs();
  const { details, updateDetails, lifecycle, isLoading, isSaving, save } =
    useSermonSession(labels);

  return (
    <div className={styles.page}>
      <h1>{labels.navSermonSession}</h1>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className={styles.lifecycle}>
          <span>{labels.sermonLifecycle}</span>
          <output aria-live="polite" data-status={lifecycle}>
            {labels[LIFECYCLE_LABELS[lifecycle]]}
          </output>
        </div>
        <InputField
          label={labels.sermonTitle}
          value={details.title}
          onChange={(value) => updateDetails('title', value)}
          disabled={isLoading}
        />
        <InputField
          label={labels.sermonSpeaker}
          value={details.speaker}
          onChange={(value) => updateDetails('speaker', value)}
          disabled={isLoading}
        />
        <InputField
          label={labels.sermonBibleReference}
          value={details.bible_reference}
          onChange={(value) => updateDetails('bible_reference', value)}
          disabled={isLoading}
        />
        <InputField
          label={labels.sermonBibleText}
          value={details.bible_text}
          onChange={(value) => updateDetails('bible_text', value)}
          multiline
          rows={5}
          disabled={isLoading}
        />
        <InputField
          label={labels.sermonNotes}
          value={details.notes}
          onChange={(value) => updateDetails('notes', value)}
          multiline
          rows={5}
          disabled={isLoading}
        />
        <div className={styles.actions}>
          <Button type="submit" disabled={isLoading || isSaving}>
            {labels.sermonSave}
          </Button>
        </div>
      </form>
    </div>
  );
}