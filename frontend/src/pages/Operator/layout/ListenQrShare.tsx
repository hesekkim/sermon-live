import { useState } from 'react';
import { LuCopy, LuQrCode, LuRefreshCw } from 'react-icons/lu';
import { QRCodeSVG } from 'qrcode.react';
import Button from '../../../shared/components/Button/Button';
import Dialog from '../../../shared/components/Dialog/Dialog';
import type { OperatorCopy } from '../translations';
import { useListenQr } from './useListenQr';
import layoutStyles from './OperatorLayout.module.css';
import styles from './ListenQrShare.module.css';

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) {
    throw new Error('Clipboard copy is unavailable');
  }
}

export default function ListenQrShare({ labels }: { labels: OperatorCopy }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'copied' | 'failed' | null>(
    null,
  );
  const { url, isLoading, hasError, refresh } = useListenQr();

  const openDialog = () => {
    setIsOpen(true);
    setCopyStatus(null);
    void refresh();
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await copyText(url);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  const handleRefresh = () => {
    setCopyStatus(null);
    void refresh();
  };

  return (
    <>
      <button
        type="button"
        className={layoutStyles.iconButton}
        aria-label={labels.listenQrOpen}
        title={labels.listenQrOpen}
        onClick={openDialog}
      >
        <LuQrCode size={20} aria-hidden />
      </button>
      <Dialog
        isOpen={isOpen}
        title={labels.listenQrTitle}
        onClose={() => setIsOpen(false)}
        closeLabel={labels.toastClose}
        size="md"
        overlayClassName={styles.dialogOverlay}
      >
        <div className={styles.content}>
          {isLoading ? <p role="status">{labels.listenQrLoading}</p> : null}
          {hasError ? (
            <div className={styles.error}>
              <p role="alert">{labels.listenQrUnavailable}</p>
              <Button
                variant="secondary"
                icon={<LuRefreshCw size={16} />}
                onClick={handleRefresh}
              >
                {labels.listenQrRefresh}
              </Button>
            </div>
          ) : null}
          {url && !isLoading ? (
            <>
              <div className={styles.qrFrame}>
                <QRCodeSVG
                  value={url}
                  size={256}
                  marginSize={4}
                  title={labels.listenQrTitle}
                />
              </div>
              <label className={styles.address}>
                <span>{labels.listenQrAddress}</span>
                <input
                  aria-label={labels.listenQrAddress}
                  readOnly
                  value={url}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  icon={<LuRefreshCw size={16} />}
                  onClick={handleRefresh}
                >
                  {labels.listenQrRefresh}
                </Button>
                <Button
                  variant="primary"
                  icon={<LuCopy size={16} />}
                  onClick={() => void handleCopy()}
                >
                  {copyStatus === 'copied'
                    ? labels.listenQrCopied
                    : labels.listenQrCopy}
                </Button>
              </div>
              {copyStatus === 'failed' ? (
                <p role="status" className={styles.copyStatus}>
                  {labels.listenQrCopyFailed}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
