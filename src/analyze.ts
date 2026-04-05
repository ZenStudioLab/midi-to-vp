import { createDefaultVpKeymap } from './keymap.js';
import type { AnalysisResult, DifficultyLevel } from './types.js';

type ParsedSlot = {
  notes: string[];
  slotType: 'onset' | 'sustain' | 'rest';
};

const VP_KEYMAP = createDefaultVpKeymap();
const KEY_SEQUENCE = Object.keys(VP_KEYMAP.keyToMidi).sort((a, b) => VP_KEYMAP.keyToMidi[a] - VP_KEYMAP.keyToMidi[b]).join('');

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function mapScoreToLevel(score: number): DifficultyLevel {
  if (score <= 20) {
    return 'Novice';
  }
  if (score <= 40) {
    return 'Apprentice';
  }
  if (score <= 60) {
    return 'Adept';
  }
  if (score <= 80) {
    return 'Master';
  }

  return 'Guru';
}

function consumeWhitespace(notation: string, startIndex: number): number {
  let index = startIndex;
  while (index < notation.length && /\s/.test(notation[index] ?? '')) {
    index += 1;
  }

  return index;
}

function parseChordToken(notation: string, startIndex: number): { notes: string[]; nextIndex: number } | null {
  if (notation[startIndex] !== '[') {
    return null;
  }

  const closeIndex = notation.indexOf(']', startIndex + 1);
  if (closeIndex === -1) {
    return null;
  }

  return {
    notes: notation
      .slice(startIndex + 1, closeIndex)
      .split('')
      .filter((token) => token.length > 0),
    nextIndex: closeIndex + 1,
  };
}

function parseDashRun(
  notation: string,
  startIndex: number,
  precededByWhitespace: boolean,
  previousSlot: ParsedSlot | undefined,
): { slots: ParsedSlot[]; nextIndex: number } {
  let index = startIndex;
  while (notation[index] === '-') {
    index += 1;
  }

  const runLength = index - startIndex;
  const isSustainRun = !precededByWhitespace &&
    previousSlot !== undefined &&
    previousSlot.slotType !== 'rest';
  const slotType = isSustainRun ? 'sustain' : 'rest';

  return {
    slots: Array.from({ length: runLength }, () => ({ notes: [], slotType })),
    nextIndex: index,
  };
}

function parseNotation(notation: string): ParsedSlot[] {
  const trimmed = notation.trim();
  if (!trimmed) {
    return [];
  }

  const slots: ParsedSlot[] = [];
  let index = 0;

  while (index < notation.length) {
    const nextIndex = consumeWhitespace(notation, index);
    const precededByWhitespace = nextIndex > index;
    index = nextIndex;

    if (index >= notation.length) {
      break;
    }

    const char = notation[index];

    if (char === '-') {
      const dashRun = parseDashRun(
        notation,
        index,
        precededByWhitespace,
        slots[slots.length - 1],
      );
      slots.push(...dashRun.slots);
      index = dashRun.nextIndex;
      continue;
    }

    if (char === '[') {
      const chord = parseChordToken(notation, index);
      if (!chord) {
        break;
      }

      slots.push({ notes: chord.notes, slotType: 'onset' });
      index = chord.nextIndex;
      continue;
    }

    slots.push({ notes: [char], slotType: 'onset' });
    index += 1;
  }

  return slots;
}

function toKeyIndex(note: string): number {
  const idx = KEY_SEQUENCE.indexOf(note);
  return idx >= 0 ? idx : -1;
}

export function analyzeVpNotation(notation: string): AnalysisResult {
  const slots = parseNotation(notation);
  if (slots.length === 0) {
    return {
      noteDensity: 0,
      chordComplexity: 0,
      rhythmicComplexity: 0,
      rangeScore: 0,
      overallScore: 0,
      recommendedLevel: 'Novice',
      confidence: 0
    };
  }

  const noteSlots = slots.filter((slot) => slot.notes.length > 0);
  const restSlots = slots.filter((slot) => slot.slotType === 'rest').length;
  const totalNotes = noteSlots.reduce((sum, slot) => sum + slot.notes.length, 0);
  const notesPerSlot = noteSlots.length === 0 ? 0 : totalNotes / slots.length;
  const noteDensity = clampScore(((totalNotes / Math.max(16, slots.length)) * 100) * 0.6 + (notesPerSlot / 4) * 40);

  const chordSlots = noteSlots.filter((slot) => slot.notes.length > 1);
  const maxChordSize = chordSlots.reduce((max, slot) => Math.max(max, slot.notes.length), 1);
  const chordFrequency = slots.length === 0 ? 0 : chordSlots.length / slots.length;
  const chordComplexity = clampScore((maxChordSize / 6) * 60 + chordFrequency * 40);

  let transitions = 0;
  for (let i = 1; i < slots.length; i += 1) {
    const prev = slots[i - 1];
    const current = slots[i];
    const prevToken = prev.slotType === 'onset' ? prev.notes.join('') : prev.slotType;
    const currentToken = current.slotType === 'onset' ? current.notes.join('') : current.slotType;
    if (prevToken !== currentToken) {
      transitions += 1;
    }
  }
  const rhythmicComplexity = clampScore((transitions / Math.max(1, slots.length - 1)) * 40 + (restSlots / slots.length) * 20);

  const allNotes = noteSlots.flatMap((slot) => slot.notes);
  const indices = allNotes.map(toKeyIndex).filter((idx) => idx >= 0);
  const minIndex = indices.length > 0 ? Math.min(...indices) : 0;
  const maxIndex = indices.length > 0 ? Math.max(...indices) : 0;
  const span = maxIndex - minIndex;
  const rangeScore = clampScore((span / 35) * 100);

  const overallScore = clampScore((noteDensity + chordComplexity + rhythmicComplexity + rangeScore) / 4);
  const confidence = clampScore((Math.min(slots.length, 64) / 64) * 70 + (Math.min(allNotes.length, 128) / 128) * 30);

  return {
    noteDensity,
    chordComplexity,
    rhythmicComplexity,
    rangeScore,
    overallScore,
    recommendedLevel: mapScoreToLevel(overallScore),
    confidence
  };
}
