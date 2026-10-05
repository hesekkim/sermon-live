import { useCallback, useEffect, useRef, useState } from 'react';
import { operatorFetch } from '../../auth/operatorAuthApi';

const AUDIO_TEST_TIMEOUT_MS = 15_000;

export interface AudioTestResult {
  status: 'disconnected' | 'silent' | 'signal';
  capture_sample_rate: number | null;
  capture_channels: number | null;
  capture_sample_width: number | null;
  input_level_dbfs: number | null;
  processing_sample_rate: number;
  processing_channels: number;
  processing_sample_width: number;
  processing_success: boolean;
  message: string;
}

export function useAudioTest(
  selectedDevice = '',
  timeoutMessage = 'Audio test timed out',
  selectedChannel = 1,
) {
  const [result, setResult] = useState<AudioTestResult | null>(null);
  const [liveInputLevel, setLiveInputLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const stopTest = useCallback(() => {
    requestRef.current?.abort();
  }, []);

  useEffect(() => {
    requestRef.current?.abort();
    setResult(null);
    setLiveInputLevel(null);
    setError(null);

    return () => requestRef.current?.abort();
  }, [selectedDevice, selectedChannel]);

  const runTest = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, AUDIO_TEST_TIMEOUT_MS);
    setIsTesting(true);
    setResult(null);
    setLiveInputLevel(null);
    setError(null);

    try {
      const response = await operatorFetch('/api/v1/audio/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_device: selectedDevice,
          audio_channel: selectedChannel,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        setResult(null);
        setError(payload?.detail ?? 'Audio test request failed');
        return null;
      }

      const testResult = (await response.json()) as AudioTestResult;
      setResult(testResult);
      setLiveInputLevel(testResult.input_level_dbfs);
      setError(null);
      return testResult;
    } catch (caughtError) {
      if (controller.signal.aborted) {
        if (didTimeout) {
          setResult(null);
          setError(timeoutMessage);
        }
        return null;
      }
      setResult(null);
      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : 'Audio test request failed',
      );
      return null;
    } finally {
      window.clearTimeout(timeoutId);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setIsTesting(false);
      }
    }
  }, [selectedDevice, selectedChannel, timeoutMessage]);

  return { result, liveInputLevel, error, isTesting, runTest, stopTest };
}
