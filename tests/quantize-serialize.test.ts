import { describe, expect, it } from 'vitest';
import { convertMidiToVp } from '../src/index';
import { createDefaultVpKeymap } from '../src/keymap';
import { quantizeNotes } from '../src/quantize';
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
      quantization: { slotsPerQuarter: 4 }
    });

    const slotZero = result.timeline.find((slot) => slot.slot === 0);
    expect(slotZero).toBeDefined();
    expect(slotZero!.notes.length).toBeLessThanOrEqual(3);

    const pitches = slotZero!.notes.map((note) => note.midi).sort((a, b) => a - b);
    expect(pitches[0]).toBe(60);
    expect(pitches[pitches.length - 1]).toBe(77);
  });

  it('merges near-simultaneous duplicate notes into a single quantized event', () => {
    const keymap = createDefaultVpKeymap();
    const quantized = quantizeNotes(
      [
        {
          midi: 60,
          startSec: 0,
          durationSec: 0.24,
          endSec: 0.24,
          velocity: 0.8,
          track: 0,
          channel: 0
        },
        {
          midi: 60,
          startSec: 0.12,
          durationSec: 0.23,
          endSec: 0.35,
          velocity: 0.9,
          track: 0,
          channel: 0
        }
      ],
      0.25,
      keymap
    );

    expect(quantized).toHaveLength(1);
    expect(quantized[0]).toMatchObject({
      startSlot: 0,
      durSlots: 1,
      vpKey: 't',
      velocity: 0.9
    });
  });

  it('never emits more than three notes in a public conversion chord even when chord simplification is disabled', () => {
    const result = convertMidiToVp(createDenseChordMidi(), {
      simplifyChords: false,
      quantization: { slotsPerQuarter: 4 },
    });

    const slotZero = result.timeline.find((slot) => slot.slot === 0);
    expect(slotZero).toBeDefined();
    expect(slotZero!.notes.length).toBeLessThanOrEqual(3);
  });
});
