#!/usr/bin/env python3
"""Create original Nabihalmang cry and Jeju volcanic entrance sound effects."""

from __future__ import annotations

import pathlib

import numpy as np
import soundfile as sf
from scipy import signal


SR = 48_000
DURATION = 30.0
N = int(SR * DURATION)
RNG = np.random.default_rng(20260808)


def envelope(length: int, attack: float, release: float, power: float = 1.0) -> np.ndarray:
    env = np.ones(length, dtype=np.float64)
    a = min(length, max(1, int(attack * SR)))
    r = min(length, max(1, int(release * SR)))
    env[:a] = np.linspace(0, 1, a) ** power
    env[-r:] = np.linspace(1, 0, r) ** power
    return env


def pan(mono: np.ndarray, position: float = 0.0) -> np.ndarray:
    position = float(np.clip(position, -1, 1))
    angle = (position + 1) * np.pi / 4
    return np.column_stack((mono * np.cos(angle), mono * np.sin(angle)))


def put(bus: np.ndarray, sound: np.ndarray, start: float) -> None:
    index = max(0, int(start * SR))
    if sound.ndim == 1:
        sound = pan(sound)
    end = min(N, index + len(sound))
    if end > index:
        bus[index:end] += sound[: end - index]


def filtered_noise(seconds: float, low: float | None = None, high: float | None = None) -> np.ndarray:
    length = int(seconds * SR)
    x = RNG.normal(0, 1, length)
    if low is not None and high is not None:
        sos = signal.butter(4, (low, high), btype="bandpass", fs=SR, output="sos")
    elif low is not None:
        sos = signal.butter(4, low, btype="highpass", fs=SR, output="sos")
    elif high is not None:
        sos = signal.butter(4, high, btype="lowpass", fs=SR, output="sos")
    else:
        return x
    return signal.sosfilt(sos, x)


def volcanic_wind() -> np.ndarray:
    base = filtered_noise(DURATION, low=90, high=2200)
    slow = signal.sosfilt(signal.butter(2, 0.6, btype="lowpass", fs=SR, output="sos"), RNG.normal(0, 1, N))
    slow /= np.max(np.abs(slow)) + 1e-9
    mono = base * (0.12 + 0.055 * slow)
    # Slightly decorrelated right channel creates a broad crater ambience.
    right = np.roll(mono, 317) * 0.96
    return np.column_stack((mono, right))


def low_rumble(seconds: float, strength: float = 1.0) -> np.ndarray:
    length = int(seconds * SR)
    t = np.arange(length) / SR
    noise = filtered_noise(seconds, high=95)
    tone = np.sin(2 * np.pi * (38 * t + 2.2 * np.sin(2 * np.pi * 0.16 * t)))
    mono = (0.48 * noise + 0.30 * tone) * envelope(length, .4, 1.2, 1.5) * strength
    return pan(mono)


def energy_hum(seconds: float) -> np.ndarray:
    length = int(seconds * SR)
    t = np.arange(length) / SR
    glide = 92 + 54 * (t / max(seconds, .01)) ** 1.7
    phase = 2 * np.pi * np.cumsum(glide) / SR
    mono = (np.sin(phase) + .38 * np.sin(2.01 * phase) + .18 * np.sin(3.96 * phase))
    mono *= (.15 + .65 * (t / seconds) ** 2) * envelope(length, .8, .25)
    shimmer = filtered_noise(seconds, low=2600, high=7600) * (.01 + .08 * (t / seconds) ** 3)
    return pan(mono + shimmer, .05)


def impact_shatter() -> np.ndarray:
    seconds = 3.2
    length = int(seconds * SR)
    t = np.arange(length) / SR
    burst = filtered_noise(seconds, low=180, high=12_000) * np.exp(-t * 5.5)
    sub = np.sin(2 * np.pi * (48 * t - 8 * t * t)) * np.exp(-t * 2.2)
    metal = np.zeros(length)
    for freq, amp, decay in ((730, .38, 4.2), (1110, .26, 5.1), (1870, .16, 6.4), (2630, .10, 7.2)):
        metal += amp * np.sin(2 * np.pi * freq * t) * np.exp(-t * decay)
    mono = .62 * burst + .75 * sub + metal
    stereo = pan(mono, -.05)
    # A short reflected crack from the opposite crater wall.
    echo = np.zeros_like(stereo)
    delay = int(.17 * SR)
    echo[delay:] = stereo[:-delay, ::-1] * .34
    return stereo + echo


def wing_whoosh(seconds: float = 1.0, direction: float = 0.0) -> np.ndarray:
    length = int(seconds * SR)
    t = np.arange(length) / SR
    noise = filtered_noise(seconds, low=90, high=1800)
    swell = np.sin(np.pi * np.clip(t / seconds, 0, 1)) ** 2
    low = np.sin(2 * np.pi * (74 + 18 * t) * t) * swell
    return pan((.34 * noise + .28 * low) * swell, direction)


def fairy_chime(root: float, seconds: float = 2.3, position: float = 0.0) -> np.ndarray:
    length = int(seconds * SR)
    t = np.arange(length) / SR
    mono = np.zeros(length)
    for ratio, amp, decay in ((1, .38, 2.1), (1.5, .25, 2.8), (2.01, .18, 3.7), (2.67, .10, 4.5)):
        mono += amp * np.sin(2 * np.pi * root * ratio * t) * np.exp(-t * decay)
    return pan(mono * envelope(length, .008, .8), position)


def nabihalmang_cry(seconds: float = 2.9, intensity: float = 1.0) -> np.ndarray:
    """A nonverbal metallic-moth legendary cry: ascent, tremolo, noble fall."""
    length = int(seconds * SR)
    t = np.arange(length) / SR
    # Three-stage contour: awakening rise, held call, resolving fall.
    freq = np.empty(length)
    a = int(.78 * SR)
    b = int(1.72 * SR)
    freq[:a] = np.linspace(210, 510, a)
    freq[a:b] = 510 + 22 * np.sin(2 * np.pi * 5.2 * t[a:b])
    freq[b:] = np.linspace(480, 285, length - b)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    tremolo = .72 + .28 * np.sin(2 * np.pi * (27 + 8 * t) * t)
    voice = (np.sin(phase) + .43 * np.sin(2 * phase + .2) + .22 * np.sin(3 * phase + .6)) * tremolo
    airy = filtered_noise(seconds, low=800, high=6800)
    airy *= .10 + .17 * np.sin(np.pi * t / seconds) ** 2
    plate = .12 * np.sin(2 * np.pi * 1320 * t) * np.exp(-t * .65)
    mono = (voice * .34 + airy + plate) * envelope(length, .055, .72, 1.4) * intensity
    stereo = pan(mono, 0)
    delay = int(.083 * SR)
    stereo[delay:, 1] += mono[:-delay] * .22
    delay2 = int(.147 * SR)
    stereo[delay2:, 0] += mono[:-delay2] * .15
    return stereo


def steam_burst(seconds: float = 1.6, position: float = 0.0) -> np.ndarray:
    length = int(seconds * SR)
    noise = filtered_noise(seconds, low=450, high=7800)
    return pan(noise * .19 * envelope(length, .08, 1.25, 1.8), position)


def main() -> None:
    output_dir = pathlib.Path(__file__).resolve().parent / "audio"
    output_dir.mkdir(parents=True, exist_ok=True)

    ambience = volcanic_wind()
    put(ambience, low_rumble(8.5, .55), 0.0)
    put(ambience, low_rumble(10.0, .82), 5.2)
    put(ambience, low_rumble(9.0, .44), 20.5)
    for when, pos in ((1.0, -.7), (6.7, .65), (18.5, -.5), (23.2, .72)):
        put(ambience, steam_burst(position=pos), when)

    effects = np.zeros((N, 2), dtype=np.float64)
    put(effects, energy_hum(8.0), 4.6)
    put(effects, impact_shatter(), 11.65)
    put(effects, nabihalmang_cry(3.1, 1.0), 11.95)
    for when, pos in ((15.8, -.3), (16.9, .3), (18.1, -.15), (24.2, -.35), (25.3, .35), (26.4, 0)):
        put(effects, wing_whoosh(1.2, pos), when)
    for index, when in enumerate((12.0, 13.0, 17.2, 20.9, 24.9, 27.6)):
        put(effects, fairy_chime(660 * (1 + .07 * index), 2.2, (-1) ** index * .32), when)
    put(effects, nabihalmang_cry(2.7, .83), 26.8)
    put(effects, low_rumble(3.0, .8), 27.0)

    # Keep plenty of headroom for the game BGM during the final mix.
    ambience *= .34 / (np.max(np.abs(ambience)) + 1e-9)
    effects *= .70 / (np.max(np.abs(effects)) + 1e-9)
    sf.write(output_dir / "jeju_crater_ambience.wav", ambience.astype(np.float32), SR, subtype="FLOAT")
    sf.write(output_dir / "nabihalmang_entrance_sfx.wav", effects.astype(np.float32), SR, subtype="FLOAT")
    sf.write(output_dir / "nabihalmang_cry.wav", nabihalmang_cry(3.1).astype(np.float32), SR, subtype="FLOAT")
    print(output_dir)


if __name__ == "__main__":
    main()
