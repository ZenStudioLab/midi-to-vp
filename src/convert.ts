import { createDefaultVpKeymap } from './keymap.js';
import { collectMidiNotes, normalizeMidiNotes } from './normalize.js';
import { getKnownParseErrorCode, ParseMidiError, parseMidiBuffer } from './parse.js';
import { getDifficultyPreset } from './presets.js';
import { buildTimeline, quantizeNotes } from './quantize.js';
import { serializeVpTimeline } from './serialize.js';
import { MAX_VP_MIDI, MIN_VP_MIDI, transformNotesToVpRange } from './transform.js';
import type {
  ConversionFailure,
  ConversionOptions,
  ConversionOutcome,
  ConversionResult,
  ConversionSuccess,
  DifficultyLevel,
  NoteEvent,
  ParsedMidiData,
  QualitySignals,
} from './types.js';

type ParsedMidiInput = ReturnType<typeof parseMidiBuffer>;

const DEFAULT_SLOTS_PER_QUARTER = 4;
const DEFAULT_MAX_CHORD_SIZE = 3;

function createFailure(
  reason: ConversionFailure['reason'],
  details?: ConversionFailure['details']
): ConversionFailure {
  return details ? { ok: false, reason, details } : { ok: false, reason };
}

function getPitchedNotes(notes: NoteEvent[]): NoteEvent[] {
  return notes.filter((note) => note.channel !== 9);
}

function computeQualitySignals(
  rawNotes: NoteEvent[],
  transformedNotes: NoteEvent[],
  timeline: ConversionResult['timeline'],
  stepSec: number
): QualitySignals {
  const pitchedRawNotes = getPitchedNotes(rawNotes);
  const occupiedSlots = timeline.filter((slot) => slot.notes.length > 0);
  const chordSizes = occupiedSlots.map((slot) => slot.notes.length);
  const durationSeconds = transformedNotes.length === 0
    ? 0
    : Number(Math.max(...transformedNotes.map((note) => note.endSec)).toFixed(3));
  const notesPerSecond = durationSeconds > 0
    ? Number((transformedNotes.length / durationSeconds).toFixed(6))
    : transformedNotes.length;
  const jitterOffsets = pitchedRawNotes.map((note) => {
    const nearestGrid = Math.round(note.startSec / stepSec) * stepSec;
    return Math.abs(note.startSec - nearestGrid) / Math.max(stepSec, 0.000001);
  });

  return {
    totalRawNotes: pitchedRawNotes.length,
    inRangeNotes: pitchedRawNotes.filter((note) => note.midi >= MIN_VP_MIDI && note.midi <= MAX_VP_MIDI).length,
    averageChordSize: chordSizes.length === 0 ? 0 : chordSizes.reduce((sum, value) => sum + value, 0) / chordSizes.length,
    peakChordSize: chordSizes.length === 0 ? 0 : Math.max(...chordSizes),
    notesPerSecond,
    timingJitter: jitterOffsets.length === 0
      ? 0
      : Number((jitterOffsets.reduce((sum, value) => sum + value, 0) / jitterOffsets.length).toFixed(6)),
  };
}

function runConversion(
  parsedInput: ParsedMidiInput,
  options: ConversionOptions = {}
): ConversionResult {
  const { midi, parsed } = parsedInput;
  const keymap = options.keymap ?? createDefaultVpKeymap();
  const vpMinMidi = Math.max(keymap.minMidi, MIN_VP_MIDI);
  const vpMaxMidi = Math.min(keymap.maxMidi, MAX_VP_MIDI);
  const notationMode = options.notationMode ?? 'extended';
  const slotsPerQuarter = options.quantization?.slotsPerQuarter ?? DEFAULT_SLOTS_PER_QUARTER;
  const includePercussion = options.includePercussion ?? false;
  const dedupe = options.dedupe ?? true;
  const simplifyChords = options.simplifyChords ?? true;
  const maxChordSize = options.maxChordSize ?? DEFAULT_MAX_CHORD_SIZE;
  const rawNotes = collectMidiNotes(midi);
  const normalizedNotes = normalizeMidiNotes(midi);

  const transformed = transformNotesToVpRange(normalizedNotes, keymap, {
    includePercussion,
    dedupe,
    extraTranspose: options.transposeSemitones ?? 0
  });

  const stepSec = (60 / parsed.tempoBpm) / slotsPerQuarter;
  const quantized = quantizeNotes(transformed.notes, stepSec, keymap);
  const timeline = buildTimeline(quantized, {
    simplifyChords,
    maxChordSize
  });

  const quantizedNotes = timeline.flatMap((slot) => slot.notes);
  const qualitySignals = computeQualitySignals(rawNotes, transformed.notes, timeline, stepSec);

  const notationExtended = serializeVpTimeline(timeline, {
    mode: 'extended',
    format: options.format
  });

  const notationStandard = serializeVpTimeline(timeline, {
    mode: 'standard',
    format: options.format
  });

  const warnings = [...transformed.warnings];

  return {
    normalizedNotes,
    transformedNotes: transformed.notes,
    quantizedNotes,
    timeline,
    transposeSemitones: transformed.transposeSemitones,
    warnings,
    notation: {
      extended: notationExtended,
      standard: notationStandard,
      selected:
        notationMode === 'standard'
          ? notationStandard
          : notationExtended,
      mode: notationMode
    },
    tempoSegments: parsed.tempoSegments,
    metadata: {
      tempoBpm: parsed.tempoBpm,
      slotsPerQuarter,
      timeSignature: parsed.timeSignature,
      stepSec,
      totalSlots: timeline.length,
      sourceTrackCount: parsed.trackCount,
      qualitySignals,
      vpRange: {
        minMidi: vpMinMidi,
        maxMidi: vpMaxMidi
      }
    }
  };
}

export function convertMidiToVp(input: Uint8Array, options: ConversionOptions = {}): ConversionResult {
  return runConversion(parseMidiBuffer(input), options);
}

export function tryConvertMidiToVp(input: Uint8Array, options: ConversionOptions = {}): ConversionOutcome {
  try {
    const parsedInput = parseMidiBuffer(input);
    const { midi } = parsedInput;
    const rawNotes = collectMidiNotes(midi);
    const pitchedNotes = getPitchedNotes(rawNotes);
    const hasPercussion = rawNotes.some((note) => note.channel === 9);
    const includePercussion = options.includePercussion ?? false;

    if (includePercussion) {
      if (rawNotes.length === 0) {
        return createFailure('empty_midi');
      }
    } else if (pitchedNotes.length === 0) {
      return createFailure(hasPercussion ? 'percussion_only' : 'empty_midi');
    }

    return {
      ok: true,
      ...runConversion(parsedInput, options),
    } satisfies ConversionSuccess;
  } catch (error) {
    if (error instanceof ParseMidiError) {
      return createFailure('corrupted_midi', {
        code: error.code,
        message: error.message,
        source: 'parse_error_code',
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    const knownCode = getKnownParseErrorCode(message);

    if (knownCode) {
      return createFailure('corrupted_midi', {
        code: knownCode,
        message,
        source: 'parse_error_message',
      });
    }

    return createFailure('internal_error', {
      code: error instanceof Error ? error.name : 'UnknownError',
      message,
      source: 'runtime_error',
      cause: error,
    });
  }
}

export function convertMidiWithDifficulty(
  input: Uint8Array,
  level: DifficultyLevel,
  overrides: ConversionOptions = {}
): ConversionResult {
  return convertMidiWithLevel(input, { level, ...overrides });
}

export function convertMidiWithLevel(
  input: Uint8Array,
  options: { level: DifficultyLevel } & Partial<ConversionOptions>
): ConversionResult {
  const { level, ...overrides } = options;
  const preset = getDifficultyPreset(level);
  const mergedOptions: ConversionOptions = {
    ...preset,
    ...overrides,
    quantization: {
      ...(preset.quantization ?? {}),
      ...(overrides.quantization ?? {})
    }
  };

  return convertMidiToVp(input, mergedOptions);
}
