import type { FormattingOptions, QuantizedNoteEvent, SerializeOptions, TimelineSlot } from './types.js';

const MINIMAL_KEYS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const MINIMAL_LOW_MIDI = 48; // C3
const MINIMAL_HIGH_MIDI = MINIMAL_LOW_MIDI + MINIMAL_KEYS.length - 1; // B5

function renderSlotToken(notes: QuantizedNoteEvent[]): string {
  if (notes.length === 0) {
    return '';
  }

  if (notes.length === 1) {
    return notes[0].vpKey;
  }

  const chord = notes.map((note) => note.vpKey).join('');
  return `[${chord}]`;
}

function mapMidiToMinimalKey(midi: number): string {
  let normalized = midi;
  while (normalized < MINIMAL_LOW_MIDI) {
    normalized += 12;
  }
  while (normalized > MINIMAL_HIGH_MIDI) {
    normalized -= 12;
  }

  return MINIMAL_KEYS[normalized - MINIMAL_LOW_MIDI];
}

function renderMinimalSlotToken(notes: QuantizedNoteEvent[]): string {
  if (notes.length === 0) {
    return '';
  }

  if (notes.length === 1) {
    return mapMidiToMinimalKey(notes[0].midi);
  }

  const chord = notes.map((note) => mapMidiToMinimalKey(note.midi)).join('');
  return `[${chord}]`;
}

function formatTokens(tokens: string[], format?: FormattingOptions | null): string {
  if (!format) {
    return tokens.join('');
  }

  const groupSlots = format.groupSlots ?? 0;
  const lineBreakEveryGroups = format.lineBreakEveryGroups ?? 0;

  if (groupSlots <= 0) {
    return tokens.join('');
  }

  const parts: string[] = [];

  tokens.forEach((token, index) => {
    parts.push(token);

    const slotNumber = index + 1;
    const isLast = slotNumber === tokens.length;
    if (isLast) {
      return;
    }

    if (lineBreakEveryGroups > 0 && slotNumber % (groupSlots * lineBreakEveryGroups) === 0) {
      parts.push('\n');
      return;
    }

    if (slotNumber % groupSlots === 0) {
      parts.push(' ');
    }
  });

  return parts.join('').trimEnd();
}

export function serializeVpTimeline(timeline: TimelineSlot[], options: SerializeOptions): string {
  const tokens: string[] = [];

  if (options.mode === 'extended') {
    for (const slot of timeline) {
      tokens.push(slot.notes.length > 0 ? renderSlotToken(slot.notes) : '-');
    }

    return formatTokens(tokens, options.format);
  }

  if (options.mode === 'minimal') {
    for (const slot of timeline) {
      if (slot.notes.length > 0) {
        tokens.push(renderMinimalSlotToken(slot.notes));
      }
    }

    return formatTokens(tokens, options.format);
  }

  for (const slot of timeline) {
    if (slot.notes.length > 0) {
      tokens.push(renderSlotToken(slot.notes));
    }
  }

  return formatTokens(tokens, options.format);
}
