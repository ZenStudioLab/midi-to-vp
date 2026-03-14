import type { FormattingOptions, QuantizedNoteEvent, SerializeOptions, TimelineSlot } from './types.js';

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

  const activeEndSlots: number[] = [];

  for (const slot of timeline) {
    for (let i = activeEndSlots.length - 1; i >= 0; i -= 1) {
      if (activeEndSlots[i] <= slot.slot) {
        activeEndSlots.splice(i, 1);
      }
    }

    if (slot.notes.length > 0) {
      tokens.push(renderSlotToken(slot.notes));
      slot.notes.forEach((note) => {
        if (note.endSlot > slot.slot + 1) {
          activeEndSlots.push(note.endSlot);
        }
      });
      continue;
    }

    tokens.push(activeEndSlots.some((endSlot) => endSlot > slot.slot) ? '-' : '|');
  }

  return formatTokens(tokens, options.format);
}
