export type VpNotationMode = 'extended' | 'standard';
export type DifficultyLevel = 'Novice' | 'Apprentice' | 'Adept' | 'Master' | 'Guru';

export type TempoSegment = {
  ticks: number;
  bpm: number;
  timeSec: number;
};

export type NoteEvent = {
  midi: number;
  startSec: number;
  durationSec: number;
  endSec: number;
  velocity: number;
  track: number;
  channel: number;
};

export type QuantizedNoteEvent = NoteEvent & {
  startSlot: number;
  durSlots: number;
  endSlot: number;
  vpKey: string;
};

export type TimelineSlot = {
  slot: number;
  notes: QuantizedNoteEvent[];
};

export type VpKeymap = {
  midiToKey: Record<number, string>;
  keyToMidi: Record<string, number>;
  minMidi: number;
  maxMidi: number;
};

export type VpKeymapBounds = Pick<VpKeymap, 'minMidi' | 'maxMidi'>;

export type QuantizationOptions = {
  slotsPerQuarter?: number;
};

export type FormattingOptions = {
  groupSlots?: number;
  lineBreakEveryGroups?: number;
};

export type ConversionOptions = {
  notationMode?: VpNotationMode;
  quantization?: QuantizationOptions;
  includePercussion?: boolean;
  dedupe?: boolean;
  simplifyChords?: boolean;
  maxChordSize?: number;
  format?: FormattingOptions | null;
  keymap?: VpKeymap;
  transposeSemitones?: number;
};

export type QualitySignals = {
  totalRawNotes: number;
  inRangeNotes: number;
  averageChordSize: number;
  peakChordSize: number;
  avgNotesPerSecond: number;
  timingJitter: number;
  p95ChordSize: number;
  hardChordRate: number;
  p95NotesPerSecond: number;
  maxNotesPerSecond: number;
  gridConfidence: number;
};

export type ReasonCode =
  | 'LOW_IN_RANGE_RATIO'
  | 'FATAL_IN_RANGE_RATIO'
  | 'HIGH_PEAK_CHORD_SIZE'
  | 'FATAL_PEAK_CHORD_SIZE'
  | 'HIGH_HARD_CHORD_RATE'
  | 'FATAL_HARD_CHORD_RATE'
  | 'HIGH_LOCAL_NOTE_DENSITY'
  | 'FATAL_MAX_NOTE_DENSITY'
  | 'LOW_TIMING_CONSISTENCY'
  | 'FATAL_TIMING_CONSISTENCY'
  | 'LOW_TEMPO_GRID_CONFIDENCE'
  | 'INPUT_LIMIT_EXCEEDED_FILE_SIZE'
  | 'INPUT_LIMIT_EXCEEDED_EVENT_COUNT'
  | 'INPUT_LIMIT_EXCEEDED_DURATION'
  | 'INPUT_LIMIT_EXCEEDED_TRACK_COUNT';

export type QualityStats = {
  totalNotes: number;
  inRangeNotes: number;
  averageChordSize: number;
  peakChordSize: number;
  p95ChordSize: number;
  hardChordRate: number;
  avgNotesPerSecond: number;
  p95NotesPerSecond: number;
  maxNotesPerSecond: number;
  timingJitter: number;
  gridConfidence: number;
  durationSeconds: number;
};

export type QualitySignalSet = {
  inRangeRatio: number;
  chordComplexity: number;
  noteDensity: number;
  timingConsistency: number;
};

export type ScoringAssessment = {
  score: number;
  rubricVersion: string;
  signals: QualitySignalSet;
  reasons: ReasonCode[];
  stats: QualityStats;
};

export type ConversionResult = {
  normalizedNotes: NoteEvent[];
  transformedNotes: NoteEvent[];
  quantizedNotes: QuantizedNoteEvent[];
  timeline: TimelineSlot[];
  transposeSemitones: number;
  warnings: string[];
  notation: {
    extended: string;
    standard: string;
    selected: string;
    mode: VpNotationMode;
  };
  tempoSegments: TempoSegment[];
  metadata: {
    tempoBpm: number;
    slotsPerQuarter: number;
    timeSignature?: string;
    stepSec: number;
    totalSlots: number;
    sourceTrackCount: number;
    qualitySignals: QualitySignals;
    vpRange: {
      minMidi: number;
      maxMidi: number;
    };
  };
};

export type ConversionFailureReason = 'corrupted_midi' | 'empty_midi' | 'percussion_only' | 'internal_error';

export type ConversionFailure = {
  ok: false;
  reason: ConversionFailureReason;
  details?: {
    code?: string;
    message?: string;
    cause?: unknown;
    source?: string;
  };
};

export type ConversionSuccess = ConversionResult & {
  ok: true;
};

export type ConversionOutcome = ConversionSuccess | ConversionFailure;

export type ParsedMidiData = {
  tempoSegments: TempoSegment[];
  tempoBpm: number;
  timeSignature?: string;
  trackCount: number;
};

export type SerializeOptions = {
  mode: VpNotationMode;
  format?: FormattingOptions | null;
};

export type AnalysisResult = {
  noteDensity: number;
  chordComplexity: number;
  rhythmicComplexity: number;
  rangeScore: number;
  overallScore: number;
  recommendedLevel: DifficultyLevel;
  confidence: number;
};
