import {
  convertMidiToVp as convertMidiToVpInternal,
  tryConvertMidiToVp as tryConvertMidiToVpInternal,
  convertMidiWithDifficulty as convertMidiWithDifficultyInternal,
  convertMidiWithLevel as convertMidiWithLevelInternal,
} from './convert.js';

import type {
  ConversionOptions,
  ConversionOutcome,
  ConversionResult,
  DifficultyLevel,
} from './types.js';

export { createDefaultVpKeymap } from './keymap.js';
export { getDifficultyPreset } from './presets.js';
export { analyzeVpNotation } from './analyze.js';
export { inferTempoGrid } from './grid-inference.js';
export { SCORING_RUBRIC_VERSION, scoreConversionQuality } from './quality-scorer.js';
export { serializeVpTimeline } from './serialize.js';
export { MIN_VP_MIDI, MAX_VP_MIDI } from './transform.js';

export function convertMidiToVp(input: Uint8Array, options: ConversionOptions = {}): ConversionResult {
  return convertMidiToVpInternal(input, options);
}

export function tryConvertMidiToVp(input: Uint8Array, options: ConversionOptions = {}): ConversionOutcome {
  return tryConvertMidiToVpInternal(input, options);
}

export function convertMidiWithDifficulty(
  input: Uint8Array,
  level: DifficultyLevel,
  overrides: ConversionOptions = {}
): ConversionResult {
  return convertMidiWithDifficultyInternal(input, level, overrides);
}

export function convertMidiWithLevel(
  input: Uint8Array,
  options: { level: DifficultyLevel } & Partial<ConversionOptions>
): ConversionResult {
  return convertMidiWithLevelInternal(input, options);
}

export type {
  AnalysisResult,
  ConversionFailure,
  ConversionFailureReason,
  ConversionOptions,
  ConversionOutcome,
  ConversionResult,
  ConversionSuccess,
  DifficultyLevel,
  FormattingOptions,
  NoteEvent,
  QualitySignalSet,
  QualitySignals,
  QualityStats,
  QuantizationOptions,
  QuantizedNoteEvent,
  ReasonCode,
  ScoringAssessment,
  TempoSegment,
  TimelineSlot,
  VpKeymapBounds,
  VpKeymap,
  VpNotationMode
} from './types.js';
