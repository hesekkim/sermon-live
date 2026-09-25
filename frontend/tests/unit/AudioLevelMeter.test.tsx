import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import AudioLevelMeter from '../../src/shared/components/AudioLevelMeter/AudioLevelMeter';

describe('AudioLevelMeter', () => {
  it('reveals the next color band only after the matching threshold is crossed', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AudioLevelMeter level={-12} />);
    });

    const meter = container.querySelector('[role="meter"]');
    const segments = meter?.querySelectorAll('[data-segment]');

    expect(segments).toHaveLength(4);
    expect(Array.from(segments ?? []).map((segment) => segment.getAttribute('data-visible'))).toEqual([
      'true',
      'true',
      'true',
      'false',
    ]);

    act(() => root.unmount());
    container.remove();
  });

  it('marks the meter as measuring while an audio test is active', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AudioLevelMeter level={null} isActive />);
    });

    const meter = container.querySelector('[role="meter"]');
    expect(meter?.getAttribute('aria-valuetext')).toBe('measuring');

    act(() => root.unmount());
    container.remove();
  });
});
