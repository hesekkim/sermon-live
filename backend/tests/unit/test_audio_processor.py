import numpy as np
import pytest

from services.audio_processor import AudioProcessor, calculate_audio_level


def pcm16(values: list[int]) -> bytes:
    return np.asarray(values, dtype="<i2").tobytes()


def test_calculates_audio_level_in_dbfs():
    assert calculate_audio_level(np.asarray([0.0, 0.0])) == -60.0
    assert calculate_audio_level(np.asarray([1.0, -1.0])) == 0.0
    assert calculate_audio_level(np.asarray([0.1, -0.1])) == pytest.approx(-20.0)


def test_downmixes_stereo_and_downsamples_in_chunks():
    processor = AudioProcessor(48000, 2, 2, 24000, 1, 2)
    source = np.asarray(
        [[0, 1000], [2000, 3000], [4000, 5000], [6000, 7000]], dtype="<i2"
    )

    output = processor.process(source[:2].tobytes())
    output += processor.process(source[2:].tobytes())

    assert np.frombuffer(output, dtype="<i2").tolist() == [500, 4500]


def test_carries_odd_bytes_until_a_complete_frame_arrives():
    processor = AudioProcessor(16000, 1, 2, 16000, 1, 2)

    assert processor.process(b"\x01") == b""
    assert processor.process(b"\x00\x02\x00") == pcm16([1, 2])


def test_converts_bit_depth_and_channels():
    processor = AudioProcessor(16000, 1, 1, 16000, 2, 2)

    output = processor.process(bytes([128, 255]))

    assert np.frombuffer(output, dtype="<i2").tolist() == [0, 0, 32511, 32511]


def test_resampling_is_independent_of_chunk_boundaries_for_downsampling():
    source = np.arange(2000, dtype="<i2").reshape(-1, 2).tobytes()

    whole_processor = AudioProcessor(44100, 2, 2, 16000, 1, 2)
    whole = whole_processor.process(source) + whole_processor.flush()

    chunked_processor = AudioProcessor(44100, 2, 2, 16000, 1, 2)
    chunked = b"".join(
        chunked_processor.process(source[index : index + 13])
        for index in range(0, len(source), 13)
    ) + chunked_processor.flush()

    assert chunked == whole


def test_flush_emits_resampler_tail():
    processor = AudioProcessor(48000, 1, 2, 24000, 1, 2)

    assert processor.process(pcm16([0, 1000, 2000]))
    assert np.frombuffer(processor.flush(), dtype="<i2").tolist() == [2000]


def test_flush_preserves_linear_interpolation_for_upsampling():
    processor = AudioProcessor(16000, 1, 2, 24000, 1, 2)

    assert np.frombuffer(processor.process(pcm16([0, 1000])), dtype="<i2").tolist() == [0, 667]
    assert np.frombuffer(processor.flush(), dtype="<i2").tolist() == [1000]