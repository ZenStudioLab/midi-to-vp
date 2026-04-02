import * as ToneMidi from '@tonejs/midi';
import type { ParsedMidiData, TempoSegment } from './types.js';

type MidiConstructor = new (input: Uint8Array) => {
  header: {
    tempos?: Array<{ ticks: number; bpm: number; time?: number }>;
    timeSignatures?: Array<{ ticks: number; timeSignature: [number, number] }>;
  };
  tracks: Array<{
    channel?: number;
    notes: Array<{
      midi: number;
      time: number;
      duration: number;
      velocity: number;
    }>;
  }>;
};

const MidiCtor = ((ToneMidi as unknown as { Midi?: MidiConstructor; default?: { Midi?: MidiConstructor } }).Midi ??
  (ToneMidi as unknown as { default?: { Midi?: MidiConstructor } }).default?.Midi) as MidiConstructor;

const PARSE_ERROR_PATTERNS: Array<{ code: string; pattern: RegExp }> = [
  { code: 'INVALID_MIDI_FILE', pattern: /bad midi file|invalid midi|mthd/i },
  { code: 'UNEXPECTED_END', pattern: /unexpected end|truncated|out of bounds|offset is outside/i },
  { code: 'INVALID_TRACK_DATA', pattern: /running status|invalid track|track (?:chunk|data|length)|end of track/i },
];

export class ParseMidiError extends Error {
  code: string;
  cause?: unknown;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ParseMidiError';
    this.code = code;
    this.cause = options?.cause;
  }
}

export function getKnownParseErrorCode(message: string): string | undefined {
  const match = PARSE_ERROR_PATTERNS.find((candidate) => candidate.pattern.test(message));
  return match?.code;
}

export function parseMidiBuffer(input: Uint8Array): {
  midi: InstanceType<MidiConstructor>;
  parsed: ParsedMidiData;
} {
  if (!MidiCtor) {
    throw new TypeError('Unable to resolve Midi constructor from @tonejs/midi');
  }

  const bytes = input;
  let midi: InstanceType<MidiConstructor>;

  try {
    midi = new MidiCtor(bytes);
  } catch (error) {
    if (error instanceof ParseMidiError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const code = getKnownParseErrorCode(message);
    if (code) {
      throw new ParseMidiError(code, message, { cause: error });
    }

    throw error;
  }

  const tempoSegments: TempoSegment[] = (midi.header.tempos ?? []).map((tempo) => ({
    ticks: tempo.ticks,
    bpm: tempo.bpm,
    timeSec: typeof tempo.time === 'number' ? tempo.time : 0
  }));

  const tempoBpm = tempoSegments[0]?.bpm ?? 120;
  const firstTimeSignature = midi.header.timeSignatures?.[0]?.timeSignature;
  const timeSignature = firstTimeSignature
    ? `${firstTimeSignature[0]}/${firstTimeSignature[1]}`
    : undefined;

  return {
    midi,
    parsed: {
      tempoSegments,
      tempoBpm,
      timeSignature,
      trackCount: midi.tracks.length
    }
  };
}
