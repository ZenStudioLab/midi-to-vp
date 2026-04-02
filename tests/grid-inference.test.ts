import { describe, expect, it } from 'vitest';

import { inferTempoGrid } from '../src/grid-inference';

describe('inferTempoGrid', () => {
  it('infers a stable grid from evenly spaced onsets', () => {
    const result = inferTempoGrid([0, 0.5, 1, 1.5, 2]);

    expect(result.beatGrid.length).toBeGreaterThan(3);
    expect(result.confidence).toBeGreaterThan(0.95);
    expect(result.beatGrid[1] - result.beatGrid[0]).toBeCloseTo(0.5, 6);
  });

  it('uses tempo segments when they provide a clearer beat grid', () => {
    const result = inferTempoGrid(
      [0.02, 0.48, 1.03],
      [{ ticks: 0, bpm: 120, timeSec: 0 }],
    );

    expect(result.beatGrid.length).toBeGreaterThan(2);
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.beatGrid[1] - result.beatGrid[0]).toBeCloseTo(0.5, 6);
  });

  it('falls back to a low-confidence grid when tempo metadata is invalid', () => {
    const result = inferTempoGrid(
      [0, 0.61, 1.42],
      [{ ticks: 0, bpm: 500, timeSec: 0 }],
    );

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThan(0.8);
    expect(result.beatGrid.every(Number.isFinite)).toBe(true);
    expect([...result.beatGrid].sort((left, right) => left - right)).toEqual(result.beatGrid);
  });

  it('keeps irregular onset sequences finite and low confidence', () => {
    const result = inferTempoGrid([0, 0.19, 0.61, 1.04, 1.61]);

    expect(result.beatGrid.every(Number.isFinite)).toBe(true);
    expect(result.confidence).toBeLessThan(0.85);
  });

  it('returns IOI result when tempo segments have zero confidence', () => {
    const result = inferTempoGrid(
      [0, 0.5, 1, 1.5, 2],
      [],
    );

    expect(result.confidence).toBeGreaterThan(0);
    expect(result.beatGrid.length).toBeGreaterThan(3);
    expect(result.beatGrid[1] - result.beatGrid[0]).toBeCloseTo(0.5, 6);
  });

  it('returns IOI result when IOI confidence is higher than tempo confidence', () => {
    const evenlySpacedOnsets = [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const tempoSegments = [{ ticks: 0, bpm: 120, timeSec: 0 }];

    const result = inferTempoGrid(evenlySpacedOnsets, tempoSegments);

    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.beatGrid[1] - result.beatGrid[0]).toBeCloseTo(0.25, 6);
  });
});