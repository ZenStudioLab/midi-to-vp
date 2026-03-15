import { describe, expect, it } from 'vitest';
import { convertMidiToVp } from '../src/index';
import { createDenseChordMidi, createMidiFixture, createSustainMidi } from './helpers/midi-fixture';

describe('quantize + serialize', () => {
  it('quantizes timeline deterministically and serializes chords + waits in extended mode', () => {
    const result = convertMidiToVp(createMidiFixture(), {
      notationMode: 'extended',
      quantization: { slotsPerQuarter: 4 }
    });

    expect(result.metadata.stepSec).toBeCloseTo(0.125, 6);
    expect(result.notation.extended).toContain('[tu]');
    expect(result.notation.extended).toBe('[tu]y--d');
  });

  it('serializes compact mode without dash or rest placeholders', () => {
    const result = convertMidiToVp(createSustainMidi(), {
      notationMode: 'standard',
      quantization: { slotsPerQuarter: 4 }
    });

    expect(result.notation.standard).not.toContain('-');
    expect(result.notation.standard).not.toContain('|');
    expect(result.notation.standard).toBe('ty');
  });

  it('simplifies overly dense chords while keeping bass and melody anchors', () => {
    const result = convertMidiToVp(createDenseChordMidi(), {
      quantization: { slotsPerQuarter: 4 },
      maxChordSize: 4
    });

    const slotZero = result.timeline.find((slot) => slot.slot === 0);
    expect(slotZero).toBeDefined();
    expect(slotZero!.notes.length).toBeLessThanOrEqual(4);

    const pitches = slotZero!.notes.map((note) => note.midi).sort((a, b) => a - b);
    expect(pitches[0]).toBe(60);
    expect(pitches[pitches.length - 1]).toBe(77);
  });
});
