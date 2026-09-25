import { useCallback, useEffect, useState } from 'react';

export interface AudioTestResult {
  status: 'disconnected' | 'silent' | 'signal';
  detected_sample_rate: number | null;
  detected_channels: number | null;
  detected_sample_width: number | null;
  input_level_dbfs: number | null;
  processing_sample_rate: number;
  processing_channels: number;
  processing_sample_width: number;
  processing_success: boolean;
  message: string;
}

export function useAudioTest(selectedDevice = '') {
  const [result, setResult] = useState<AudioTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [selectedDevice]);

  const runTest = useCallback(async () => {
    setIsTesting(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/audio/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_device: selectedDevice }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        const message = payload?.detail ?? 'Audio test request failed';
        setResult(null);
        setError(message);
        return null;
      }

      const payload = (await response.json()) as AudioTestResult;
      setResult(payload);
      setError(null);
      return payload;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Audio test request failed';
      setResult(null);
      setError(message);
      return null;
    } finally {
      setIsTesting(false);
    }
  }, [selectedDevice]);

  return {
    result,
    error,
    isTesting,
    runTest,
  };
}
