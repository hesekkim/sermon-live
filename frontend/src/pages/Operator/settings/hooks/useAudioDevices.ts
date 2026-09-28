import { useCallback, useEffect, useMemo, useState } from 'react';
import { operatorFetch } from '../../auth/operatorAuthApi';

export interface AudioDevice {
	index: number;
	name: string;
	input_channels: number;
	default_sample_rate: number;
}

export interface AudioDeviceOption {
	value: string;
	label: string;
}

export function useAudioDevices() {
	const [devices, setDevices] = useState<AudioDevice[]>([]);
	const [selectedDevice, setSelectedDeviceState] = useState('');
	const [error, setError] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	const setSelectedDevice = useCallback(
		(nextValue: string) => {
			const trimmed = nextValue.trim();
			if (trimmed === 'default') {
				setSelectedDeviceState('default');
				return;
			}
			if (!trimmed) {
				setSelectedDeviceState('');
				return;
			}
			if (devices.length === 0) {
				setSelectedDeviceState(trimmed);
				return;
			}

			const match = devices.find(
				(device) =>
					String(device.index) === trimmed ||
					device.name.toLowerCase() === trimmed.toLowerCase()
			);

			setSelectedDeviceState(match ? String(match.index) : '');
		},
		[devices]
	);

	useEffect(() => {
		setSelectedDeviceState((current) => {
			const trimmed = current.trim();
			if (!trimmed || trimmed === 'default' || devices.length === 0) {
				return current;
			}

			const match = devices.find(
				(device) =>
					String(device.index) === trimmed ||
					device.name.toLowerCase() === trimmed.toLowerCase()
			);

			return match ? String(match.index) : '';
		});
	}, [devices]);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(false);

		try {
			const response = await operatorFetch('/api/v1/audio/devices');
			if (!response.ok) {
				throw new Error('device request failed');
			}

			const payload = (await response.json()) as unknown;
			if (!Array.isArray(payload)) {
				setDevices([]);
				setError(true);
				return;
			}

			setDevices(payload);
		} catch {
			setDevices([]);
			setError(true);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const deviceOptions = useMemo<AudioDeviceOption[]>(
		() =>
			devices.map((device) => ({
				value: String(device.index),
				label: `${device.name} (${Math.round(device.default_sample_rate)} Hz)`,
			})),
		[devices]
	);

	return {
		devices,
		deviceOptions,
		selectedDevice,
		setSelectedDevice,
		isLoading,
		error,
		refresh,
	};
}