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

export function useBroadcastSession(labels: OperatorCopy) {
  const [running, setRunning] = useState(false);
  const [listenerCount, setListenerCount] = useState(0);
  const [inputLines, setInputLines] = useState<string[]>([]);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [error, setError] = useState('');
  const socketRef = useRef<WebSocket | null>(null);

  const applyStatus = useCallback((data: SessionStatus) => {
    setRunning(data.running);
    setListenerCount(data.listener_count);
  }, []);

  const refreshStatus = useCallback(async () => {
    const response = await fetch('/api/v1/session');
    if (!response.ok) {
      return;
    }
    applyStatus((await response.json()) as SessionStatus);
  }, [applyStatus]);

  useEffect(() => {
    void refreshStatus();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws/operator`);
    socketRef.current = socket;
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
          setError(labels.sessionError);
          return;
        }
        if (payload.type === 'transcript' && payload.text) {
          if (payload.role === 'input') {
            setInputLines((lines) => appendTranscriptLine(lines, payload.text ?? ''));
          } else if (payload.role === 'output') {
            setOutputLines((lines) => appendTranscriptLine(lines, payload.text ?? ''));
          }
        }
      } catch {
        return;
      }
    });
    return () => {
      if (
        socket.readyState === WebSocket.CONNECTING ||
        socket.readyState === WebSocket.OPEN
      ) {
        socket.close(1000, 'Page closed');
      }
      socketRef.current = null;
    };
  }, [labels.sessionError, refreshStatus]);

  const start = useCallback(async () => {
    setError('');
    const response = await fetch('/api/v1/session/start', { method: 'POST' });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { detail?: string }
        | null;
      throw new Error(body?.detail || 'start failed');
    }
    applyStatus((await response.json()) as SessionStatus);
  }, [applyStatus]);

  const stop = useCallback(async () => {
    setError('');
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
    error,
    setError,
    start,
    stop,
  };
}
