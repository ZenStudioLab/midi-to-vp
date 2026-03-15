import { describe, expect, it } from 'vitest';
import { convertMidiToVp } from '../src/index';
import { createMidiFixture } from './helpers/midi-fixture';

describe('integration: conversion pipeline', () => {
  it('returns a rich conversion result with both notation modes and stable metadata', () => {
    const result = convertMidiToVp(createMidiFixture(), {
      notationMode: 'extended',
      quantization: { slotsPerQuarter: 4 }
    });

    expect(result.notation.extended).toBe('[tu]y--d');
    expect(result.notation.standard).toBe('[tu]yd');
    expect(result.notation.selected).toBe('[tu]y--d');
    expect(result.timeline.length).toBe(5);
    expect(result.warnings).toEqual([]);
  });

  it('keeps slot parity across notation modes', () => {
    const extended = convertMidiToVp(createMidiFixture(), { notationMode: 'extended' });
    const minimal = convertMidiToVp(createMidiFixture(), { notationMode: 'minimal' });

    expect(extended.metadata.totalSlots).toBe(minimal.metadata.totalSlots);
    expect(extended.timeline.length).toBe(minimal.timeline.length);
  });

  it('serializes standard mode without dash placeholders for empty slots', () => {
    const standardResult = convertMidiToVp(createMidiFixture(), { notationMode: 'standard' as never });

    expect(standardResult.notation.selected).toBe('[tu]yd');
    expect(standardResult.notation.selected).not.toContain('-');
    expect(standardResult.notation.selected).not.toContain('|');
    expect(standardResult.notation.mode).toBe('standard');
  });
});
