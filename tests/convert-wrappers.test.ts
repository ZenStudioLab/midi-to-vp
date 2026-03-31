import { describe, expect, it } from 'vitest';

import {
  convertMidiToVp,
  convertMidiWithDifficulty,
  convertMidiWithLevel,
  getDifficultyPreset,
  MAX_VP_MIDI,
  MIN_VP_MIDI,
} from '../src/index';
import { createMidiFixture } from './helpers/midi-fixture';

describe('converter wrappers', () => {
  it('exports the shared VP range constants', () => {
    expect(MIN_VP_MIDI).toBe(48);
    expect(MAX_VP_MIDI).toBe(95);
  });

  it('convertMidiWithDifficulty matches convertMidiWithLevel for the same level', () => {
    const midi = createMidiFixture();

    const viaDifficulty = convertMidiWithDifficulty(midi, 'Novice', {
      notationMode: 'extended',
    });
    const viaLevel = convertMidiWithLevel(midi, {
      level: 'Novice',
      notationMode: 'extended',
    });

    expect(viaDifficulty.notation.selected).toBe(viaLevel.notation.selected);
    expect(viaDifficulty.metadata.qualitySignals).toEqual(viaLevel.metadata.qualitySignals);
  });

  it('preserves direct conversion parity when using presets plus overrides', () => {
    const midi = createMidiFixture();
    const preset = getDifficultyPreset('Adept');

    const direct = convertMidiToVp(midi, {
      ...preset,
      notationMode: 'standard',
    });
    const viaLevel = convertMidiWithLevel(midi, {
      level: 'Adept',
      notationMode: 'standard',
    });

    expect(viaLevel.notation.selected).toBe(direct.notation.selected);
    expect(viaLevel.metadata.qualitySignals).toEqual(direct.metadata.qualitySignals);
  });
});