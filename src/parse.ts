import * as ToneMidi from '@tonejs/midi';
import type { ParsedMidiData, TempoSegment } from './types.js';

type MidiConstructor = new (input: Uint8Array) => {
  header: {
    tempos?: Array<{ ticks: number; bpm: number; time?: number }>;
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

export function parseMidiBuffer(input: Uint8Array | Buffer): {
  midi: InstanceType<MidiConstructor>;
  parsed: ParsedMidiData;
} {
  if (!MidiCtor) {
    throw new Error('Unable to resolve Midi constructor from @tonejs/midi');
  }

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const midi = new MidiCtor(bytes);

  const tempoSegments: TempoSegment[] = (midi.header.tempos ?? []).map((tempo) => ({
    ticks: tempo.ticks,
    bpm: tempo.bpm,
    timeSec: typeof tempo.time === 'number' ? tempo.time : 0
  }));

  const tempoBpm = tempoSegments[0]?.bpm ?? 120;

  return {
    midi,
    parsed: {
      tempoSegments,
      tempoBpm,
      trackCount: midi.tracks.length
    }
  };
}
