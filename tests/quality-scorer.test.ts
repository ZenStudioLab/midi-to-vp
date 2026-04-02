import { describe, expect, it } from 'vitest';

import {
  SCORING_RUBRIC_VERSION,
  scoreConversionQuality,
} from '../src/quality-scorer';
import type { QualitySignals } from '../src/types';

function createSignals(overrides: Partial<QualitySignals> = {}): QualitySignals {
  return {
    totalRawNotes: 100,
    inRangeNotes: 92,
    outputTotalNotes: 98,
    outputInRangeNotes: 95,
    averageChordSize: 1.5,
    peakChordSize: 4,
    avgNotesPerSecond: 4.5,
    timingJitter: 0.03,
    p95ChordSize: 3,
    hardChordRate: 0.05,
    p95NotesPerSecond: 6,
    maxNotesPerSecond: 7,
    gridConfidence: 0.9,
    ...overrides,
  };
}

describe('scoreConversionQuality', () => {
  it('returns rubric metadata, bounded signals, and derived stats', () => {
    const result = scoreConversionQuality(createSignals());

    expect(result.rubricVersion).toBe(SCORING_RUBRIC_VERSION);
    Object.values(result.signals).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
    expect(result.stats.totalNotes).toBe(98);
    expect(result.stats.inRangeNotes).toBe(95);
    expect(result.stats.avgNotesPerSecond).toBe(4.5);
    expect(result.stats.p95NotesPerSecond).toBe(6);
    expect(result.stats.maxNotesPerSecond).toBe(7);
    expect(result.stats.gridConfidence).toBe(0.9);
    expect(result.stats.durationSeconds).toBeCloseTo(98 / 4.5, 6);
  });

  it('forces score 0 for fatal in-range ratio', () => {
    const result = scoreConversionQuality(createSignals({ outputInRangeNotes: 30, outputTotalNotes: 60 }));

    expect(result.score).toBe(0);
    expect(result.reasons).toContain('FATAL_IN_RANGE_RATIO');
  });

  it('forces score 0 for fatal peak chord size', () => {
    const result = scoreConversionQuality(createSignals({ peakChordSize: 9, p95ChordSize: 6 }));

    expect(result.score).toBe(0);
    expect(result.reasons).toContain('FATAL_PEAK_CHORD_SIZE');
  });

  it('forces score 0 for fatal hard chord rate', () => {
    const result = scoreConversionQuality(createSignals({ hardChordRate: 0.31 }));

    expect(result.score).toBe(0);
    expect(result.reasons).toContain('FATAL_HARD_CHORD_RATE');
  });

  it('forces score 0 for fatal max note density', () => {
    const result = scoreConversionQuality(createSignals({ maxNotesPerSecond: 61, p95NotesPerSecond: 18 }));

    expect(result.score).toBe(0);
    expect(result.reasons).toContain('FATAL_MAX_NOTE_DENSITY');
  });

  it('falls back to the legacy raw-note population when output counters are omitted', () => {
    const { outputTotalNotes, outputInRangeNotes, ...legacySignals } = createSignals();

    const result = scoreConversionQuality(legacySignals);

    expect(outputTotalNotes).toBeDefined();
    expect(outputInRangeNotes).toBeDefined();
    expect(result.stats.totalNotes).toBe(100);
    expect(result.stats.inRangeNotes).toBe(92);
    expect(result.stats.durationSeconds).toBeCloseTo(100 / 4.5, 6);
  });

  it('rejects partial output-note populations', () => {
    expect(() => scoreConversionQuality(createSignals({ outputInRangeNotes: undefined }))).toThrow(RangeError);
    expect(() => scoreConversionQuality(createSignals({ outputTotalNotes: undefined }))).toThrow(RangeError);
  });

  it('treats timing as less authoritative when grid confidence is low', () => {
    const lowConfidence = scoreConversionQuality(createSignals({ timingJitter: 0.2, gridConfidence: 0.25 }));
    const mediumConfidence = scoreConversionQuality(createSignals({ timingJitter: 0.2, gridConfidence: 0.8 }));
    const highConfidence = scoreConversionQuality(createSignals({ timingJitter: 0.2, gridConfidence: 0.95 }));

    expect(lowConfidence.reasons).toContain('LOW_TEMPO_GRID_CONFIDENCE');
    expect(lowConfidence.reasons).not.toContain('LOW_TIMING_CONSISTENCY');
    expect(mediumConfidence.reasons).toContain('LOW_TIMING_CONSISTENCY');
    expect(highConfidence.reasons).toContain('FATAL_TIMING_CONSISTENCY');
    expect(lowConfidence.score).toBeGreaterThan(highConfidence.score);
  });

  it('emits reasons in deterministic severity order', () => {
    const result = scoreConversionQuality(
      createSignals({
        outputInRangeNotes: 60,
        outputTotalNotes: 100,
        peakChordSize: 6,
        p95ChordSize: 4,
        hardChordRate: 0.2,
        timingJitter: 0.08,
        p95NotesPerSecond: 9,
        maxNotesPerSecond: 13,
        gridConfidence: 0.25,
      }),
    );

    expect(result.reasons).toEqual([
      'LOW_IN_RANGE_RATIO',
      'HIGH_PEAK_CHORD_SIZE',
      'HIGH_HARD_CHORD_RATE',
      'LOW_TEMPO_GRID_CONFIDENCE',
    ]);
  });

  it('validates malformed signal sets', () => {
    expect(() => scoreConversionQuality(createSignals({ inRangeNotes: Number.NaN }))).toThrow(RangeError);
    expect(() => scoreConversionQuality(createSignals({ hardChordRate: -0.1 }))).toThrow(RangeError);
    expect(() => scoreConversionQuality(createSignals({ inRangeNotes: 120 }))).toThrow(RangeError);
    expect(() => scoreConversionQuality(createSignals({ averageChordSize: 5, peakChordSize: 4 }))).toThrow(RangeError);
    expect(() => scoreConversionQuality(createSignals({ p95ChordSize: 5, peakChordSize: 4 }))).toThrow(RangeError);
    expect(() => scoreConversionQuality(createSignals({ p95NotesPerSecond: 8, maxNotesPerSecond: 7 }))).toThrow(RangeError);
    expect(() => scoreConversionQuality(createSignals({ gridConfidence: 1.1 }))).toThrow(RangeError);
  });
});