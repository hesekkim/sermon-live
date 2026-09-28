import { useCallback, useEffect, useRef, useState } from 'react';
import { operatorFetch } from '../../auth/operatorAuthApi';
import type { OperatorCopy } from '../../translations';
import { appendTranscriptLine } from '../utils/transcriptFile';

export type ServerStatus = 'connecting' | 'online' | 'offline';
export type OperatorConnectionStatus = 'connecting' | 'connected' | 'reconnecting';
export type InterpreterStatus = 'connected' | 'disconnected' | 'error';
export type TranslationSessionStatus = 'off' | 'starting' | 'live' | 'stopping' | 'error';
export type TerminationReason =
  | 'manual'
  | 'auto_stop'
  | 'hard_limit'
  | 'interpreter_error'
  | 'device_error'
  | 'server_shutdown';

export interface SessionTimerState {
  elapsedSeconds?: number;
  remainingSeconds?: number | null;
  warning?: boolean;
  extensionMinutes?: number;
  extensionCount?: number;
  hardLimitReached?: boolean;
}

interface SessionStatus {
  running: boolean;
  listener_count: number;
  session_status?: TranslationSessionStatus;
  audio_ready?: boolean;
  audio_error?: string | null;
  start_available?: boolean;
  start_block_reason?: string | null;
  error?: string | null;
  last_termination_reason?: TerminationReason | null;
  timer?: SessionTimerState;
}

interface OperatorMessage {
  type?: string;
  role?: 'input' | 'output';
  text?: string;
  running?: boolean;
  session_status?: TranslationSessionStatus;
  sessionStatus?: TranslationSessionStatus;
  audio_ready?: boolean;
  audioReady?: boolean;
  audio_error?: string | null;
  audioError?: string | null;
  start_available?: boolean;
  startAvailable?: boolean;
  start_block_reason?: string | null;
  startBlockReason?: string | null;
  error?: string | null;
  ready?: boolean;
  listener_count?: number;
  listenerCount?: number;
  level?: number;
  milliseconds?: number;
  timer?: SessionTimerState;
  reason?: TerminationReason;
  last_termination_reason?: TerminationReason | null;
}

const AUDIO_LEVEL_MIN_DBFS = -60;
const AUDIO_LEVEL_MAX_DBFS = 0;
const SOCKET_RETRY_DELAY_MS = 1000;

function clampAudioLevel(level: number) {
  return Math.min(AUDIO_LEVEL_MAX_DBFS, Math.max(AUDIO_LEVEL_MIN_DBFS, level));
}

function getTerminationLabel(labels: OperatorCopy, reason: TerminationReason | null) {
  switch (reason) {
    case 'manual': return labels.terminationManual;
    case 'auto_stop': return labels.terminationAutoStop;
    case 'hard_limit': return labels.terminationHardLimit;
    case 'interpreter_error': return labels.terminationInterpreterError;
    case 'device_error': return labels.terminationDeviceError;
    case 'server_shutdown': return labels.terminationServerShutdown;
    default: return reason ? labels.terminationUnknown : null;
  }
}

export function useBroadcastSession(labels: OperatorCopy, onSessionError?: (message: string) => void) {
  const [running, setRunning] = useState(false);
    const [sessionStatus, setSessionStatus] = useState<TranslationSessionStatus>('off');
    const [audioReady, setAudioReady] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [startAvailable, setStartAvailable] = useState(false);
    const [startBlockReason, setStartBlockReason] = useState<string | null>(null);
    const [sessionError, setSessionError] = useState<string | null>(null);
  const [listenerCount, setListenerCount] = useState(0);
  const [audioLevel, setAudioLevel] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('connecting');
  const [operatorConnectionStatus, setOperatorConnectionStatus] =
    useState<OperatorConnectionStatus>('connecting');
  const [interpreterStatus, setInterpreterStatus] = useState<InterpreterStatus>('disconnected');
  const [timer, setTimer] = useState<SessionTimerState | null>(null);
  const [lastTerminationReason, setLastTerminationReason] = useState<string | null>(null);
  const [inputLines, setInputLines] = useState<string[]>([]);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountingRef = useRef(false);
  const socketErrorReportedRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const statusRequestGenerationRef = useRef(0);
  const startRequestPendingRef = useRef(false);
  const onSessionErrorRef = useRef(onSessionError);

  useEffect(() => {
    onSessionErrorRef.current = onSessionError;
  }, [onSessionError]);

  const formatSessionError = useCallback((message?: string) => {
    const text = (message ?? '').toLowerCase();
    return text.includes('api key') && (text.includes('not valid') || text.includes('invalid'))
      ? labels.invalidApiKey
      : labels.sessionError;
  }, [labels.invalidApiKey, labels.sessionError]);
  const emitSessionError = useCallback((message?: string) => {
    onSessionErrorRef.current?.(formatSessionError(message));
  }, [formatSessionError]);
  const applyStatus = useCallback((data: SessionStatus) => {
    const status = data.session_status ?? (data.running ? 'live' : 'off');
    if (sessionEndedRef.current && data.running && status !== 'error') return;
    setRunning(data.running);
    setSessionStatus(status);
    if (typeof data.audio_ready === 'boolean') setAudioReady(data.audio_ready);
    if ('audio_error' in data) setAudioError(data.audio_error ?? null);
    if (typeof data.start_available === 'boolean') setStartAvailable(data.start_available);
    if ('start_block_reason' in data) setStartBlockReason(data.start_block_reason ?? null);
    if ('error' in data) setSessionError(data.error ?? null);
    if (data.last_termination_reason) {
      setLastTerminationReason(getTerminationLabel(labels, data.last_termination_reason));
    }
    setListenerCount(data.listener_count);
    if ('timer' in data) {
      setTimer(data.timer ?? null);
    } else if (!data.running) {
      setTimer(null);
    }
    setInterpreterStatus((current) =>
      current === 'error' ? current : data.running ? 'connected' : 'disconnected'
    );
    if (!data.running) setAudioLevel(null);
  }, [labels]);
  const refreshStatus = useCallback(async () => {
    const requestGeneration = ++statusRequestGenerationRef.current;
    try {
      const response = await operatorFetch('/api/v1/session');
      if (!response.ok) throw new Error('Session status unavailable');
      const data = (await response.json()) as SessionStatus;
      if (
        startRequestPendingRef.current ||
        requestGeneration !== statusRequestGenerationRef.current
      ) return;
      applyStatus(data);
      setServerStatus('online');
    } catch {
      if (
        startRequestPendingRef.current ||
        requestGeneration !== statusRequestGenerationRef.current
      ) return;
      if (socketRef.current?.readyState !== WebSocket.OPEN) setServerStatus('offline');
    }
  }, [applyStatus]);

  useEffect(() => {
    isUnmountingRef.current = false;
    void refreshStatus();
    const statusRefresh = window.setInterval(() => void refreshStatus(), 5000);
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${location.host}/ws/operator`;
    let shouldReconnect = true;

    const connect = () => {
      if (!shouldReconnect) return;
      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;
      socket.addEventListener('open', () => {
        setOperatorConnectionStatus('connected');
        socketErrorReportedRef.current = false;
      });
      socket.addEventListener('message', (event) => {
        if (typeof event.data !== 'string') return;
        try {
          const payload = JSON.parse(event.data) as OperatorMessage;
          if (payload.type === 'translation_status' || payload.type === 'server_status' || payload.type === 'status') {
            const sessionStatus = payload.session_status ?? payload.sessionStatus;
            const listenerCount =
              typeof payload.listener_count === 'number'
                ? payload.listener_count
                : typeof payload.listenerCount === 'number'
                  ? payload.listenerCount
                  : undefined;
            const isLiveStatus = sessionStatus === 'live'
              || (!sessionStatus && payload.running === true);
            if (sessionEndedRef.current && isLiveStatus) return;
            if (typeof payload.running === 'boolean') {
              setRunning(payload.running);
              setInterpreterStatus((current) =>
                current === 'error'
                  ? current
                  : payload.running ? 'connected' : 'disconnected'
              );
              if (!payload.running) setAudioLevel(null);
            }
            if (sessionStatus) setSessionStatus(sessionStatus);
            const audioReady = payload.audio_ready ?? payload.audioReady;
            if (typeof audioReady === 'boolean') setAudioReady(audioReady);
            const audioError = payload.audio_error ?? payload.audioError;
            if ('audio_error' in payload || 'audioError' in payload) setAudioError(audioError ?? null);
            const startAvailable = payload.start_available ?? payload.startAvailable;
            if (typeof startAvailable === 'boolean') setStartAvailable(startAvailable);
            const startBlockReason = payload.start_block_reason ?? payload.startBlockReason;
            if ('start_block_reason' in payload || 'startBlockReason' in payload) setStartBlockReason(startBlockReason ?? null);
            if ('error' in payload) setSessionError(payload.error ?? null);
            if (payload.reason || payload.last_termination_reason) {
              setLastTerminationReason(
                getTerminationLabel(labels, payload.reason ?? payload.last_termination_reason ?? null),
              );
            }
            if (typeof listenerCount === 'number') setListenerCount(listenerCount);
            if ('timer' in payload) {
              setTimer(payload.timer ?? null);
            } else if (!payload.running) {
              setTimer(null);
            }
            return;
          }
          if (payload.type === 'listener_count') {
            const listenerCount =
              typeof payload.listener_count === 'number'
                ? payload.listener_count
                : typeof payload.listenerCount === 'number'
                  ? payload.listenerCount
                  : undefined;
            if (typeof listenerCount === 'number') setListenerCount(listenerCount);
            return;
          }
          if (payload.type === 'audio_level') {
            if (typeof payload.level === 'number' && Number.isFinite(payload.level)) {
              setAudioLevel(clampAudioLevel(payload.level));
            }
            return;
          }
          if (payload.type === 'latency') {
            if (typeof payload.milliseconds === 'number' && Number.isFinite(payload.milliseconds)) {
              setLatencyMs(Math.max(0, payload.milliseconds));
            }
            return;
          }
          if (payload.type === 'timer' && payload.timer) {
            setTimer(payload.timer);
            return;
          }
          if (payload.type === 'session_ended') {
            sessionEndedRef.current = true;
            const reason = payload.reason ?? null;
            setRunning(false);
            setSessionStatus(reason === 'interpreter_error' || reason === 'device_error' ? 'error' : 'off');
            setInterpreterStatus(reason === 'interpreter_error' ? 'error' : 'disconnected');
            setAudioLevel(null);
            setTimer(null);
            if (reason) setLastTerminationReason(getTerminationLabel(labels, reason));
            return;
          }
          if (payload.type === 'audio_status') {
            if (typeof payload.ready === 'boolean') {
              setAudioReady(payload.ready);
              if (!payload.ready) setStartAvailable(false);
              else void refreshStatus();
            }
            if (typeof payload.error === 'string' || payload.error === null) {
              setAudioError(payload.error ?? null);
              if (payload.error) setStartBlockReason(payload.error);
            }
            return;
          }
          if (payload.type === 'error' && payload.text) {
            setSessionError(payload.text);
            setSessionStatus('error');
            setInterpreterStatus('error');
            emitSessionError(payload.text);
            return;
          }
          if (payload.type === 'transcript' && payload.text) {
            if (payload.role === 'input') {
              setInputLines((lines) => appendTranscriptLine(lines, payload.text ?? ''));
            } else if (payload.role === 'output') {
              setOutputLines((lines) => appendTranscriptLine(lines, payload.text ?? ''));
            }
          }
        } catch { return; }
      });
      const handleSocketFailure = () => {
        if (isUnmountingRef.current || !shouldReconnect) return;
        setOperatorConnectionStatus('reconnecting');
        setAudioLevel(null);
        if (!socketErrorReportedRef.current) {
          socketErrorReportedRef.current = true;
          emitSessionError();
        }
      };
      socket.addEventListener('error', handleSocketFailure);
      socket.addEventListener('close', () => {
        handleSocketFailure();
        if (!shouldReconnect) return;
        retryTimerRef.current = setTimeout(connect, SOCKET_RETRY_DELAY_MS);
      });
    };

    connect();
    return () => {
      shouldReconnect = false;
      isUnmountingRef.current = true;
      window.clearInterval(statusRefresh);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.CONNECTING || socket?.readyState === WebSocket.OPEN) {
        socket.close(1000, 'Page closed');
      }
      socketRef.current = null;
    };
  }, [emitSessionError, refreshStatus]);

  const start = useCallback(async () => {
    statusRequestGenerationRef.current += 1;
    startRequestPendingRef.current = true;
    try {
      const response = await operatorFetch('/api/v1/session/start', { method: 'POST' });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        const detail = body?.detail ?? 'start failed';
        if (detail.toLowerCase().includes('api key') && (detail.toLowerCase().includes('not valid') || detail.toLowerCase().includes('invalid'))) {
          throw new Error('invalid_api_key');
        }
        throw new Error(detail);
      }
      const payload = (await response.json()) as SessionStatus;
      sessionEndedRef.current = false;
      applyStatus(payload);
      setSessionError(null);
      setInterpreterStatus('connected');
      setTimer(null);
      setLastTerminationReason(null);
    } finally {
      statusRequestGenerationRef.current += 1;
      startRequestPendingRef.current = false;
    }
  }, [applyStatus]);
  const stop = useCallback(async () => {
    const response = await operatorFetch('/api/v1/session/stop', { method: 'POST' });
    if (!response.ok) throw new Error('stop failed');
    applyStatus((await response.json()) as SessionStatus);
  }, [applyStatus]);
  const extend = useCallback(async () => {
    const response = await operatorFetch('/api/v1/session/extend', { method: 'POST' });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      const detail = body?.detail ?? 'extend failed';
      throw new Error(detail);
    }
    const payload = (await response.json()) as SessionStatus;
    applyStatus(payload);
    return payload;
  }, [applyStatus]);

  return {
    running,
    sessionStatus,
    audioReady,
    audioError,
    startAvailable,
    startBlockReason,
    sessionError,
    listenerCount,
    audioLevel,
    latencyMs,
    serverStatus,
    operatorConnectionStatus,
    interpreterStatus,
    timer,
    lastTerminationReason,
    inputLines,
    outputLines,
    start,
    stop,
    extend,
    setTimer,
  };
}