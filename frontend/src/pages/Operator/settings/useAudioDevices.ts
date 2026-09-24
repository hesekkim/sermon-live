import { useCallback, useEffect, useMemo, useState } from 'react';

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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setSelectedDevice = useCallback(
    (nextValue: string) => {
      const trimmed = nextValue.trim();
      if (!trimmed) {
        setSelectedDeviceState('');
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
      if (!trimmed) {
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
    setError(null);

    try {
      const response = await fetch('/api/v1/audio/devices');
      if (!response.ok) {
        throw new Error('device request failed');
      }

      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload) || payload.length === 0) {
        setDevices([]);
        setError('기기를 불러오지 못했습니다');
        return;
      }

      setDevices(payload);
    } catch {
      setError('기기를 불러오지 못했습니다');
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
