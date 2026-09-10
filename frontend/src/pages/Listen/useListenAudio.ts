import { useCallback, useRef, useState } from 'react';
import { mergeOddPcmByte, pcm16ToFloat32 } from '../../shared/audio/pcm';

const DEFAULT_SAMPLE_RATE = 24000;

export function useListenAudio() {
  const [status, setStatus] = useState('Waiting for audio stream.');
  const [subtitle, setSubtitle] = useState('No subtitle yet.');
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingPcmRef = useRef<Uint8Array | null>(null);
  const sampleRateRef = useRef(DEFAULT_SAMPLE_RATE);
  const receivedChunksRef = useRef(0);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state !== 'running') {
      throw new Error(`AudioContext state is ${ctx.state}`);
    }
    return ctx;
  }, []);

  const queueAudioChunk = useCallback((chunkBuffer: ArrayBuffer) => {
    const ctx = audioContextRef.current;
    if (!ctx) {
      return;
    }

    const incoming = new Uint8Array(chunkBuffer);
    const merged = mergeOddPcmByte(pendingPcmRef.current, incoming);
    pendingPcmRef.current = merged.pending;
    const monoFloat = pcm16ToFloat32(merged.pcmBytes);
    if (!monoFloat) {
      return;
    }

    const audioBuffer = ctx.createBuffer(1, monoFloat.length, sampleRateRef.current);
    audioBuffer.getChannelData(0).set(monoFloat);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime + 0.05, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + audioBuffer.duration;
  }, []);

  const connectSocket = useCallback(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws/listen`);
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setStatus('Connected to live sermon stream.');
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        try {
          const payload = JSON.parse(event.data) as {
            text?: string;
            sampleRate?: number;
          };
          if (payload.sampleRate) {
            sampleRateRef.current = payload.sampleRate;
          }
          if (payload.text) {
            setSubtitle(payload.text);
          }
        } catch {
          return;
        }
        return;
      }

      const chunk = new Uint8Array(event.data as ArrayBuffer);
      if (chunk.length === 0) {
        return;
      }
      receivedChunksRef.current += 1;
      setStatus(
        `Audio connected. Received ${receivedChunksRef.current} audio chunks.`
      );
      try {
        queueAudioChunk(
          chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Audio decode error: ${message}`);
      }
    });

    socket.addEventListener('close', () => {
      setStatus('Connection closed. Reconnect or refresh the page.');
    });

    socket.addEventListener('error', () => {
      setStatus('Socket error. Please refresh and retry.');
    });
  }, [queueAudioChunk]);

  const startListening = useCallback(async () => {
    try {
      await ensureAudioContext();
      setStatus('Audio unlocked. Listening...');
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        connectSocket();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Audio output unavailable: ${message}`);
    }
  }, [connectSocket, ensureAudioContext]);

  return { status, subtitle, startListening };
}
