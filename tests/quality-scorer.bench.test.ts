import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { scoreConversionQuality } from "../src/quality-scorer";
import type { QualitySignals } from "../src/types";

function createSignals(
  overrides: Partial<QualitySignals> = {},
): QualitySignals {
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

describe("scoreConversionQuality regressions", () => {
  it("rejects malformed scoring contracts before large-file scoring begins", () => {
    expect(() =>
      scoreConversionQuality(createSignals({ outputInRangeNotes: undefined })),
    ).toThrow(RangeError);

    expect(() =>
      scoreConversionQuality(createSignals({ outputTotalNotes: undefined })),
    ).toThrow(RangeError);

    expect(() =>
      scoreConversionQuality(
        createSignals({ p95NotesPerSecond: 20, maxNotesPerSecond: 12 }),
      ),
    ).toThrow(RangeError);
  });

  it("keeps large MIDI scoring bounded and numerically stable", () => {
    const signals = createSignals({
      totalRawNotes: 500_000,
      inRangeNotes: 490_000,
      outputTotalNotes: 500_000,
      outputInRangeNotes: 490_000,
      averageChordSize: 1.02,
      peakChordSize: 4,
      avgNotesPerSecond: 4.5,
      timingJitter: 0.004,
      p95ChordSize: 3,
      hardChordRate: 0.002,
      p95NotesPerSecond: 6,
      maxNotesPerSecond: 8,
      gridConfidence: 0.95,
    });

    const started = performance.now();
    let assessment = scoreConversionQuality(signals);

    for (let index = 0; index < 24_999; index += 1) {
      assessment = scoreConversionQuality(signals);
    }

    const elapsedMs = performance.now() - started;

    expect(assessment.score).toBeGreaterThan(0);
    expect(assessment.score).toBeLessThanOrEqual(1);
    expect(assessment.stats.totalNotes).toBe(500_000);
    expect(assessment.stats.inRangeNotes).toBe(490_000);
    expect(assessment.stats.durationSeconds).toBeCloseTo(500_000 / 4.5, 6);
    expect(Number.isFinite(assessment.stats.durationSeconds)).toBe(true);
    expect(elapsedMs).toBeLessThan(1_000);
  });
});
