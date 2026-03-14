import { readFile } from 'node:fs/promises';
import { createDefaultVpKeymap } from './keymap.js';
import { normalizeMidiNotes } from './normalize.js';
import { parseMidiBuffer } from './parse.js';
import { buildTimeline, quantizeNotes } from './quantize.js';
import { serializeVpTimeline } from './serialize.js';
import { transformNotesToVpRange } from './transform.js';
import type { ConversionOptions, ConversionResult } from './types.js';

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
    dedupe
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

  const notationZen = serializeVpTimeline(timeline, {
    mode: 'zen',
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
      zen: notationZen,
      selected: notationMode === 'zen' ? notationZen : notationExtended,
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

export async function convertMidiFileToVp(inputPath: string, options: ConversionOptions = {}): Promise<ConversionResult> {
  const data = await readFile(inputPath);
  return convertMidiToVp(data, options);
}
