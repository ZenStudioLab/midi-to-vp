import { describe, expect, it } from 'vitest';
import { convertMidiToVp, convertMidiWithLevel, getDifficultyPreset } from '../src/index';
import { createMidiFixture } from './helpers/midi-fixture';

describe('difficulty presets', () => {
  it('TC-N-01: returns Novice preset with standard notation and beginner-friendly options', () => {
    // Given: Novice difficulty level
    const level = 'Novice';

    // When: requesting the preset
    const preset = getDifficultyPreset(level);

    // Then: expected conversion options are returned
    expect(preset).toMatchObject({
      notationMode: 'standard',
      quantization: { slotsPerQuarter: 2 },
      simplifyChords: true,
      maxChordSize: 2,
      dedupe: true,
    });
  });

  it('TC-N-02: returns Guru preset with extended notation and high-fidelity options', () => {
    // Given: Guru difficulty level
    const level = 'Guru';

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
    const invalidLevel = 'legendary' as unknown as 'Novice';

    // When / Then: requesting the preset should fail with a clear message
    expect(() => getDifficultyPreset(invalidLevel)).toThrowError(
      'Unsupported difficulty level: legendary'
    );
  });

  it('TC-N-03: converts using preset options selected by difficulty level', () => {
    // Given: same MIDI input converted via direct options and difficulty helper
    const midi = createMidiFixture();
    const novicePreset = getDifficultyPreset('Novice');

    // When: converting with both methods
    const direct = convertMidiToVp(midi, novicePreset);
    const viaDifficulty = convertMidiWithLevel(midi, { level: 'Novice' });

    // Then: selected output matches the direct conversion path
    expect(viaDifficulty.notation.selected).toBe(direct.notation.selected);
    expect(viaDifficulty.notation.mode).toBe('standard');
    expect(viaDifficulty.metadata.slotsPerQuarter).toBe(2);
  });

  it('TC-N-04: applies custom overrides on top of selected level preset', () => {
    // Given: Novice preset with a custom quantization override
    const midi = createMidiFixture();

    // When: converting with preset + overrides
    const result = convertMidiWithLevel(midi, {
      level: 'Novice',
      quantization: { slotsPerQuarter: 8 },
      notationMode: 'extended'
    });

    // Then: explicit overrides take precedence
    expect(result.metadata.slotsPerQuarter).toBe(8);
    expect(result.notation.mode).toBe('extended');
  });
});
