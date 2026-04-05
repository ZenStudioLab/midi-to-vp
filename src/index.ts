export { createDefaultVpKeymap } from "./keymap.js";
export {
  convertMidiToVp,
  tryConvertMidiToVp,
  convertMidiWithDifficulty,
  convertMidiWithLevel,
} from "./convert.js";
export { getDifficultyPreset } from "./presets.js";
export { analyzeVpNotation } from "./analyze.js";
export { inferTempoGrid } from "./grid-inference.js";
export {
  SCORING_RUBRIC_VERSION,
  scoreConversionQuality,
} from "./quality-scorer.js";
export { serializeVpTimeline } from "./serialize.js";
export { MIN_VP_MIDI, MAX_VP_MIDI } from "./transform.js";

export type {
  AnalysisResult,
  ArtifactCapped,
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
  VpNotationMode,
} from "./types.js";
