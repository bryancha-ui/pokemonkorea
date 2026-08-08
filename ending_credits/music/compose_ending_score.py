#!/usr/bin/env python3
"""Compose a five-minute Pokemon Korea ending score as a multitrack MIDI file.

The score uses the source ending theme's measured pulse (96 BPM), B-flat-major
tonal center, and E-flat/F/G-minor color.  It is a newly structured 120-bar
arrangement synchronized to the finished 300-second ending video.
"""

from __future__ import annotations

import pathlib
import struct


PPQ = 480
BPM = 96
TOTAL_BARS = 120
TOTAL_BEATS = TOTAL_BARS * 4


TRACKS = {
    "piano": (0, 0),
    "zither": (107, 1),
    "celesta": (8, 2),
    "strings": (48, 3),
    "pizzicato": (45, 4),
    "flute": (73, 5),
    "horn": (60, 6),
    "choir": (52, 7),
    "bass": (32, 8),
    "warm_pad": (89, 10),
    "timpani": (47, 11),
    "drums": (0, 9),
}


CHORDS = {
    "Bb": (58, 62, 65, 70),
    "BbD": (50, 58, 62, 65),
    "F": (53, 57, 60, 65),
    "Gm": (55, 58, 62, 67),
    "Eb": (51, 55, 58, 63),
    "Cm": (48, 51, 55, 60),
    "Dm": (50, 53, 57, 62),
    "D7": (50, 54, 57, 60),
    "Ab": (56, 60, 63, 68),
}

ROOTS = {
    "Bb": 34,
    "BbD": 38,
    "F": 29,
    "Gm": 31,
    "Eb": 27,
    "Cm": 36,
    "Dm": 38,
    "D7": 38,
    "Ab": 32,
}


SECTIONS = [
    (0, "Dawn — quiet departure"),
    (12, "Morning — fields and small Pokemon"),
    (36, "Day — city and coast"),
    (60, "Dusk — volcanic road and spirits"),
    (84, "Night — Baekdu tension"),
    (92, "Climax — Hwanung and Nabihalmang"),
    (104, "Release — descent toward dawn"),
    (108, "Credits — homeward reprise"),
    (120, "The End"),
]


def vlq(value: int) -> bytes:
    out = [value & 0x7F]
    value >>= 7
    while value:
        out.append((value & 0x7F) | 0x80)
        value >>= 7
    return bytes(reversed(out))


class MidiTrack:
    def __init__(self, name: str, program: int, channel: int):
        self.name = name
        self.program = program
        self.channel = channel
        self.events: list[tuple[int, int, bytes]] = []

    def raw(self, beat: float, priority: int, payload: bytes) -> None:
        tick = max(0, round(beat * PPQ))
        self.events.append((tick, priority, payload))

    def note(self, start: float, duration: float, pitch: int, velocity: int) -> None:
        velocity = max(1, min(127, round(velocity)))
        pitch = max(0, min(127, round(pitch)))
        self.raw(start, 1, bytes((0x90 | self.channel, pitch, velocity)))
        self.raw(start + duration, 0, bytes((0x80 | self.channel, pitch, 0)))

    def cc(self, beat: float, controller: int, value: int) -> None:
        self.raw(beat, -2, bytes((0xB0 | self.channel, controller, value)))

    def chunk(self) -> bytes:
        name = self.name.encode("utf-8")
        prefix = vlq(0) + bytes((0xFF, 0x03)) + vlq(len(name)) + name
        prefix += vlq(0) + bytes((0xC0 | self.channel, self.program))
        body = bytearray(prefix)
        last_tick = 0
        for tick, _, payload in sorted(self.events, key=lambda event: (event[0], event[1])):
            body.extend(vlq(tick - last_tick))
            body.extend(payload)
            last_tick = tick
        end_tick = TOTAL_BEATS * PPQ
        body.extend(vlq(max(0, end_tick - last_tick)))
        body.extend(b"\xFF\x2F\x00")
        return b"MTrk" + struct.pack(">I", len(body)) + body


tracks = {name: MidiTrack(name, *settings) for name, settings in TRACKS.items()}


def add_chord(track: str, start: float, duration: float, chord: str, velocity: int,
              octave_shift: int = 0, spread: bool = False) -> None:
    notes = list(CHORDS[chord])
    if spread:
        notes[-1] += 12
    for pitch in notes:
        tracks[track].note(start, duration, pitch + octave_shift, velocity)


def add_sequence(track: str, start: float, sequence, velocity: int,
                 transpose: int = 0, legato: float = 0.94) -> None:
    for offset, duration, pitch, accent in sequence:
        tracks[track].note(start + offset, duration * legato, pitch + transpose,
                           velocity + accent)


def add_arp(track: str, bar: int, chord: str, velocity: int, pattern=None) -> None:
    notes = CHORDS[chord]
    pattern = pattern or (0, 1, 2, 3, 2, 1, 2, 3)
    start = bar * 4
    for index, tone in enumerate(pattern):
        pitch = notes[tone] + (12 if index in (3, 7) else 0)
        tracks[track].note(start + index * 0.5, 0.42, pitch, velocity + (4 if index % 2 == 0 else 0))


def add_strum(track: str, bar: int, chord: str, velocity: int) -> None:
    notes = CHORDS[chord]
    start = bar * 4
    for beat in (0, 1.5, 2.5):
        for index, pitch in enumerate(notes[1:]):
            tracks[track].note(start + beat + index * 0.035, 0.75, pitch + 12, velocity - index * 2)


def add_bass(bar: int, chord: str, velocity: int, moving: bool = False) -> None:
    root = ROOTS[chord]
    fifth = root + 7
    start = bar * 4
    if moving:
        for offset, pitch in ((0, root), (1, root + 12), (2, fifth), (3, root + 12)):
            tracks["bass"].note(start + offset, 0.86, pitch, velocity)
    else:
        tracks["bass"].note(start, 1.85, root, velocity)
        tracks["bass"].note(start + 2, 1.85, fifth, velocity - 5)


def drum(bar: int, intensity: int, crash: bool = False, half_time: bool = False) -> None:
    start = bar * 4
    if crash:
        tracks["drums"].note(start, 0.35, 49, min(120, intensity + 25))
    # GM: kick 36, snare 38, closed hat 42, open hat 46, ride 51.
    for index in range(8):
        tracks["drums"].note(start + index * 0.5, 0.16, 42,
                              max(20, intensity - 25 + (5 if index % 2 == 0 else 0)))
    tracks["drums"].note(start, 0.18, 36, intensity)
    tracks["drums"].note(start + (2 if half_time else 1), 0.18, 38, intensity - 8)
    if not half_time:
        tracks["drums"].note(start + 2, 0.18, 36, intensity - 4)
        tracks["drums"].note(start + 3, 0.18, 38, intensity - 5)
    else:
        tracks["drums"].note(start + 3.5, 0.2, 46, intensity - 18)


THEME_A = [
    (0, .5, 65, 0), (.5, .5, 70, 5), (1, 1, 74, 3), (2, 1, 77, 7), (3, 1, 79, 8),
    (4, 1, 77, 3), (5, 1, 74, 0), (6, 1, 72, -2), (7, 1, 70, 2),
    (8, 1, 75, 4), (9, 1, 77, 5), (10, 2, 79, 8),
    (12, 1, 77, 4), (13, 1, 74, 1), (14, 1, 72, -1), (15, 1, 70, 4),
]

THEME_A2 = [
    (0, 1, 70, 1), (1, .5, 72, 1), (1.5, .5, 74, 3), (2, 1, 77, 5), (3, 1, 74, 1),
    (4, 1, 72, 0), (5, 1, 70, 2), (6, 2, 67, -1),
    (8, .5, 70, 2), (8.5, .5, 74, 4), (9, 1, 77, 6), (10, 1, 79, 8), (11, 1, 81, 9),
    (12, 1, 79, 6), (13, 1, 77, 3), (14, 2, 74, 5),
]

THEME_MINOR = [
    (0, 1, 67, 1), (1, 1, 70, 3), (2, 1, 74, 5), (3, 1, 77, 7),
    (4, 2, 79, 8), (6, 1, 77, 3), (7, 1, 74, 1),
    (8, 1, 75, 4), (9, 1, 74, 2), (10, 2, 70, 3),
    (12, .5, 69, 0), (12.5, .5, 70, 1), (13, 1, 74, 5), (14, 2, 66, 7),
]

THEME_CLIMAX = [
    (0, .5, 67, 2), (.5, .5, 70, 4), (1, 1, 74, 6), (2, 1, 79, 9), (3, 1, 81, 10),
    (4, 1, 82, 12), (5, 1, 81, 9), (6, 2, 79, 7),
    (8, .5, 75, 4), (8.5, .5, 77, 5), (9, 1, 79, 7), (10, 1, 82, 12), (11, 1, 81, 10),
    (12, 1, 79, 8), (13, 1, 77, 5), (14, 2, 74, 7),
]


section_1 = ["Eb", "BbD", "Cm", "Ab", "Eb", "Bb", "Gm", "F", "Cm", "Eb", "F", "Bb"]
section_2 = (["Bb", "F", "Gm", "Eb"] * 3 + ["Cm", "Gm", "Eb", "F"]
             + ["Bb", "F", "Gm", "Eb"] + ["Cm", "F", "Bb", "F"])
section_3 = (["Eb", "BbD", "F", "Gm", "Eb", "Cm", "F", "Bb"] * 2
             + ["Eb", "F", "Dm", "Gm", "Cm", "F", "Bb", "Bb"])
section_4 = ["Gm", "Eb", "Bb", "F", "Gm", "Eb", "Cm", "D7"] * 3
section_5 = ["Gm", "F", "Eb", "D7"] * 2
section_6 = ["Gm", "Eb", "Bb", "F", "Cm", "Eb", "D7", "Gm", "Eb", "F", "Gm", "D7"]
section_7 = ["Bb", "F", "Eb", "Bb"]
section_8 = ["Eb", "BbD", "Cm", "Gm", "Eb", "F", "Bb", "Bb", "Gm", "Eb", "F", "Bb"]
progression = section_1 + section_2 + section_3 + section_4 + section_5 + section_6 + section_7 + section_8
assert len(progression) == TOTAL_BARS


# Initial mixer-friendly controller defaults.
for track in tracks.values():
    track.cc(0, 7, 108)   # channel volume
    track.cc(0, 11, 112)  # expression


for bar, chord in enumerate(progression):
    beat = bar * 4

    if bar < 12:
        dynamic = 28 + bar
        add_chord("strings", beat, 3.9, chord, dynamic, spread=True)
        add_chord("warm_pad", beat, 3.95, chord, max(18, dynamic - 9), octave_shift=12)
        add_arp("celesta", bar, chord, 38 + bar // 2)
        if bar >= 4:
            add_bass(bar, chord, 31 + bar // 2)

    elif bar < 36:
        dynamic = 43 + (bar - 12) // 4
        add_chord("strings", beat, 3.88, chord, dynamic, spread=True)
        add_strum("zither", bar, chord, 44 + (bar - 12) // 5)
        add_bass(bar, chord, 45, moving=bar >= 28)
        for pulse in range(4):
            tracks["pizzicato"].note(beat + pulse, .72, CHORDS[chord][pulse % 3] + 12, 37 + pulse * 2)
        if bar >= 16:
            drum(bar, 48 + (bar - 16) // 2, crash=bar in (20, 28))

    elif bar < 60:
        dynamic = 50 + (bar - 36) // 3
        add_chord("strings", beat, 3.9, chord, dynamic, spread=True)
        add_arp("piano", bar, chord, 45 + (bar - 36) // 5, pattern=(0, 2, 1, 3, 2, 1, 3, 2))
        add_strum("zither", bar, chord, 38)
        add_bass(bar, chord, 50, moving=True)
        drum(bar, 58 + (bar - 36) // 3, crash=bar in (36, 44, 52))

    elif bar < 84:
        dynamic = 52 + (bar - 60)
        add_chord("strings", beat, 3.92, chord, dynamic, spread=True)
        add_chord("warm_pad", beat, 3.95, chord, max(30, dynamic - 20), octave_shift=12)
        add_arp("piano", bar, chord, 45 + (bar - 60) // 2, pattern=(0, 1, 2, 1, 3, 2, 1, 2))
        add_bass(bar, chord, 53 + (bar - 60) // 3, moving=bar >= 72)
        drum(bar, 62 + (bar - 60), crash=bar in (60, 68, 76), half_time=bar >= 76)
        if bar >= 72:
            root = ROOTS[chord] + 12
            tracks["timpani"].note(beat, 1.5, root, 50 + (bar - 72) * 2)
            tracks["timpani"].note(beat + 2.5, 1.0, root, 44 + (bar - 72) * 2)

    elif bar < 92:
        dynamic = 68 + (bar - 84) * 2
        add_chord("strings", beat, 3.92, chord, dynamic, spread=True)
        add_chord("warm_pad", beat, 3.95, chord, dynamic - 25, octave_shift=12)
        add_chord("choir", beat, 3.9, chord, 42 + (bar - 84) * 3, octave_shift=12)
        add_arp("piano", bar, chord, 62 + (bar - 84) * 2, pattern=(0, 2, 1, 3, 0, 2, 3, 2))
        add_bass(bar, chord, 65 + (bar - 84), moving=True)
        drum(bar, 78 + (bar - 84) * 3, crash=bar in (84, 88), half_time=True)
        tracks["timpani"].note(beat, 1.5, ROOTS[chord] + 12, 68 + (bar - 84) * 3)

    elif bar < 104:
        # Full ensemble for the Hwanung/Nabihalmang confrontation and descent.
        dynamic = min(105, 82 + (bar - 92) * 3)
        add_chord("strings", beat, 3.94, chord, dynamic, spread=True)
        add_chord("warm_pad", beat, 3.96, chord, dynamic - 31, octave_shift=12)
        add_chord("choir", beat, 3.92, chord, dynamic - 24, octave_shift=12)
        add_arp("piano", bar, chord, dynamic - 12, pattern=(0, 2, 1, 3, 2, 3, 1, 3))
        add_bass(bar, chord, dynamic - 10, moving=True)
        drum(bar, min(112, dynamic + 4), crash=bar in (92, 96, 100), half_time=False)
        root = ROOTS[chord] + 12
        for offset, amount in ((0, 0), (1.5, -9), (2.5, -4), (3.5, -12)):
            tracks["timpani"].note(beat + offset, .45, root, dynamic + amount)

    elif bar < 108:
        dynamic = 64 - (bar - 104) * 6
        add_chord("strings", beat, 3.94, chord, dynamic, spread=True)
        add_chord("warm_pad", beat, 3.96, chord, dynamic - 18, octave_shift=12)
        add_arp("piano", bar, chord, 52 - (bar - 104) * 3)
        add_bass(bar, chord, 49 - (bar - 104) * 3)
        if bar == 104:
            drum(bar, 72, crash=True, half_time=True)

    else:
        dynamic = 42 + (bar - 108) // 3
        add_chord("strings", beat, 3.94, chord, dynamic, spread=True)
        add_chord("warm_pad", beat, 3.97, chord, max(23, dynamic - 16), octave_shift=12)
        if bar < 116:
            add_arp("piano", bar, chord, 42 + (bar - 108) // 2, pattern=(0, 2, 1, 3, 2, 1, 2, 3))
        else:
            # Slower final cadence so THE END lands on the last tonic.
            notes = CHORDS[chord]
            for offset, index in ((0, 0), (1, 2), (2, 1), (3, 3)):
                tracks["piano"].note(beat + offset, .85, notes[index] + 12, 43)
        if bar < 119:
            add_bass(bar, chord, 39)


# Recurring source-inspired leitmotif, developed rather than looped.
add_sequence("celesta", 16, THEME_A, 47, transpose=-12)
add_sequence("flute", 48, THEME_A, 62)
add_sequence("flute", 80, THEME_A2, 65)
add_sequence("flute", 112, THEME_A, 68, transpose=0)

add_sequence("flute", 144, THEME_A2, 68)
add_sequence("flute", 176, THEME_A, 72)
add_sequence("flute", 208, THEME_A2, 74)

add_sequence("flute", 240, THEME_MINOR, 72)
add_sequence("flute", 272, THEME_MINOR, 77)
add_sequence("horn", 304, THEME_MINOR, 62, transpose=-12)

# Tension fragments on the night road.
for start, velocity in ((336, 70), (352, 77)):
    fragment = [(0, 1, 67, 0), (1, 1, 70, 2), (2, 1, 74, 5), (3, 1, 77, 7),
                (4, .5, 79, 8), (4.5, .5, 77, 5), (5, 1, 74, 2), (6, 2, 66, 9)]
    add_sequence("flute", start, fragment, velocity)
    add_sequence("horn", start, fragment, velocity - 18, transpose=-12)

# Climax: the same motif opens upward and is doubled by horn and strings.
add_sequence("flute", 368, THEME_CLIMAX, 91)
add_sequence("horn", 368, THEME_CLIMAX, 78, transpose=-12)
add_sequence("flute", 384, THEME_CLIMAX, 96)
add_sequence("horn", 384, THEME_CLIMAX, 85, transpose=-12)
add_sequence("strings", 384, THEME_CLIMAX, 72, transpose=-12, legato=.98)
add_sequence("flute", 400, THEME_MINOR, 88)
add_sequence("horn", 400, THEME_MINOR, 77, transpose=-12)

# Credits reprise and conclusive four-bar cadence.
add_sequence("flute", 432, THEME_A, 61)
add_sequence("flute", 448, THEME_A2, 58)
final_cadence = [
    (0, 1, 67, 0), (1, 1, 70, 3), (2, 2, 74, 5),
    (4, 1, 75, 4), (5, 1, 74, 2), (6, 2, 72, 1),
    (8, 1, 77, 6), (9, 1, 75, 3), (10, 2, 74, 4),
    (12, 4, 70, 8),
]
add_sequence("flute", 464, final_cadence, 57, legato=.98)
tracks["horn"].note(476, 3.9, 58, 48)
tracks["strings"].note(476, 3.95, 70, 46)


# Memory-window chimes at the actual edit points.
memory_seconds = [35, 50, 65, 85, 105, 128, 150, 175, 195, 214, 232, 248]
for index, seconds in enumerate(memory_seconds):
    beat = round(seconds * BPM / 60 * 2) / 2
    chord = progression[min(TOTAL_BARS - 1, int(beat // 4))]
    chord_tones = CHORDS[chord]
    velocity = 54 + min(25, index * 2)
    for step, tone in enumerate((0, 1, 2, 3, 2)):
        tracks["celesta"].note(beat + step * .22, .52, chord_tones[tone] + 24, velocity - step * 2)
    if seconds >= 214:
        tracks["drums"].note(beat, .4, 49, 92 + min(24, index))
        tracks["timpani"].note(beat, .8, ROOTS[chord] + 12, 85 + min(20, index))


def tempo_track_chunk() -> bytes:
    body = bytearray()
    name = b"Pokemon Korea Ending Score"
    body.extend(vlq(0) + bytes((0xFF, 0x03)) + vlq(len(name)) + name)
    micros = round(60_000_000 / BPM)
    body.extend(vlq(0) + b"\xFF\x51\x03" + micros.to_bytes(3, "big"))
    body.extend(vlq(0) + b"\xFF\x58\x04\x04\x02\x18\x08")
    body.extend(vlq(0) + b"\xFF\x59\x02\xFE\x00")  # B-flat major: two flats.
    last_tick = 0
    for bar, label in SECTIONS:
        tick = bar * 4 * PPQ
        text = label.encode("utf-8")
        body.extend(vlq(tick - last_tick) + bytes((0xFF, 0x06)) + vlq(len(text)) + text)
        last_tick = tick
    body.extend(vlq(TOTAL_BEATS * PPQ - last_tick) + b"\xFF\x2F\x00")
    return b"MTrk" + struct.pack(">I", len(body)) + body


def main() -> None:
    output = pathlib.Path(__file__).with_name("pokemon_korea_ending_score.mid")
    chunks = [tempo_track_chunk()] + [track.chunk() for track in tracks.values()]
    header = b"MThd" + struct.pack(">IHHH", 6, 1, len(chunks), PPQ)
    output.write_bytes(header + b"".join(chunks))
    print(output)
    print(f"tracks={len(chunks) - 1} bars={TOTAL_BARS} bpm={BPM} duration=300.0s")


if __name__ == "__main__":
    main()
