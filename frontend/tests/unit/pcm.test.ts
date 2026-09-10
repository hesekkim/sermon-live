import { describe, expect, it } from 'vitest';
import { mergeOddPcmByte, pcm16ToFloat32 } from '../../src/shared/audio/pcm';

describe('mergeOddPcmByte', () => {
  it('holds the last byte when the chunk length is odd', () => {
    const incoming = new Uint8Array([1, 2, 3]);
    const result = mergeOddPcmByte(null, incoming);
    expect(Array.from(result.pcmBytes)).toEqual([1, 2]);
    expect(result.pending && Array.from(result.pending)).toEqual([3]);
  });

  it('prepends a pending byte onto the next chunk', () => {
    const pending = new Uint8Array([3]);
    const incoming = new Uint8Array([4, 5, 6]);
    const result = mergeOddPcmByte(pending, incoming);
    expect(Array.from(result.pcmBytes)).toEqual([3, 4, 5, 6]);
    expect(result.pending).toBeNull();
  });
});

describe('pcm16ToFloat32', () => {
  it('returns null for an empty buffer', () => {
    expect(pcm16ToFloat32(new Uint8Array())).toBeNull();
  });

  it('converts little-endian int16 samples', () => {
    const bytes = new Uint8Array(new Int16Array([32767, -32768]).buffer);
    const floats = pcm16ToFloat32(bytes);
    expect(floats).not.toBeNull();
    expect(floats![0]).toBeCloseTo(32767 / 32768);
    expect(floats![1]).toBeCloseTo(-1);
  });
});
