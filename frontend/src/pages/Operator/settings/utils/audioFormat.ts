export function formatAudioFormat(
  sampleRate: number | null | undefined,
  channels: number | null | undefined,
  sampleWidth: number | null | undefined
) {
  if (sampleRate == null || channels == null || sampleWidth == null) {
    return '—';
  }

  return `${sampleRate} Hz / ${channels} ch / ${sampleWidth * 8}-bit PCM`;
}