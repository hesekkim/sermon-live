import { useState } from 'react';
import { LuCopy, LuQrCode, LuRefreshCw } from 'react-icons/lu';
import { QRCodeSVG } from 'qrcode.react';
import Button from '../../../shared/components/Button/Button';
import Dialog from '../../../shared/components/Dialog/Dialog';
import type { OperatorCopy } from '../translations';
import {
  buildHotspotListenQrUrl,
  buildWifiQrPayload,
  type HotspotSecurity,
} from './hotspotQr';
import { useListenQr } from './useListenQr';
import layoutStyles from './OperatorLayout.module.css';
import styles from './ListenQrShare.module.css';

interface HotspotDetails {
  ssid: string;
  security: HotspotSecurity;
  password: string;
  ipv4: string;
}

const EMPTY_HOTSPOT_DETAILS: HotspotDetails = {
  ssid: '',
  security: 'WPA2',
  password: '',
  ipv4: '',
};

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
  const [hotspotDetails, setHotspotDetails] = useState(EMPTY_HOTSPOT_DETAILS);
  const { url, isLoading, hasError, refresh } = useListenQr();
  const wifiQr = buildWifiQrPayload(
    hotspotDetails.ssid,
    hotspotDetails.security,
    hotspotDetails.password,
  );
  const hotspotUrl = buildHotspotListenQrUrl(
    window.location.origin,
    hotspotDetails.ipv4,
  );
  const hasCompleteHotspotQr = Boolean(wifiQr && hotspotUrl);

  const openDialog = () => {
    setIsOpen(true);
    setCopyStatus(null);
    void refresh();
  };

  const closeDialog = () => {
    setIsOpen(false);
    setHotspotDetails(EMPTY_HOTSPOT_DETAILS);
    setCopyStatus(null);
  };

  const handleCopy = async (text: string) => {
    try {
      await copyText(text);
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
        title={labels.hotspotQrTitle}
        onClose={closeDialog}
        closeLabel={labels.toastClose}
        size="lg"
        overlayClassName={styles.dialogOverlay}
      >
        <div className={styles.content}>
          <p className={styles.instructions}>{labels.hotspotQrInstructions}</p>
          {isLoading ? <p role="status">{labels.listenQrLoading}</p> : null}
          {hasError && !hasCompleteHotspotQr ? (
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
          <div className={styles.hotspotForm}>
            <label className={styles.field}>
              <span>{labels.hotspotSsid}</span>
              <input
                autoComplete="off"
                value={hotspotDetails.ssid}
                onChange={(event) =>
                  setHotspotDetails((current) => ({
                    ...current,
                    ssid: event.target.value,
                  }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>{labels.hotspotSecurity}</span>
              <select
                value={hotspotDetails.security}
                onChange={(event) => {
                  const value = event.target.value;
                  if (
                    value !== 'open' &&
                    value !== 'WPA' &&
                    value !== 'WPA2' &&
                    value !== 'WPA3'
                  ) {
                    return;
                  }
                  const security: HotspotSecurity = value;
                  setHotspotDetails((current) => ({
                    ...current,
                    security,
                    password: security === 'open' ? '' : current.password,
                  }));
                }}
              >
                <option value="open">{labels.hotspotSecurityOpen}</option>
                <option value="WPA">{labels.hotspotSecurityWpa}</option>
                <option value="WPA2">{labels.hotspotSecurityWpa2}</option>
                <option value="WPA3">{labels.hotspotSecurityWpa3}</option>
              </select>
            </label>
            {hotspotDetails.security !== 'open' ? (
              <label className={styles.field}>
                <span>{labels.hotspotPassword}</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={hotspotDetails.password}
                  onChange={(event) =>
                    setHotspotDetails((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </label>
            ) : null}
            <label className={styles.field}>
              <span>{labels.hotspotIpv4}</span>
              <input
                autoComplete="off"
                inputMode="decimal"
                value={hotspotDetails.ipv4}
                onChange={(event) =>
                  setHotspotDetails((current) => ({
                    ...current,
                    ipv4: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <p className={styles.note}>{labels.hotspotWpaQrNote}</p>
          <div className={styles.qrSections}>
            <section className={styles.qrCard}>
              <h3>{labels.hotspotWifiQrTitle}</h3>
              {wifiQr ? (
                <div className={styles.qrFrame}>
                  <QRCodeSVG
                    value={wifiQr}
                    size={216}
                    marginSize={4}
                    title={labels.hotspotWifiQrTitle}
                  />
                </div>
              ) : (
                <p className={styles.unavailable}>
                  {labels.hotspotWifiQrUnavailable}
                </p>
              )}
            </section>
            <section className={styles.qrCard}>
              <h3>{labels.hotspotListenerQrTitle}</h3>
              {hotspotUrl ? (
                <>
                  <div className={styles.qrFrame}>
                    <QRCodeSVG
                      value={hotspotUrl}
                      size={216}
                      marginSize={4}
                      title={labels.hotspotListenerQrTitle}
                    />
                  </div>
                  <label className={styles.address}>
                    <span>{labels.listenQrAddress}</span>
                    <input
                      aria-label={labels.listenQrAddress}
                      readOnly
                      value={hotspotUrl}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </label>
                  <Button
                    variant="secondary"
                    icon={<LuCopy size={16} />}
                    onClick={() => void handleCopy(hotspotUrl)}
                  >
                    {copyStatus === 'copied'
                      ? labels.listenQrCopied
                      : labels.listenQrCopy}
                  </Button>
                  {copyStatus === 'failed' ? (
                    <p role="status" className={styles.copyStatus}>
                      {labels.listenQrCopyFailed}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className={styles.unavailable}>
                  {labels.hotspotListenerQrUnavailable}
                </p>
              )}
            </section>
          </div>
          {url && !isLoading && !hasCompleteHotspotQr ? (
            <section className={styles.qrCard}>
              <h3>{labels.listenQrTitle}</h3>
              <div className={styles.qrFrame}>
                <QRCodeSVG
                  value={url}
                  size={216}
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
                  onClick={() => void handleCopy(url)}
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
            </section>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
