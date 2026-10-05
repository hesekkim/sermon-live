import { useCallback, useEffect, useMemo, useState } from 'react';
import { operatorFetch } from '../../auth/operatorAuthApi';

export interface AudioDevice {
	index: number;
	name: string;
	host_api: string;
	selector: string;
	input_channels: number;
	default_sample_rate: number;
}

export type AudioDeviceListMode = 'standard' | 'all';

export interface AudioDeviceOption {
	value: string;
	label: string;
}

export function useAudioDevices() {
	const [devices, setDevices] = useState<AudioDevice[]>([]);
	const [selectedDevice, setSelectedDeviceState] = useState('');
	const [selectedChannel, setSelectedChannel] = useState(1);
	const [listMode, setListMode] = useState<AudioDeviceListMode>('standard');
	const [error, setError] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	const setSelectedDevice = useCallback(
		(nextValue: string) => {
			const trimmed = nextValue.trim();
			if (!trimmed || trimmed === 'default' || devices.length === 0) {
				setSelectedDeviceState(trimmed);
				return;
			}
			if (devices.some((device) => device.selector === trimmed)) {
				setSelectedDeviceState(trimmed);
				return;
			}
			const nameMatches = devices.filter(
				(device) => device.name.toLowerCase() === trimmed.toLowerCase()
			);
			setSelectedDeviceState(
				nameMatches.length === 1 ? nameMatches[0].selector : trimmed
			);
		},
		[devices]
	);

	useEffect(() => {
		setSelectedDeviceState((current) => {
			const trimmed = current.trim();
			if (!trimmed || trimmed === 'default' || devices.length === 0) {
				return current;
			}
			if (devices.some((device) => device.selector === trimmed)) {
				return current;
			}
			const nameMatches = devices.filter(
				(device) => device.name.toLowerCase() === trimmed.toLowerCase()
			);
			return nameMatches.length === 1 ? nameMatches[0].selector : current;
		});
	}, [devices]);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(false);

		try {
			const response = await operatorFetch(
				`/api/v1/audio/devices?mode=${listMode}`
			);
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
	}, [listMode]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const deviceOptions = useMemo<AudioDeviceOption[]>(
		() =>
			devices.map((device) => ({
					value: device.selector,
					label: `${device.name} · ${device.host_api} (${Math.round(device.default_sample_rate)} Hz)`,
			})),
		[devices]
	);
		const isSelectionStale =
			!isLoading &&
			!error &&
			Boolean(selectedDevice) &&
			selectedDevice !== 'default' &&
			!devices.some((device) => device.selector === selectedDevice);

	return {
		devices,
		deviceOptions,
		selectedDevice,
		setSelectedDevice,
		selectedChannel,
		setSelectedChannel,
			listMode,
			setListMode,
			isSelectionStale,
		isLoading,
		error,
		refresh,
	};
}