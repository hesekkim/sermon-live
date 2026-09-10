import styles from './Listen.module.css';
import { useListenAudio } from './useListenAudio';

export default function Listen() {
  const { status, subtitle, startListening } = useListenAudio();

  return (
    <div className={styles.page}>
      <div className={styles.app}>
        <h1>Church Live Translator</h1>
        <p>
          Connect to the local Wi-Fi broadcast and start listening to the sermon
          in real time. Use the laptop LAN IP, not localhost.
        </p>
        <button type="button" onClick={() => void startListening()}>
          Start Listening
        </button>
        <div className={styles.status}>{status}</div>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>
    </div>
  );
}
