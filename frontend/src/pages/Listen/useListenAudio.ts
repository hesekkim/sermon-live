import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeOddPcmByte, pcm16ToFloat32 } from '../../shared/audio/pcm';
import { appendSentenceDelta } from '../../utils/appendSentenceDelta';

const DEFAULT_SAMPLE_RATE = 24000;
const RECONNECT_DELAY_MS = 1200;
const MAX_SCHEDULED_AUDIO_SECONDS = 2;

interface ScheduledAudioSource {
  startAt: number;
  endAt: number;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting';
type SessionStatus =
  | 'unknown'
  | 'off'
  | 'starting'
  | 'live'
  | 'stopping'
  | 'error';

interface ScriptureVersePayload {
  verse?: number;
  text?: string;
}

export interface ScripturePassage {
  reference: string;
  version: string;
  verses: { verse: number; text: string }[];
}

interface SessionEvent {
  type?: string;
  text?: string;
  reference?: string;
  version?: string;
  verses?: ScriptureVersePayload[];
  sampleRate?: number;
  session_status?: SessionStatus;
  last_termination_reason?: string | null;
  reason?: string;
}

function parseScripturePayload(payload: SessionEvent): ScripturePassage | null {
  if (
    typeof payload.reference !== 'string' ||
    typeof payload.version !== 'string' ||
    !Array.isArray(payload.verses) ||
    payload.verses.length === 0
  ) {
    return null;
  }

  const verses: ScripturePassage['verses'] = [];
  for (const verse of payload.verses) {
    if (
      typeof verse.verse !== 'number' ||
      !Number.isInteger(verse.verse) ||
      typeof verse.text !== 'string'
    ) {
      return null;
    }
    verses.push({ verse: verse.verse, text: verse.text });
  }

  return {
    reference: payload.reference,
    version: payload.version,
    verses,
  };
}

export function useListenAudio() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('idle');
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('unknown');
  const [hasSessionStatus, setHasSessionStatus] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [subtitleLines, setSubtitleLines] = useState<string[]>([]);
  const [scripture, setScripture] = useState<ScripturePassage | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [audioError, setAudioError] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const playingSourcesRef = useRef(
    new Map<AudioBufferSourceNode, ScheduledAudioSource>(),
  );
  const listenGenerationRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingPcmRef = useRef<Uint8Array | null>(null);
  const sampleRateRef = useRef(DEFAULT_SAMPLE_RATE);
  const wantsListenRef = useRef(false);
  const isListeningRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const connectSocketRef = useRef<((isReconnect: boolean) => void) | null>(
    null,
  );

  useEffect(() => {
    return () => {
      wantsListenRef.current = false;
      isListeningRef.current = false;
      listenGenerationRef.current += 1;
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
    const generation = listenGenerationRef.current;
    if (!isListeningRef.current) {
      return;
    }
    const context = audioContextRef.current;
    if (!context) {
      return;
    }
    if (context.state === 'suspended') {
      await context.resume();
    }
    if (
      !isListeningRef.current ||
      generation !== listenGenerationRef.current ||
      context.state !== 'running'
    ) {
      return;
    }

    const incoming = new Uint8Array(chunkBuffer);
    const merged = mergeOddPcmByte(pendingPcmRef.current, incoming);
    pendingPcmRef.current = merged.pending;
    const monoFloat = pcm16ToFloat32(merged.pcmBytes);
    if (!monoFloat) {
      return;
    }

    const audioBuffer = context.createBuffer(
      1,
      monoFloat.length,
      sampleRateRef.current,
    );
    audioBuffer.getChannelData(0).set(monoFloat);

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.addEventListener(
      'ended',
      () => {
        source.disconnect();
        playingSourcesRef.current.delete(source);
      },
      { once: true },
    );

    if (
      nextPlayTimeRef.current - context.currentTime >
      MAX_SCHEDULED_AUDIO_SECONDS
    ) {
      let activeAudioEnd = context.currentTime;
      for (const [
        scheduledSource,
        scheduledAudio,
      ] of playingSourcesRef.current) {
        if (scheduledAudio.startAt > context.currentTime) {
          scheduledSource.stop();
          scheduledSource.disconnect();
          playingSourcesRef.current.delete(scheduledSource);
        } else {
          activeAudioEnd = Math.max(activeAudioEnd, scheduledAudio.endAt);
        }
      }
      nextPlayTimeRef.current = activeAudioEnd;
    }

    const startAt = Math.max(
      context.currentTime + 0.05,
      nextPlayTimeRef.current,
    );
    source.start(startAt);
    nextPlayTimeRef.current = startAt + audioBuffer.duration;
    playingSourcesRef.current.set(source, {
      startAt,
      endAt: nextPlayTimeRef.current,
    });
  }, []);

  const stopListening = useCallback(() => {
    listenGenerationRef.current += 1;
    isListeningRef.current = false;
    setIsListening(false);
    pendingPcmRef.current = null;
    nextPlayTimeRef.current = audioContextRef.current?.currentTime ?? 0;
    for (const source of playingSourcesRef.current.keys()) {
      source.stop();
      source.disconnect();
    }
    playingSourcesRef.current.clear();
  }, []);

  const connectSocket = useCallback(
    (isReconnect: boolean) => {
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
      setHasSessionStatus(false);
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
            setHasSessionStatus(true);
            setSessionStatus(payload.session_status);
            if (payload.session_status === 'starting') {
              setSubtitleLines([]);
              setScripture(null);
              setSessionEnded(false);
            } else if (
              payload.session_status === 'off' ||
              payload.session_status === 'error'
            ) {
              stopListening();
            }
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
            stopListening();
          } else if (payload.type === 'error') {
            setSessionStatus('error');
            stopListening();
          } else if (payload.type === 'scripture') {
            const passage = parseScripturePayload(payload);
            if (passage) setScripture(passage);
          } else if (payload.text) {
            setSubtitleLines((current) =>
              appendSentenceDelta(current, payload.text ?? ''),
            );
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
    },
    [queueAudioChunk, stopListening],
  );
  connectSocketRef.current = connectSocket;

  useEffect(() => {
    wantsListenRef.current = true;
    connectSocket(false);
  }, [connectSocket]);

  const subtitle = subtitleLines.at(-1) ?? '';
  const canStartListening =
    connectionState === 'connected' &&
    hasSessionStatus &&
    sessionStatus === 'live';

  const startListening = useCallback(async () => {
    if (!canStartListening || isListeningRef.current) {
      return;
    }
    try {
      await ensureAudioContext();
      setAudioError('');
      setSessionEnded(false);
      wantsListenRef.current = true;
      listenGenerationRef.current += 1;
      isListeningRef.current = true;
      setIsListening(true);
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : String(error));
      setIsListening(false);
    }
  }, [canStartListening, ensureAudioContext]);

  const dismissScripture = useCallback(() => {
    setScripture(null);
  }, []);

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
    canStartListening,
    connectionLabel,
    connectionState,
    dismissScripture,
    isListening,
    sessionEnded,
    sessionLabel,
    sessionStatus,
    scripture,
    startListening,
    stopListening,
    subtitle,
    subtitleLines,
  };
}
