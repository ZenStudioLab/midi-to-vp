export type VpNotationMode = 'extended' | 'standard' | 'minimal';
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
    minimal: string;
    selected: string;
    mode: VpNotationMode;
  };
  tempoSegments: TempoSegment[];
  metadata: {
    tempoBpm: number;
    slotsPerQuarter: number;
    stepSec: number;
    totalSlots: number;
    sourceTrackCount: number;
    vpRange: {
      minMidi: number;
      maxMidi: number;
    };
  };
};

export type ParsedMidiData = {
  tempoSegments: TempoSegment[];
  tempoBpm: number;
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
