import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import type { OperatorCopy, UiLanguage, UiTheme } from '../../translations';

type InterpreterName = 'echo' | 'openai';
type KeyStatus = 'valid' | 'missing' | 'invalid';

interface SettingsResponse {
	interpreter: InterpreterName;
	audio_device?: string | null;
	openai_key_set: boolean;
	openai_key_masked?: string;
	openai_key_status?: KeyStatus;
	openai_key_warning?: string | null;
}

interface UseOperatorSettingsOptions {
	labels: OperatorCopy;
	language: UiLanguage;
	theme: UiTheme;
	setLanguage: (language: UiLanguage) => void;
	setTheme: (theme: UiTheme) => void;
	selectedDevice: string;
	setSelectedDevice: (device: string) => void;
}

export function useOperatorSettings({
	labels,
	language,
	theme,
	setLanguage,
	setTheme,
	selectedDevice,
	setSelectedDevice,
}: UseOperatorSettingsOptions) {
	const [interpreter, setInterpreter] = useState<InterpreterName>('echo');
	const [apiKey, setApiKey] = useState('');
	const [openaiKeyStatus, setOpenaiKeyStatus] = useState<KeyStatus>('missing');
	const [openaiKeyMasked, setOpenaiKeyMasked] = useState('');
	const [keyWarning, setKeyWarning] = useState('');
	const [draftLanguage, setDraftLanguage] = useState<UiLanguage>(language);
	const [draftTheme, setDraftTheme] = useState<UiTheme>(theme);
	const [isSaving, setIsSaving] = useState(false);
	const { info, warning, error } = useToast();
	const setSelectedDeviceRef = useRef(setSelectedDevice);
	setSelectedDeviceRef.current = setSelectedDevice;

	const applySettingsResponse = (data: SettingsResponse) => {
		setInterpreter(data.interpreter);
		setSelectedDeviceRef.current(data.audio_device ?? '');
		setOpenaiKeyStatus(data.openai_key_status ?? 'missing');
		setOpenaiKeyMasked(data.openai_key_masked ?? '');
		setKeyWarning(getSelectedWarning(data));
	};

	useEffect(() => {
		void (async () => {
			try {
				const response = await fetch('/api/v1/operator/settings');
				if (!response.ok) {
					error(labels.settingsLoadFailed);
					return;
				}
				const data = (await response.json()) as SettingsResponse;
				applySettingsResponse(data);
				if (data.openai_key_status === 'invalid' && data.openai_key_warning) {
					warning(summarizeWarning(data.openai_key_warning));
				}
			} catch {
				error(labels.settingsLoadFailed);
			}
		})();
	}, [error, labels.settingsLoadFailed, warning]);

	const handleSave = async () => {
		if (isSaving) return;
		setIsSaving(true);
		try {
			const trimmedKey = apiKey.trim();
			const body: Record<string, string | undefined> = {
				interpreter,
				audio_device: selectedDevice.trim() ? selectedDevice : undefined,
			};
			if (interpreter === 'openai' && trimmedKey) {
				body.openai_api_key = trimmedKey;
			}
			const response = await fetch('/api/v1/operator/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			if (!response.ok) {
				error(labels.applyFailed);
				return;
			}
			const data = (await response.json()) as SettingsResponse;
			applySettingsResponse(data);
			setApiKey('');
			setLanguage(draftLanguage);
			setTheme(draftTheme);
			const responseWarning = getSelectedWarning(data);
			if (responseWarning && data.interpreter !== 'echo') {
				warning(summarizeWarning(responseWarning));
			}
			info(labels.applySaved);
		} catch {
			error(labels.applyFailed);
		} finally {
			setIsSaving(false);
		}
	};

	return {
		interpreter,
		setInterpreter,
		apiKey,
		setApiKey,
		openaiKeyStatus,
		openaiKeyMasked,
		keyWarning,
		draftLanguage,
		setDraftLanguage,
		draftTheme,
		setDraftTheme,
		isSaving,
		handleSave,
	};
}

function getSelectedWarning(data: SettingsResponse): string {
	const warning = data.interpreter === 'openai' ? data.openai_key_warning : null;
	return warning ? summarizeWarning(warning) : '';
}

function summarizeWarning(value: string): string {
	const normalized = value.replace(/\s+/g, ' ').trim();
	return normalized.length > 160
		? `${normalized.slice(0, 157).trimEnd()}...`
		: normalized;
}