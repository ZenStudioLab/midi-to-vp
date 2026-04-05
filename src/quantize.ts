import type {
  NoteEvent,
  QuantizedNoteEvent,
  TimelineSlot,
  VpKeymap,
} from "./types.js";

type TimelineOptions = {
  simplifyChords: boolean;
  maxChordSize: number;
};

function simplifyChord(
  notes: QuantizedNoteEvent[],
  maxChordSize: number,
): QuantizedNoteEvent[] {
  const allowedChordSize = maxChordSize;

  if (notes.length <= allowedChordSize) {
    return [...notes].sort((a, b) => a.midi - b.midi);
  }

  const sorted = [...notes].sort((a, b) => a.midi - b.midi);
  const bass = sorted[0];
  const melody = sorted[sorted.length - 1];

  if (allowedChordSize <= 1) {
    return [melody];
  }

  if (allowedChordSize === 2) {
    return [bass, melody];
  }

  const middle = sorted
    .slice(1, -1)
    .sort((a, b) => b.velocity - a.velocity || a.midi - b.midi);
  const keepMiddleCount = allowedChordSize - 2;
  const keptMiddle = middle
    .slice(0, keepMiddleCount)
    .sort((a, b) => a.midi - b.midi);

  return [bass, ...keptMiddle, melody].sort((a, b) => a.midi - b.midi);
}

export function quantizeNotes(
  notes: NoteEvent[],
  stepSec: number,
  keymap: VpKeymap,
): QuantizedNoteEvent[] {
  const deduped = new Map<string, QuantizedNoteEvent>();

  for (const note of notes) {
    if (note.durationSec <= 0) {
      continue;
    }

    const vpKey = keymap.midiToKey[note.midi];
    if (!vpKey) {
      continue;
    }

    const startSlot = Math.round(note.startSec / stepSec);
    const durSlots = Math.max(1, Math.round(note.durationSec / stepSec));
    const endSlot = startSlot + durSlots;

    const quantizedNote: QuantizedNoteEvent = {
      ...note,
      startSlot,
      durSlots,
      endSlot,
      vpKey,
    };

    const dedupeKey = `${startSlot}:${note.midi}:${note.channel}`;
    const existing = deduped.get(dedupeKey);

    if (!existing) {
      deduped.set(dedupeKey, quantizedNote);
      continue;
    }

    deduped.set(dedupeKey, {
      ...existing,
      durationSec: Math.max(existing.durationSec, quantizedNote.durationSec),
      endSec: Math.max(existing.endSec, quantizedNote.endSec),
      durSlots: Math.max(existing.durSlots, quantizedNote.durSlots),
      endSlot: Math.max(existing.endSlot, quantizedNote.endSlot),
      velocity: Math.max(existing.velocity, quantizedNote.velocity),
    });
  }

  return [...deduped.values()].sort(
    (a, b) => a.startSlot - b.startSlot || a.midi - b.midi,
  );
}

export function buildTimeline(
  quantized: QuantizedNoteEvent[],
  options: TimelineOptions,
): TimelineSlot[] {
  if (quantized.length === 0) {
    return [];
  }

  const bySlot = new Map<number, QuantizedNoteEvent[]>();
  let maxEndSlotExclusive = 0;

  for (const note of quantized) {
    const list = bySlot.get(note.startSlot) ?? [];
    list.push(note);
    bySlot.set(note.startSlot, list);
    if (note.endSlot > maxEndSlotExclusive) {
      maxEndSlotExclusive = note.endSlot;
    }
  }

  // Pre-compute active note counts per slot using boundary sweep (O(n))
  // This avoids O(n*m) per-slot reduce in the loop below
  const slotActiveCounts = new Map<number, number>();
  for (const note of quantized) {
    for (let s = note.startSlot; s < note.endSlot; s++) {
      slotActiveCounts.set(s, (slotActiveCounts.get(s) ?? 0) + 1);
    }
  }

  const timeline: TimelineSlot[] = [];

  for (let slot = 0; slot < maxEndSlotExclusive; slot += 1) {
    const onsetNotes = bySlot.get(slot) ?? [];

    const mergedByPitch = new Map<number, QuantizedNoteEvent>();
    for (const note of onsetNotes) {
      const existing = mergedByPitch.get(note.midi);
      if (!existing || note.velocity > existing.velocity) {
        mergedByPitch.set(note.midi, note);
      }
    }

    const unique = [...mergedByPitch.values()];
    const slotNotes = options.simplifyChords
      ? simplifyChord(unique, options.maxChordSize)
      : unique.sort((a, b) => a.midi - b.midi).slice(0, options.maxChordSize);
    const activeNoteCount = slotActiveCounts.get(slot) ?? 0;
    const slotType =
      slotNotes.length > 0 ? "onset" : activeNoteCount > 0 ? "sustain" : "rest";

    timeline.push({
      slot,
      slotType,
      activeNoteCount,
      notes: slotNotes,
    });
  }

  return timeline;
}
