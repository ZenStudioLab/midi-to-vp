# Comprehensive Code Review Findings — midi-to-vp Package
**Date**: 2026-04-01
**Scope**: Full package review (newly introduced module)
**Review Type**: Static analysis + source re-verification + adversarial plan review
**Status**: Revised on 2026-04-02 after review-log validation
**Total Findings**: 6 issues (3 P1, 3 P2)

---

## Executive Summary

The `@zen/midi-to-vp` package still has 6 actionable issues spanning correctness, scoring, CLI validation, analysis accuracy, and documentation drift. During plan review, two statements from the first draft were corrected before finalizing this document:

- The pre-transform quality-signal bug is real, but the fatal gating happens in `src/quality-scorer.ts`, not inside `src/convert.ts`
- The CLI `--out` / `--notation-out` issue is not silent overwrite of a fixed default path; it is silent acceptance of an explicitly provided flag with no value

**Key Findings**:
- Chord-size ceilings make higher-complexity presets unreachable across two quantization paths
- `qualitySignals.inRangeNotes` is computed from pre-transform notes even though downstream scoring uses it for fatal quality decisions
- Grid inference can over-prefer an IOI histogram over tempo metadata without fixture-backed guardrails
- Notation analysis collapses shifted keys and uses an invalid printable-ASCII fallback for unknown tokens
- CLI required-value flags accept missing arguments silently
- Documentation and ADRs have 5 verified drift points across 4 files

---

## Findings

### P1 — Critical Issues

#### 1. Chord Simplification Ceiling Breaks Presets Across Two Code Paths
**Files**: `src/quantize.ts`, `src/presets.ts`
**Lines**: `src/quantize.ts` L7-L28, L98-L107; `src/presets.ts` L18-L33
**Severity**: P1 — Breaks preset contract

**Problem**:
The quantizer enforces a hard maximum of 3 notes per chord in two separate places:

```typescript
const HARD_MAX_CHORD_SIZE = 3;

function simplifyChord(notes: QuantizedNoteEvent[], maxChordSize: number): QuantizedNoteEvent[] {
   const allowedChordSize = Math.min(maxChordSize, HARD_MAX_CHORD_SIZE);
```

And later:

```typescript
const slotNotes = options.simplifyChords
   ? simplifyChord(unique, options.maxChordSize)
   : simplifyChord(unique.sort((a, b) => a.midi - b.midi), HARD_MAX_CHORD_SIZE);
```

This means:
- `simplifyChords: true` still caps requested values above 3 inside `simplifyChord()`
- `simplifyChords: false` bypasses the user option entirely and always passes `3`

Affected presets:
- Adept: `maxChordSize: 4`
- Master: `simplifyChords: false`, `maxChordSize: 5`
- Guru: `simplifyChords: false`, `maxChordSize: 6`

**Impact**: Users selecting higher-fidelity presets get max-3 output regardless of advertised configuration.

**Design Question**:
Is `3` the true product ceiling, or should `maxChordSize > 3` be supported for higher-fidelity presets?

**Backward-Compatibility Note**:
- Option A changes the documented contract but preserves current runtime output
- Option B changes output for callers currently relying on the silent cap and is the riskiest option
- Option C preserves default behavior while enabling an explicit opt-in path for advanced presets

**Current Coverage Gap**:
- `tests/quantize-serialize.test.ts` only asserts dense chords are reduced to `<= 3`
- No preset-focused test verifies `Adept`, `Master`, or `Guru` behavior

**Suggested Fix**:
- Decide the product contract first:
   - Option A: Declare `3` as the real ceiling and lower preset values plus docs
   - Option B: Remove the hard cap and honor preset/requested `maxChordSize`
   - Option C: Keep `3` as the default but make the cap configurable for advanced presets
- Whichever option is chosen, align both code paths in `buildTimeline()` and `simplifyChord()`
- Add regression tests for preset-driven conversions, especially `Master` and `Guru`

---

#### 2. `inRangeNotes` Is Computed Pre-Transform But Used for Post-Conversion Quality Gating
**Files**: `src/convert.ts`, `src/quality-scorer.ts`
**Lines**: `src/convert.ts` L124-L160, L203-L210; `src/quality-scorer.ts` L110-L118, L165-L173, L222-L233
**Severity**: P1 — Can zero out quality scores using the wrong note set

**Problem**:
`computeQualitySignals()` derives `inRangeNotes` from `pitchedRawNotes`, which represent pre-transform source notes:

```typescript
const pitchedRawNotes = getPitchedNotes(rawNotes);
...
inRangeNotes: pitchedRawNotes.filter((note) => note.midi >= vpRange.minMidi && note.midi <= vpRange.maxMidi).length,
```

At the same time, `transformedNotes` is already available to the function and is used for density metrics. Downstream, `scoreConversionQuality()` computes `inRangeRatio` from `inRangeNotes / totalRawNotes` and can emit `FATAL_IN_RANGE_RATIO`, which forces the public quality score to `0`.

**Impact**:
- Output can be scored as fatally poor even after transform-stage transpose/range normalization produces playable VP notes
- The bug affects not only metadata quality stats but also the scorer contract exposed to consumers

**Design Question**:
Should `QualitySignals` describe source MIDI playability, converted-output playability, or both?

**Recommended Direction**:
Use output-oriented signals for scoring, but preserve source-oriented counters separately for diagnostics. That avoids silently redefining `totalRawNotes` while letting the scorer reason about actual converted playability.

**Scoring Contract Constraint**:
- `scoreConversionQuality()` computes `inRangeRatio` from `inRangeNotes / totalRawNotes`
- `validateSignals()` requires `inRangeNotes <= totalRawNotes`
- Any fix must keep numerator and denominator sourced from the same note population, or split the fields so the invariant stays explicit

**Dependency Note**:
- `qualitySignals` feeds `scoreConversionQuality()` in `src/quality-scorer.ts`
- This is a scoring contract issue, not just an informational metadata issue

**Current Coverage Gap**:
- `tests/quality-scorer.test.ts` verifies fatal gating in `scoreConversionQuality()` once signals are produced
- No integration test proves the `inRangeNotes` input is sourced from the correct note set after transformation

**Suggested Fix**:
- Decide whether quality scoring is source-oriented or output-oriented
- If scoring converted output, derive both `inRangeNotes` and `totalRawNotes` from the transformed pitched-note population; the parameter is already present, so no signature change is required
- If both views matter, split the signal into explicit source/output fields instead of overloading `inRangeNotes`
- Update or preserve the `validateSignals()` same-population invariant as part of the same change
- Preferred implementation path: keep source diagnostics additive, introduce explicit output-scoring counts, and point `scoreConversionQuality()` plus `buildStats()` at the output pair rather than reinterpreting existing source fields
- Add an integration test where out-of-range source notes are transposed into VP range and ensure the resulting quality assessment matches the chosen contract

---

#### 3. Grid Inference Lacks Guardrails When Tempo Metadata and IOI Histogram Disagree
**File**: `src/grid-inference.ts`
**Lines**: L8-L9, L92-L134, L137-L143
**Severity**: P1 — Can distort timing assessment on otherwise quantized material

**Problem**:
The current algorithm builds two competing grid candidates:
- tempo-map grid from tempo metadata (`confidence` `0.8` or `0.9`)
- IOI histogram grid using `IOI_BIN_WIDTH_SECONDS = 0.01`

It then picks whichever candidate has the higher confidence:

```typescript
return tempoMapResult.confidence > 0 && tempoMapResult.confidence >= ioiResult.confidence
   ? tempoMapResult
   : ioiResult;
```

This is a reasonable heuristic, but the current plan needs stronger evidence around when the histogram should outrank tempo metadata. With 10ms bins, the histogram can group tightly spaced subdivisions in a way that appears confident without proving it is musically more correct than valid tempo segments.

**Impact**:
- Timing jitter and grid-confidence outputs can be skewed by a histogram-derived beat grid even when usable tempo metadata is available
- Any downstream quality scoring that trusts `gridConfidence` and timing jitter inherits this error

**Current Coverage Gap**:
- `tests/grid-inference.test.ts` covers evenly spaced onsets, tempo segments, invalid metadata, and irregular sequences
- No test combines trustworthy tempo metadata with borderline IOI clustering to define the expected winner
- No benchmark currently defines an acceptable IOI bucketing error across 20-300 BPM and common subdivisions

**Suggested Fix**:
- Add a minimal guard first so a zero-confidence tempo-map result never wins by default tie-break:
   - `tempoMapResult.confidence > 0 && tempoMapResult.confidence >= ioiResult.confidence`
- Add a pre-analysis table before changing bin width:

| BPM | Eighth IOI | Max % Error @ 10ms bin | Sixteenth IOI | Max % Error @ 10ms bin | 16th-triplet IOI | Max % Error @ 10ms bin |
|-----|------------|------------------------|---------------|------------------------|-------------------|------------------------|
| 40  | 0.750s | 0.67% | 0.375s | 1.33% | 0.250s | 2.00% |
| 60  | 0.500s | 1.00% | 0.250s | 2.00% | 0.1667s | 3.00% |
| 90  | 0.3333s | 1.50% | 0.1667s | 3.00% | 0.1111s | 4.50% |
| 120 | 0.250s | 2.00% | 0.125s | 4.00% | 0.0833s | 6.00% |
| 180 | 0.1667s | 3.00% | 0.0833s | 6.00% | 0.0556s | 9.00% |

- Add fixture-driven tests before changing constants:
   - tempo metadata present + clean quantized onsets
   - tempo metadata present + slight humanized onset jitter
   - no tempo metadata + strong IOI cluster
- Use those fixtures to choose one of these policies:
   - prefer non-zero tempo metadata unless IOI confidence exceeds it by a defined margin
   - widen histogram bins only if tests show 10ms buckets are the root cause
   - document that tempo metadata is authoritative whenever present and valid
- Avoid arbitrary bin-width changes without benchmarked expectations across common tempos/subdivisions

---

### P2 — Medium Issues

#### 4. Notation Analysis Key Indexing Is Wrong for Shifted and Unknown Tokens
**File**: `src/analyze.ts`
**Lines**: L8, L71-L83
**Severity**: P2 — Produces incorrect range scoring and level recommendations

**Problem**:
The analyzer currently lowercases notation tokens and then falls back to printable-ASCII offsets when a token is not in `KEY_SEQUENCE`:

```typescript
const idx = KEY_SEQUENCE.indexOf(note.toLowerCase());
...
const code = note.charCodeAt(0);
if (code >= 33 && code <= 126) {
   return code - 33;
}
```

This creates two separate errors:
- shifted keys are collapsed into lowercase, so case-sensitive VP tokens cannot be distinguished
- unknown tokens are assigned arbitrary ASCII-derived positions that do not correspond to the actual VP key ordering

**Impact**:
- `rangeScore`, `overallScore`, and `recommendedLevel` become unreliable for notation containing shifted/symbol keys
- The hardcoded `KEY_SEQUENCE` can also drift from the canonical VP keymap if not validated

**Current Coverage Gap**:
- `tests/analyze.test.ts` exercises simple notation and dense lowercase chords only
- No test covers uppercase tokens, symbol tokens, or invalid-key handling

**Suggested Fix**:
- Stop lowercasing tokens in `toKeyIndex()` unless case-insensitive handling is a deliberate product rule
- Remove the printable-ASCII fallback; use canonical VP ordering only
- Either derive analysis ordering from the exported keymap/key sequence source of truth or add a test/assertion that locks `KEY_SEQUENCE` to the actual keymap contract
- Add tests for uppercase/shifted tokens and explicit invalid-token behavior

---

#### 5. CLI Required-Value Flags Accept Missing Arguments Silently
**File**: `src/cli.ts`
**Lines**: L63-L71, L82-L90, L108-L126, L140-L154
**Severity**: P2 — Violates CLI input-validation expectations

**Problem**:
The parser blindly consumes the next token for required-value flags:

```typescript
case '--out':
   options.outPath = argv[index + 1];
   index += 1;
   break;
case '--notation-out':
   options.notationOutPath = argv[index + 1];
   index += 1;
   break;
```

If a user runs `midi-to-vp song.mid --out`, `options.outPath` becomes `undefined`, validation does not reject it, and `runCli()` falls back to the derived default output path. The same pattern silently skips notation output when `--notation-out` is provided without a value.

**Impact**:
- Explicit user intent is ignored without an error
- Output lands in unexpected locations or optional artifacts are silently omitted

**Current Coverage Gap**:
- `tests/integration-cli.test.ts` covers successful writes and valid flag usage only
- No test asserts that explicitly provided required-value flags must fail when missing an argument

**Suggested Fix**:
- Reject missing values during parse or validation for every required-value flag
- Track whether the flag itself was present so omission can be distinguished from an intentionally absent optional value
- Treat `--flag --other-flag` as missing a value, not as a valid path/value
- Add integration coverage for `--out`, `--notation-out`, `--mode`, `--slots-per-quarter`, `--max-chord-size`, and `--json-indent`

---

#### 6. Documentation and ADRs Have 5 Verified Drift Points
**Files**: `README.md`, `docs/architecture.md`, `docs/adr/0007-cli-architecture.md`, `docs/adr/0002-browser-node-split.md`
**Severity**: P2 — Technical debt and onboarding friction

**Verified Drift Points**:

1. **README.md** — Extended notation description is incorrect
    - Documented: full note names with octaves (`C4 D4 E4`)
    - Reality: `serialize.ts` emits VP key tokens with dash placeholders in extended mode

2. **docs/architecture.md** — Pipeline diagram still says `Extended/Zen`
    - Reality: public modes are `extended` and `standard`

3. **docs/architecture.md** — Module table and notation section are outdated
    - Documented: `Extended (C4 D4)` or `Zen (a s)` and `Minimal` notation profiles
    - Reality: serializer outputs VP key tokens; public API exposes `standard` and `extended`

4. **docs/adr/0007-cli-architecture.md** — CLI default `maxChordSize` is wrong
    - Documented: `4`
    - Reality: `src/cli.ts` and `src/convert.ts` default to `3`

5. **docs/adr/0002-browser-node-split.md** — Node usage example imports `convertMidiFileToVp` from the root entry
    - Documented: `import { convertMidiFileToVp } from '@zen/midi-to-vp'`
    - Reality: `convertMidiFileToVp` is only exported from `@zen/midi-to-vp/node`

**Note**:
The earlier claim that `README.md` already used the wrong root import path did not reproduce during re-check and has been removed from this revised findings list.

**Impact**:
- Users can follow examples that do not match the package surface
- Architecture docs describe non-existent or renamed notation concepts
- ADR defaults drift from the implementation contract

**Suggested Fix**:
- Update README notation examples to show actual VP-token output
- Replace `Zen` / `Minimal` terminology with the current `standard` / `extended` contract unless a rename is intentionally being reintroduced
- Correct ADR 0007 defaults and ADR 0002 usage examples
- Add a doc check to release review so exported API examples and defaults are spot-checked against source

---

## Verification Matrix

| Finding | Existing Coverage | Missing Coverage |
|---------|-------------------|------------------|
| 1. Chord cap | `tests/quantize-serialize.test.ts` checks dense-chord reduction | Preset-specific tests for `Adept`, `Master`, `Guru`; explicit `simplifyChords: false` coverage |
| 2. Pre-transform `inRangeNotes` | `tests/quality-scorer.test.ts` covers scorer-side fatal gating only | Integration test proving the chosen source-vs-output contract after transform and that `validateSignals()` still holds |
| 3. Grid inference hierarchy | `tests/grid-inference.test.ts` covers simple cases | Fixtures that force tempo-vs-IOI disagreements and lock expected precedence |
| 4. Notation analysis indexing | `tests/analyze.test.ts` covers lowercase/basic notation | Uppercase, symbol, and invalid-token cases |
| 5. CLI missing args | `tests/integration-cli.test.ts` covers valid flag use | Missing-value failures for every required-value flag |
| 6. Docs drift | none | Manual review checklist or doc-lint assertions for exports/defaults/examples |

---

## Removal Plan & Iteration Priority

### Phase 1 — Product and Scoring Decisions (0.5 day)
- Decide whether `maxChordSize > 3` is a supported public contract or an invalid preset configuration
- Decide whether quality scoring should describe source MIDI, converted output, or both
- Record both decisions before implementation so fixes do not encode hidden assumptions

**Default Recommendation if no contrary product input arrives**:
- Finding 1: choose Option C (`3` stays default, advanced presets opt into higher limits explicitly)
- Finding 2: keep source diagnostics, add explicit output-oriented scoring fields, and make scorer math use the output population end to end

### Phase 2 — P1 Correctness Fixes (3 to 4 hours)
- Fix chord-cap behavior across both quantization paths
- Align quality-signal range counting with the chosen scoring contract
- Add tempo-vs-IOI fixtures and adjust grid precedence only after tests prove the failure mode

### Phase 3 — P2 Code and CLI Fixes (2 to 3 hours)
- Repair notation-analysis key indexing and remove invalid fallback behavior
- Add strict missing-argument validation for required-value CLI flags
- Add regression tests for both fixes

### Phase 4 — Documentation Sync (0.5 to 1 hour)
- Update README, architecture docs, and ADRs to match actual modes, defaults, and import surfaces
- Remove stale terminology that no longer exists in the package API

### Phase 5 — Verification (1 hour)
- Run targeted unit/integration suites for quantization, analysis, grid inference, quality scoring, and CLI
- Run the full package test suite
- Manually smoke-test at least one preset-driven conversion per difficulty tier
- Confirm docs/examples match the final implementation decisions

**Exit Criteria**:
- Finding 1: preset regression tests prove the final chord-size contract for `Adept`, `Master`, and `Guru`
- Finding 2: one integration test proves the chosen source-vs-output scoring contract, and scorer tests still pass
- Finding 3: tempo-vs-IOI fixtures pass with an agreed precedence rule and documented bucketing threshold
- Finding 4: analysis tests cover uppercase, symbol, and invalid-token paths
- Finding 5: CLI integration tests fail with exit code `1` for missing required flag values
- Finding 6: all 5 documented drift points are rechecked against source after edits

---

## Decision Matrix

| Fix Scope | Effort | Risk | Breaking Change? | Go/No-Go | Notes |
|-----------|--------|------|------------------|----------|-------|
| **All (1–6)** | ~1 day | Medium | F1: A No / B Yes / C Low; F2: Low under recommended path | ✅ Recommended | Assumes chord-cap Option C and additive source/output scoring metrics |
| **P1 Only (1–3)** | ~0.5 day | Low | F1: A No / B Yes / C Low; F2: Low under recommended path | ✅ Acceptable | Fixes the highest-risk behavior but leaves analysis/CLI/docs debt |
| **Code Only (1–5)** | ~0.75 day | Medium | F1: A No / B Yes / C Low; F2: Low under recommended path | ✅ Good | Suitable if docs update must land separately |
| **None** | 0 | High deferred risk | No | ⚠️ Defer | Leaves known contract and scoring issues in place |

---

## Next Steps

**If GREEN (implement all fixes)**:
1. Lock product decisions for chord cap and scoring scope
2. Implement P1 fixes with regression tests
3. Implement P2 fixes with regression tests
4. Sync docs and ADRs
5. Run full verification and open a PR

**If YELLOW (implement P1 only)**:
1. Lock product decisions for chord cap and scoring scope
2. Implement Findings 1-3 with tests
3. Log Findings 4-6 as follow-up work
4. Run verification and open a narrower PR

**If RED (defer fixes)**:
- Archive this revised findings document and review log
- Track the unresolved package contract risks explicitly in backlog/planning
- Revisit before wider package adoption or public release

---

## Appendix: Review Corrections Applied in This Revision

- Removed the incorrect claim that `FATAL_IN_RANGE_RATIO` logic lives inside `src/convert.ts`; the fatal gating is downstream in `src/quality-scorer.ts`
- Removed the incorrect claim that README root-import examples for `convertMidiFileToVp` were already wrong; that specific README example is currently correct
- Tightened Issue 1 to cover both `simplifyChords: true` and `simplifyChords: false` paths
- Added explicit test-coverage gaps and dependency analysis so each finding is implementation-ready
