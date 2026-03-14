import { describe, expect, it } from 'vitest';
import { convertMidiToVp } from '../src/index';
import { createMidiFixture } from './helpers/midi-fixture';

describe('parse + normalize', () => {
  it('parses a MIDI fixture into normalized note events', () => {
    const result = convertMidiToVp(createMidiFixture());

    expect(result.normalizedNotes.length).toBeGreaterThanOrEqual(5);
    expect(result.normalizedNotes[0]).toMatchObject({
      midi: 60,
      startSec: 0,
      durationSec: 0.125,
      endSec: 0.125,
      track: 0,
      channel: 0
    });
    expect(result.tempoSegments[0]?.bpm).toBe(120);
  });

  it('filters percussion by default and can include it via option', () => {
    const defaultResult = convertMidiToVp(createMidiFixture());
    const includePercussion = convertMidiToVp(createMidiFixture(), { includePercussion: true });

    expect(defaultResult.transformedNotes.some((note) => note.channel === 9)).toBe(false);
    expect(includePercussion.transformedNotes.some((note) => note.channel === 9)).toBe(true);
  });
});
