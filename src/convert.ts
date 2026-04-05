import { createDefaultVpKeymap } from "./keymap.js";
import { inferTempoGrid } from "./grid-inference.js";
import { collectMidiNotes, normalizeMidiNotes } from "./normalize.js";
import {
  getKnownParseErrorCode,
  ParseMidiError,
  parseMidiBuffer,
} from "./parse.js";
import { getDifficultyPreset } from "./presets.js";
import { getP95 } from "./quality-scorer.js";
import { buildTimeline, quantizeNotes } from "./quantize.js";
import { serializeVpTimeline } from "./serialize.js";
import {
  MAX_VP_MIDI,
  MIN_VP_MIDI,
  transformNotesToVpRange,
} from "./transform.js";
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
  QuantizedNoteEvent,
} from "./types.js";

type ParsedMidiInput = ReturnType<typeof parseMidiBuffer>;

const DEFAULT_SLOTS_PER_QUARTER = 4;
const DEFAULT_MAX_CHORD_SIZE = 3;

function createFailure(
  reason: ConversionFailure["reason"],
  details?: ConversionFailure["details"],
): ConversionFailure {
  return details ? { ok: false, reason, details } : { ok: false, reason };
}

function getPitchedNotes(notes: NoteEvent[]): NoteEvent[] {
  return notes.filter((note) => note.channel !== 9);
}

function nearestGridDistance(onset: number, beatGrid: number[]): number {
  if (beatGrid.length === 0) {
    return 0;
  }

  let left = 0;
  let right = beatGrid.length - 1;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (beatGrid[mid] < onset) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  const nearest = beatGrid[left];
  const prev = left > 0 ? beatGrid[left - 1] : Number.POSITIVE_INFINITY;
  return Math.min(Math.abs(onset - nearest), Math.abs(onset - prev));
}

function buildSubdivisionGrid(
  beatGrid: number[],
  slotsPerQuarter: number,
  fallbackStepSec: number,
): number[] {
  if (beatGrid.length === 0) {
    return [];
  }

  if (beatGrid.length === 1) {
    const step = fallbackStepSec > 0 ? fallbackStepSec : 0.125;
    return Array.from({ length: slotsPerQuarter }, (_, index) =>
      Number((beatGrid[0] + step * index).toFixed(6)),
    );
  }

  const subdivisionGrid: number[] = [];
  for (let index = 0; index < beatGrid.length - 1; index += 1) {
    const beatStart = beatGrid[index];
    const beatEnd = beatGrid[index + 1];
    const beatDuration = beatEnd - beatStart;
    const subdivisionStep =
      beatDuration > 0 ? beatDuration / slotsPerQuarter : fallbackStepSec;

    for (let slot = 0; slot < slotsPerQuarter; slot += 1) {
      subdivisionGrid.push(
        Number((beatStart + subdivisionStep * slot).toFixed(6)),
      );
    }
  }

  subdivisionGrid.push(Number(beatGrid[beatGrid.length - 1].toFixed(6)));
  return subdivisionGrid;
}

function buildChordSizesBySlot(quantizedNotes: QuantizedNoteEvent[]): number[] {
  const chordSizesBySlot = new Map<number, number>();

  for (const note of quantizedNotes) {
    chordSizesBySlot.set(
      note.startSlot,
      (chordSizesBySlot.get(note.startSlot) ?? 0) + 1,
    );
  }

  return [...chordSizesBySlot.values()].filter((size) => size > 0);
}

function buildLocalDensityStats(
  notes: NoteEvent[],
  durationSeconds: number,
): {
  avgNotesPerSecond: number;
  p95NotesPerSecond: number;
  maxNotesPerSecond: number;
} {
  const bucketWidthSeconds = 1;

  if (notes.length === 0) {
    return {
      avgNotesPerSecond: 0,
      p95NotesPerSecond: 0,
      maxNotesPerSecond: 0,
    };
  }

  const firstOnset = Math.min(...notes.map((note) => note.startSec));
  const activeDurationSeconds = Math.max(
    bucketWidthSeconds,
    durationSeconds - firstOnset,
  );
  const bucketCount = Math.max(
    1,
    Math.ceil(activeDurationSeconds / bucketWidthSeconds),
  );
  const buckets = new Array<number>(bucketCount).fill(0);

  for (const note of notes) {
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.max(
        0,
        Math.floor((note.startSec - firstOnset) / bucketWidthSeconds),
      ),
    );
    buckets[bucketIndex] += 1;
  }

  const avgNotesPerSecond =
    durationSeconds > 0 ? notes.length / durationSeconds : notes.length;
  const bucketRates = buckets.map(
    (bucketCountValue) => bucketCountValue / bucketWidthSeconds,
  );

  return {
    avgNotesPerSecond: Number(avgNotesPerSecond.toFixed(6)),
    p95NotesPerSecond: Number(getP95(bucketRates).toFixed(6)),
    maxNotesPerSecond: Number(Math.max(...bucketRates).toFixed(6)),
  };
}

function computeQualitySignals(
  rawNotes: NoteEvent[],
  transformedNotes: NoteEvent[],
  quantizedNotes: QuantizedNoteEvent[],
  stepSec: number,
  tempoSegments: ParsedMidiData["tempoSegments"],
  vpRange: { minMidi: number; maxMidi: number },
): QualitySignals {
  const pitchedRawNotes = getPitchedNotes(rawNotes);
  const outputTotalNotes = transformedNotes.length;
  const outputInRangeNotes = transformedNotes.filter(
    (note) => note.midi >= vpRange.minMidi && note.midi <= vpRange.maxMidi,
  ).length;
  const chordSizes = buildChordSizesBySlot(quantizedNotes);
  const durationSeconds =
    transformedNotes.length === 0
      ? 0
      : Number(
          Math.max(...transformedNotes.map((note) => note.endSec)).toFixed(3),
        );
  const densityStats = buildLocalDensityStats(
    transformedNotes,
    durationSeconds,
  );
  const inferredGrid = inferTempoGrid(
    pitchedRawNotes.map((note) => note.startSec),
    tempoSegments,
  );
  const slotsPerQuarter =
    stepSec > 0
      ? Math.max(1, Math.round(60 / (tempoSegments[0]?.bpm ?? 120) / stepSec))
      : 1;
  const subdivisionGrid = buildSubdivisionGrid(
    inferredGrid.beatGrid,
    slotsPerQuarter,
    stepSec,
  );
  const jitterOffsets = pitchedRawNotes.map((note) => {
    if (inferredGrid.beatGrid.length === 0) {
      const nearestGrid = Math.round(note.startSec / stepSec) * stepSec;
      return (
        Math.abs(note.startSec - nearestGrid) / Math.max(stepSec, 0.000001)
      );
    }

    const nearestDistance = nearestGridDistance(note.startSec, subdivisionGrid);

    return nearestDistance / Math.max(stepSec, 0.000001);
  });

  return {
    totalRawNotes: pitchedRawNotes.length,
    inRangeNotes: pitchedRawNotes.filter(
      (note) => note.midi >= vpRange.minMidi && note.midi <= vpRange.maxMidi,
    ).length,
    outputTotalNotes,
    outputInRangeNotes,
    averageChordSize:
      chordSizes.length === 0
        ? 0
        : chordSizes.reduce((sum, value) => sum + value, 0) / chordSizes.length,
    peakChordSize: chordSizes.length === 0 ? 0 : Math.max(...chordSizes),
    avgNotesPerSecond: densityStats.avgNotesPerSecond,
    timingJitter:
      jitterOffsets.length === 0 ? 0 : Number(getP95(jitterOffsets).toFixed(6)),
    p95ChordSize:
      chordSizes.length === 0 ? 0 : Number(getP95(chordSizes).toFixed(6)),
    hardChordRate:
      chordSizes.length === 0
        ? 0
        : Number(
            (
              chordSizes.filter((size) => size >= 5).length / chordSizes.length
            ).toFixed(6),
          ),
    p95NotesPerSecond: densityStats.p95NotesPerSecond,
    maxNotesPerSecond: densityStats.maxNotesPerSecond,
    gridConfidence: Number(inferredGrid.confidence.toFixed(6)),
  };
}

function runConversion(
  parsedInput: ParsedMidiInput,
  options: ConversionOptions = {},
): ConversionResult {
  const { midi, parsed } = parsedInput;
  const keymap = options.keymap ?? createDefaultVpKeymap();
  const vpMinMidi = Math.max(keymap.minMidi, MIN_VP_MIDI);
  const vpMaxMidi = Math.min(keymap.maxMidi, MAX_VP_MIDI);
  const notationMode = options.notationMode ?? "extended";
  const slotsPerQuarter =
    options.quantization?.slotsPerQuarter ?? DEFAULT_SLOTS_PER_QUARTER;
  const includePercussion = options.includePercussion ?? false;
  const dedupe = options.dedupe ?? true;
  const simplifyChords = options.simplifyChords ?? true;
  const maxChordSize = options.maxChordSize ?? DEFAULT_MAX_CHORD_SIZE;

  if (!Number.isFinite(slotsPerQuarter) || slotsPerQuarter <= 0) {
    throw new Error(
      `slotsPerQuarter must be a positive number, got: ${slotsPerQuarter}`,
    );
  }
  if (!Number.isFinite(maxChordSize) || maxChordSize <= 0) {
    throw new Error(
      `maxChordSize must be a positive number, got: ${maxChordSize}`,
    );
  }

  const rawNotes = collectMidiNotes(midi);
  const normalizedNotes = normalizeMidiNotes(midi);

  const transformed = transformNotesToVpRange(normalizedNotes, keymap, {
    includePercussion,
    dedupe,
    extraTranspose: options.transposeSemitones ?? 0,
  });

  const stepSec = 60 / parsed.tempoBpm / slotsPerQuarter;
  const quantized = quantizeNotes(transformed.notes, stepSec, keymap);
  const timeline = buildTimeline(quantized, {
    simplifyChords,
    maxChordSize,
  });

  const qualitySignals = computeQualitySignals(
    rawNotes,
    transformed.notes,
    quantized,
    stepSec,
    parsed.tempoSegments,
    { minMidi: vpMinMidi, maxMidi: vpMaxMidi },
  );

  const notationExtended = serializeVpTimeline(timeline, {
    mode: "extended",
    format: options.format,
  });

  const notationStandard = serializeVpTimeline(timeline, {
    mode: "standard",
    format: options.format,
  });

  const warnings = [...transformed.warnings];

  return {
    normalizedNotes,
    transformedNotes: transformed.notes,
    quantizedNotes: quantized,
    timeline,
    transposeSemitones: transformed.transposeSemitones,
    warnings,
    notation: {
      extended: notationExtended,
      standard: notationStandard,
      selected:
        notationMode === "standard" ? notationStandard : notationExtended,
      mode: notationMode,
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
        maxMidi: vpMaxMidi,
      },
    },
  };
}

export function convertMidiToVp(
  input: Uint8Array,
  options: ConversionOptions = {},
): ConversionResult {
  return runConversion(parseMidiBuffer(input), options);
}

export function tryConvertMidiToVp(
  input: Uint8Array,
  options: ConversionOptions = {},
): ConversionOutcome {
  try {
    const parsedInput = parseMidiBuffer(input);
    const { midi } = parsedInput;
    const rawNotes = collectMidiNotes(midi);
    const pitchedNotes = getPitchedNotes(rawNotes);
    const hasPercussion = rawNotes.some((note) => note.channel === 9);
    const includePercussion = options.includePercussion ?? false;

    if (includePercussion) {
      if (rawNotes.length === 0) {
        return createFailure("empty_midi");
      }
    } else if (pitchedNotes.length === 0) {
      return createFailure(hasPercussion ? "percussion_only" : "empty_midi");
    }

    return {
      ok: true,
      ...runConversion(parsedInput, options),
    } satisfies ConversionSuccess;
  } catch (error) {
    if (error instanceof ParseMidiError) {
      return createFailure("corrupted_midi", {
        code: error.code,
        message: error.message,
        source: "parse_error_code",
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    const knownCode = getKnownParseErrorCode(message);

    if (knownCode) {
      return createFailure("corrupted_midi", {
        code: knownCode,
        message,
        source: "parse_error_message",
      });
    }

    return createFailure("internal_error", {
      code: error instanceof Error ? error.name : "UnknownError",
      message,
      source: "runtime_error",
      cause: error,
    });
  }
}

export function convertMidiWithDifficulty(
  input: Uint8Array,
  level: DifficultyLevel,
  overrides: ConversionOptions = {},
): ConversionResult {
  return convertMidiWithLevel(input, { level, ...overrides });
}

export function convertMidiWithLevel(
  input: Uint8Array,
  options: { level: DifficultyLevel } & Partial<ConversionOptions>,
): ConversionResult {
  const { level, ...overrides } = options;
  const preset = getDifficultyPreset(level);
  const mergedOptions: ConversionOptions = {
    ...preset,
    ...overrides,
    quantization: {
      ...(preset.quantization ?? {}),
      ...(overrides.quantization ?? {}),
    },
  };

  return convertMidiToVp(input, mergedOptions);
}
