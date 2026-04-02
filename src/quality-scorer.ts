import type { QualitySignalSet, QualitySignals, QualityStats, ReasonCode, ScoringAssessment } from './types.js';

export const SCORING_RUBRIC_VERSION = 'v2';

export const SCORING_WEIGHTS = {
  inRangeRatio: 0.3,
  chordComplexity: 0.3,
  noteDensity: 0.2,
  timingConsistency: 0.2,
} as const;

export type ValidationFailureReasonCode = Extract<
  ReasonCode,
  | 'INPUT_LIMIT_EXCEEDED_FILE_SIZE'
  | 'INPUT_LIMIT_EXCEEDED_EVENT_COUNT'
  | 'INPUT_LIMIT_EXCEEDED_DURATION'
  | 'INPUT_LIMIT_EXCEEDED_TRACK_COUNT'
>;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function quantile(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(percentile * sorted.length) - 1));
  return sorted[index];
}

function createZeroSignalSet(): QualitySignalSet {
  return {
    inRangeRatio: 0,
    chordComplexity: 0,
    noteDensity: 0,
    timingConsistency: 0,
  };
}

function createZeroStats(): QualityStats {
  return {
    totalNotes: 0,
    inRangeNotes: 0,
    averageChordSize: 0,
    peakChordSize: 0,
    p95ChordSize: 0,
    hardChordRate: 0,
    avgNotesPerSecond: 0,
    p95NotesPerSecond: 0,
    maxNotesPerSecond: 0,
    timingJitter: 0,
    gridConfidence: 0,
    durationSeconds: 0,
  };
}

function resolveScoredPopulation(input: QualitySignals) {
  const hasOutputTotalNotes = input.outputTotalNotes !== undefined;
  const hasOutputInRangeNotes = input.outputInRangeNotes !== undefined;

  if (hasOutputTotalNotes !== hasOutputInRangeNotes) {
    throw new RangeError('QualitySignals.outputTotalNotes and outputInRangeNotes must be provided together');
  }

  return {
    totalNotes: input.outputTotalNotes ?? input.totalRawNotes,
    inRangeNotes: input.outputInRangeNotes ?? input.inRangeNotes,
  };
}

function validateSignals(input: QualitySignals): void {
  const entries = Object.entries(input) as Array<[keyof QualitySignals, number]>;

  for (const [field, value] of entries) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`QualitySignals.${field} must be finite; received ${value}`);
    }

    if (value < 0) {
      throw new RangeError(`QualitySignals.${field} must be >= 0; received ${value}`);
    }
  }

  if (input.inRangeNotes > input.totalRawNotes) {
    throw new RangeError(
      `QualitySignals.inRangeNotes (${input.inRangeNotes}) must be <= totalRawNotes (${input.totalRawNotes})`,
    );
  }

  const scoredPopulation = resolveScoredPopulation(input);

  if (scoredPopulation.inRangeNotes > scoredPopulation.totalNotes) {
    throw new RangeError(
      `QualitySignals.outputInRangeNotes (${scoredPopulation.inRangeNotes}) must be <= outputTotalNotes (${scoredPopulation.totalNotes})`,
    );
  }

  if (input.totalRawNotes > 0 && input.averageChordSize > input.peakChordSize) {
    throw new RangeError(
      `QualitySignals.averageChordSize (${input.averageChordSize}) must be <= peakChordSize (${input.peakChordSize})`,
    );
  }

  if (input.p95ChordSize > input.peakChordSize) {
    throw new RangeError(
      `QualitySignals.p95ChordSize (${input.p95ChordSize}) must be <= peakChordSize (${input.peakChordSize})`,
    );
  }

  if (input.p95NotesPerSecond > input.maxNotesPerSecond) {
    throw new RangeError(
      `QualitySignals.p95NotesPerSecond (${input.p95NotesPerSecond}) must be <= maxNotesPerSecond (${input.maxNotesPerSecond})`,
    );
  }

  if (input.gridConfidence > 1) {
    throw new RangeError(`QualitySignals.gridConfidence must be <= 1; received ${input.gridConfidence}`);
  }
}

function buildStats(input: QualitySignals): QualityStats {
  const scoredPopulation = resolveScoredPopulation(input);
  const durationSeconds = input.avgNotesPerSecond > 0 ? scoredPopulation.totalNotes / input.avgNotesPerSecond : 0;

  return {
    totalNotes: scoredPopulation.totalNotes,
    inRangeNotes: scoredPopulation.inRangeNotes,
    averageChordSize: input.averageChordSize,
    peakChordSize: input.peakChordSize,
    p95ChordSize: input.p95ChordSize,
    hardChordRate: input.hardChordRate,
    avgNotesPerSecond: input.avgNotesPerSecond,
    p95NotesPerSecond: input.p95NotesPerSecond,
    maxNotesPerSecond: input.maxNotesPerSecond,
    timingJitter: input.timingJitter,
    gridConfidence: input.gridConfidence,
    durationSeconds: Number(durationSeconds.toFixed(6)),
  };
}

export function normalizeSignals(input: QualitySignals): QualitySignalSet {
  validateSignals(input);

  const scoredPopulation = resolveScoredPopulation(input);

  if (scoredPopulation.totalNotes === 0) {
    return createZeroSignalSet();
  }

  const inRangeRatio = clamp01(scoredPopulation.inRangeNotes / scoredPopulation.totalNotes);

  const avgPenalty = clamp01((input.averageChordSize - 1) / 4);
  const peakPenalty = clamp01((input.peakChordSize - 3) / 5);
  const p95Penalty = clamp01((input.p95ChordSize - 3) / 4);
  const hardPenalty = clamp01(input.hardChordRate / 0.25);
  const chordComplexity = clamp01(1 - (avgPenalty * 0.35 + peakPenalty * 0.15 + p95Penalty * 0.25 + hardPenalty * 0.25));

  const avgDensityPenalty = clamp01(Math.abs(input.avgNotesPerSecond - 4) / 8);
  const p95DensityPenalty = clamp01(Math.max(0, input.p95NotesPerSecond - 8) / 8);
  const maxDensityPenalty = clamp01(Math.max(0, input.maxNotesPerSecond - 12) / 12);
  const noteDensity = clamp01(1 - (avgDensityPenalty * 0.35 + p95DensityPenalty * 0.4 + maxDensityPenalty * 0.25));

  const timingConsistency = clamp01(1 - input.timingJitter / 0.12);

  return {
    inRangeRatio,
    chordComplexity,
    noteDensity,
    timingConsistency,
  };
}

export function getEffectiveQualityWeights(gridConfidence: number) {
  const normalizedConfidence = clamp01(gridConfidence);
  const effectiveTimingWeight = SCORING_WEIGHTS.timingConsistency * normalizedConfidence;
  const redistributed = SCORING_WEIGHTS.timingConsistency - effectiveTimingWeight;
  const scale = redistributed >= 1 ? 1 : 1 / (1 - redistributed);

  return {
    inRangeRatio: Number((SCORING_WEIGHTS.inRangeRatio * scale).toFixed(12)),
    chordComplexity: Number((SCORING_WEIGHTS.chordComplexity * scale).toFixed(12)),
    noteDensity: Number((SCORING_WEIGHTS.noteDensity * scale).toFixed(12)),
    timingConsistency: Number((effectiveTimingWeight * scale).toFixed(12)),
  };
}

function collectReasons(input: QualitySignals, signals: QualitySignalSet): ReasonCode[] {
  const reasons: ReasonCode[] = [];

  if (signals.inRangeRatio < 0.55) {
    reasons.push('FATAL_IN_RANGE_RATIO');
  } else if (signals.inRangeRatio < 0.7) {
    reasons.push('LOW_IN_RANGE_RATIO');
  }

  if (input.peakChordSize >= 9) {
    reasons.push('FATAL_PEAK_CHORD_SIZE');
  } else if (input.peakChordSize >= 6) {
    reasons.push('HIGH_PEAK_CHORD_SIZE');
  }

  if (input.hardChordRate > 0.3) {
    reasons.push('FATAL_HARD_CHORD_RATE');
  } else if (input.hardChordRate > 0.15) {
    reasons.push('HIGH_HARD_CHORD_RATE');
  }

  if (input.maxNotesPerSecond > 60) {
    reasons.push('FATAL_MAX_NOTE_DENSITY');
  } else if (input.p95NotesPerSecond > 16 || input.maxNotesPerSecond > 24) {
    reasons.push('HIGH_LOCAL_NOTE_DENSITY');
  }

  if (input.gridConfidence < 0.5) {
    reasons.push('LOW_TEMPO_GRID_CONFIDENCE');
  } else if (input.gridConfidence >= 0.9 && signals.timingConsistency < 0.35) {
    reasons.push('FATAL_TIMING_CONSISTENCY');
  } else if (input.gridConfidence >= 0.75 && signals.timingConsistency < 0.65) {
    reasons.push('LOW_TIMING_CONSISTENCY');
  }

  return reasons;
}

export function hasFatalReason(reasons: ReasonCode[]): boolean {
  return reasons.some((reason) => reason.startsWith('FATAL_') || reason.startsWith('INPUT_LIMIT_EXCEEDED_'));
}

export function createValidationFailureAssessment(reason: ValidationFailureReasonCode): ScoringAssessment {
  return {
    score: 0,
    rubricVersion: SCORING_RUBRIC_VERSION,
    signals: createZeroSignalSet(),
    reasons: [reason],
    stats: createZeroStats(),
  };
}

export function scoreConversionQuality(input: QualitySignals): ScoringAssessment {
  const signals = normalizeSignals(input);
  const stats = buildStats(input);
  const reasons = collectReasons(input, signals);

  if (hasFatalReason(reasons)) {
    return {
      score: 0,
      rubricVersion: SCORING_RUBRIC_VERSION,
      signals,
      reasons,
      stats,
    };
  }

  const weights = getEffectiveQualityWeights(input.gridConfidence);
  const score = clamp01(
    signals.inRangeRatio * weights.inRangeRatio +
      signals.chordComplexity * weights.chordComplexity +
      signals.noteDensity * weights.noteDensity +
      signals.timingConsistency * weights.timingConsistency,
  );

  return {
    score: Number(score.toFixed(6)),
    rubricVersion: SCORING_RUBRIC_VERSION,
    signals,
    reasons,
    stats,
  };
}

export function getP95(values: number[]): number {
  return quantile(values, 0.95);
}
