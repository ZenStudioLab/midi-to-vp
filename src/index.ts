export { createDefaultVpKeymap } from './keymap.js';
export { convertMidiToVp, tryConvertMidiToVp, convertMidiWithDifficulty, convertMidiWithLevel } from './convert.js';
export { getDifficultyPreset } from './presets.js';
export { analyzeVpNotation } from './analyze.js';
export { serializeVpTimeline } from './serialize.js';
export { MIN_VP_MIDI, MAX_VP_MIDI } from './transform.js';

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
  QualitySignals,
  QuantizationOptions,
  QuantizedNoteEvent,
  TempoSegment,
  TimelineSlot,
  VpKeymap,
  VpNotationMode
} from './types.js';
