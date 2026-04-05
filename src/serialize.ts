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

function getFormatBoundary(
  slotNumber: number,
  format?: FormattingOptions | null,
): string {
  if (!format) {
    return '';
  }

  const groupSlots = format.groupSlots ?? 0;
  const lineBreakEveryGroups = format.lineBreakEveryGroups ?? 0;

  if (groupSlots <= 0) {
    return '';
  }

  if (
    lineBreakEveryGroups > 0 &&
    slotNumber % (groupSlots * lineBreakEveryGroups) === 0
  ) {
    return '\n';
  }

  if (slotNumber % groupSlots === 0) {
    return ' ';
  }

  return '';
}

function getExtendedBoundary(
  previousSlot: TimelineSlot | undefined,
  currentSlot: TimelineSlot,
): string {
  if (!previousSlot) {
    return '';
  }

  if (currentSlot.slotType === 'sustain') {
    return '';
  }

  if (currentSlot.slotType === 'rest') {
    return ' ';
  }

  return previousSlot.slotType === 'rest' ? ' ' : '';
}

function serializeExtendedTimeline(
  timeline: TimelineSlot[],
  format?: FormattingOptions | null,
): string {
  let output = '';

  timeline.forEach((slot, index) => {
    const previousSlot = index > 0 ? timeline[index - 1] : undefined;
    if (index > 0) {
      const formatBoundary = getFormatBoundary(index, format);
      output += formatBoundary || getExtendedBoundary(previousSlot, slot);
    }

    if (slot.slotType === 'onset') {
      output += renderSlotToken(slot.notes);
      return;
    }

    output += '-';
  });

  return output.trimEnd();
}

export function serializeVpTimeline(timeline: TimelineSlot[], options: SerializeOptions): string {
  if (options.mode === 'extended') {
    return serializeExtendedTimeline(timeline, options.format);
  }

  const tokens: string[] = [];

  // Standard mode: only includes notes, no timing markers
  for (const slot of timeline) {
    if (slot.slotType !== 'onset') {
      continue;
    }

    if (slot.notes.length > 0) {
      tokens.push(renderSlotToken(slot.notes));
    }
  }

  return formatTokens(tokens, options.format);
}
