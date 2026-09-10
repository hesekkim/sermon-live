export function mergeOddPcmByte(
  pending: Uint8Array | null,
  incoming: Uint8Array
): { pcmBytes: Uint8Array; pending: Uint8Array | null } {
  let pcmBytes = incoming;

  if (pending && pending.length > 0) {
    const merged = new Uint8Array(pending.length + incoming.length);
    merged.set(pending, 0);
    merged.set(incoming, pending.length);
    pcmBytes = merged;
  }

  let nextPending: Uint8Array | null = null;
  if (pcmBytes.length % 2 !== 0) {
    nextPending = pcmBytes.slice(pcmBytes.length - 1);
    pcmBytes = pcmBytes.slice(0, pcmBytes.length - 1);
  }

  return { pcmBytes, pending: nextPending };
}

export function pcm16ToFloat32(pcmBytes: Uint8Array): Float32Array | null {
  if (pcmBytes.length === 0) {
    return null;
  }

  const int16 = new Int16Array(
    pcmBytes.buffer,
    pcmBytes.byteOffset,
    pcmBytes.byteLength / 2
  );
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}
