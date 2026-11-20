import styles from '../Listen.module.css';

interface SessionEndedDialogProps {
  message: string;
  title: string;
}

export function SessionEndedDialog({
  message,
  title,
}: SessionEndedDialogProps) {
  return (
    <div className={styles.sessionEndBackdrop}>
      <section
        className={styles.sessionEndDialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-ended-title"
        aria-describedby="session-ended-message"
      >
        <h2 id="session-ended-title">{title}</h2>
        <p id="session-ended-message">{message}</p>
      </section>
    </div>
  );
}
