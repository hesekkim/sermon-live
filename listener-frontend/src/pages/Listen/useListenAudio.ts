import { OpusDecoder } from 'opus-decoder';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  appendSentenceAfterGap,
  appendSentenceDelta,
} from '../../utils/appendSentenceDelta';
import {
  isTranslationTargetLanguage,
  type TranslationTargetLanguage,
} from '../../shared/types/translation';
import {
  buildListenerWebSocketUrl,
  ListenerAdmissionError,
  parseOpusPacket,
  requestListenerToken,
  type ListenerToken,
} from './relayProtocol';
import type { AdmissionErrorKey } from './translations';

const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
export const SESSION_END_LOGOUT_SECONDS = 5;
const SESSION_END_LOGOUT_DELAY_MS = SESSION_END_LOGOUT_SECONDS * 1000;
const CONNECT_TIMEOUT_MS = 10000;
const HEARTBEAT_INTERVAL_MS = 5000;
const STALE_CONNECTION_MS = 15000;
const MAX_SCHEDULED_AUDIO_SECONDS = 6;
const JITTER_BUFFER_SECONDS = 0.25;
const MIN_SCHEDULE_LEAD_SECONDS = 0.02;
const PACKET_DURATION_MICROS = 20_000n;

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

type AdmissionState =
  | 'needs_session'
  | 'authenticating'
  | 'admitted'
  | 'reauthentication_required';

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

interface RelayEvent {
  type?: string;
  protocol?: string;
  session_id?: string;
  status?: string;
  reason?: string;
  text?: string;
  language?: unknown;
  reference?: string;
  version?: string;
  verses?: ScriptureVersePayload[];
  codec?: string;
  sample_rate?: number;
  channels?: number;
  packet_duration_ms?: number;
}

function parseScripturePayload(payload: RelayEvent): ScripturePassage | null {
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
  return { reference: payload.reference, version: payload.version, verses };
}

function initialSessionId(): string {
  return new URLSearchParams(location.search).get('session')?.trim() ?? '';
}

export function useListenAudio() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('idle');
  const [admissionState, setAdmissionState] =
    useState<AdmissionState>('needs_session');
  const [admissionError, setAdmissionError] =
    useState<AdmissionErrorKey | null>(null);
  const [sessionInput, setSessionInput] = useState(initialSessionId);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('unknown');
  const [translationTargetLanguage, setTranslationTargetLanguage] =
    useState<TranslationTargetLanguage>('de');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [interpreterReconnecting, setInterpreterReconnecting] = useState(false);
  const [subtitleLines, setSubtitleLines] = useState<string[]>([]);
  const [scripture, setScripture] = useState<ScripturePassage | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [audioRecoveryRequired, setAudioRecoveryRequired] = useState(false);
  const [audioOutputReady, setAudioOutputReady] = useState(false);
  const [audioError, setAudioError] = useState('');

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioContextListenerRef = useRef<{
    context: AudioContext;
    listener: EventListener;
  } | null>(null);
  const audioNeedsUserGestureRef = useRef(false);
  const audioRestartRequiredRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const playingSourcesRef = useRef(
    new Map<AudioBufferSourceNode, ScheduledAudioSource>(),
  );
  const listenGenerationRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);
  const readySocketRef = useRef<WebSocket | null>(null);
  const decoderRef = useRef<OpusDecoder<24000> | null>(null);
  const decoderQueueRef = useRef<Promise<void>>(Promise.resolve());
  const wantsListenRef = useRef(false);
  const isListeningRef = useRef(false);
  const sessionEndedRef = useRef(false);
  const tokenRef = useRef<ListenerToken | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const hasConnectedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const connectTimeoutRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const sessionEndLogoutTimerRef = useRef<number | null>(null);
  const lastMessageAtRef = useRef(0);
  const lastAudioSequenceRef = useRef<number | null>(null);
  const lastAudioTimestampRef = useRef<bigint | null>(null);
  const subtitleGapRef = useRef(false);
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

  const sendRelayMessage = useCallback((payload: object) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      setAudioError('The Berlin relay connection could not send a message.');
    }
  }, []);

  const stopListening = useCallback(() => {
    const wasListening = isListeningRef.current;
    listenGenerationRef.current += 1;
    isListeningRef.current = false;
    setIsListening(false);
    setAudioOutputReady(false);
    setAudioRecoveryRequired(false);
    audioNeedsUserGestureRef.current = false;
    audioRestartRequiredRef.current = false;
    clearScheduledAudio();
    if (wasListening) {
      sendRelayMessage({ type: 'audio', enabled: false });
    }
  }, [clearScheduledAudio, sendRelayMessage]);

  const discardToken = useCallback(
    (error: AdmissionErrorKey) => {
      wantsListenRef.current = false;
      tokenRef.current = null;
      stopListening();
      setConnectionState('idle');
      setSessionStatus('unknown');
      setSessionEnded(false);
      setInterpreterReconnecting(false);
      setSubtitleLines([]);
      setScripture(null);
      setAdmissionError(error);
      setAdmissionState('reauthentication_required');
      const socket = socketRef.current;
      socketRef.current = null;
      readySocketRef.current = null;
      if (
        socket &&
        (socket.readyState === WebSocket.CONNECTING ||
          socket.readyState === WebSocket.OPEN)
      ) {
        socket.close(1000, 'Listener admission expired');
      }
    },
    [stopListening],
  );

  const finishSession = useCallback(
    (socket: WebSocket, reason?: string) => {
      sessionEndedRef.current = true;
      wantsListenRef.current = false;
      tokenRef.current = null;
      readySocketRef.current = null;
      setSessionEnded(true);
      setSessionStatus(reason === 'publisher_error' ? 'error' : 'off');
      setInterpreterReconnecting(false);
      setSubtitleLines([]);
      setScripture(null);
      setSessionKey((key) => key + 1);
      subtitleGapRef.current = false;
      stopListening();
      for (const timer of [
        reconnectTimerRef.current,
        connectTimeoutRef.current,
      ]) {
        if (timer !== null) window.clearTimeout(timer);
      }
      reconnectTimerRef.current = null;
      connectTimeoutRef.current = null;
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      const context = audioContextRef.current;
      audioContextRef.current = null;
      const contextListener = audioContextListenerRef.current;
      if (contextListener?.context === context) {
        context.removeEventListener('statechange', contextListener.listener);
        audioContextListenerRef.current = null;
      }
      if (context) void context.close();
      if (socket.readyState < WebSocket.CLOSING) {
        socket.close(1000, 'Session ended');
      }
      if (sessionEndLogoutTimerRef.current !== null) {
        window.clearTimeout(sessionEndLogoutTimerRef.current);
      }
      sessionEndLogoutTimerRef.current = window.setTimeout(() => {
        sessionEndLogoutTimerRef.current = null;
        sessionEndedRef.current = false;
        sessionIdRef.current = null;
        setAdmissionError(null);
        setAdmissionState('needs_session');
        setConnectionState('idle');
        setSessionStatus('unknown');
        setSessionEnded(false);
        setInterpreterReconnecting(false);
      }, SESSION_END_LOGOUT_DELAY_MS);
    },
    [stopListening],
  );

  const getAudioContext = useCallback(
    (replaceExisting = false) => {
      const current = audioContextRef.current;
      if (!replaceExisting && current && current.state !== 'closed') {
        return current;
      }
      const previousListener = audioContextListenerRef.current;
      if (previousListener) {
        previousListener.context.removeEventListener(
          'statechange',
          previousListener.listener,
        );
        audioContextListenerRef.current = null;
      }
      const context = new AudioContext();
      audioContextRef.current = context;
      const listener: EventListener = () => {
        if (audioContextRef.current !== context) return;
        if (context.state === 'running') {
          if (!audioNeedsUserGestureRef.current) {
            audioRestartRequiredRef.current = false;
            setAudioRecoveryRequired(false);
            setAudioError('');
          }
        } else if (isListeningRef.current) {
          audioNeedsUserGestureRef.current = true;
          audioRestartRequiredRef.current = true;
          clearScheduledAudio(context);
          setAudioOutputReady(false);
          setAudioRecoveryRequired(true);
        }
      };
      context.addEventListener('statechange', listener);
      audioContextListenerRef.current = { context, listener };
      return context;
    },
    [clearScheduledAudio],
  );

  const ensureAudioContext = useCallback(async () => {
    const context = getAudioContext();
    if (context.state !== 'running') await context.resume();
    if (context.state !== 'running') {
      throw new Error(`AudioContext state is ${context.state}`);
    }
    return context;
  }, [getAudioContext]);

  const queueDecodedAudio = useCallback(
    (packet: ArrayBuffer) => {
      const generation = listenGenerationRef.current;
      decoderQueueRef.current = decoderQueueRef.current
        .then(async () => {
          if (!isListeningRef.current || generation !== listenGenerationRef.current) {
            return;
          }
          if (audioNeedsUserGestureRef.current) return;
          const parsed = parseOpusPacket(packet);
          if (
            lastAudioSequenceRef.current !== null &&
            parsed.sequence <= lastAudioSequenceRef.current
          ) {
            return;
          }
          const hasSequenceGap =
            lastAudioSequenceRef.current !== null &&
            parsed.sequence !== lastAudioSequenceRef.current + 1;
          const hasTimestampGap =
            lastAudioTimestampRef.current !== null &&
            parsed.timestampMicros - lastAudioTimestampRef.current >
              PACKET_DURATION_MICROS;
          if (
            lastAudioTimestampRef.current !== null &&
            parsed.timestampMicros <= lastAudioTimestampRef.current
          ) {
            setAudioError('The relay sent an out-of-order audio timestamp.');
            await decoderRef.current?.reset();
            return;
          }
          lastAudioSequenceRef.current = parsed.sequence;
          lastAudioTimestampRef.current = parsed.timestampMicros;

          let decoder = decoderRef.current;
          if (!decoder) {
            decoder = new OpusDecoder<24000>({
              sampleRate: 24000,
              channels: 1,
            });
            decoderRef.current = decoder;
          }
          await decoder.ready;
          if (hasSequenceGap || hasTimestampGap) {
            clearScheduledAudio(audioContextRef.current ?? undefined);
            await decoder.reset();
          }
          const decoded = decoder.decodeFrame(parsed.payload);
          if (decoded.errors.length > 0) {
            await decoder.reset();
            setAudioError('An Opus audio packet could not be decoded.');
            return;
          }
          const samples = decoded.channelData[0];
          const context = audioContextRef.current;
          if (
            !samples ||
            decoded.samplesDecoded === 0 ||
            Number(decoded.sampleRate) !== 24000 ||
            !context ||
            context.state !== 'running' ||
            audioNeedsUserGestureRef.current
          ) {
            return;
          }

          const output = context.createBuffer(
            1,
            decoded.samplesDecoded,
            decoded.sampleRate,
          );
          output.getChannelData(0).set(samples.subarray(0, decoded.samplesDecoded));
          const source = context.createBufferSource();
          source.buffer = output;
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
            for (const [scheduledSource, scheduledAudio] of playingSourcesRef.current) {
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

          const startAt =
            nextPlayTimeRef.current >
            context.currentTime + MIN_SCHEDULE_LEAD_SECONDS
              ? nextPlayTimeRef.current
              : context.currentTime + JITTER_BUFFER_SECONDS;
          source.start(startAt);
          nextPlayTimeRef.current = startAt + output.duration;
          playingSourcesRef.current.set(source, {
            startAt,
            endAt: nextPlayTimeRef.current,
          });
          setAudioOutputReady(true);
          setAudioError('');
        })
        .catch((error: unknown) => {
          if (generation === listenGenerationRef.current) {
            clearScheduledAudio(audioContextRef.current ?? undefined);
            setAudioOutputReady(false);
            setAudioError(
              error instanceof Error
                ? error.message
                : 'The compressed audio frame could not be processed.',
            );
            const decoder = decoderRef.current;
            if (decoder) {
              decoderQueueRef.current = decoderQueueRef.current.then(() =>
                decoder.reset(),
              );
            }
          }
        });
    },
    [clearScheduledAudio],
  );

  const connectSocket = useCallback(
    (isReconnect: boolean) => {
      const token = tokenRef.current;
      const sessionId = sessionIdRef.current;
      if (
        !wantsListenRef.current ||
        !token ||
        !sessionId ||
        sessionEndedRef.current
      ) {
        return;
      }
      if (token.expiresAt <= Date.now()) {
        discardToken('accessExpired');
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
      let socket: WebSocket;
      try {
        socket = new WebSocket(buildListenerWebSocketUrl(sessionId));
      } catch {
        discardToken('relayConfiguration');
        return;
      }
      socket.binaryType = 'arraybuffer';
      socketRef.current = socket;
      lastMessageAtRef.current = Date.now();

      const stopTimers = () => {
        if (connectTimeoutRef.current !== null) {
          window.clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        if (heartbeatTimerRef.current !== null) {
          window.clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }
      };

      const scheduleReconnect = (retryState: RetryState) => {
        if (
          !wantsListenRef.current ||
          sessionEndedRef.current ||
          reconnectTimerRef.current !== null
        ) {
          return;
        }
        const activeToken = tokenRef.current;
        if (!activeToken || activeToken.expiresAt <= Date.now()) {
          discardToken('accessExpired');
          return;
        }
        setConnectionState(retryState);
        const delay = Math.min(
          RECONNECT_DELAY_MS * 2 ** reconnectAttemptRef.current,
          MAX_RECONNECT_DELAY_MS,
        );
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          connectSocketRef.current?.(true);
        }, Math.min(delay, activeToken.expiresAt - Date.now()));
      };

      const failSocket = (
        retryState: RetryState,
        closeSocket = true,
      ) => {
        if (socketRef.current !== socket) return;
        socketRef.current = null;
        readySocketRef.current = null;
        stopTimers();
        clearScheduledAudio(audioContextRef.current ?? undefined);
        if (isListeningRef.current) setAudioOutputReady(false);
        if (closeSocket && socket.readyState < WebSocket.CLOSING) socket.close();
        if (tokenRef.current && tokenRef.current.expiresAt <= Date.now()) {
          discardToken('accessExpired');
          return;
        }
        scheduleReconnect(retryState);
      };

      connectTimeoutRef.current = window.setTimeout(() => {
        failSocket('timedOutRetrying');
      }, CONNECT_TIMEOUT_MS);

      socket.addEventListener('open', () => {
        if (socketRef.current !== socket) return;
        try {
          socket.send(
            JSON.stringify({
              type: 'listener_hello',
              session_id: sessionId,
              listener_token: token.value,
            }),
          );
        } catch {
          failSocket('initialRetrying');
        }
      });

      socket.addEventListener('message', (event) => {
        if (socketRef.current !== socket) return;
        lastMessageAtRef.current = Date.now();
        if (typeof event.data !== 'string') {
          if (sessionEndedRef.current || readySocketRef.current !== socket) return;
          queueDecodedAudio(event.data as ArrayBuffer);
          return;
        }

        let payload: RelayEvent;
        try {
          payload = JSON.parse(event.data) as RelayEvent;
        } catch {
          setAdmissionError('invalidRelayMessage');
          return;
        }
        if (payload.session_id && payload.session_id !== sessionId) return;
        if (sessionEndedRef.current && payload.type !== 'pong') return;

        if (payload.type === 'listener_ready') {
          if (
            payload.session_id !== sessionId ||
            payload.protocol !== 'sermon-live/1' ||
            ![
              'starting',
              'live',
              'reconnecting',
              'live_recovered',
              'ending',
              'error',
            ].includes(payload.status ?? 'starting') ||
            payload.codec !== 'opus' ||
            payload.sample_rate !== 24000 ||
            payload.channels !== 1 ||
            payload.packet_duration_ms !== 20
          ) {
            discardToken('unsupportedRelayFormat');
            return;
          }
          if (
            payload.status !== 'live' &&
            payload.status !== 'live_recovered' &&
            !hasConnectedRef.current
          ) {
            discardToken('broadcastNotLive');
            return;
          }
          if (connectTimeoutRef.current !== null) {
            window.clearTimeout(connectTimeoutRef.current);
            connectTimeoutRef.current = null;
          }
          hasConnectedRef.current = true;
          reconnectAttemptRef.current = 0;
          readySocketRef.current = socket;
          subtitleGapRef.current = true;
          setConnectionState('connected');
          setSessionStatus(
            payload.status === 'live' || payload.status === 'live_recovered'
              ? 'live'
              : payload.status === 'reconnecting'
                ? 'live'
                : payload.status === 'ending'
                  ? 'stopping'
                  : payload.status === 'error'
                    ? 'error'
                    : 'starting',
          );
          setInterpreterReconnecting(payload.status === 'reconnecting');
          setSessionEnded(false);
          if (decoderRef.current) {
            decoderQueueRef.current = decoderQueueRef.current.then(() =>
              decoderRef.current?.reset(),
            );
          }
          if (isListeningRef.current) {
            sendRelayMessage({ type: 'audio', enabled: true });
          }
          if (heartbeatTimerRef.current !== null) {
            window.clearInterval(heartbeatTimerRef.current);
          }
          heartbeatTimerRef.current = window.setInterval(() => {
            if (socketRef.current !== socket) return;
            if (Date.now() - lastMessageAtRef.current > STALE_CONNECTION_MS) {
              failSocket('reconnecting');
              return;
            }
            sendRelayMessage({ type: 'ping' });
          }, HEARTBEAT_INTERVAL_MS);
          return;
        }

        if (payload.type === 'pong') return;
        if (payload.type === 'audio_gap') {
          subtitleGapRef.current = true;
          decoderQueueRef.current = decoderQueueRef.current.then(async () => {
            await decoderRef.current?.reset();
            clearScheduledAudio(audioContextRef.current ?? undefined);
          });
          return;
        }
        if (payload.type === 'status') {
          if (payload.status === 'ended') {
            finishSession(socket, payload.reason);
          } else if (payload.status === 'starting') {
            setSessionStatus('starting');
            setSessionKey((key) => key + 1);
            setSubtitleLines([]);
            setScripture(null);
            subtitleGapRef.current = false;
          } else if (payload.status === 'reconnecting') {
            setInterpreterReconnecting(true);
          } else if (
            payload.status === 'live' ||
            payload.status === 'live_recovered'
          ) {
            setSessionStatus('live');
            setInterpreterReconnecting(false);
          } else if (payload.status === 'ending') {
            setSessionStatus('stopping');
          } else if (payload.status === 'error') {
            setSessionStatus('error');
            setInterpreterReconnecting(false);
          }
          return;
        }
        if (payload.type === 'subtitle' && typeof payload.text === 'string') {
          if (isTranslationTargetLanguage(payload.language)) {
            setTranslationTargetLanguage(payload.language);
          }
          const afterGap = subtitleGapRef.current;
          subtitleGapRef.current = false;
          setSubtitleLines((current) =>
            afterGap
              ? appendSentenceAfterGap(current, payload.text!)
              : appendSentenceDelta(current, payload.text!),
          );
        } else if (payload.type === 'scripture') {
          const passage = parseScripturePayload(payload);
          if (passage) setScripture(passage);
        }
      });

      socket.addEventListener('close', (event) => {
        if (socketRef.current !== socket) return;
        if (sessionEndedRef.current) {
          socketRef.current = null;
          readySocketRef.current = null;
          stopTimers();
          return;
        }
        if (event.code === 1008) {
          socketRef.current = null;
          readySocketRef.current = null;
          stopTimers();
          clearScheduledAudio(audioContextRef.current ?? undefined);
          discardToken(
            event.reason.toLowerCase().includes('expired')
              ? 'accessExpired'
              : event.reason.toLowerCase().includes('not live')
                ? 'broadcastNotLive'
                : 'accessRejected',
          );
          return;
        }
        failSocket(
          event.wasClean
            ? 'serverRetrying'
            : hasConnectedRef.current
              ? 'reconnecting'
              : 'initialRetrying',
          false,
        );
      });

      socket.addEventListener('error', () => {
        failSocket(
          hasConnectedRef.current ? 'reconnecting' : 'initialRetrying',
        );
      });
    },
    [
      clearScheduledAudio,
      discardToken,
      queueDecodedAudio,
      sendRelayMessage,
      stopListening,
      finishSession,
    ],
  );
  connectSocketRef.current = connectSocket;

  const authenticate = useCallback(async () => {
    const sessionId = sessionInput.trim();
    setAdmissionError(null);
    if (!sessionId) {
      setAdmissionError('missingSession');
      return;
    }
    setAdmissionState('authenticating');
    try {
      const token = await requestListenerToken(sessionId);
      tokenRef.current = token;
      sessionIdRef.current = sessionId;
      sessionEndedRef.current = false;
      setSessionInput(sessionId);
      setAdmissionState('admitted');
      setSessionStatus('unknown');
      setSessionEnded(false);
      setSubtitleLines([]);
      setScripture(null);
      setSessionKey((key) => key + 1);
      hasConnectedRef.current = false;
      reconnectAttemptRef.current = 0;
      wantsListenRef.current = true;
      connectSocketRef.current?.(false);
    } catch (error) {
      setAdmissionState('needs_session');
      setAdmissionError(
        error instanceof ListenerAdmissionError
          ? error.kind === 'invalid'
            ? 'invalidSession'
            : error.kind === 'not_live'
              ? 'broadcastNotLive'
              : error.kind === 'rate_limited'
                ? 'rateLimited'
                : error.kind === 'configuration'
                  ? 'relayConfiguration'
                  : 'relayUnavailable'
          : 'authenticationFailed',
      );
    }
  }, [sessionInput]);

  const canStartListening =
    admissionState === 'admitted' &&
    connectionState === 'connected' &&
    sessionStatus === 'live' &&
    !sessionEnded;

  const startListening = useCallback(async () => {
    if (!canStartListening || isListeningRef.current) return;
    try {
      await ensureAudioContext();
      setAudioError('');
      setAudioRecoveryRequired(false);
      audioNeedsUserGestureRef.current = false;
      audioRestartRequiredRef.current = false;
      listenGenerationRef.current += 1;
      lastAudioSequenceRef.current = null;
      lastAudioTimestampRef.current = null;
      await decoderRef.current?.reset();
      isListeningRef.current = true;
      setIsListening(true);
      sendRelayMessage({ type: 'audio', enabled: true });
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : String(error));
      setIsListening(false);
    }
  }, [canStartListening, ensureAudioContext, sendRelayMessage]);

  const recoverAudio = useCallback(async () => {
    if (!isListeningRef.current) return;
    try {
      const previous = audioContextRef.current;
      const replace =
        audioRestartRequiredRef.current &&
        previous !== null &&
        previous.state !== 'closed';
      if (replace && previous) {
        clearScheduledAudio(previous);
        void previous.close();
      }
      const context = getAudioContext(replace);
      if (context.state !== 'running') await context.resume();
      if (context.state !== 'running') {
        throw new Error(`AudioContext state is ${context.state}`);
      }
      await decoderRef.current?.reset();
      audioNeedsUserGestureRef.current = false;
      audioRestartRequiredRef.current = false;
      setAudioRecoveryRequired(false);
      setAudioError('');
      sendRelayMessage({ type: 'audio', enabled: true });
    } catch (error) {
      setAudioRecoveryRequired(true);
      setAudioError(error instanceof Error ? error.message : String(error));
    }
  }, [clearScheduledAudio, getAudioContext, sendRelayMessage]);

  const dismissScripture = useCallback(() => setScripture(null), []);

  useEffect(() => {
    if (admissionState === 'admitted') {
      wantsListenRef.current = true;
      connectSocketRef.current?.(false);
    }
  }, [admissionState]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        if (isListeningRef.current) {
          audioNeedsUserGestureRef.current = true;
          audioRestartRequiredRef.current = true;
          clearScheduledAudio(audioContextRef.current ?? undefined);
          setAudioOutputReady(false);
          setAudioRecoveryRequired(true);
        }
        return;
      }
      if (!isListeningRef.current || !audioNeedsUserGestureRef.current) return;
      setAudioRecoveryRequired(true);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [clearScheduledAudio]);

  useEffect(() => {
    return () => {
      wantsListenRef.current = false;
      isListeningRef.current = false;
      tokenRef.current = null;
      listenGenerationRef.current += 1;
      for (const timer of [
        reconnectTimerRef.current,
        connectTimeoutRef.current,
        sessionEndLogoutTimerRef.current,
      ]) {
        if (timer !== null) window.clearTimeout(timer);
      }
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
      }
      const socket = socketRef.current;
      socketRef.current = null;
      readySocketRef.current = null;
      if (
        socket &&
        (socket.readyState === WebSocket.CONNECTING ||
          socket.readyState === WebSocket.OPEN)
      ) {
        socket.close(1000, 'Page closed');
      }
      const contextListener = audioContextListenerRef.current;
      if (contextListener) {
        contextListener.context.removeEventListener(
          'statechange',
          contextListener.listener,
        );
      }
      clearScheduledAudio(audioContextRef.current ?? undefined);
      void audioContextRef.current?.close();
      decoderRef.current?.free();
      decoderRef.current = null;
    };
  }, [clearScheduledAudio]);

  const subtitle = subtitleLines.at(-1) ?? '';

  return {
    admissionError,
    admissionState,
    audioError,
    audioOutputReady,
    audioRecoveryRequired,
    canStartListening,
    connectionState,
    dismissScripture,
    interpreterReconnecting,
    isListening,
    setSessionInput,
    sessionEnded,
    sessionInput,
    sessionKey,
    sessionStatus,
    translationTargetLanguage,
    scripture,
    recoverAudio,
    authenticate,
    startListening,
    stopListening,
    subtitle,
    subtitleLines,
  };
}
