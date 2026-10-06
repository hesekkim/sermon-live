import { useEffect, useRef, useState } from 'react';
import { operatorFetch } from '../../auth/operatorAuthApi';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import type { OperatorCopy, UiLanguage } from '../../translations';

type InterpreterName = 'echo' | 'openai';
type KeyStatus = 'valid' | 'missing' | 'invalid';
type SaveScope = 'device' | 'safety' | 'api';
type SettingsValue = string | number | boolean | undefined;
type TimerValueKey =
	| 'autoStopMinutes'
	| 'warningMinutes'
	| 'extensionMinutes'
	| 'hardLimitMinutes';

interface SettingsResponse {
	interpreter: InterpreterName;
	audio_device?: string | null;
	audio_channel?: number | null;
	translation_session_auto_stop_minutes?: number | null;
	translation_session_warning_minutes?: number | null;
	translation_session_extension_minutes?: number | null;
	translation_session_hard_limit_minutes?: number | null;
	openai_key_set: boolean;
	openai_key_masked?: string;
	openai_key_status?: KeyStatus;
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
	setSelectedDevice: (device: string) => void;
	setSelectedChannel: (channel: number) => void;
}

export function useOperatorSettings({
	labels,
	language,
	setSelectedDevice,
	setSelectedChannel,
}: UseOperatorSettingsOptions) {
	const [interpreter, setInterpreter] = useState<InterpreterName>('echo');
	const [apiKey, setApiKey] = useState('');
	const [openaiKeyStatus, setOpenaiKeyStatus] = useState<KeyStatus>('missing');
	const [openaiKeyMasked, setOpenaiKeyMasked] = useState('');
	const [draftLanguage, setDraftLanguage] = useState<UiLanguage>(language);
	const [timerValues, setTimerValues] = useState<TimerDraftState>({
		autoStopMinutes: '90',
		warningMinutes: '5',
		extensionMinutes: '10',
		hardLimitMinutes: '120',
	});
	const [isSaving, setIsSaving] = useState(false);
	const [settingsLoadStatus, setSettingsLoadStatus] = useState<
		'loading' | 'loaded' | 'error'
	>('loading');
	const { error } = useToast();
	const settingsLoadStartedRef = useRef(false);
	const savedInterpreterRef = useRef<InterpreterName>('echo');
	const savedTimerValuesRef = useRef<TimerDraftState | null>(null);
	const setSelectedDeviceRef = useRef(setSelectedDevice);
	setSelectedDeviceRef.current = setSelectedDevice;
	const setSelectedChannelRef = useRef(setSelectedChannel);
	setSelectedChannelRef.current = setSelectedChannel;

	const applyApiModelResponse = (data: SettingsResponse) => {
		savedInterpreterRef.current = data.interpreter;
		setInterpreter(data.interpreter);
		setOpenaiKeyStatus(data.openai_key_status ?? 'missing');
		setOpenaiKeyMasked(data.openai_key_masked ?? '');
	};

	const applySettingsResponse = (data: SettingsResponse) => {
		applyApiModelResponse(data);
		setSelectedDeviceRef.current(data.audio_device || 'default');
		setSelectedChannelRef.current(data.audio_channel ?? 1);
		const values = getTimerDraftValues(data);
		setTimerValues(values);
		savedTimerValuesRef.current = values;
	};

	useEffect(() => {
		if (settingsLoadStartedRef.current) return;
		settingsLoadStartedRef.current = true;
		void (async () => {
			try {
				const response = await operatorFetch('/api/v1/operator/settings');
				if (!response.ok) {
					setSettingsLoadStatus('error');
					error(labels.settingsLoadFailed);
					return;
				}
				const data = (await response.json()) as SettingsResponse;
				applySettingsResponse(data);
				setSettingsLoadStatus('loaded');
			} catch {
				setSettingsLoadStatus('error');
				error(labels.settingsLoadFailed);
			}
		})();
	}, [error, labels.settingsLoadFailed]);

	const setTimerValue = (key: TimerValueKey, value: string) => {
		setTimerValues((current) => ({ ...current, [key]: value }));
	};
	const timerValidation = validateTimerDraft(timerValues, labels);

	const submitSettings = async (
		body: Record<string, SettingsValue>,
		scope: SaveScope
	) => {
		if (isSaving) return { success: false as const, message: labels.applyFailed };
		setIsSaving(true);
		try {
			const response = await operatorFetch('/api/v1/operator/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as
					| { detail?: unknown }
					| null;
				return {
					success: false as const,
					status: response.status,
					message:
						typeof payload?.detail === 'string'
							? payload.detail
							: labels.applyFailed,
				};
			}
			const data = (await response.json()) as SettingsResponse;
			if (scope === 'device') {
				setSelectedDeviceRef.current(data.audio_device || 'default');
				setSelectedChannelRef.current(data.audio_channel ?? 1);
			} else if (scope === 'safety') {
				const values = getTimerDraftValues(data);
				setTimerValues(values);
				savedTimerValuesRef.current = values;
			} else {
				applyApiModelResponse(data);
				setSettingsLoadStatus('loaded');
				setApiKey('');
			}
			return { success: true as const };
		} catch {
			return { success: false as const, message: labels.applyFailed };
		} finally {
			setIsSaving(false);
		}
	};

	const saveDevice = async (nextDevice: string, nextChannel: number) => {
		if (settingsLoadStatus !== 'loaded') {
			return { success: false as const, message: labels.settingsLoadFailed };
		}
		const body: Record<string, SettingsValue> = {
			interpreter: savedInterpreterRef.current,
			audio_device: nextDevice,
			audio_channel: nextChannel,
		};
		return submitSettings(body, 'device');
	};

	const saveSafety = async () => {
		if (timerValidation.hasErrors) {
			return { success: false as const, message: timerValidation.message };
		}
		const body: Record<string, SettingsValue> = {
			interpreter: savedInterpreterRef.current,
			translation_session_auto_stop_minutes: Number(timerValues.autoStopMinutes),
			translation_session_warning_minutes: Number(timerValues.warningMinutes),
			translation_session_extension_minutes: Number(timerValues.extensionMinutes),
			translation_session_hard_limit_minutes: Number(timerValues.hardLimitMinutes),
		};
		return submitSettings(body, 'safety');
	};

	const saveApiModel = async () => {
		const trimmedKey = apiKey.trim();
		const body: Record<string, SettingsValue> = {
			interpreter,
		};
		if (trimmedKey) {
			body.openai_api_key = trimmedKey;
		}
		return submitSettings(body, 'api');
	};
	const isSafetyDirty =
		savedTimerValuesRef.current !== null &&
		Object.keys(timerValues).some((key) => {
			const timerKey = key as TimerValueKey;
			return timerValues[timerKey] !== savedTimerValuesRef.current?.[timerKey];
		});
	const isApiModelDirty =
		settingsLoadStatus === 'loaded' &&
		(interpreter !== savedInterpreterRef.current || Boolean(apiKey.trim()));

	return {
		interpreter,
		setInterpreter,
		apiKey,
		setApiKey,
		openaiKeyStatus,
		openaiKeyMasked,
		settingsLoadStatus,
		draftLanguage,
		setDraftLanguage,
		timerValues,
		setTimerValue,
		timerValidation,
		isSaving,
		isSafetyDirty,
		isApiModelDirty,
		saveDevice,
		saveSafety,
		saveApiModel,
	};
}

function getTimerDraftValues(data: SettingsResponse): TimerDraftState {
	return {
		autoStopMinutes: String(data.translation_session_auto_stop_minutes ?? 90),
		warningMinutes: String(data.translation_session_warning_minutes ?? 5),
		extensionMinutes: String(data.translation_session_extension_minutes ?? 10),
		hardLimitMinutes: String(data.translation_session_hard_limit_minutes ?? 120),
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
