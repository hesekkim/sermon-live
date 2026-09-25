from __future__ import annotations

import numpy as np


AUDIO_LEVEL_FLOOR_DBFS = -60.0


def calculate_audio_level(samples: np.ndarray) -> float:
    if samples.size == 0:
        return AUDIO_LEVEL_FLOOR_DBFS
    rms = float(np.sqrt(np.mean(np.square(samples))))
    if rms == 0.0:
        return AUDIO_LEVEL_FLOOR_DBFS
    return float(max(AUDIO_LEVEL_FLOOR_DBFS, 20.0 * np.log10(rms)))


class AudioProcessor:
    def __init__(
        self,
        source_rate: int,
        source_channels: int,
        source_width: int,
        target_rate: int,
        target_channels: int,
        target_width: int,
    ) -> None:
        if min(
            source_rate,
            source_channels,
            source_width,
            target_rate,
            target_channels,
            target_width,
        ) <= 0:
            raise ValueError("Audio format values must be positive")
        if source_width not in (1, 2, 3, 4) or target_width not in (1, 2, 3, 4):
            raise ValueError("PCM sample width must be between 1 and 4 bytes")
        self._source_rate = source_rate
        self._source_channels = source_channels
        self._source_width = source_width
        self._target_rate = target_rate
        self._target_channels = target_channels
        self._target_width = target_width
        self._pending_bytes = b""
        self._resample_buffer = np.empty((0, target_channels), dtype=np.float64)
        self._source_position = 0.0
        self._input_level_dbfs: float | None = None

    @property
    def input_level_dbfs(self) -> float | None:
        return self._input_level_dbfs

    def process(self, chunk: bytes) -> bytes:
        if not chunk:
            return b""
        frame_size = self._source_channels * self._source_width
        data = self._pending_bytes + chunk
        complete_size = len(data) - (len(data) % frame_size)
        self._pending_bytes = data[complete_size:]
        if complete_size == 0:
            return b""

        samples = self._decode(data[:complete_size], self._source_width)
        self._input_level_dbfs = calculate_audio_level(samples)
        samples = samples.reshape(-1, self._source_channels)
        samples = self._convert_channels(samples)
        if self._source_rate == self._target_rate:
            return self._encode(samples, self._target_width)

        self._resample_buffer = np.concatenate((self._resample_buffer, samples))
        step = self._source_rate / self._target_rate
        output: list[np.ndarray] = []
        while self._source_position + 1 < len(self._resample_buffer):
            index = int(self._source_position)
            fraction = self._source_position - index
            output.append(
                self._resample_buffer[index]
                + fraction
                * (self._resample_buffer[index + 1] - self._resample_buffer[index])
            )
            self._source_position += step

        consumed = min(int(self._source_position), len(self._resample_buffer) - 1)
        if consumed:
            self._resample_buffer = self._resample_buffer[consumed:]
            self._source_position -= consumed
        if not output:
            return b""
        return self._encode(np.asarray(output), self._target_width)

    def flush(self) -> bytes:
        self._pending_bytes = b""
        if self._source_rate == self._target_rate or len(self._resample_buffer) == 0:
            return b""

        output: list[np.ndarray] = []
        while self._source_position < len(self._resample_buffer):
            index = min(int(self._source_position), len(self._resample_buffer) - 1)
            fraction = self._source_position - index
            if index + 1 < len(self._resample_buffer):
                sample = self._resample_buffer[index] + fraction * (
                    self._resample_buffer[index + 1]
                    - self._resample_buffer[index]
                )
            else:
                sample = self._resample_buffer[index]
            output.append(sample)
            if index == len(self._resample_buffer) - 1:
                break
            self._source_position += self._source_rate / self._target_rate

        self._resample_buffer = np.empty(
            (0, self._target_channels), dtype=np.float64
        )
        self._source_position = 0.0
        if not output:
            return b""
        return self._encode(np.asarray(output), self._target_width)

    @staticmethod
    def _decode(data: bytes, width: int) -> np.ndarray:
        if width == 1:
            values = np.frombuffer(data, dtype=np.uint8).astype(np.float64)
            return (values - 128.0) / 128.0
        if width == 2:
            values = np.frombuffer(data, dtype="<i2").astype(np.float64)
            return values / 32768.0
        if width == 4:
            values = np.frombuffer(data, dtype="<i4").astype(np.float64)
            return values / 2147483648.0

        raw = np.frombuffer(data, dtype=np.uint8).reshape(-1, 3)
        values = (
            raw[:, 0].astype(np.int32)
            | (raw[:, 1].astype(np.int32) << 8)
            | (raw[:, 2].astype(np.int32) << 16)
        )
        values[values >= 0x800000] -= 0x1000000
        return values.astype(np.float64) / 8388608.0

    def _convert_channels(self, samples: np.ndarray) -> np.ndarray:
        if self._source_channels == self._target_channels:
            return samples
        if self._target_channels == 1:
            return samples.mean(axis=1, keepdims=True)
        if self._source_channels == 1:
            return np.repeat(samples, self._target_channels, axis=1)
        if self._target_channels < self._source_channels:
            return samples[:, : self._target_channels]
        repeats = self._target_channels // self._source_channels
        remainder = self._target_channels % self._source_channels
        expanded = np.tile(samples, (1, repeats))
        if remainder:
            expanded = np.concatenate((expanded, samples[:, :remainder]), axis=1)
        return expanded

    @staticmethod
    def _encode(samples: np.ndarray, width: int) -> bytes:
        samples = np.clip(samples, -1.0, 1.0)
        if width == 1:
            values = np.rint(samples * 127.0 + 128.0).astype(np.uint8)
        elif width == 2:
            values = np.rint(samples * 32767.0).astype("<i2")
        elif width == 4:
            values = np.rint(samples * 2147483647.0).astype("<i4")
        else:
            integer = np.rint(samples * 8388607.0).astype(np.int32)
            values = np.empty((*integer.shape, 3), dtype=np.uint8)
            values[..., 0] = integer & 0xFF
            values[..., 1] = (integer >> 8) & 0xFF
            values[..., 2] = (integer >> 16) & 0xFF
            return values.tobytes()
        return values.tobytes()