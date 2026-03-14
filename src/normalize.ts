import type { NoteEvent } from './types.js';

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

  normalized.sort((a, b) => a.startSec - b.startSec || a.midi - b.midi);
  return normalized;
}
