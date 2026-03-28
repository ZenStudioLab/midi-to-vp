import type { NoteEvent } from './types.js';

const COMMON_GRID_STEPS = [0.0625, 0.083333, 0.1, 0.125, 0.166667, 0.1875, 0.25, 0.333333, 0.375, 0.5];

type MidiLike = {
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

export function normalizeMidiNotes(midi: MidiLike): NoteEvent[] {
  const normalized: NoteEvent[] = [];

  midi.tracks.forEach((track, trackIndex) => {
    const channel = track.channel ?? 0;

    track.notes.forEach((note) => {
      normalized.push({
        midi: note.midi,
        startSec: note.time,
        durationSec: note.duration,
        endSec: note.time + note.duration,
        velocity: note.velocity,
        track: trackIndex,
        channel
      });
    });
  });

  const gridStep = detectGridStep(normalized);
  const snapped = normalized.map((note) => snapNoteToGrid(note, gridStep));

  snapped.sort((a, b) => a.startSec - b.startSec || a.midi - b.midi);
  return snapped;
}

function detectGridStep(notes: NoteEvent[]): number | null {
  if (notes.length === 0) {
    return null;
  }

  const candidates: number[] = [];

  for (const note of notes) {
    if (note.durationSec > 0.04) {
      candidates.push(note.durationSec);
    }
  }

  for (let index = 1; index < notes.length; index += 1) {
    const delta = notes[index].startSec - notes[index - 1].startSec;
    if (delta > 0.04) {
      candidates.push(delta);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const sortedCandidates = [...candidates].sort((left, right) => left - right);
  const median = sortedCandidates[Math.floor(sortedCandidates.length / 2)];

  return COMMON_GRID_STEPS.reduce((closest, candidate) => {
    if (Math.abs(candidate - median) < Math.abs((closest ?? Number.POSITIVE_INFINITY) - median)) {
      return candidate;
    }

    return closest;
  }, null as number | null);
}

function snapValueToGrid(value: number, gridStep: number | null): number {
  if (!gridStep) {
    return value;
  }

  const snapped = Math.round(value / gridStep) * gridStep;
  const tolerance = Math.min(Math.max(gridStep * 0.2, 0.01), 0.04);

  if (Math.abs(value - snapped) <= tolerance) {
    return Number(snapped.toFixed(6));
  }

  return Number(value.toFixed(6));
}

function snapNoteToGrid(note: NoteEvent, gridStep: number | null): NoteEvent {
  const startSec = snapValueToGrid(note.startSec, gridStep);
  const durationSec = Math.max(gridStep ?? 0, snapValueToGrid(note.durationSec, gridStep));

  return {
    ...note,
    startSec,
    durationSec,
    endSec: Number((startSec + durationSec).toFixed(6)),
  };
}
