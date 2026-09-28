import { useCallback, useEffect, useRef, useState } from 'react';
import { operatorFetch } from '../../auth/operatorAuthApi';

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

export function useAudioTest(selectedDevice = '') {
	const [result, setResult] = useState<AudioTestResult | null>(null);
	const [liveInputLevel, setLiveInputLevel] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isTesting, setIsTesting] = useState(false);
	const requestRef = useRef<AbortController | null>(null);

	useEffect(() => {
		requestRef.current?.abort();
		setResult(null);
		setLiveInputLevel(null);
		setError(null);

		return () => requestRef.current?.abort();
	}, [selectedDevice]);

	const runTest = useCallback(async () => {
		requestRef.current?.abort();
		const controller = new AbortController();
		requestRef.current = controller;
		setIsTesting(true);
		setLiveInputLevel(null);
		setError(null);

		try {
			const response = await operatorFetch('/api/v1/audio/test/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ audio_device: selectedDevice }),
				signal: controller.signal,
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as
					| { detail?: string }
					| null;
				setResult(null);
				setError(payload?.detail ?? 'Audio test request failed');
				return null;
			}

			if (!response.body) {
				throw new Error('Audio test stream is unavailable');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let finalResult: AudioTestResult | null = null;
			const consumeLine = (line: string) => {
				if (!line.trim()) return;
				const event = JSON.parse(line) as
					| { type: 'level'; input_level_dbfs: number }
					| { type: 'result' } & AudioTestResult;
				if (event.type === 'level') setLiveInputLevel(event.input_level_dbfs);
				else finalResult = event;
			};

			while (true) {
				const { done, value } = await reader.read();
				buffer += decoder.decode(value, { stream: !done });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				lines.forEach(consumeLine);
				if (done) break;
			}
			consumeLine(buffer);

			if (!finalResult) throw new Error('Audio test did not return a result');
			setResult(finalResult);
			setError(null);
			return finalResult;
		} catch (caughtError) {
			if (caughtError instanceof DOMException && caughtError.name === 'AbortError') {
				return null;
			}
			setResult(null);
			setError(caughtError instanceof Error && caughtError.message ? caughtError.message : 'Audio test request failed');
			return null;
		} finally {
			if (requestRef.current === controller) {
				requestRef.current = null;
				setIsTesting(false);
			}
		}
	}, [selectedDevice]);

	return { result, liveInputLevel, error, isTesting, runTest };
}