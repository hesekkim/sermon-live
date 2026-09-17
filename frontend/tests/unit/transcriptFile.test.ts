import { describe, expect, it } from 'vitest';
import {
  appendTranscriptLine,
  buildTranscriptDownload,
  buildTranscriptPaneDownload,
} from '../../src/pages/Operator/broadcast/transcriptFile';

describe('transcriptFile', () => {
  it('appends transcript fragments and skips empty', () => {
    const next = appendTranscriptLine(['Hallo'], ' Welt  ');
    expect(next).toEqual(['Hallo Welt']);
    expect(appendTranscriptLine(next, ' nächsten Satz')).toEqual([
      'Hallo Welt nächsten Satz',
    ]);
    expect(appendTranscriptLine(['Hallo.'], 'Nächster Satz')).toEqual([
      'Hallo. Nächster Satz',
    ]);
    expect(appendTranscriptLine(next, '   ')).toEqual(next);
  });

  it('preserves Korean word spacing across provider fragments', () => {
    const fragments = [
      '안녕하세요.',
      ' 안녕하세요.',
      ' 현재',
      ' 잘',
      ' 작동',
      ' 하는지',
      ' 검사',
      ' 중',
      ' 입니다.',
    ];

    const lines = fragments.reduce(
      (current, fragment) => appendTranscriptLine(current, fragment),
      [] as string[]
    );

    expect(lines).toEqual([
      '안녕하세요. 안녕하세요. 현재 잘 작동 하는지 검사 중 입니다.',
    ]);
  });

  it('builds a downloadable text document', () => {
    const body = buildTranscriptDownload(['안녕하세요'], ['Guten Tag']);
    expect(body).toContain('Input (Korean)');
    expect(body).toContain('안녕하세요');
    expect(body).toContain('Output (German)');
    expect(body).toContain('Guten Tag');
  });

  it('builds a separate pane download without the other transcript', () => {
    expect(buildTranscriptPaneDownload(['Guten Tag'])).toBe('Guten Tag\n');
  });
});
