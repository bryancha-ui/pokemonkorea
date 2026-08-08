#!/usr/bin/env swift

import AVFoundation
import AudioToolbox
import Foundation

struct Instrument {
    let name: String
    let program: UInt8
    let volume: Float
    let pan: Float
    let percussion: Bool
}

let instruments: [Instrument] = [
    Instrument(name: "Piano", program: 0, volume: 0.76, pan: -0.10, percussion: false),
    Instrument(name: "Zither", program: 107, volume: 0.66, pan: 0.28, percussion: false),
    Instrument(name: "Celesta", program: 8, volume: 0.62, pan: 0.16, percussion: false),
    Instrument(name: "Strings", program: 48, volume: 0.72, pan: -0.08, percussion: false),
    Instrument(name: "Pizzicato", program: 45, volume: 0.60, pan: 0.18, percussion: false),
    Instrument(name: "Flute", program: 73, volume: 0.72, pan: 0.20, percussion: false),
    Instrument(name: "French Horn", program: 60, volume: 0.68, pan: -0.24, percussion: false),
    Instrument(name: "Choir", program: 52, volume: 0.54, pan: 0.05, percussion: false),
    Instrument(name: "Bass", program: 32, volume: 0.66, pan: 0.0, percussion: false),
    Instrument(name: "Warm Pad", program: 89, volume: 0.46, pan: 0.08, percussion: false),
    Instrument(name: "Timpani", program: 47, volume: 0.66, pan: -0.12, percussion: false),
    Instrument(name: "Drums", program: 0, volume: 0.62, pan: 0.0, percussion: true),
]

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: render_midi.swift input.mid output.wav\n", stderr)
    exit(2)
}

let midiURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
let soundBankURL = URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
let sampleRate = 48_000.0
let durationSeconds = 300.0
let renderFormat = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!

let engine = AVAudioEngine()
let sequencer = AVAudioSequencer(audioEngine: engine)
// The generated SMF already has one instrument per track, so preserve its
// authored track order instead of asking AVFoundation to regroup by channel.
try sequencer.load(from: midiURL, options: AVMusicSequenceLoadOptions(rawValue: 0))

// Some macOS versions expose the SMF conductor/meta track in `tracks`, while
// others keep it only in `tempoTrack`.
let musicTracks = sequencer.tracks.count == instruments.count + 1
    ? Array(sequencer.tracks.dropFirst())
    : sequencer.tracks

guard musicTracks.count == instruments.count else {
    fputs("MIDI track mismatch: expected \(instruments.count), got \(musicTracks.count)\n", stderr)
    exit(3)
}

let ensembleMixer = AVAudioMixerNode()
let reverb = AVAudioUnitReverb()
reverb.loadFactoryPreset(.largeHall2)
reverb.wetDryMix = 18
engine.attach(ensembleMixer)
engine.attach(reverb)

var samplers: [AVAudioUnitSampler] = []
var trackMixers: [AVAudioMixerNode] = []

for (index, instrument) in instruments.enumerated() {
    let sampler = AVAudioUnitSampler()
    let trackMixer = AVAudioMixerNode()
    engine.attach(sampler)
    engine.attach(trackMixer)

    let bankMSB = instrument.percussion
        ? UInt8(kAUSampler_DefaultPercussionBankMSB)
        : UInt8(kAUSampler_DefaultMelodicBankMSB)
    try sampler.loadSoundBankInstrument(
        at: soundBankURL,
        program: instrument.program,
        bankMSB: bankMSB,
        bankLSB: UInt8(kAUSampler_DefaultBankLSB)
    )

    engine.connect(sampler, to: trackMixer, format: renderFormat)
    engine.connect(trackMixer, to: ensembleMixer, format: renderFormat)
    trackMixer.outputVolume = instrument.volume
    trackMixer.pan = instrument.pan
    musicTracks[index].destinationAudioUnit = sampler

    samplers.append(sampler)
    trackMixers.append(trackMixer)
}

engine.connect(ensembleMixer, to: reverb, format: renderFormat)
engine.connect(reverb, to: engine.mainMixerNode, format: renderFormat)
engine.mainMixerNode.outputVolume = 0.82

try engine.enableManualRenderingMode(
    .offline,
    format: renderFormat,
    maximumFrameCount: 4096
)

let outputFile = try AVAudioFile(
    forWriting: outputURL,
    settings: renderFormat.settings,
    commonFormat: .pcmFormatFloat32,
    interleaved: false
)

try engine.start()
sequencer.prepareToPlay()
sequencer.currentPositionInBeats = 0
try sequencer.start()

let totalFrames = AVAudioFramePosition(durationSeconds * sampleRate)
let maximumFrames = AVAudioFrameCount(4096)

while engine.manualRenderingSampleTime < totalFrames {
    let remaining = totalFrames - engine.manualRenderingSampleTime
    let requested = AVAudioFrameCount(min(AVAudioFramePosition(maximumFrames), remaining))
    guard let buffer = AVAudioPCMBuffer(
        pcmFormat: engine.manualRenderingFormat,
        frameCapacity: requested
    ) else {
        fputs("Unable to allocate render buffer\n", stderr)
        exit(4)
    }

    let status = try engine.renderOffline(requested, to: buffer)
    switch status {
    case .success:
        try outputFile.write(from: buffer)
    case .insufficientDataFromInputNode, .cannotDoInCurrentContext:
        continue
    case .error:
        fputs("AVAudioEngine returned an offline rendering error\n", stderr)
        exit(5)
    @unknown default:
        fputs("AVAudioEngine returned an unknown rendering status\n", stderr)
        exit(6)
    }
}

sequencer.stop()
engine.stop()
print("Rendered \(durationSeconds)s to \(outputURL.path)")
