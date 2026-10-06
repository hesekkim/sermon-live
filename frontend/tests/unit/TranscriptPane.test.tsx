import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TranscriptPane from '../../src/pages/Operator/broadcast/components/TranscriptPane';
import * as transcriptFile from '../../src/pages/Operator/broadcast/utils/transcriptFile';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

let roots: Root[] = [];

function renderPane(lines: string[]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() =>
    root.render(
      <TranscriptPane
        title="German transcript"
        empty="No transcript"
        lines={lines}
        downloadLabel="Download transcript"
        filename="transcript.txt"
      />
    )
  );
  return container;
}

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('TranscriptPane', () => {
  it('scrolls to the newest transcript line when lines change', () => {
    const container = renderPane(['First line.']);
    const scroll = container.querySelector('[class*="scroll"]') as HTMLDivElement;
    Object.defineProperty(scroll, 'scrollHeight', {
      configurable: true,
      value: 240,
    });

    act(() => {
      roots[0].render(
        <TranscriptPane
          title="German transcript"
          empty="No transcript"
          lines={['First line.', 'Newest line.']}
          downloadLabel="Download transcript"
          filename="transcript.txt"
        />,
      );
    });

    expect(scroll.scrollTop).toBe(240);
  });

  it('disables download for empty content and downloads valid transcript lines', () => {
    const download = vi.spyOn(transcriptFile, 'downloadTextFile').mockImplementation(() => {});
    const emptyPane = renderPane(['', '   ']);
    const emptyButton = emptyPane.querySelector(
      'button[aria-label="Download transcript"]'
    ) as HTMLButtonElement;

    expect(emptyButton).toBeDisabled();
    act(() => emptyButton.click());
    expect(download).not.toHaveBeenCalled();

    act(() => roots[0].unmount());
    roots = [];
    emptyPane.remove();

    const populatedPane = renderPane(['Guten Morgen.']);
    const downloadButton = populatedPane.querySelector(
      'button[aria-label="Download transcript"]'
    ) as HTMLButtonElement;

    expect(downloadButton).toBeEnabled();
    act(() => downloadButton.click());
    expect(download).toHaveBeenCalledWith('transcript.txt', 'Guten Morgen.\n');
  });
});