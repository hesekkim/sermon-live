import { useEffect, useState } from 'react';
import styles from '../Listen.module.css';

interface SessionEndedDialogProps {
  message: (seconds: number) => string;
  seconds: number;
  title: string;
}

export function SessionEndedDialog({
  message,
  seconds,
  title,
}: SessionEndedDialogProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(seconds);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

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
        <p id="session-ended-message">{message(secondsRemaining)}</p>
      </section>
    </div>
  );
}
