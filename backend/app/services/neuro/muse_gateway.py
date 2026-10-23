"""Muse 2 BLE → Learn8 WebSocket frame adapter.

This module intentionally has no import-time BLE dependency.  The main Learn8
server therefore starts normally unless the presenter explicitly enables the
gateway and installs ``requirements-muse.txt`` on the computer paired with the
headband.  No raw EEG samples are persisted; the gateway only keeps bounded
in-memory windows needed for the live display and rolling metrics.

The acquisition conventions mirror ``muse2`` in this repository:
TP9, AF7, AF8, TP10 at 256 Hz, one-second FFT windows, a ten-second rolling
metric window, and RMS-based contact quality.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from math import isfinite
from threading import Event, RLock, Thread, current_thread
from time import monotonic
from typing import Any


CHANNELS = ("TP9", "AF7", "AF8", "TP10")
SAMPLE_RATE_HZ = 256
WAVEFORM_SAMPLES = 100
METRIC_WINDOW_SECONDS = 10


class MuseGatewayError(RuntimeError):
    """An actionable gateway error suitable for a WebSocket status payload."""


def _quality_from_rms(rms: float) -> str:
    # Same thresholds used by muse2/src/signal_monitor/hardware/monitor_raw.py.
    if rms < 1.0 or rms > 120.0:
        return "poor"
    if rms <= 45.0:
        return "good"
    return "fair"


def _finite_or_none(value: float) -> float | None:
    return round(float(value), 4) if isfinite(float(value)) else None


@dataclass
class MuseConnection:
    name: str
    address: str


class MuseFrameProcessor:
    """Bounded raw-sample processor producing the frontend NeuroFrame schema."""

    def __init__(self) -> None:
        self._lock = RLock()
        self.buffers = {channel: deque(maxlen=SAMPLE_RATE_HZ * METRIC_WINDOW_SECONDS) for channel in CHANNELS}
        self.ei_history: deque[float] = deque(maxlen=METRIC_WINDOW_SECONDS)
        self.faa_history: deque[float] = deque(maxlen=METRIC_WINDOW_SECONDS)
        self.blink_history: deque[int] = deque(maxlen=METRIC_WINDOW_SECONDS)
        self.baseline_ei: float | None = None
        self.baseline_faa: float | None = None
        self.sequence = 0
        self.last_metric_second = -1
        self.started_at = monotonic()
        self.last_sample_at: float | None = None

    def push(self, data: Any) -> None:
        """Accept muselsl's ``(channels, samples)`` EEG callback matrix."""
        with self._lock:
            try:
                for index, channel in enumerate(CHANNELS):
                    self.buffers[channel].extend(float(value) for value in data[index, :])
            except (IndexError, TypeError) as exc:
                raise MuseGatewayError("Muse EEG callback did not include TP9, AF7, AF8 and TP10.") from exc
            self.last_sample_at = monotonic()

    @staticmethod
    def _power_band(samples: Any, sample_rate: int, low_hz: int, high_hz: int) -> float:
        import numpy as np

        if len(samples) < sample_rate:
            return float("nan")
        window = np.asarray(list(samples)[-sample_rate:], dtype=float)
        window = window - np.mean(window)
        spectrum = np.fft.rfft(window * np.hanning(sample_rate))
        power = np.square(np.abs(spectrum))
        frequencies = np.fft.rfftfreq(sample_rate, 1 / sample_rate)
        return float(power[(frequencies >= low_hz) & (frequencies <= high_hz)].sum())

    def _metric_second(self) -> tuple[float | None, float | None, float | None]:
        """Compute Muse2-aligned EI, FAA and a local robust blink-rate estimate."""
        import numpy as np

        if min(len(values) for values in self.buffers.values()) < SAMPLE_RATE_HZ:
            return None, None, None
        alpha_tp9 = self._power_band(self.buffers["TP9"], SAMPLE_RATE_HZ, 8, 12)
        alpha_tp10 = self._power_band(self.buffers["TP10"], SAMPLE_RATE_HZ, 8, 12)
        alpha_af7 = self._power_band(self.buffers["AF7"], SAMPLE_RATE_HZ, 8, 12)
        alpha_af8 = self._power_band(self.buffers["AF8"], SAMPLE_RATE_HZ, 8, 12)
        theta_af7 = self._power_band(self.buffers["AF7"], SAMPLE_RATE_HZ, 4, 7)
        theta_af8 = self._power_band(self.buffers["AF8"], SAMPLE_RATE_HZ, 4, 7)
        beta_af7 = self._power_band(self.buffers["AF7"], SAMPLE_RATE_HZ, 13, 30)
        beta_af8 = self._power_band(self.buffers["AF8"], SAMPLE_RATE_HZ, 13, 30)
        denominator = alpha_tp9 + alpha_tp10 + theta_af7 + theta_af8
        ei = (beta_af7 + beta_af8) / denominator if denominator > 0 else float("nan")
        faa = float(np.log(alpha_af8) - np.log(alpha_af7)) if alpha_af7 > 0 and alpha_af8 > 0 else float("nan")

        # A bounded real-time estimate: robust amplitude threshold and a 300 ms
        # refractory period.  Offline analysis in muse2 additionally uses a
        # zero-phase 0.5–5 Hz filter; that requires future samples and is not
        # suitable for a strictly live frame.
        frontal = (np.asarray(list(self.buffers["AF7"])[-SAMPLE_RATE_HZ:], dtype=float) + np.asarray(list(self.buffers["AF8"])[-SAMPLE_RATE_HZ:], dtype=float)) / 2
        centered = frontal - np.median(frontal)
        robust_sigma = 1.4826 * np.median(np.abs(centered))
        threshold = max(3.0 * robust_sigma, 8.0)
        candidates = np.flatnonzero(np.abs(centered) >= threshold)
        minimum_distance = int(SAMPLE_RATE_HZ * 0.3)
        blink_count = 0
        previous = -minimum_distance
        for index in candidates:
            if int(index) - previous >= minimum_distance:
                blink_count += 1
                previous = int(index)
        return _finite_or_none(ei), _finite_or_none(faa), float(blink_count)

    def _update_metrics(self) -> None:
        elapsed_second = int(monotonic() - self.started_at)
        if elapsed_second == self.last_metric_second:
            return
        self.last_metric_second = elapsed_second
        ei, faa, blinks = self._metric_second()
        if ei is not None:
            self.ei_history.append(ei)
        if faa is not None:
            self.faa_history.append(faa)
        if blinks is not None:
            self.blink_history.append(int(blinks))
        if len(self.ei_history) >= METRIC_WINDOW_SECONDS and self.baseline_ei is None:
            self.baseline_ei = sum(self.ei_history) / len(self.ei_history)
        if len(self.faa_history) >= METRIC_WINDOW_SECONDS and self.baseline_faa is None:
            self.baseline_faa = sum(self.faa_history) / len(self.faa_history)

    def frame(self) -> dict[str, Any]:
        import numpy as np

        with self._lock:
            self._update_metrics()
            self.sequence += 1
            now_ms = int((monotonic() - self.started_at) * 1000)
            stalled = self.last_sample_at is None or monotonic() - self.last_sample_at > 2
            channels: dict[str, Any] = {}
            good_contacts = 0
            for channel, buffer in self.buffers.items():
                values = np.asarray(buffer, dtype=float)
                if values.size:
                    centered = values - values.mean()
                    rms = float(np.sqrt(np.mean(np.square(centered))))
                    peak_to_peak = float(values.max() - values.min())
                    waveform = [round(float(value), 3) for value in values[-WAVEFORM_SAMPLES:]]
                    quality = _quality_from_rms(rms)
                else:
                    rms = peak_to_peak = 0.0
                    waveform = []
                    quality = "unknown"
                if quality == "good":
                    good_contacts += 1
                channels[channel] = {"waveform": waveform, "rms": round(rms, 3), "peakToPeak": round(peak_to_peak, 3), "quality": quality}

            quality_gate = not stalled and good_contacts >= 3 and self.baseline_ei is not None
            ei = sum(self.ei_history) / len(self.ei_history) if self.ei_history else None
            faa = sum(self.faa_history) / len(self.faa_history) if self.faa_history else None
            bpm = (sum(self.blink_history) * 60 / len(self.blink_history)) if self.blink_history else None
            relative_ei = ((ei / self.baseline_ei) - 1) if ei is not None and self.baseline_ei else 0.0
            relative_faa = (faa - self.baseline_faa) if faa is not None and self.baseline_faa is not None else 0.0
            engagement = max(0.0, min(100.0, 50.0 + relative_ei * 125.0)) if quality_gate else None
            approach = max(0.0, min(100.0, 50.0 + relative_faa * 35.0)) if quality_gate else None
            fatigue = max(0.0, min(100.0, 50.0 - relative_ei * 90.0)) if quality_gate else None
            state = "poor_signal" if stalled or good_contacts < 3 else "calibrating" if not quality_gate else "focused" if engagement is not None and engagement >= 58 else "distracted" if engagement is not None and engagement <= 42 else "recovered"
            overall_quality = "poor" if good_contacts < 2 else "fair" if good_contacts < 4 else "good"
            return {
            "schemaVersion": "1.0", "sessionId": "muse-live", "sequence": self.sequence, "timestampMs": now_ms,
            "source": "muse-live", "mock": False,
            "connection": "stalled" if stalled else "connected",
            "signal": {"sampleRateHz": SAMPLE_RATE_HZ, "overallQuality": overall_quality, "channels": channels},
            "metrics": {
                "engagementIndex": _finite_or_none(ei) if ei is not None else None,
                "frontalAlphaAsymmetry": _finite_or_none(faa) if faa is not None else None,
                "blinkRatePerMinute": _finite_or_none(bpm) if bpm is not None else None,
                # There is no trained interest classifier in the live gateway.
                "interestProbability": None,
            },
            "normalized": {"engagement": _finite_or_none(engagement) if engagement is not None else None, "approach": _finite_or_none(approach) if approach is not None else None, "fatigue": _finite_or_none(fatigue) if fatigue is not None else None},
            "inferredState": state, "confidence": 0.72 if quality_gate else None, "qualityGatePassed": quality_gate,
            }


class MuseGatewaySession:
    """Owns one BLE connection and exposes bounded frames to the API endpoint."""

    def __init__(self) -> None:
        self.processor = MuseFrameProcessor()
        self.connection: MuseConnection | None = None
        self._muse: Any = None
        self._worker: Thread | None = None
        self._stop = Event()
        self._ready = Event()
        self._error: MuseGatewayError | None = None

    def connect(self, address: str | None = None, name: str | None = None) -> MuseConnection:
        if self._worker and self._worker.is_alive():
            if self.connection is None:
                raise MuseGatewayError("Muse connection is still starting.")
            return self.connection
        self._stop.clear()
        self._ready.clear()
        self._error = None
        self._worker = Thread(target=self._run, args=(address, name), name="learn8-muse-ble", daemon=True)
        self._worker.start()
        if not self._ready.wait(timeout=20):
            self.close()
            raise MuseGatewayError("Muse connection timed out after 20 seconds.")
        if self._error:
            raise self._error
        if self.connection is None:
            raise MuseGatewayError("Muse connection stopped before streaming began.")
        return self.connection

    def _run(self, address: str | None, name: str | None) -> None:
        try:
            from muselsl import backends, list_muses
            from muselsl.muse import Muse
        except ImportError as exc:
            self._error = MuseGatewayError("Muse gateway dependencies are missing. Install: pip install -r backend/requirements-muse.txt")
            self._ready.set()
            return
        try:
            if not address:
                devices = list_muses(backend="bleak") or []
                if not devices:
                    raise MuseGatewayError("No Muse device found. Turn on the headband and make sure no phone app is connected.")
                device = devices[0]
                address = str(device.get("address", ""))
                name = name or str(device.get("name", "Muse"))
            self.connection = MuseConnection(name=name or "Muse", address=address)
            self._muse = Muse(address=address, name=self.connection.name, callback_eeg=self._on_eeg, backend="bleak")
            if not self._muse.connect(retries=3):
                raise MuseGatewayError("Muse connection failed. Check Bluetooth and make sure the device is not in use by another app.")
            self._muse.start()
            self._ready.set()
            # muselsl's bleak backend dispatches BLE notifications only while
            # its sleep helper pumps the event loop. Keep connect, pump and
            # callback on this one worker thread, exactly as muse2 does.
            while not self._stop.is_set():
                backends.sleep(0.02)
        except MuseGatewayError as exc:
            self._error = exc
        except Exception as exc:
            self._error = MuseGatewayError(f"Muse connection failed: {exc}")
        finally:
            self._ready.set()
            muse, self._muse = self._muse, None
            if muse:
                try:
                    muse.stop()
                    muse.disconnect()
                except Exception:
                    pass

    def _on_eeg(self, data: Any, _timestamps: Any) -> None:
        self.processor.push(data)

    def close(self) -> None:
        self._stop.set()
        worker = self._worker
        if worker and worker is not current_thread():
            worker.join(timeout=3)
        self._worker = None
