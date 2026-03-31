import type { NoteEvent, VpKeymap } from './types.js';

export const MIN_VP_MIDI = 36;
export const MAX_VP_MIDI = 96;

type TransformOptions = {
  includePercussion: boolean;
  dedupe: boolean;
  extraTranspose?: number;
};

type TransformResult = {
  notes: NoteEvent[];
  transposeSemitones: number;
  warnings: string[];
};

function dedupeNotes(notes: NoteEvent[]): NoteEvent[] {
  const byIdentity = new Map<string, NoteEvent>();

  for (const note of notes) {
    const timeBucket = Math.round(note.startSec * 1_000_000);
    const key = `${timeBucket}:${note.midi}:${note.channel}`;
    const existing = byIdentity.get(key);

    if (!existing || note.velocity > existing.velocity) {
      byIdentity.set(key, note);
    }
  }

  return [...byIdentity.values()].sort((a, b) => a.startSec - b.startSec || a.midi - b.midi);
}

function chooseBestOctaveShift(notes: NoteEvent[], minMidi: number, maxMidi: number): number {
  if (notes.length === 0) {
    return 0;
  }

  let bestShift = 0;
  let bestOutliers = Number.POSITIVE_INFINITY;

  for (let shift = -60; shift <= 60; shift += 12) {
    let outliers = 0;

    for (const note of notes) {
      const candidate = note.midi + shift;
      if (candidate < minMidi || candidate > maxMidi) {
        outliers += 1;
      }
    }

    if (outliers < bestOutliers) {
      bestOutliers = outliers;
      bestShift = shift;
      continue;
    }

    if (outliers === bestOutliers && Math.abs(shift) < Math.abs(bestShift)) {
      bestShift = shift;
    }
  }

  return bestShift;
}

function foldMidiIntoRange(midi: number, minMidi: number, maxMidi: number): number {
  let current = midi;

  while (current < minMidi) {
    current += 12;
  }

  while (current > maxMidi) {
    current -= 12;
  }

  if (current < minMidi) {
    return minMidi;
  }

  if (current > maxMidi) {
    return maxMidi;
  }

  return current;
}

export function transformNotesToVpRange(
  notes: NoteEvent[],
  keymap: VpKeymap,
  options: TransformOptions
): TransformResult {
  const warnings: string[] = [];
  const minMidi = Math.max(keymap.minMidi, MIN_VP_MIDI);
  const maxMidi = Math.min(keymap.maxMidi, MAX_VP_MIDI);

  const filtered = notes.filter((note) => {
    if (options.includePercussion) {
      return true;
    }

    return note.channel !== 9;
  });

  const deduped = options.dedupe ? dedupeNotes(filtered) : [...filtered];
  const rawTransposeSemitones = chooseBestOctaveShift(deduped, minMidi, maxMidi) + (options.extraTranspose ?? 0);
  const transposeSemitones = Object.is(rawTransposeSemitones, -0) ? 0 : rawTransposeSemitones;

  const transformed = deduped.map((note) => {
    const shiftedMidi = note.midi + transposeSemitones;
    const foldedMidi = foldMidiIntoRange(shiftedMidi, minMidi, maxMidi);

    if (shiftedMidi !== foldedMidi) {
      warnings.push(`Folded note ${shiftedMidi} into VP range as ${foldedMidi}`);
    }

    return {
      ...note,
      midi: foldedMidi
    };
  });

  return {
    notes: transformed,
    transposeSemitones,
    warnings
  };
}
