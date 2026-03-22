import { createDefaultVpKeymap } from './keymap.js';
import { normalizeMidiNotes } from './normalize.js';
import { parseMidiBuffer } from './parse.js';
import { getDifficultyPreset } from './presets.js';
import { buildTimeline, quantizeNotes } from './quantize.js';
import { serializeVpTimeline } from './serialize.js';
import { transformNotesToVpRange } from './transform.js';
import type { ConversionOptions, ConversionResult, DifficultyLevel } from './types.js';

const DEFAULT_SLOTS_PER_QUARTER = 4;
const DEFAULT_MAX_CHORD_SIZE = 4;

export function convertMidiToVp(input: Uint8Array | Buffer, options: ConversionOptions = {}): ConversionResult {
  const keymap = options.keymap ?? createDefaultVpKeymap();
  const notationMode = options.notationMode ?? 'extended';
  const slotsPerQuarter = options.quantization?.slotsPerQuarter ?? DEFAULT_SLOTS_PER_QUARTER;
  const includePercussion = options.includePercussion ?? false;
  const dedupe = options.dedupe ?? true;
  const simplifyChords = options.simplifyChords ?? true;
  const maxChordSize = options.maxChordSize ?? DEFAULT_MAX_CHORD_SIZE;

  const { midi, parsed } = parseMidiBuffer(input);
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
      stepSec,
      totalSlots: timeline.length,
      sourceTrackCount: parsed.trackCount,
      vpRange: {
        minMidi: keymap.minMidi,
        maxMidi: keymap.maxMidi
      }
    }
  };
}

export function convertMidiWithDifficulty(
  input: Uint8Array | Buffer,
  level: DifficultyLevel,
  overrides: ConversionOptions = {}
): ConversionResult {
  return convertMidiWithLevel(input, { level, ...overrides });
}

export function convertMidiWithLevel(
  input: Uint8Array | Buffer,
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
