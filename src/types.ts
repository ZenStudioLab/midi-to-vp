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
  notesPerSecond: number;
  timingJitter: number;
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
