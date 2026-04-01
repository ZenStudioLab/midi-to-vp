import type { TempoSegment } from './types.js';

export type GridInferenceResult = {
  beatGrid: number[];
  confidence: number;
};

const IOI_BIN_WIDTH_SECONDS = 0.01;
const GRID_TOLERANCE_RATIO = 0.15;
const MIN_TEMPO_BPM = 20;
const MAX_TEMPO_BPM = 300;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sortUniqueOnsets(onsets: number[]): number[] {
  return [...new Set(onsets.filter((value) => Number.isFinite(value) && value >= 0).map((value) => Number(value.toFixed(6))))]
    .sort((left, right) => left - right);
}

function getLastOnset(onsets: number[]): number {
  return onsets.length === 0 ? 0 : onsets[onsets.length - 1];
}

function buildGrid(start: number, period: number, lastOnset: number): number[] {
  if (!Number.isFinite(start) || !Number.isFinite(period) || period <= 0) {
    return [];
  }

  const beatGrid: number[] = [];
  const maxTime = Math.max(lastOnset, start) + period;

  for (let current = start; current <= maxTime + 0.000001; current += period) {
    beatGrid.push(Number(current.toFixed(6)));
  }

  return beatGrid;
}

function nearestGridDistance(onset: number, gridStart: number, period: number): number {
  if (period <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const offset = (onset - gridStart) / period;
  const nearestIndex = Math.round(offset);
  const nearestGrid = gridStart + nearestIndex * period;

  return Math.abs(onset - nearestGrid);
}

function computeGridConfidence(onsets: number[], gridStart: number, period: number): number {
  if (onsets.length === 0 || period <= 0) {
    return 0;
  }

  const tolerance = period * GRID_TOLERANCE_RATIO;
  const aligned = onsets.filter((onset) => nearestGridDistance(onset, gridStart, period) <= tolerance).length;

  return clamp01(aligned / onsets.length);
}

function inferFromTempoSegments(onsets: number[], tempoSegments: TempoSegment[]): GridInferenceResult {
  if (tempoSegments.length === 0) {
    return { beatGrid: [], confidence: 0 };
  }

  const sortedSegments = [...tempoSegments].sort((left, right) => left.timeSec - right.timeSec || left.ticks - right.ticks);
  const monotonic = sortedSegments.every((segment, index) => index === 0 || segment.timeSec >= sortedSegments[index - 1].timeSec);
  const allBpmsValid = sortedSegments.every((segment) => segment.bpm >= MIN_TEMPO_BPM && segment.bpm <= MAX_TEMPO_BPM);
  const lastOnset = getLastOnset(onsets);

  if (!monotonic || !allBpmsValid) {
    return {
      beatGrid: sortedSegments.length > 0 && sortedSegments[0].bpm > 0
        ? buildGrid(sortedSegments[0].timeSec, 60 / sortedSegments[0].bpm, lastOnset)
        : [],
      confidence: 0.3,
    };
  }

  const beatGrid: number[] = [];
  for (let index = 0; index < sortedSegments.length; index += 1) {
    const segment = sortedSegments[index];
    const nextStart = sortedSegments[index + 1]?.timeSec ?? lastOnset + 60 / segment.bpm;
    const period = 60 / segment.bpm;

    for (let current = segment.timeSec; current < nextStart - 0.000001; current += period) {
      beatGrid.push(Number(current.toFixed(6)));
    }
  }

  if (beatGrid.length === 0 && sortedSegments[0]) {
    beatGrid.push(Number(sortedSegments[0].timeSec.toFixed(6)));
  }

  return {
    beatGrid,
    confidence: sortedSegments.length >= 2 ? 0.9 : 0.8,
  };
}

function inferFromIoiHistogram(onsets: number[]): GridInferenceResult {
  if (onsets.length < 2) {
    return { beatGrid: onsets, confidence: 0 };
  }

  const iois: number[] = [];
  for (let index = 1; index < onsets.length; index += 1) {
    const delta = onsets[index] - onsets[index - 1];
    if (delta > 0) {
      iois.push(delta);
    }
  }

  if (iois.length === 0) {
    return { beatGrid: [], confidence: 0 };
  }

  const histogram = new Map<number, number>();
  for (const ioi of iois) {
    const bucket = Number((Math.round(ioi / IOI_BIN_WIDTH_SECONDS) * IOI_BIN_WIDTH_SECONDS).toFixed(6));
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
  }

  const dominantPeriod = [...histogram.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? 0;
  if (dominantPeriod <= 0) {
    return { beatGrid: [], confidence: 0 };
  }

  const tolerance = dominantPeriod * GRID_TOLERANCE_RATIO;
  const clustered = iois.filter((ioi) => Math.abs(ioi - dominantPeriod) <= tolerance).length;
  const clusterFraction = clustered / iois.length;
  const confidence = computeGridConfidence(onsets, onsets[0], dominantPeriod);

  if (clusterFraction < 0.4) {
    return {
      beatGrid: buildGrid(onsets[0], dominantPeriod, getLastOnset(onsets)),
      confidence: clamp01(confidence * clusterFraction),
    };
  }

  return {
    beatGrid: buildGrid(onsets[0], dominantPeriod, getLastOnset(onsets)),
    confidence,
  };
}

export function inferTempoGrid(onsets: number[], tempoSegments: TempoSegment[] = []): GridInferenceResult {
  const sortedOnsets = sortUniqueOnsets(onsets);
  const tempoMapResult = inferFromTempoSegments(sortedOnsets, tempoSegments);
  const ioiResult = inferFromIoiHistogram(sortedOnsets);

  return tempoMapResult.confidence >= ioiResult.confidence ? tempoMapResult : ioiResult;
}
