import { useCallback, useEffect, useRef, useState } from 'react';
import type { OperatorCopy } from '../../translations';
import { appendTranscriptLine } from '../utils/transcriptFile';

export type ServerStatus = 'connecting' | 'online' | 'offline';
export type OperatorConnectionStatus = 'connecting' | 'connected' | 'reconnecting';
export type InterpreterStatus = 'connected' | 'disconnected' | 'error';
export type TranslationSessionStatus = 'off' | 'starting' | 'live' | 'stopping' | 'error';

export interface SessionTimerState {
  elapsedSeconds?: number;
  remainingSeconds?: number | null;
  warning?: boolean;
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
  last_termination_reason?: string | null;
  timer?: SessionTimerState;
}

interface OperatorMessage {
  type?: string;
  role?: 'input' | 'output';
  text?: string;
  running?: boolean;
  sessionStatus?: TranslationSessionStatus;
  audioReady?: boolean;
  audioError?: string | null;
  startAvailable?: boolean;
  startBlockReason?: string | null;
  error?: string | null;
  ready?: boolean;
  listenerCount?: number;
  level?: number;
  milliseconds?: number;
  timer?: SessionTimerState;
  reason?: string;
}

const AUDIO_LEVEL_MIN_DBFS = -60;
const AUDIO_LEVEL_MAX_DBFS = 0;
const SOCKET_RETRY_DELAY_MS = 1000;

function clampAudioLevel(level: number) {
  return Math.min(AUDIO_LEVEL_MAX_DBFS, Math.max(AUDIO_LEVEL_MIN_DBFS, level));
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
    setRunning(data.running);
      setSessionStatus(data.session_status ?? (data.running ? 'live' : 'off'));
      if (typeof data.audio_ready === 'boolean') setAudioReady(data.audio_ready);
      if ('audio_error' in data) setAudioError(data.audio_error ?? null);
      if (typeof data.start_available === 'boolean') setStartAvailable(data.start_available);
      if ('start_block_reason' in data) setStartBlockReason(data.start_block_reason ?? null);
      if ('error' in data) setSessionError(data.error ?? null);
      if (data.last_termination_reason) setLastTerminationReason(data.last_termination_reason);
    setListenerCount(data.listener_count);
    if (data.timer) setTimer(data.timer);
    setInterpreterStatus((current) =>
      current === 'error' ? current : data.running ? 'connected' : 'disconnected'
    );
    if (!data.running) setAudioLevel(null);
  }, []);
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/session');
      if (!response.ok) throw new Error('Session status unavailable');
      applyStatus((await response.json()) as SessionStatus);
      setServerStatus('online');
    } catch {
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
          if (payload.type === 'status') {
            if (typeof payload.running === 'boolean') {
              setRunning(payload.running);
              setInterpreterStatus((current) =>
                current === 'error'
                  ? current
                  : payload.running ? 'connected' : 'disconnected'
              );
              if (!payload.running) setAudioLevel(null);
            }
            if (payload.sessionStatus) setSessionStatus(payload.sessionStatus);
            if (typeof payload.audioReady === 'boolean') setAudioReady(payload.audioReady);
            if ('audioError' in payload) setAudioError(payload.audioError ?? null);
            if (typeof payload.startAvailable === 'boolean') setStartAvailable(payload.startAvailable);
            if ('startBlockReason' in payload) setStartBlockReason(payload.startBlockReason ?? null);
            if ('error' in payload) setSessionError(payload.error ?? null);
            if (payload.reason) setLastTerminationReason(payload.reason);
            if (typeof payload.listenerCount === 'number') setListenerCount(payload.listenerCount);
            if (payload.timer) setTimer(payload.timer);
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
            if (payload.reason) setLastTerminationReason(payload.reason);
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
    const response = await fetch('/api/v1/session/start', { method: 'POST' });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      const detail = body?.detail ?? 'start failed';
      if (detail.toLowerCase().includes('api key') && (detail.toLowerCase().includes('not valid') || detail.toLowerCase().includes('invalid'))) {
        throw new Error('invalid_api_key');
      }
      throw new Error(detail);
    }
    applyStatus((await response.json()) as SessionStatus);
    setSessionError(null);
    setInterpreterStatus('connected');
    setTimer(null);
    setLastTerminationReason(null);
  }, [applyStatus]);
  const stop = useCallback(async () => {
    const response = await fetch('/api/v1/session/stop', { method: 'POST' });
    if (!response.ok) throw new Error('stop failed');
    applyStatus((await response.json()) as SessionStatus);
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
  };
}