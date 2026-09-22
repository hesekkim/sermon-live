import { useCallback, useEffect, useRef, useState } from 'react';
import type { OperatorCopy } from '../translations';
import { appendTranscriptLine } from './transcriptFile';

interface SessionStatus {
  running: boolean;
  listener_count: number;
}

interface OperatorMessage {
  type?: string;
  role?: 'input' | 'output';
  text?: string;
  running?: boolean;
  listenerCount?: number;
}

export function useBroadcastSession(
  labels: OperatorCopy,
  onSessionError?: (message: string) => void
) {
  const [running, setRunning] = useState(false);
  const [listenerCount, setListenerCount] = useState(0);
  const [inputLines, setInputLines] = useState<string[]>([]);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const isUnmountingRef = useRef(false);
  const socketErrorReportedRef = useRef(false);

  const formatSessionError = useCallback(
    (message?: string) => {
      const text = (message ?? '').toLowerCase();
      if (
        text.includes('api key') &&
        (text.includes('not valid') || text.includes('invalid'))
      ) {
        return labels.invalidApiKey;
      }
      return labels.sessionError;
    },
    [labels.invalidApiKey, labels.sessionError]
  );

  const emitSessionError = useCallback(
    (message?: string) => {
      onSessionError?.(formatSessionError(message));
    },
    [formatSessionError, onSessionError]
  );

  const applyStatus = useCallback((data: SessionStatus) => {
    setRunning(data.running);
    setListenerCount(data.listener_count);
  }, []);

  const refreshStatus = useCallback(async () => {
    const response = await fetch('/api/v1/session');
    if (!response || !response.ok) {
      return;
    }
    applyStatus((await response.json()) as SessionStatus);
  }, [applyStatus]);

  useEffect(() => {
    void refreshStatus();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws/operator`);
    socketRef.current = socket;
    socketErrorReportedRef.current = false;
    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        return;
      }
      try {
        const payload = JSON.parse(event.data) as OperatorMessage;
        if (payload.type === 'status') {
          if (typeof payload.running === 'boolean') {
            setRunning(payload.running);
          }
          if (typeof payload.listenerCount === 'number') {
            setListenerCount(payload.listenerCount);
          }
          return;
        }
        if (payload.type === 'error' && payload.text) {
          emitSessionError(payload.text);
          return;
        }
        if (payload.type === 'transcript' && payload.text) {
          if (payload.role === 'input') {
            setInputLines((lines) =>
              appendTranscriptLine(lines, payload.text ?? '')
            );
          } else if (payload.role === 'output') {
            setOutputLines((lines) =>
              appendTranscriptLine(lines, payload.text ?? '')
            );
          }
        }
      } catch {
        return;
      }
    });
    socket.addEventListener('error', () => {
      if (!isUnmountingRef.current) {
        if (!socketErrorReportedRef.current) {
          socketErrorReportedRef.current = true;
          emitSessionError();
        }
      }
    });
    socket.addEventListener('close', () => {
      if (!isUnmountingRef.current) {
        if (!socketErrorReportedRef.current) {
          socketErrorReportedRef.current = true;
          emitSessionError();
        }
      }
    });
    return () => {
      isUnmountingRef.current = true;
      if (
        socket.readyState === WebSocket.CONNECTING ||
        socket.readyState === WebSocket.OPEN
      ) {
        socket.close(1000, 'Page closed');
      }
      socketRef.current = null;
    };
  }, [emitSessionError, refreshStatus]);

  const start = useCallback(async () => {
    const response = await fetch('/api/v1/session/start', { method: 'POST' });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { detail?: string }
        | null;
      const detail = body?.detail ?? 'start failed';
      if (
        detail.toLowerCase().includes('api key') &&
        (detail.toLowerCase().includes('not valid') ||
          detail.toLowerCase().includes('invalid'))
      ) {
        throw new Error('invalid_api_key');
      }
      throw new Error(detail);
    }
    applyStatus((await response.json()) as SessionStatus);
  }, [applyStatus]);

  const stop = useCallback(async () => {
    const response = await fetch('/api/v1/session/stop', { method: 'POST' });
    if (!response.ok) {
      throw new Error('stop failed');
    }
    applyStatus((await response.json()) as SessionStatus);
  }, [applyStatus]);

  return {
    running,
    listenerCount,
    inputLines,
    outputLines,
    start,
    stop,
  };
}
