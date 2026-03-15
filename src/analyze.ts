import type { AnalysisResult, DifficultyLevel } from './types.js';

type ParsedSlot = {
  notes: string[];
  isRest: boolean;
};

const KEY_SEQUENCE = '1234567890qwertyuiopasdfghjklzxcvbnm';

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

function parseNotation(notation: string): ParsedSlot[] {
  const cleaned = notation.replace(/\s+/g, '').trim();
  if (!cleaned) {
    return [];
  }

  const slots: ParsedSlot[] = [];
  let index = 0;

  while (index < cleaned.length) {
    const char = cleaned[index];

    if (char === '-') {
      slots.push({ notes: [], isRest: true });
      index += 1;
      continue;
    }

    if (char === '[') {
      const close = cleaned.indexOf(']', index + 1);
      if (close === -1) {
        break;
      }

      const notes = cleaned
        .slice(index + 1, close)
        .split('')
        .filter((token) => token.length > 0);
      slots.push({ notes, isRest: false });
      index = close + 1;
      continue;
    }

    slots.push({ notes: [char], isRest: false });
    index += 1;
  }

  return slots;
}

function toKeyIndex(note: string): number {
  const idx = KEY_SEQUENCE.indexOf(note.toLowerCase());
  if (idx >= 0) {
    return idx;
  }

  const code = note.charCodeAt(0);
  if (code >= 33 && code <= 126) {
    return code - 33;
  }

  return 0;
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
  const restSlots = slots.length - noteSlots.length;
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
    const prevToken = prev.isRest ? '-' : prev.notes.join('');
    const currentToken = current.isRest ? '-' : current.notes.join('');
    if (prevToken !== currentToken) {
      transitions += 1;
    }
  }
  const rhythmicComplexity = clampScore((transitions / Math.max(1, slots.length - 1)) * 40 + (restSlots / slots.length) * 20);

  const allNotes = noteSlots.flatMap((slot) => slot.notes);
  const indices = allNotes.map(toKeyIndex);
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
