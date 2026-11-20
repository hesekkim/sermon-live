from __future__ import annotations

import io
import json
import os
import time
from typing import Iterable

import av
import numpy as np


SAMPLE_RATE = 24_000
CHANNELS = 1
BITRATE = 48_000
PACKET_DURATION_SECONDS = 0.020
SAMPLE_COUNT = SAMPLE_RATE * 8


def synthetic_pcm(duration_seconds: float = 8.0) -> bytes:
    sample_count = int(SAMPLE_RATE * duration_seconds)
    time_axis = np.arange(sample_count, dtype=np.float64) / SAMPLE_RATE
    envelope = 0.35 + 0.65 * np.minimum(time_axis / 0.5, 1.0)
    speech_like = (
        np.sin(2 * np.pi * 220 * time_axis)
        + 0.45 * np.sin(2 * np.pi * 440 * time_axis)
        + 0.20 * np.sin(2 * np.pi * 880 * time_axis)
    )
    syllable = 0.35 + 0.65 * (
        np.sin(2 * np.pi * 5.0 * time_axis) > -0.25
    )
    pcm = np.clip(speech_like * envelope * syllable * 0.20, -1.0, 1.0)
    return (pcm * 32767).astype("<i2").tobytes()


def encode_opus(pcm: bytes) -> tuple[bytes, list[int], float]:
    samples = np.frombuffer(pcm, dtype="<i2").reshape(-1, 1)
    packet_size = int(SAMPLE_RATE * PACKET_DURATION_SECONDS)
    output = io.BytesIO()
    container = av.open(output, mode="w", format="ogg")
    stream = container.add_stream("libopus", rate=SAMPLE_RATE)
    stream.layout = "mono"
    stream.bit_rate = BITRATE
    stream.options = {"frame_duration": "20"}

    packet_sizes: list[int] = []
    started = time.perf_counter()
    for offset in range(0, len(samples), packet_size):
        block = np.ascontiguousarray(samples[offset : offset + packet_size])
        if len(block) < packet_size:
            padding = np.zeros((packet_size - len(block), 1), dtype="<i2")
            block = np.ascontiguousarray(np.vstack((block, padding)))
        frame = av.AudioFrame.from_ndarray(block.T, format="s16", layout="mono")
        frame.sample_rate = SAMPLE_RATE
        for packet in stream.encode(frame):
            packet_sizes.append(packet.size)
            container.mux(packet)
    for packet in stream.encode(None):
        packet_sizes.append(packet.size)
        container.mux(packet)
    container.close()
    elapsed = time.perf_counter() - started
    return output.getvalue(), packet_sizes, elapsed


def decode_opus(encoded: bytes) -> tuple[bytes, int, float]:
    output = bytearray()
    decoded_frames = 0
    started = time.perf_counter()
    with av.open(io.BytesIO(encoded), format="ogg") as container:
        stream = next(stream for stream in container.streams if stream.type == "audio")
        for frame in container.decode(stream):
            samples = frame.to_ndarray()
            if samples.dtype != np.int16:
                samples = (samples * 32767).astype("<i2")
            output.extend(samples.tobytes())
            decoded_frames += 1
    elapsed = time.perf_counter() - started
    return bytes(output), decoded_frames, elapsed


def snr_db(original: bytes, decoded: bytes) -> float:
    original_samples = np.frombuffer(original, dtype="<i2").astype(np.float64)
    decoded_byte_count = min(len(original), len(decoded))
    decoded_samples = np.frombuffer(
        decoded[:decoded_byte_count], dtype="<i2"
    ).astype(np.float64)
    if len(original_samples) != len(decoded_samples):
        return float("-inf")
    noise = original_samples - decoded_samples
    signal_power = np.mean(original_samples**2)
    noise_power = np.mean(noise**2)
    return 10.0 * np.log10(signal_power / noise_power) if noise_power else float("inf")


def main() -> None:
    pcm = synthetic_pcm()
    encoded, packet_sizes, encoder_seconds = encode_opus(pcm)
    decoded, frame_count, decoder_seconds = decode_opus(encoded)

    pcm_duration = len(pcm) / (SAMPLE_RATE * CHANNELS * 2)
    pcm_bitrate = len(pcm) * 8 / pcm_duration
    opus_bitrate = len(encoded) * 8 / pcm_duration
    measured_snr = snr_db(pcm, decoded)

    result = {
        "format": "Ogg/Opus",
        "sample_rate_hz": SAMPLE_RATE,
        "channels": CHANNELS,
        "pcm_width_bits": 16,
        "pcm_duration_seconds": round(pcm_duration, 3),
        "pcm_baseline_bps": int(pcm_bitrate),
        "opus_encoded_bytes": len(encoded),
        "opus_wire_bps_including_container": int(opus_bitrate),
        "opus_target_bps": BITRATE,
        "packet_count": len(packet_sizes),
        "packet_size_min_bytes": min(packet_sizes, default=0),
        "packet_size_max_bytes": max(packet_sizes, default=0),
        "decoded_frames": frame_count,
        "snr_db": round(measured_snr, 2),
        "encoder_seconds": round(encoder_seconds, 6),
        "decoder_seconds": round(decoder_seconds, 6),
        "decoded_bytes": len(decoded),
        "decoded_without_error": frame_count > 0 and len(decoded) > 0,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
