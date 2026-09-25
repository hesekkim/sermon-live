import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import type { OperatorCopy, UiLanguage, UiTheme } from '../../translations';

type InterpreterName = 'echo' | 'openai';
type KeyStatus = 'valid' | 'missing' | 'invalid';
type TimerValueKey =
	| 'autoStopMinutes'
	| 'warningMinutes'
	| 'extensionMinutes'
	| 'hardLimitMinutes';

interface SettingsResponse {
	interpreter: InterpreterName;
	audio_device?: string | null;
	translation_session_auto_stop_minutes?: number | null;
	translation_session_warning_minutes?: number | null;
	translation_session_extension_minutes?: number | null;
	translation_session_hard_limit_minutes?: number | null;
	openai_key_set: boolean;
	openai_key_masked?: string;
	openai_key_status?: KeyStatus;
	openai_key_warning?: string | null;
}

export interface TimerDraftState {
	autoStopMinutes: string;
	warningMinutes: string;
	extensionMinutes: string;
	hardLimitMinutes: string;
}

export interface TimerValidationState {
	fieldErrors: Partial<Record<TimerValueKey, string>>;
	hasErrors: boolean;
	message: string;
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
	const [timerValues, setTimerValues] = useState<TimerDraftState>({
		autoStopMinutes: '90',
		warningMinutes: '5',
		extensionMinutes: '10',
		hardLimitMinutes: '120',
	});
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
		setTimerValues({
			autoStopMinutes: String(data.translation_session_auto_stop_minutes ?? 90),
			warningMinutes: String(data.translation_session_warning_minutes ?? 5),
			extensionMinutes: String(data.translation_session_extension_minutes ?? 10),
			hardLimitMinutes: String(data.translation_session_hard_limit_minutes ?? 120),
		});
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

	const setTimerValue = (key: TimerValueKey, value: string) => {
		setTimerValues((current) => ({ ...current, [key]: value }));
	};
	const timerValidation = validateTimerDraft(timerValues, labels);

	const handleSave = async () => {
		if (isSaving) return;
		if (timerValidation.hasErrors) {
			error(timerValidation.message);
			return;
		}
		setIsSaving(true);
		try {
			const trimmedKey = apiKey.trim();
			const body: Record<string, string | number | undefined> = {
				interpreter,
				audio_device: selectedDevice.trim() ? selectedDevice : undefined,
				translation_session_auto_stop_minutes: Number(timerValues.autoStopMinutes),
				translation_session_warning_minutes: Number(timerValues.warningMinutes),
				translation_session_extension_minutes: Number(timerValues.extensionMinutes),
				translation_session_hard_limit_minutes: Number(timerValues.hardLimitMinutes),
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
		timerValues,
		setTimerValue,
		timerValidation,
		isSaving,
		handleSave,
	};
}

function validateTimerDraft(values: TimerDraftState, labels: OperatorCopy): TimerValidationState {
	const parsed = {
		autoStopMinutes: Number(values.autoStopMinutes),
		warningMinutes: Number(values.warningMinutes),
		extensionMinutes: Number(values.extensionMinutes),
		hardLimitMinutes: Number(values.hardLimitMinutes),
	};
	const fieldErrors: Partial<Record<TimerValueKey, string>> = {};

	if (!Number.isInteger(parsed.autoStopMinutes) || parsed.autoStopMinutes <= 0) {
		fieldErrors.autoStopMinutes = labels.timerAutoStopRequired;
	}
	if (!Number.isInteger(parsed.warningMinutes) || parsed.warningMinutes <= 0) {
		fieldErrors.warningMinutes = labels.timerWarningMustBeLess;
	}
	if (!Number.isInteger(parsed.extensionMinutes) || parsed.extensionMinutes <= 0) {
		fieldErrors.extensionMinutes = labels.timerExtensionRequired;
	}
	if (!Number.isInteger(parsed.hardLimitMinutes) || parsed.hardLimitMinutes <= 0) {
		fieldErrors.hardLimitMinutes = labels.timerHardLimitMinimum;
	}
	if (
		Number.isFinite(parsed.autoStopMinutes) &&
		Number.isFinite(parsed.warningMinutes) &&
		parsed.warningMinutes >= parsed.autoStopMinutes
	) {
		fieldErrors.warningMinutes = labels.timerWarningMustBeLess;
	}
	if (
		Number.isFinite(parsed.autoStopMinutes) &&
		Number.isFinite(parsed.hardLimitMinutes) &&
		parsed.hardLimitMinutes < parsed.autoStopMinutes
	) {
		fieldErrors.hardLimitMinutes = labels.timerHardLimitMinimum;
	}

	const message = Object.values(fieldErrors)[0] ?? labels.timerRangeHint;
	return {
		fieldErrors,
		hasErrors: Object.keys(fieldErrors).length > 0,
		message,
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