import type { ConversionOptions, DifficultyLevel } from './types.js';

const DIFFICULTY_PRESETS: Record<DifficultyLevel, ConversionOptions> = {
  Novice: {
    notationMode: 'minimal',
    quantization: { slotsPerQuarter: 2 },
    simplifyChords: true,
    maxChordSize: 2,
    dedupe: true
  },
  Apprentice: {
    notationMode: 'minimal',
    quantization: { slotsPerQuarter: 4 },
    simplifyChords: true,
    maxChordSize: 3,
    dedupe: true
  },
  Adept: {
    notationMode: 'standard',
    quantization: { slotsPerQuarter: 4 },
    simplifyChords: true,
    maxChordSize: 4,
    dedupe: true
  },
  Master: {
    notationMode: 'extended',
    quantization: { slotsPerQuarter: 8 },
    simplifyChords: false,
    maxChordSize: 5,
    dedupe: true
  },
  Guru: {
    notationMode: 'extended',
    quantization: { slotsPerQuarter: 8 },
    simplifyChords: false,
    maxChordSize: 6,
    dedupe: false
  }
};

export function getDifficultyPreset(level: DifficultyLevel): ConversionOptions {
  const preset = DIFFICULTY_PRESETS[level];
  if (!preset) {
    throw new Error(`Unsupported difficulty level: ${String(level)}`);
  }

  return {
    ...preset,
    quantization: preset.quantization ? { ...preset.quantization } : undefined
  };
}
