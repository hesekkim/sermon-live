import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeOddPcmByte, pcm16ToFloat32 } from '../../shared/audio/pcm';
import { appendSentenceDelta } from '../../utils/appendSentenceDelta';

const DEFAULT_SAMPLE_RATE = 24000;
const RECONNECT_DELAY_MS = 1200;
const CONNECT_TIMEOUT_MS = 8000;
const MAX_SCHEDULED_AUDIO_SECONDS = 2;

interface ScheduledAudioSource {
  startAt: number;
  endAt: number;
}

type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'initialRetrying'
  | 'timedOutRetrying'
  | 'serverRetrying'
  | 'reconnecting';
type RetryState = Extract<
  ConnectionState,
  'initialRetrying' | 'timedOutRetrying' | 'serverRetrying' | 'reconnecting'
>;
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
  const [audioRecoveryRequired, setAudioRecoveryRequired] = useState(false);
  const [audioError, setAudioError] = useState('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioContextStateListenerRef = useRef<{
    context: AudioContext;
    listener: EventListener;
  } | null>(null);
  const audioResumeRef = useRef<{
    context: AudioContext;
    promise: Promise<void>;
  } | null>(null);
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
  const hasConnectedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const connectTimeoutTimerRef = useRef<number | null>(null);
  const connectSocketRef = useRef<((isReconnect: boolean) => void) | null>(
    null,
  );

  const clearScheduledAudio = useCallback((context?: AudioContext) => {
    for (const source of playingSourcesRef.current.keys()) {
      source.stop();
      source.disconnect();
    }
    playingSourcesRef.current.clear();
    nextPlayTimeRef.current =
      context?.currentTime ?? audioContextRef.current?.currentTime ?? 0;
  }, []);

  useEffect(() => {
    return () => {
      wantsListenRef.current = false;
      isListeningRef.current = false;
      listenGenerationRef.current += 1;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (connectTimeoutTimerRef.current !== null) {
        window.clearTimeout(connectTimeoutTimerRef.current);
        connectTimeoutTimerRef.current = null;
      }
      const socket = socketRef.current;
      socketRef.current = null;
      if (
        socket &&
        (socket.readyState === WebSocket.CONNECTING ||
          socket.readyState === WebSocket.OPEN)
      ) {
        socket.close(1000, 'Page closed');
      }
      const stateListener = audioContextStateListenerRef.current;
      if (stateListener) {
        stateListener.context.removeEventListener(
          'statechange',
          stateListener.listener,
        );
        audioContextStateListenerRef.current = null;
      }
      void audioContextRef.current?.close();
    };
  }, []);

  const getAudioContext = useCallback(() => {
    const current = audioContextRef.current;
    if (current && current.state !== 'closed') {
      return current;
    }
    const previousListener = audioContextStateListenerRef.current;
    if (previousListener) {
      previousListener.context.removeEventListener(
        'statechange',
        previousListener.listener,
      );
      audioContextStateListenerRef.current = null;
    }
    const context = new AudioContext();
    audioContextRef.current = context;
    const listener: EventListener = () => {
      if (audioContextRef.current !== context) {
        return;
      }
      if (context.state === 'running') {
        setAudioRecoveryRequired(false);
        setAudioError('');
      } else if (isListeningRef.current) {
        clearScheduledAudio(context);
        pendingPcmRef.current = null;
        setAudioRecoveryRequired(true);
      }
    };
    context.addEventListener('statechange', listener);
    audioContextStateListenerRef.current = { context, listener };
    return context;
  }, [clearScheduledAudio]);

  const resumeAudioContext = useCallback((context: AudioContext) => {
    if (context.state === 'running') {
      return Promise.resolve();
    }
    if (context.state === 'closed') {
      return Promise.reject(
        new Error(`AudioContext state is ${context.state}`),
      );
    }
    const currentResume = audioResumeRef.current;
    if (currentResume?.context === context) {
      return currentResume.promise;
    }
    const promise = context.resume().then(() => {
      if (context.state !== 'running') {
        throw new Error(`AudioContext state is ${context.state}`);
      }
    }).finally(() => {
      if (audioResumeRef.current?.promise === promise) {
        audioResumeRef.current = null;
      }
    });
    audioResumeRef.current = { context, promise };
    return promise;
  }, []);

  const ensureAudioContext = useCallback(async () => {
    const context = getAudioContext();
    if (context.state !== 'running') {
      await resumeAudioContext(context);
    }
    if (context.state !== 'running') {
      throw new Error(`AudioContext state is ${context.state}`);
    }
    return context;
  }, [getAudioContext, resumeAudioContext]);

  const queueAudioChunk = useCallback(async (chunkBuffer: ArrayBuffer) => {
    const generation = listenGenerationRef.current;
    if (!isListeningRef.current) {
      return;
    }
    const context = audioContextRef.current;
    if (!context || context.state !== 'running') {
      pendingPcmRef.current = null;
      setAudioRecoveryRequired(true);
      if (context && context.state !== 'closed') {
        void resumeAudioContext(context).catch((error: unknown) => {
          if (
            isListeningRef.current &&
            generation === listenGenerationRef.current &&
            audioContextRef.current === context
          ) {
            setAudioError(
              error instanceof Error ? error.message : String(error),
            );
          }
        });
      }
      return;
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
  }, [resumeAudioContext]);

  const stopListening = useCallback(() => {
    listenGenerationRef.current += 1;
    isListeningRef.current = false;
    setIsListening(false);
    setAudioRecoveryRequired(false);
    pendingPcmRef.current = null;
    clearScheduledAudio();
  }, [clearScheduledAudio]);

  const recoverAudio = useCallback(async () => {
    if (!isListeningRef.current) {
      return;
    }
    const generation = listenGenerationRef.current;
    try {
      const context = getAudioContext();
      if (context.state !== 'running') {
        await resumeAudioContext(context);
      }
      if (
        !isListeningRef.current ||
        generation !== listenGenerationRef.current ||
        context.state !== 'running'
      ) {
        throw new Error(`AudioContext state is ${context.state}`);
      }
      setAudioRecoveryRequired(false);
      setAudioError('');
    } catch (error) {
      if (
        isListeningRef.current &&
        generation === listenGenerationRef.current
      ) {
        setAudioRecoveryRequired(true);
        setAudioError(error instanceof Error ? error.message : String(error));
      }
    }
  }, [getAudioContext, resumeAudioContext]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState !== 'visible' ||
        !isListeningRef.current
      ) {
        return;
      }
      const context = audioContextRef.current;
      if (!context || context.state === 'closed') {
        setAudioRecoveryRequired(true);
        return;
      }
      if (context.state === 'running') {
        return;
      }
      const generation = listenGenerationRef.current;
      void resumeAudioContext(context).catch((error: unknown) => {
        if (
          isListeningRef.current &&
          generation === listenGenerationRef.current &&
          audioContextRef.current === context
        ) {
          setAudioRecoveryRequired(true);
          setAudioError(error instanceof Error ? error.message : String(error));
        }
      });
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [resumeAudioContext]);

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

      setConnectionState(
        isReconnect
          ? hasConnectedRef.current
            ? 'reconnecting'
            : 'initialRetrying'
          : 'connecting',
      );
      setHasSessionStatus(false);
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${location.host}/ws/listen`);
      socket.binaryType = 'arraybuffer';
      socketRef.current = socket;

      const scheduleReconnect = (retryState: RetryState) => {
        if (!wantsListenRef.current || reconnectTimerRef.current !== null) {
          return;
        }
        setConnectionState(retryState);
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          connectSocketRef.current?.(true);
        }, RECONNECT_DELAY_MS);
      };

      const failSocket = (retryState: RetryState) => {
        if (socketRef.current !== socket) {
          return;
        }
        socketRef.current = null;
        if (connectTimeoutTimerRef.current !== null) {
          window.clearTimeout(connectTimeoutTimerRef.current);
          connectTimeoutTimerRef.current = null;
        }
        if (
          socket.readyState === WebSocket.CONNECTING ||
          socket.readyState === WebSocket.OPEN
        ) {
          socket.close();
        }
        scheduleReconnect(retryState);
      };

      connectTimeoutTimerRef.current = window.setTimeout(() => {
        failSocket('timedOutRetrying');
      }, CONNECT_TIMEOUT_MS);

      socket.addEventListener('open', () => {
        if (socketRef.current !== socket) {
          return;
        }
        if (connectTimeoutTimerRef.current !== null) {
          window.clearTimeout(connectTimeoutTimerRef.current);
          connectTimeoutTimerRef.current = null;
        }
        setConnectionState('connected');
        hasConnectedRef.current = true;
      });

      socket.addEventListener('message', (event) => {
        if (socketRef.current !== socket) {
          return;
        }
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

      socket.addEventListener('close', (event) => {
        if (socketRef.current !== socket) {
          return;
        }
        socketRef.current = null;
        if (connectTimeoutTimerRef.current !== null) {
          window.clearTimeout(connectTimeoutTimerRef.current);
          connectTimeoutTimerRef.current = null;
        }
        if (!wantsListenRef.current) {
          return;
        }
        const retryState: RetryState = event.wasClean
          ? 'serverRetrying'
          : hasConnectedRef.current
            ? 'reconnecting'
            : 'initialRetrying';
        scheduleReconnect(retryState);
      });

      socket.addEventListener('error', () => {
        failSocket(
          hasConnectedRef.current ? 'reconnecting' : 'initialRetrying',
        );
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
      setAudioRecoveryRequired(false);
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
    initialRetrying: 'Initial connection failed · retrying',
    timedOutRetrying: 'Connection timed out · retrying',
    serverRetrying: 'Server closed the connection · retrying',
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
    audioRecoveryRequired,
    canStartListening,
    connectionLabel,
    connectionState,
    dismissScripture,
    isListening,
    sessionEnded,
    sessionLabel,
    sessionStatus,
    scripture,
    recoverAudio,
    startListening,
    stopListening,
    subtitle,
    subtitleLines,
  };
}
