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
    expect(result.notation.zen).toBe('[tu]y||d');
    expect(result.notation.selected).toBe('[tu]y--d');
    expect(result.timeline.length).toBe(5);
    expect(result.warnings).toEqual([]);
  });

  it('keeps slot parity across notation modes', () => {
    const extended = convertMidiToVp(createMidiFixture(), { notationMode: 'extended' });
    const zen = convertMidiToVp(createMidiFixture(), { notationMode: 'zen' });

    expect(extended.metadata.totalSlots).toBe(zen.metadata.totalSlots);
    expect(extended.timeline.length).toBe(zen.timeline.length);
  });

  it('supports standard mode as an alias of compact notation output', () => {
    const standardResult = convertMidiToVp(createMidiFixture(), { notationMode: 'standard' as never });
    const compactResult = convertMidiToVp(createMidiFixture(), { notationMode: 'zen' });

    expect(standardResult.notation.selected).toBe(compactResult.notation.zen);
    expect(standardResult.notation.mode).toBe('standard');
  });
});
