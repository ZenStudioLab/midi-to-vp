import { describe, expect, it } from 'vitest';
import { convertMidiToVp } from '../src/index';
import { createMidiFixture } from './helpers/midi-fixture';

describe('transposeSemitones option', () => {
  it('applying +3 semitones shifts all transformed note MIDI values up by 3', () => {
    const baseline = convertMidiToVp(createMidiFixture());
    const transposed = convertMidiToVp(createMidiFixture(), { transposeSemitones: 3 });

    const baselineMidis = baseline.transformedNotes.map((n) => n.midi);
    const transposedMidis = transposed.transformedNotes.map((n) => n.midi);

    expect(transposedMidis).not.toEqual(baselineMidis);
    // Each note should be exactly 3 semitones higher (fixture notes are safely within VP range)
    baselineMidis.forEach((midi, i) => {
      expect(transposedMidis[i]).toBe(midi + 3);
    });
  });

  it('result.transposeSemitones reflects the user-specified offset on top of auto-transpose', () => {
    const baseline = convertMidiToVp(createMidiFixture());
    const transposed = convertMidiToVp(createMidiFixture(), { transposeSemitones: 3 });

    expect(transposed.transposeSemitones).toBe(baseline.transposeSemitones + 3);
  });

  it('negative transpose shifts notes down', () => {
    const baseline = convertMidiToVp(createMidiFixture());
    const transposed = convertMidiToVp(createMidiFixture(), { transposeSemitones: -5 });

    const baselineMidis = baseline.transformedNotes.map((n) => n.midi);
    const transposedMidis = transposed.transformedNotes.map((n) => n.midi);

    baselineMidis.forEach((midi, i) => {
      expect(transposedMidis[i]).toBe(midi - 5);
    });
  });

  it('zero transpose produces identical result to default', () => {
    const baseline = convertMidiToVp(createMidiFixture());
    const zeroed = convertMidiToVp(createMidiFixture(), { transposeSemitones: 0 });

    expect(zeroed.transformedNotes.map((n) => n.midi)).toEqual(
      baseline.transformedNotes.map((n) => n.midi)
    );
  });
});
