import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import AudioLevelMeter from '../../src/shared/components/AudioLevelMeter/AudioLevelMeter';

describe('AudioLevelMeter', () => {
  it('fills one horizontal segmented bar according to the input signal', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AudioLevelMeter level={-12} />);
    });

    const meter = container.querySelector('[role="meter"]');
    const segments = meter?.querySelectorAll('[data-segment]');

    expect(meter?.getAttribute('data-mode')).toBe('signal');
    expect(segments).toHaveLength(24);
    expect(meter?.querySelectorAll('[data-visible="true"]')).toHaveLength(20);
    expect(
      Array.from(meter?.querySelectorAll('[data-visible="false"]') ?? []).every(
        (segment) => segment.getAttribute('style')?.includes('opacity: 0.3'),
      ),
    ).toBe(true);

    act(() => root.unmount());
    container.remove();
  });

  it('shows the idle color gradient at its default dim level', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<AudioLevelMeter level={-55} />);
    });

    const meter = container.querySelector('[role="meter"]');
    const segments = meter?.querySelectorAll('[data-segment]');

    expect(meter?.getAttribute('data-mode')).toBe('idle');
    expect(segments).toHaveLength(24);
    expect(meter?.querySelectorAll('[data-visible="true"]')).toHaveLength(0);
    expect(
      Array.from(segments ?? []).every(
        (segment) => segment.getAttribute('style')?.includes('opacity: 0.3'),
      ),
    ).toBe(true);

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

  it('announces when the displayed level is stale', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AudioLevelMeter
          level={-18}
          isStale
          staleLabel="Stale measurement"
        />,
      );
    });

    const meter = container.querySelector('[role="meter"]');
    expect(meter?.getAttribute('aria-valuetext')).toBe(
      '-18.0 dBFS, Stale measurement',
    );

    act(() => root.unmount());
    container.remove();
  });
});
