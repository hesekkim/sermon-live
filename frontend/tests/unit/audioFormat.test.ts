import { describe, expect, it } from 'vitest';
import { formatAudioFormat } from '../../src/pages/Operator/settings/utils/audioFormat';

describe('formatAudioFormat', () => {
	it('displays sample width in bits', () => {
		expect(formatAudioFormat(24000, 1, 2)).toBe('24000 Hz / 1 ch / 16-bit PCM');
	});

	it('returns an empty marker when the format is incomplete', () => {
		expect(formatAudioFormat(null, 1, 2)).toBe('—');
	});
});