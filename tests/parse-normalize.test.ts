import { describe, expect, it } from 'vitest';
import { convertMidiToVp } from '../src/index';
import { normalizeMidiNotes } from '../src/normalize';
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

  it('reduces timing jitter by snapping near-grid starts and durations to stable buckets', () => {
    const normalized = normalizeMidiNotes({
      tracks: [
        {
          channel: 0,
          notes: [
            { midi: 60, time: 0.004, duration: 0.247, velocity: 0.8 },
            { midi: 62, time: 0.251, duration: 0.252, velocity: 0.82 },
            { midi: 64, time: 0.498, duration: 0.249, velocity: 0.84 }
          ]
        }
      ]
    });

    expect(normalized.map((note) => note.startSec)).toEqual([0, 0.25, 0.5]);
    expect(normalized.map((note) => note.durationSec)).toEqual([0.25, 0.25, 0.25]);
  });
});
