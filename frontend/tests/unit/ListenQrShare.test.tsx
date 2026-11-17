import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ListenQrShare from '../../src/pages/Operator/layout/ListenQrShare';
import { operatorCopy } from '../../src/pages/Operator/translations';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../src/pages/Operator/layout/useListenQr', () => ({
  useListenQr: () => ({
    url: 'http://192.168.1.12:5173/listen',
    isLoading: false,
    hasError: false,
    refresh: () => undefined,
  }),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <div role="img" aria-label={title}>
      {value}
    </div>
  ),
}));

afterEach(() => {
  document.body.replaceChildren();
});

describe('ListenQrShare hotspot details', () => {
  it('creates separate Wi-Fi and hotspot listener QR codes, then clears details on close', () => {
    const labels = operatorCopy.en;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ListenQrShare labels={labels} />);
    });

    const openButton = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${labels.listenQrOpen}"]`,
    );
    act(() => openButton?.click());

    const getInput = (labelText: string) => {
      const label = Array.from(document.body.querySelectorAll('label')).find(
        (candidate) => candidate.textContent?.includes(labelText),
      );
      return label?.querySelector('input') ?? null;
    };
    const setInputValue = (input: HTMLInputElement | null, value: string) => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      act(() => {
        setValue?.call(input, value);
        input?.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };

    setInputValue(getInput(labels.hotspotSsid), 'Audience Wi-Fi');
    setInputValue(getInput(labels.hotspotPassword), 'PrivatePass123');
    setInputValue(getInput(labels.hotspotIpv4), '192.168.137.1');

    expect(
      document.body.querySelector(
        `[aria-label="${labels.hotspotWifiQrTitle}"]`,
      ),
    ).toHaveTextContent('WIFI:T:WPA;S:Audience Wi-Fi;P:PrivatePass123;;');
    const currentOrigin = new URL(window.location.origin);
    const port = currentOrigin.port ? `:${currentOrigin.port}` : '';
    expect(
      document.body.querySelector(
        `[aria-label="${labels.hotspotListenerQrTitle}"]`,
      ),
    ).toHaveTextContent(
      `${currentOrigin.protocol}//192.168.137.1${port}/listen`,
    );

    const closeButton = document.body.querySelector<HTMLButtonElement>(
      `button[aria-label="${labels.toastClose}"]`,
    );
    act(() => closeButton?.click());
    act(() => openButton?.click());

    expect(getInput(labels.hotspotSsid)).toHaveValue('');
    expect(getInput(labels.hotspotPassword)).toHaveValue('');
    expect(
      document.body.querySelector(
        `[aria-label="${labels.hotspotWifiQrTitle}"]`,
      ),
    ).toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
