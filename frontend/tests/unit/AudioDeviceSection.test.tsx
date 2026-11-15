import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import AudioDeviceSection from '../../src/pages/Operator/settings/components/AudioDeviceSection';
import { operatorCopy } from '../../src/pages/Operator/translations';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

const deviceSelector = JSON.stringify({
  host_api: 'Core Audio',
  name: 'USB Audio',
  version: 1,
});
const defaultOption = {
  value: 'default',
  label: operatorCopy.ko.audioDeviceDefault,
};
const options = [
  defaultOption,
  { value: deviceSelector, label: 'USB Audio' },
];

function renderSection({
  selectedDevice,
  availableOptions,
  isSelectionStale,
  audioFallbackToDefault,
}: {
  selectedDevice: string;
  availableOptions: typeof options;
  isSelectionStale: boolean;
  audioFallbackToDefault: boolean;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <AudioDeviceSection
        labels={operatorCopy.ko}
        options={availableOptions}
        selectedDevice={selectedDevice}
        channelOptions={[]}
        showChannelSelector={false}
        selectedChannel={1}
        isChannelStale={false}
        listMode="standard"
        isSelectionStale={isSelectionStale}
        isLoading={false}
        isAudioReady
        audioError={null}
        audioFallbackToDefault={audioFallbackToDefault}
        isRetryingCapture={false}
        captureRetryError={null}
        isSettingsLoaded
        isSaving={false}
        isSessionBusy={false}
        hasLoadError={false}
        hasDevices
        deviceSaveError={null}
        onDeviceChange={() => {}}
        onChannelChange={() => {}}
        onListModeChange={() => {}}
        onRefresh={() => {}}
        onRetry={() => {}}
        onRetryCapture={() => {}}
        result={null}
        liveInputLevel={null}
        runtimeInputLevel={null}
        runtimeInputLevelStale={false}
        error={null}
        isTesting={false}
        onRunTest={() => {}}
        onStopTest={() => {}}
      />,
    );
  });

  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('AudioDeviceSection', () => {
  it('keeps an available saved device selected during runtime fallback', () => {
    const section = renderSection({
      selectedDevice: deviceSelector,
      availableOptions: options,
      isSelectionStale: false,
      audioFallbackToDefault: true,
    });

    expect(
      section.container.querySelector('button[aria-label="USB Audio"]'),
    ).not.toBeNull();
    section.cleanup();
  });

  it('shows system default when the saved device disappears from the list', () => {
    const section = renderSection({
      selectedDevice: deviceSelector,
      availableOptions: [defaultOption],
      isSelectionStale: true,
      audioFallbackToDefault: false,
    });

    expect(
      section.container.querySelector(
        `button[aria-label="${operatorCopy.ko.audioDeviceDefault}"]`,
      ),
    ).not.toBeNull();
    section.cleanup();
  });
});
