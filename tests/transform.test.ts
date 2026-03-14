import { describe, expect, it } from 'vitest';
import { convertMidiToVp } from '../src/index';
import { createRangeStressMidi } from './helpers/midi-fixture';

describe('range transform', () => {
  it('auto-transposes and folds notes into C2..C7 range while preserving relative relationships', () => {
    const result = convertMidiToVp(createRangeStressMidi());

    expect(result.metadata.vpRange.minMidi).toBe(36);
    expect(result.metadata.vpRange.maxMidi).toBe(96);
    expect(result.transformedNotes.every((note) => note.midi >= 36 && note.midi <= 96)).toBe(true);
    expect(result.transposeSemitones % 12).toBe(0);
  });
});
