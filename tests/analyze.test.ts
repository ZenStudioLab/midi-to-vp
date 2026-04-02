import { describe, expect, it } from 'vitest';
import { analyzeVpNotation, convertMidiToVp } from '../src/index';
import { createDenseChordMidi, createMidiFixture } from './helpers/midi-fixture';

describe('notation analysis', () => {
  it('returns zeroed metrics and Novice recommendation for empty notation', () => {
    const result = analyzeVpNotation('');

    expect(result.noteDensity).toBe(0);
    expect(result.chordComplexity).toBe(0);
    expect(result.rhythmicComplexity).toBe(0);
    expect(result.rangeScore).toBe(0);
    expect(result.overallScore).toBe(0);
    expect(result.recommendedLevel).toBe('Novice');
  });

  it('recommends easier levels for simple notation', () => {
    const result = analyzeVpNotation('abc');

    expect(result.overallScore).toBeLessThanOrEqual(40);
    expect(['Novice', 'Apprentice']).toContain(result.recommendedLevel);
  });

  it('recommends Master or Guru for dense chord-heavy notation', () => {
    const notation = '[asdf]-[hjkl]-[qwer]-[tyui]-[zxcv]-[bnm1]';
    const result = analyzeVpNotation(notation);

    expect(result.noteDensity).toBeGreaterThan(50);
    expect(result.chordComplexity).toBeGreaterThan(50);
    expect(result.overallScore).toBeGreaterThan(60);
    expect(['Master', 'Guru']).toContain(result.recommendedLevel);
  });

  it('can analyze notation produced by conversion output', () => {
    const converted = convertMidiToVp(createMidiFixture(), { notationMode: 'extended' });
    const result = analyzeVpNotation(converted.notation.selected);

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it('scores denser converted music higher than sparse music', () => {
    const sparse = convertMidiToVp(createMidiFixture(), { notationMode: 'extended' });
    const dense = convertMidiToVp(createDenseChordMidi(), { notationMode: 'extended' });

    const sparseAnalysis = analyzeVpNotation(sparse.notation.selected);
    const denseAnalysis = analyzeVpNotation(dense.notation.selected);

    expect(denseAnalysis.overallScore).toBeGreaterThan(sparseAnalysis.overallScore);
  });

  it('handles uppercase and shifted VP keys correctly', () => {
    const result = analyzeVpNotation('[aSdf]');
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.chordComplexity).toBeGreaterThan(0);
  });

  it('excludes unknown tokens from range calculations without crashing', () => {
    const withUnknown = analyzeVpNotation('[asd??f]');
    const withoutUnknown = analyzeVpNotation('[asdf]');
    expect(withUnknown.rangeScore).toBe(withoutUnknown.rangeScore);
  });

  it('returns valid metrics for mixed valid and invalid tokens', () => {
    const result = analyzeVpNotation('[a1!]');
    expect(result.noteDensity).toBeGreaterThan(0);
    expect(result.overallScore).toBeGreaterThan(0);
  });
});
