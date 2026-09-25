import { LiaFileDownloadSolid } from 'react-icons/lia';
import Button from '../../../../shared/components/Button/Button';
import { buildTranscriptPaneDownload, downloadTextFile } from '../utils/transcriptFile';
import styles from '../Broadcast.module.css';

interface TranscriptPaneProps {
  title: string;
  empty: string;
  lines: string[];
  downloadLabel: string;
  filename: string;
}

export default function TranscriptPane({
  title,
  empty,
  lines,
  downloadLabel,
  filename,
}: TranscriptPaneProps) {
  return (
    <section className={styles.pane}>
      <div className={styles.paneHeader}>
        <h2>{title}</h2>
        <Button
          variant="ghost"
          icon={<LiaFileDownloadSolid size={20} />}
          aria-label={downloadLabel}
          title={downloadLabel}
          onClick={() => downloadTextFile(filename, buildTranscriptPaneDownload(lines))}
        />
      </div>
      <div className={styles.scroll}>
        {lines.length === 0 ? (
          <p className={styles.empty}>{empty}</p>
        ) : (
          lines.map((line, index) => (
            <p
              key={`${index}-${line.slice(0, 24)}`}
              className={index === lines.length - 1 ? styles.current : styles.past}
            >
              {line}
            </p>
          ))
        )}
      </div>
    </section>
  );
}