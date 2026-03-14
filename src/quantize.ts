import type { NoteEvent, QuantizedNoteEvent, TimelineSlot, VpKeymap } from './types.js';

type TimelineOptions = {
  simplifyChords: boolean;
  maxChordSize: number;
};

function simplifyChord(notes: QuantizedNoteEvent[], maxChordSize: number): QuantizedNoteEvent[] {
  if (notes.length <= maxChordSize) {
    return [...notes].sort((a, b) => a.midi - b.midi);
  }

  const sorted = [...notes].sort((a, b) => a.midi - b.midi);
  const bass = sorted[0];
  const melody = sorted[sorted.length - 1];

  if (maxChordSize <= 1) {
    return [melody];
  }

  if (maxChordSize === 2) {
    return [bass, melody];
  }

  const middle = sorted.slice(1, -1).sort((a, b) => b.velocity - a.velocity || a.midi - b.midi);
  const keepMiddleCount = maxChordSize - 2;
  const keptMiddle = middle.slice(0, keepMiddleCount).sort((a, b) => a.midi - b.midi);

  return [bass, ...keptMiddle, melody].sort((a, b) => a.midi - b.midi);
}

export function quantizeNotes(notes: NoteEvent[], stepSec: number, keymap: VpKeymap): QuantizedNoteEvent[] {
  const quantized: QuantizedNoteEvent[] = [];

  for (const note of notes) {
    const vpKey = keymap.midiToKey[note.midi];
    if (!vpKey) {
      continue;
    }

    const startSlot = Math.round(note.startSec / stepSec);
    const durSlots = Math.max(1, Math.round(note.durationSec / stepSec));
    const endSlot = startSlot + durSlots;

    quantized.push({
      ...note,
      startSlot,
      durSlots,
      endSlot,
      vpKey
    });
  }

  return quantized.sort((a, b) => a.startSlot - b.startSlot || a.midi - b.midi);
}

export function buildTimeline(quantized: QuantizedNoteEvent[], options: TimelineOptions): TimelineSlot[] {
  const bySlot = new Map<number, QuantizedNoteEvent[]>();
  let maxSlot = 0;

  for (const note of quantized) {
    const list = bySlot.get(note.startSlot) ?? [];
    list.push(note);
    bySlot.set(note.startSlot, list);
    if (note.startSlot > maxSlot) {
      maxSlot = note.startSlot;
    }
  }

  const timeline: TimelineSlot[] = [];

  for (let slot = 0; slot <= maxSlot; slot += 1) {
    const notes = bySlot.get(slot) ?? [];

    const mergedByPitch = new Map<number, QuantizedNoteEvent>();
    for (const note of notes) {
      const existing = mergedByPitch.get(note.midi);
      if (!existing || note.velocity > existing.velocity) {
        mergedByPitch.set(note.midi, note);
      }
    }

    const unique = [...mergedByPitch.values()];
    const slotNotes = options.simplifyChords
      ? simplifyChord(unique, options.maxChordSize)
      : unique.sort((a, b) => a.midi - b.midi);

    timeline.push({
      slot,
      notes: slotNotes
    });
  }

  return timeline;
}
