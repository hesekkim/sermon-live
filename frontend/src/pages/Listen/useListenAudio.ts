import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeOddPcmByte, pcm16ToFloat32 } from '../../shared/audio/pcm';

const DEFAULT_SAMPLE_RATE = 24000;
const RECONNECT_DELAY_MS = 1200;

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting';
type SessionStatus = 'unknown' | 'off' | 'starting' | 'live' | 'stopping' | 'error';

interface SessionEvent {
  type?: string;
  text?: string;
  sampleRate?: number;
  session_status?: SessionStatus;
  last_termination_reason?: string | null;
  reason?: string;
}

export function useListenAudio() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('unknown');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [audioError, setAudioError] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingPcmRef = useRef<Uint8Array | null>(null);
  const sampleRateRef = useRef(DEFAULT_SAMPLE_RATE);
  const wantsListenRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const connectSocketRef = useRef<((isReconnect: boolean) => void) | null>(null);

  useEffect(() => {
    return () => {
      wantsListenRef.current = false;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      const socket = socketRef.current;
      if (
        socket &&
        (socket.readyState === WebSocket.CONNECTING ||
          socket.readyState === WebSocket.OPEN)
      ) {
        socket.close(1000, 'Page closed');
      }
      socketRef.current = null;
      void audioContextRef.current?.close();
    };
  }, []);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const context = audioContextRef.current;
    if (context.state === 'suspended') {
      await context.resume();
    }
    if (context.state !== 'running') {
      throw new Error(`AudioContext state is ${context.state}`);
    }
    return context;
  }, []);

  const queueAudioChunk = useCallback(async (chunkBuffer: ArrayBuffer) => {
    const context = audioContextRef.current;
    if (!context) {
      return;
    }
    if (context.state === 'suspended') {
      await context.resume();
    }
    if (context.state !== 'running') {
      return;
    }
    if (context.state !== 'running') {
      return;
    }

    const incoming = new Uint8Array(chunkBuffer);
    const merged = mergeOddPcmByte(pendingPcmRef.current, incoming);
    pendingPcmRef.current = merged.pending;
    const monoFloat = pcm16ToFloat32(merged.pcmBytes);
    if (!monoFloat) {
      return;
    }

    const audioBuffer = context.createBuffer(1, monoFloat.length, sampleRateRef.current);
    audioBuffer.getChannelData(0).set(monoFloat);

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);

    const startAt = Math.max(context.currentTime + 0.05, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + audioBuffer.duration;
  }, []);

  const connectSocket = useCallback((isReconnect: boolean) => {
    if (!wantsListenRef.current) {
      return;
    }
    const currentSocket = socketRef.current;
    if (
      currentSocket &&
      (currentSocket.readyState === WebSocket.CONNECTING ||
        currentSocket.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    setConnectionState(isReconnect ? 'reconnecting' : 'connecting');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws/listen`);
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      if (socketRef.current !== socket) {
        return;
      }
      setConnectionState('connected');
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        let payload: SessionEvent;
        try {
          payload = JSON.parse(event.data) as SessionEvent;
        } catch {
          return;
        }
        if (payload.sampleRate) {
          sampleRateRef.current = payload.sampleRate;
        }
        if (payload.type === 'translation_status' && payload.session_status) {
          setSessionStatus(payload.session_status);
          setSessionEnded(
            payload.session_status === 'off' &&
              Boolean(payload.last_termination_reason),
          );
        } else if (payload.type === 'session_ended') {
          const endedWithError =
            payload.reason === 'interpreter_error' ||
            payload.reason === 'device_error';
          setSessionEnded(!endedWithError);
          setSessionStatus(endedWithError ? 'error' : 'off');
        } else if (payload.type === 'error') {
          setSessionStatus('error');
        } else if (payload.text) {
          setSubtitle(payload.text);
        }
        return;
      }

      const chunk = new Uint8Array(event.data as ArrayBuffer);
      if (chunk.length === 0) {
        return;
      }
      const buffer = chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength,
      );
      void queueAudioChunk(buffer).catch((error: unknown) => {
        setAudioError(error instanceof Error ? error.message : String(error));
      });
    });

    socket.addEventListener('close', () => {
      if (socketRef.current !== socket) {
        return;
      }
      socketRef.current = null;
      if (!wantsListenRef.current) {
        return;
      }
      setConnectionState('reconnecting');
      reconnectTimerRef.current = window.setTimeout(() => {
        connectSocketRef.current?.(true);
      }, RECONNECT_DELAY_MS);
    });

    socket.addEventListener('error', () => {
      if (socketRef.current === socket) {
        socket.close();
      }
    });
  }, [queueAudioChunk]);
  connectSocketRef.current = connectSocket;

  useEffect(() => {
    wantsListenRef.current = true;
    connectSocket(false);
  }, [connectSocket]);

  const startListening = useCallback(async () => {
    try {
      await ensureAudioContext();
      setAudioError('');
      setSessionEnded(false);
      wantsListenRef.current = true;
      setIsListening(true);
      connectSocketRef.current?.(false);
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : String(error));
      setIsListening(false);
    }
  }, [ensureAudioContext]);

  const connectionLabel = {
    idle: 'Not connected',
    connecting: 'Connecting',
    connected: 'Connected',
    reconnecting: 'Connection lost · reconnecting',
  }[connectionState];

  const sessionLabel = sessionEnded
    ? 'Broadcast ended'
    : {
        unknown: 'Ready to listen',
        off: 'Translation OFF',
        starting: 'Starting translation',
        live: subtitle ? 'Live translation' : 'Waiting for translation',
        stopping: 'Broadcast ending',
        error: 'Translation unavailable',
      }[sessionStatus];

  return {
    audioError,
    connectionLabel,
    connectionState,
    isListening,
    sessionEnded,
    sessionLabel,
    sessionStatus,
    startListening,
    subtitle,
  };
}
