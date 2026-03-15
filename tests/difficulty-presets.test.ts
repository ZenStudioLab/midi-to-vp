import { describe, expect, it } from 'vitest';
import { convertMidiToVp, convertMidiWithDifficulty, getDifficultyPreset } from '../src/index';
import { createMidiFixture } from './helpers/midi-fixture';

describe('difficulty presets', () => {
  it('TC-N-01: returns easy preset with compact notation and beginner-friendly options', () => {
    // Given: easy difficulty level
    const level = 'easy';

    // When: requesting the preset
    const preset = getDifficultyPreset(level);

    // Then: expected conversion options are returned
    expect(preset).toMatchObject({
      notationMode: 'zen',
      quantization: { slotsPerQuarter: 2 },
      simplifyChords: true,
      maxChordSize: 2,
      dedupe: true,
    });
  });

  it('TC-N-02: returns hardcore preset with extended notation and high-fidelity options', () => {
    // Given: hardcore difficulty level
    const level = 'hardcore';

    // When: requesting the preset
    const preset = getDifficultyPreset(level);

    // Then: expected conversion options are returned
    expect(preset).toMatchObject({
      notationMode: 'extended',
      quantization: { slotsPerQuarter: 8 },
      simplifyChords: false,
      maxChordSize: 6,
      dedupe: false,
    });
  });

  it('TC-A-01: throws for an unsupported difficulty level', () => {
    // Given: invalid difficulty value
    const invalidLevel = 'legendary' as unknown as 'easy';

    // When / Then: requesting the preset should fail with a clear message
    expect(() => getDifficultyPreset(invalidLevel)).toThrowError(
      'Unsupported difficulty level: legendary'
    );
  });

  it('TC-N-03: converts using preset options selected by difficulty level', () => {
    // Given: same MIDI input converted via direct options and difficulty helper
    const midi = createMidiFixture();
    const easyPreset = getDifficultyPreset('easy');

    // When: converting with both methods
    const direct = convertMidiToVp(midi, easyPreset);
    const viaDifficulty = convertMidiWithDifficulty(midi, 'easy');

    // Then: selected output matches the direct conversion path
    expect(viaDifficulty.notation.selected).toBe(direct.notation.selected);
    expect(viaDifficulty.notation.mode).toBe('zen');
    expect(viaDifficulty.metadata.slotsPerQuarter).toBe(2);
  });
});
