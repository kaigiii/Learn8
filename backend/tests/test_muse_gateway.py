import numpy as np

from app.services.neuro.muse_gateway import MuseFrameProcessor


def test_muse_processor_maps_four_channels_to_a_live_frame():
    processor = MuseFrameProcessor()
    samples = np.vstack([
        18 * np.sin(np.linspace(0, 8, 256) + phase)
        for phase in (0.0, 0.6, 1.2, 1.8)
    ])

    processor.push(samples)
    frame = processor.frame()

    assert frame["source"] == "muse-live"
    assert frame["mock"] is False
    assert frame["signal"]["sampleRateHz"] == 256
    assert set(frame["signal"]["channels"]) == {"TP9", "AF7", "AF8", "TP10"}
    assert all(channel["waveform"] for channel in frame["signal"]["channels"].values())
    assert all(channel["rms"] > 0 for channel in frame["signal"]["channels"].values())


def test_muse_processor_requires_all_four_eeg_channels():
    processor = MuseFrameProcessor()
    incomplete = np.zeros((3, 16))

    try:
        processor.push(incomplete)
    except Exception as exc:
        assert "TP9, AF7, AF8 and TP10" in str(exc)
    else:
        raise AssertionError("expected a four-channel validation error")
