import type { VpKeymap } from './types.js';

const NOTE_TO_KEY: Array<{ note: string; key: string }> = [
  { note: 'C2', key: '1' },
  { note: 'C#2', key: '!' },
  { note: 'D2', key: '2' },
  { note: 'D#2', key: '@' },
  { note: 'E2', key: '3' },
  { note: 'F2', key: '4' },
  { note: 'F#2', key: '$' },
  { note: 'G2', key: '5' },
  { note: 'G#2', key: '%' },
  { note: 'A2', key: '6' },
  { note: 'A#2', key: '^' },
  { note: 'B2', key: '7' },
  { note: 'C3', key: '8' },
  { note: 'C#3', key: '*' },
  { note: 'D3', key: '9' },
  { note: 'D#3', key: '(' },
  { note: 'E3', key: '0' },
  { note: 'F3', key: 'q' },
  { note: 'F#3', key: 'Q' },
  { note: 'G3', key: 'w' },
  { note: 'G#3', key: 'W' },
  { note: 'A3', key: 'e' },
  { note: 'A#3', key: 'E' },
  { note: 'B3', key: 'r' },
  { note: 'C4', key: 't' },
  { note: 'C#4', key: 'T' },
  { note: 'D4', key: 'y' },
  { note: 'D#4', key: 'Y' },
  { note: 'E4', key: 'u' },
  { note: 'F4', key: 'i' },
  { note: 'F#4', key: 'I' },
  { note: 'G4', key: 'o' },
  { note: 'G#4', key: 'O' },
  { note: 'A4', key: 'p' },
  { note: 'A#4', key: 'P' },
  { note: 'B4', key: 'a' },
  { note: 'C5', key: 's' },
  { note: 'C#5', key: 'S' },
  { note: 'D5', key: 'd' },
  { note: 'D#5', key: 'D' },
  { note: 'E5', key: 'f' },
  { note: 'F5', key: 'g' },
  { note: 'F#5', key: 'G' },
  { note: 'G5', key: 'h' },
  { note: 'G#5', key: 'H' },
  { note: 'A5', key: 'j' },
  { note: 'A#5', key: 'J' },
  { note: 'B5', key: 'k' },
  { note: 'C6', key: 'l' },
  { note: 'C#6', key: 'L' },
  { note: 'D6', key: 'z' },
  { note: 'D#6', key: 'Z' },
  { note: 'E6', key: 'x' },
  { note: 'F6', key: 'c' },
  { note: 'F#6', key: 'C' },
  { note: 'G6', key: 'v' },
  { note: 'G#6', key: 'V' },
  { note: 'A6', key: 'b' },
  { note: 'A#6', key: 'B' },
  { note: 'B6', key: 'n' },
  { note: 'C7', key: 'm' }
];

const PITCH_CLASS_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11
};

function noteNameToMidi(note: string): number {
  const match = note.match(/^([A-G])(#?)(-?\d+)$/);
  if (!match) {
    throw new Error(`Invalid note name in keymap: ${note}`);
  }

  const pitchClass = `${match[1]}${match[2]}`;
  const octave = Number.parseInt(match[3], 10);
  const semitone = PITCH_CLASS_TO_SEMITONE[pitchClass];

  return (octave + 1) * 12 + semitone;
}

export function createDefaultVpKeymap(): VpKeymap {
  const midiToKey: Record<number, string> = {};
  const keyToMidi: Record<string, number> = {};

  for (const pair of NOTE_TO_KEY) {
    const midi = noteNameToMidi(pair.note);
    midiToKey[midi] = pair.key;
    keyToMidi[pair.key] = midi;
  }

  const midiValues = Object.keys(midiToKey).map((value) => Number.parseInt(value, 10));

  return {
    midiToKey,
    keyToMidi,
    minMidi: Math.min(...midiValues),
    maxMidi: Math.max(...midiValues)
  };
}
