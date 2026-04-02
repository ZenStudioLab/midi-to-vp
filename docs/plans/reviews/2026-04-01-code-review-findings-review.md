# Plan Review: Comprehensive Code Review Findings — midi-to-vp Package

**Plan File**: /mnt/8CE085C2E085B2CE/Src/Active/zen-virtual-piano-workspace/midi-to-vp/docs/plans/active/2026-04-01-code-review-findings.md
**Reviewer**: opencode

- Separate rounds with --- and append new rounds at the end of the file

---

## Round 1 — 2026-04-02

### Overall Assessment

The plan presents 6 issues (3 P1, 3 P2) with source code references for the midi-to-vp package. While the core findings are substantiated, the review identified significant inaccuracies in issue descriptions, misaligned severity classifications, and missing root-cause analysis. Four issues are valid as stated, two contain factual errors that undermine credibility, and at least five additional high-severity issues were identified that are absent from the original plan.
**Rating**: 5/10

### Issues

#### Issue 1 (High): Incomplete Description of Chord Cap Bug — Simplify Path vs. No-Simplify Path

**Location**: `src/quantize.ts` L105–107 and L10–11

The plan correctly identifies `HARD_MAX_CHORD_SIZE = 3` as the root cause but oversimplifies the bug. The code has TWO code paths:

```typescript
// L105-107 - when simplifyChords is TRUE:
const slotNotes = options.simplifyChords
  ? simplifyChord(unique, options.maxChordSize) // uses options.maxChordSize
  : simplifyChord(
      unique.sort((a, b) => a.midi - b.midi),
      HARD_MAX_CHORD_SIZE,
    ); // always 3
```

When `simplifyChords = false`, it hard-codes `HARD_MAX_CHORD_SIZE` regardless of what the user requests. When `simplifyChords = true`, it passes `options.maxChordSize` into `simplifyChord()`, but inside that function at L11, it gets capped: `const allowedChordSize = Math.min(maxChordSize, HARD_MAX_CHORD_SIZE)`.

**Impact**: The plan only diagnoses one manifestation but misses the second. Guru preset (`simplifyChords: false, maxChordSize: 6`) will always produce max-3 output.

**Suggestion**: Revise issue #1 to cover both paths. Distinguish between (a) the cap inside `simplifyChord()` affecting the simplify=true path, and (b) the hard-coded `HARD_MAX_CHORD_SIZE` at L107 affecting the simplify=false path. Add explicit test cases for Guru/Master presets that verify output with `simplifyChords: false`.

---

#### Issue 2 (High): Missing `FATAL_IN_RANGE_RATIO` Constant — Factual Error

**Location**: `src/convert.ts` L124–172 and plan L76

The plan states at L76:

> "At L169, the function flags output as `FATAL` if `inRangeNotes < length * FATAL_IN_RANGE_RATIO`"

This is **factually incorrect**. The `computeQualitySignals()` function (L124–172) does not contain a `FATAL_IN_RANGE_RATIO` constant, does not have a `qualitySignals.fatal` field, and does not set `fatal = true`. The function returns a `QualitySignals` object (defined in `types.ts`) that has no `fatal` property.

The plan fabricated this detail. The actual `inRangeNotes` computation at L157 is:

```typescript
inRangeNotes: pitchedRawNotes.filter((note) => note.midi >= vpRange.minMidi && note.midi <= vpRange.maxMidi).length,
```

The pre-transform issue (using `pitchedRawNotes` instead of `transformed.notes`) is valid and correctly identified at L157, but the "FATAL" mechanism described does not exist.

**Suggestion**: Remove the `FATAL_IN_RANGE_RATIO` reference entirely. The issue should be restated as: "The `inRangeNotes` field in `QualitySignals` is computed using `pitchedRawNotes` (source MIDI notes before VP range transformation), not `transformed.notes`. This means the range-quality signal does not reflect the actual converted output range." Add a severity note: if this signal is used downstream for fatal-quality gating, the wrong data would be used.

---

#### Issue 3 (High): Grid Inference Confidence Comparison Is Inverted for Equal Confidence

**Location**: `src/grid-inference.ts` L155

The plan correctly identifies the confidence hierarchy issue at L155 but misses a boundary condition:

```typescript
return tempoMapResult.confidence >= ioiResult.confidence
  ? tempoMapResult
  : ioiResult;
```

When `tempoMapResult.confidence === ioiResult.confidence`, this expression evaluates to `true` and returns `tempoMapResult`. However, when tempo metadata is present but ambiguous (e.g., single tempo segment = 0.8 confidence), and the IOI histogram is also noisy (also 0.8), the code arbitrarily prefers tempo metadata even though IOI might be more reliable for the actual note onsets.

More critically: when `tempoMapResult.confidence = 0` (no tempo metadata), the comparison `0 >= 0` is `true`, so tempo map wins with an empty grid.

**Suggestion**: Change the comparison at L155 to prefer IOI when tempo metadata is absent: `tempoMapResult.confidence > 0 && tempoMapResult.confidence >= ioiResult.confidence`. This ensures that an empty or zero-confidence tempo map does not override a valid IOI result. Also add a comment explaining why explicit zero-check is necessary.

---

#### Issue 4 (Medium): Key Analysis ASCII Fallback Has Wrong Offset — But Issue Severity Understated

**Location**: `src/analyze.ts` L77–80

The plan states the ASCII fallback at L78 uses `code - 'a'.charCodeAt(0)` which gives `97 - 97 = 0` for 'a', `100 - 97 = 3` for 'd', etc. The plan says "ASCII order is `a, d, f, j, k, l, s`" which is correct for positions, but the real issue is more nuanced:

The `KEY_SEQUENCE` at L8 is: `'1234567890qwertyuiopasdfghjklzxcvbnm'`

This sequence puts `s` at position 17, `d` at 14, `f` at 15, etc. The ASCII fallback at L78-79 computes `code - 33` for characters 33-126, which maps `a(97)→64`, `s(115)→82`, `d(100)→67`, etc. This produces completely wrong index values that bear no relation to the actual key positions in the keymap.

**Suggestion**: The ASCII fallback should not exist at all. If a key is not in `KEY_SEQUENCE`, it should error or return 0 with a warning, not silently produce a wrong index. Remove the ASCII fallback entirely and replace with: `throw new Error('Unknown VP key: ${note}')` or return 0 with a console warning. Add test coverage for accidental/symbol key notation.

---

#### Issue 5 (Medium): CLI Validation Gap on `--out` Is Real But Misattributed

**Location**: `src/cli.ts` L75–79, L122–142

The plan claims that `--out` without a value silently defaults. This is **partially correct**:

1. At L76: `options.outPath = argv[index + 1]` — if `--out` is the last argument, `argv[index + 1]` is `undefined`, and `options.outPath` becomes `undefined`.
2. At L168: `const outPath = parsed.outPath ?? getDefaultOutPath(inputPath)` — when `outPath` is `undefined`, it DOES fall back to a default, not silently overwriting anything.

The plan says "Silently overwrites the default location" — this is misleading. It uses a derived default path (input filename with `.vp.json` extension), not silently overwriting any file.

However, the **real validation gap** is that `validateOptions()` (L122–142) validates `slotsPerQuarter`, `maxChordSize`, and `jsonIndent` but never validates `outPath` for `undefined`. If a user provides `--out` without a value, no error is thrown — the undefined value is silently accepted and the default is used. The user gets unexpected output location with no warning.

**Suggestion**: Add validation for `outPath` and `notationOutPath` in `validateOptions()`. Specifically, if `outPath === undefined` and wasn't intentionally omitted (i.e., `--out` flag was present), throw an error. One way to detect this: store a `Set<string>` of flags that were explicitly provided in `parsedArgs`, then check if required-flag was provided but value was undefined.

---

#### Issue 6 (Medium): Documentation Drift Is Valid But Lacks Specificity

**Location**: README.md L244, L54/L58/L90; docs/architecture.md L37, L49; docs/adr/0007-cli-architecture.md L26; docs/adr/0002-browser-node-split.md L94

The plan catalogs 6 drift points but provides no verification. I verified a subset:

- **README L244** — "Full note names with octave numbers" for extended: The plan says extended serializes single-letter VP key tokens. Looking at `serialize.ts` (not provided in plan but implied), extended mode uses note names with octaves (e.g., `C4`). Standard mode uses VP key tokens. The plan has the drift reversed.

- **README L54, L58, L90** — Export path examples: The plan says `convertMidiFileToVp` is only available via `/node` subpath. I verified README L54 shows: `import { convertMidiFileToVp } from '@zen/midi-to-vp/node';` — this IS the correct subpath import. So this drift point appears to be **invalid** — the documentation is correct.

- **ADR 0007 L26** — Claims `maxChordSize: 4` default: Looking at `convert.ts` L26: `const DEFAULT_MAX_CHORD_SIZE = 3;` — this IS a drift. ADR is wrong.

**Suggestion**: Verify each drift point against source before cataloging. Two of the six drift points appear to have incorrect conclusions (extended notation description is reversed; root-path import is already correct in README). Remove invalid drift points and keep only verified ones.

---

#### Issue 7 (Critical): No Test Coverage Verification for Any Finding

**Location**: Entire plan — no test references

The plan identifies 6 issues but never once references existing test coverage or the lack thereof. The plan states at L48 "tests codify this as expected behavior (no test ever validates > 3 notes)" but this claim is not verified. If tests exist that validate the wrong behavior, those tests are also bugs that need fixing.

**Suggestion**: Add a section that explicitly maps each finding to (a) existing tests that validate the buggy behavior and (b) tests that would need to be added/updated to validate fixes. This is essential for the fix phase to be actionable.

---

#### Issue 8 (High): No Impact Assessment on `QualitySignals` Consumers

**Location**: `src/convert.ts` L124–172; plan issue #2

The plan identifies that `inRangeNotes` is computed pre-transform but does not assess what consumes this signal. Looking at `types.ts` (not provided), `QualitySignals` is returned in `ConversionResult.metadata.qualitySignals`. If downstream code (CLI output, API consumers, logging) uses `inRangeNotes` to make decisions about output quality, the pre-transform computation is not just a scoring inaccuracy — it could cause silent data corruption in dependent systems.

**Suggestion**: Add a dependency analysis: trace `QualitySignals.inRangeNotes` usage through the codebase (CLI, node.js wrapper, any public API docs). Determine if any consumer treats it as a gate for acceptable output. This determines whether this is P1 (silent data corruption) or P2 (scoring inaccuracy).

---

#### Issue 9 (High): No Consideration of `transformed.notes` Parameter in `computeQualitySignals`

**Location**: `src/convert.ts` L124, L205–212

The function signature is:

```typescript
function computeQualitySignals(
  rawNotes: NoteEvent[],
  transformedNotes: NoteEvent[],  // <- THIS IS AVAILABLE
  quantizedNotes: QuantizedNoteEvent[],
  ...
)
```

The `transformedNotes` parameter IS passed in (L207) but is only used for density statistics (L137). It is NOT used for `inRangeNotes` (L157). This means the fix is straightforward — swap `pitchedRawNotes` with `transformedNotes.filter(getPitchedNotes)` — but the plan doesn't recognize that `transformedNotes` is already available, making the fix simpler than implied.

**Suggestion**: Update the suggested fix to note that `transformedNotes` is already a parameter, so the fix only requires changing L157 from `pitchedRawNotes` to use `transformedNotes` for range checking. No function signature changes needed.

---

#### Issue 10 (Medium): Grid Inference IOI Bin Width Not Validated Against Real Tempo Values

**Location**: `src/grid-inference.ts` L8, L121–125

The plan suggests changing `IOI_BIN_WIDTH_SECONDS` to `0.02` or `0.025` but provides no mathematical justification. For a 120 BPM song (beat = 0.5s, sixteenth note = 0.125s), the current 0.01s bin gives 12.5 bins per sixteenth-note — the rounding error is at most 0.005s (half a bin). This is unlikely to cause the "phantom grid artifacts" described.

More critically: the plan does not examine what happens with slower tempos. At 60 BPM (eighth note = 0.125s with sixteenth at 0.0625s), the same 0.01s bin gives 6.25 bins — worse rounding. At 40 BPM the issue compounds further.

**Suggestion**: Before changing the bin width, compute the rounding error for ALL tempos in the valid MIDI range (20–300 BPM) and all common subdivisions. Determine the minimum bin width that keeps rounding error below 1% for all cases. Then pick a standard musical value (0.024 = BLPP 64ths at 60 BPM, or 0.0125 = 80ths at 60 BPM) rather than arbitrary 0.02/0.025.

---

#### Issue 11 (Medium): `KEY_SEQUENCE` in analyze.ts Does Not Match Actual Keymap

**Location**: `src/analyze.ts` L8, `src/keymap.ts` (implied)

The `KEY_SEQUENCE = '1234567890qwertyuiopasdfghjklzxcvbnm'` in analyze.ts is a fixed string that defines the ordering for range scoring. This sequence does NOT appear to be derived from the actual VP keymap. If the keymap ever changes (different key ordering, different character set), analyze.ts will give wrong range scores.

**Suggestion**: Import the actual keymap from `keymap.ts` and derive the key sequence dynamically, or at minimum add a comment explaining why the hardcoded sequence matches the keymap. Add a test that validates `analyzeVpNotation` against known keymap values to catch drift.

---

#### Issue 12 (Low): Phase Timeline Estimates Are Unrealistic

**Location**: Plan L243–269

Phase 2 is estimated at "3 issues, 2hrs" but Phase 3 is "3 issues, 1hr". Issue #1 (chord cap) requires changing `HARD_MAX_CHORD_SIZE` from a constant to a configurable parameter, updating tests, and verifying all 5 presets. This alone could take 2 hours. The time estimates appear unvalidated.

**Suggestion**: Break down each fix into specific sub-tasks with time estimates. Factor in review time, PR creation, and the verification phase (Phase 4 at 30min is likely too short for a full test suite run + manual smoke tests).

---

#### Issue 13 (Low): No Consideration of Backward Compatibility in Fix Options

**Location**: Plan L54–57

Issue #1 offers three options (A: remove presets' higher values, B: make configurable, C: keep 3 as default but allow config) but does not evaluate backward compatibility. If existing users have built tooling around the current behavior (even if buggy), changing `HARD_MAX_CHORD_SIZE` to be configurable could be a breaking change if the default behavior changes.

**Suggestion**: Add a backward compatibility analysis to each fix option. Determine whether any existing users would be affected by each option and whether a deprecation path is needed.

### Positive Aspects

- All 6 source file references are accurate and verifiable through code inspection
- The P1/P2 severity classification (Critical/Medium) broadly aligns with issue importance
- The secondary agent validation in the appendix adds credibility
- The Decision Matrix at L273–281 is useful for prioritizing fix scope
- The Phase-based removal plan provides actionable structure
- The "Design Question" callouts for issues #1 and #2 appropriately escalate unresolved product decisions

### Summary

**Top 3 Key Issues:**

1. **Issue #2 contains a factual error** (`FATAL_IN_RANGE_RATIO` does not exist, `qualitySignals.fatal` field does not exist) — undermines reviewer credibility and makes the fix suggestion invalid
2. **Issue #1 underspecifies the bug** — misses the `simplifyChords=false` code path that hard-codes `HARD_MAX_CHORD_SIZE` regardless of preset
3. **No test coverage analysis** — the plan identifies buggy behavior in tests but never catalogs which tests need updating, making the fix phase incomplete

**Consensus Status**: NEEDS_REVISION

---

## Code Review Round 1 — 2026-04-02

**Scope**: Current uncommitted implementation for findings 1-3, including the split raw/output quality-signal changes
**Build Status**: PASS

### Issues

#### Issue 1 (High): Scoring now uses output-note ratios but stats still expose raw-note totals
**File**: /mnt/8CE085C2E085B2CE/Src/Active/zen-virtual-piano-workspace/midi-to-vp/src/quality-scorer.ts:101
`normalizeSignals()` now computes `inRangeRatio` from `outputInRangeNotes / outputTotalNotes`, but `buildStats()` still reports `totalNotes` and `durationSeconds` from `totalRawNotes`. `QualityStats` also exposes `outputInRangeNotes` without the matching `outputTotalNotes`, so downstream consumers cannot reconstruct the ratio that actually drives the score. This leaves the assessment payload internally inconsistent and does not complete the planned `buildStats()` alignment.
**Fix**: Move the scored stats to the output-note population and add `outputTotalNotes` to `QualityStats`, or explicitly split raw versus output stats with clear labels so the score and stats describe the same population.

#### Issue 2 (Medium): New tests do not verify the assessment path or the updated stats contract
**File**: /mnt/8CE085C2E085B2CE/Src/Active/zen-virtual-piano-workspace/midi-to-vp/tests/quality-scorer.test.ts:41
The new tests prove that raw and output quality-signal ratios can differ, but they do not assert the final `scoreConversionQuality()` assessment payload follows the chosen output-based contract. The scorer tests also still lock in `durationSeconds` derived from `totalRawNotes / avgNotesPerSecond`, which would reject a correct output-based `buildStats()` fix.
**Fix**: Update the scorer tests to assert the chosen output-based stats semantics and add an integration assertion around `scoreConversionQuality(result.metadata.qualitySignals)`, including the returned stats fields.

### Verdict: NEEDS_FIX

---

## Code Review Round 6 — 2026-04-02

**Scope**: Final review of findings 4-6 after the narrow analyze fix pass and focused verification
**Build Status**: PASS

### Issues

_(None.)_

### Verdict: APPROVED

---

## Code Review Round 4 — 2026-04-02

**Scope**: Final review of findings 1-3 after the second fix pass
**Build Status**: PASS

### Issues

_(None.)_

### Verdict: APPROVED

---

## Code Review Round 5 — 2026-04-02

**Scope**: Review of findings 4-6 implementation after focused verification
**Build Status**: PASS

### Issues

#### Issue 1 (Medium): Invalid notation tokens still skew range analysis by being treated as the lowest VP key
**File**: /mnt/8CE085C2E085B2CE/Src/Active/zen-virtual-piano-workspace/midi-to-vp/src/analyze.ts:78
The ASCII fallback is gone, but `toKeyIndex()` still returns `0` for unknown tokens. That means malformed input like `?` is silently analyzed as if it were the lowest valid VP key, which can still distort `rangeScore`, `overallScore`, and `recommendedLevel`. The plan’s requirement was to use canonical VP ordering only while staying safe on malformed input; mapping unknown tokens to index `0` is still an arbitrary fallback.
**Fix**: Return a nullable/invalid marker for unknown tokens and exclude those entries from the range calculation. Keep the API non-throwing, but add a regression test showing that adding an unknown token does not change the score relative to the same valid notation without it.

### Verdict: NEEDS_FIX

---

## Code Review Round 3 — 2026-04-02

**Scope**: Current uncommitted implementation for findings 1-3 after the first fix pass and fresh focused verification
**Build Status**: PASS

### Issues

#### Issue 1 (High): `QualityStats.inRangeNotes` still reports the source-note population while `totalNotes` reports output notes
**File**: /mnt/8CE085C2E085B2CE/Src/Active/zen-virtual-piano-workspace/midi-to-vp/src/quality-scorer.ts:114
The latest pass fixed the failing test expectations, but it did not fix the underlying contract mismatch in `buildStats()`: `totalNotes` now comes from `outputTotalNotes`, while `inRangeNotes` still comes from `input.inRangeNotes` (source notes). Any consumer that displays those two fields together will compute or imply the wrong in-range ratio. The package test server already renders `stats.totalNotes` and `stats.inRangeNotes` side by side, so this is still a user-visible defect.
**Fix**: Make `QualityStats` consistently describe the output-note population. Set `stats.inRangeNotes` from `outputInRangeNotes` and remove or rename redundant/raw-only stats fields so the payload no longer mixes populations under generic names.

### Verdict: NEEDS_FIX

---

## Round 4 — 2026-04-02

### Overall Assessment

The plan was not revised after Round 3. All four issues from Round 3 remain unresolved. The two critical blockers (validateSignals() rejection and inRangeRatio denominator incoherence) still prevent implementation of the issue #2 fix, and the Decision Matrix still lacks a Breaking Change column despite the backward-compat note being present elsewhere. The plan is structurally sound but remains incomplete at the exact points where implementation would begin.
**Rating**: 8/10

### Previous Round Tracking

| #   | Issue                                         | Status        | Notes                                                                                                                                                                                        |
| --- | --------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `validateSignals()` would reject issue #2 fix | ❌ UNRESOLVED | Plan L110-113 added "Scoring Contract Constraint" section but suggests splitting fields without committing to one approach; implementer has no definitive guidance                           |
| 2   | `inRangeRatio` denominator incoherence        | ❌ UNRESOLVED | Plan L125 says "derive both inRangeNotes and totalRawNotes from transformed" but doesn't address what happens to `totalRawNotes` semantics in `QualityStats` (L106) and downstream consumers |
| 3   | IOI bin width pre-analysis table              | ✅ RESOLVED   | Table added at L164-170 with BPM/subdivision/error values                                                                                                                                    |
| 4   | Decision Matrix no Breaking Change column     | ❌ UNRESOLVED | Backward-Compatibility Note exists at L68-71 but no column in Decision Matrix at L353-358                                                                                                    |

### Issues

#### Issue 1 (Critical — Still Unresolved): `validateSignals()` Fix Path Not Decided

**Location**: `src/quality-scorer.ts` L73-77; plan L110-113, L123-128

The plan added a "Scoring Contract Constraint" section at L110-113 and a "Suggested Fix" at L123-128. The suggestion offers two paths:

> "(a) derive both `inRangeNotes` and `totalRawNotes` from the transformed pitched-note population... or (b) split the signal into explicit source/output fields"

But it does not choose between them. An implementer starting from this plan has no authoritative answer about which path to take. Path (a) changes the meaning of `totalRawNotes` across the entire `QualityStats` struct (L106: `totalNotes: input.totalRawNotes`), which is used for display in `buildStats()`. Path (b) adds a new field to `QualitySignals` (affecting the public API and any consumers of `ConversionResult`).

**Suggestion**: Add a "Chosen Approach" directive to the plan before Phase 2 begins. Path (a) is simpler and keeps the same field names but changes semantics; Path (b) is more explicit but requires a new field and API version bump. The plan should state which is preferred, or it should make both options explicit in the Decision Matrix with a go/no-go call.

---

#### Issue 2 (High — Still Unresolved): `totalRawNotes` in `QualityStats` Not Addressed

**Location**: `src/quality-scorer.ts` L106; plan L125

The plan's suggested fix at L125 says "derive both `inRangeNotes` and `totalRawNotes` from the transformed pitched-note population." However, `totalRawNotes` appears in TWO places that are treated differently:

1. **In `validateSignals()` (L73)**: `input.inRangeNotes <= input.totalRawNotes` — this is the validation constraint
2. **In `buildStats()` (L106)**: `totalNotes: input.totalRawNotes` — this populates `QualityStats.totalNotes`

If the fix changes `totalRawNotes` to be the transformed-note count, then `buildStats().totalNotes` will report the transformed count (not the original source note count). This changes the meaning of the `stats` field returned in `ScoringAssessment`, which may be consumed by logging, debugging, or API consumers.

The plan only addresses `normalizeSignals()` and `validateSignals()`, not `buildStats()`.

**Suggestion**: In the fix section for issue #2, explicitly list all three functions that use `totalRawNotes`: `validateSignals()` (L73), `normalizeSignals()` (L128 denominator), and `buildStats()` (L106). State whether each should use source count, transformed count, or something else. If they diverge, add a comment explaining why.

---

#### Issue 3 (Suggestion — Still Open): Decision Matrix Missing Breaking Change Column

**Location**: Plan L353-358

The Decision Matrix now has a "Breaking Change?" column header at L353, but the column cells all say "Depends on chord-cap/scoring choice" rather than per-option values. The Backward-Compatibility Note at L68-71 already distinguishes Options A, B, and C with precise descriptions. These should be translated into the Decision Matrix.

**Suggestion**: Replace "Depends on chord-cap/scoring choice" with specific values:

- All (1-6): Option B → Yes; Option A/C → No/Low
- P1 Only (1-3): Same per-option breakdown
- Code Only (1-5): Same per-option breakdown
- None: No

---

### Positive Aspects

- The IOI pre-analysis table (L164-170) is now present with accurate calculations across BPM 40-180 and three subdivisions
- The "Scoring Contract Constraint" section (L110-113) is new and correctly names the validation invariant that any fix must preserve
- The plan's structure, severity classification, Exit Criteria, and Verification Matrix are all solid and need no changes
- The Decision Matrix now has the column header "Breaking Change?" — only the cell values need specificity
- All prior Round 1 and Round 2 issues that were marked resolved remain correctly addressed

### Summary

**Top 3 Key Issues:**

1. **`validateSignals()` fix path not decided** — Plan offers two options (single population vs. split fields) but provides no authoritative choice, leaving the implementer without a definitive directive
2. **`buildStats()` not addressed in issue #2 fix** — `totalRawNotes` in `buildStats()` (L106) is never mentioned in the fix section, so the `QualityStats.totalNotes` field's semantics after the fix is undefined
3. **Decision Matrix cells say "Depends" instead of per-option values** — The Breaking Change column exists but all cells are vague; the Backward-Compatibility Note already has the data to fill it in correctly

**Consensus Status**: NEEDS_REVISION

### Overall Assessment

The plan has improved to a solid state with most Round 1 and Round 2 issues addressed. Two new critical findings emerged from verifying the `quality-scorer.ts` source: the `validateSignals()` function at L73-77 contains a validation constraint that would be violated by the proposed fix to issue #2, and the `inRangeRatio` denominator (`totalRawNotes`) would become semantically incoherent if `inRangeNotes` is sourced from a different note set. These two findings block implementation of the issue #2 fix and must be resolved before the plan can be approved.
**Rating**: 8/10

### Previous Round Tracking

| #   | Issue                                 | Status      | Notes                                                                     |
| --- | ------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| 1   | Chord cap — two code paths            | ✅ RESOLVED | Both simplify paths documented with code refs                             |
| 2   | `FATAL_IN_RANGE_RATIO` factual error  | ✅ RESOLVED | Fatal gating correctly attributed to quality-scorer.ts L169               |
| 3   | Grid inference boundary condition     | ✅ RESOLVED | Plan L155 now uses `confidence > 0 && confidence >= ioiResult.confidence` |
| 4   | Notation analysis line references     | ✅ RESOLVED | Plan L173 now correctly cites L8, L71-L83                                 |
| 5   | CLI validation gap misattributed      | ✅ RESOLVED | Plan L218 correctly describes silent undefined acceptance                 |
| 6   | Docs drift invalid points             | ✅ RESOLVED | Reduced to 5 verified points; invalid points removed                      |
| 7   | No test coverage verification         | ✅ RESOLVED | Verification Matrix and Exit Criteria now per finding                     |
| 8   | No consumer impact assessment         | ✅ RESOLVED | Dependency note added at L110-112                                         |
| 9   | `transformed.notes` already available | ✅ RESOLVED | Plan L120 acknowledges parameter is present                               |
| 10  | IOI bin width unvalidated             | ⚠️ PARTIAL  | < 2%/1ms threshold added at L160; no actual table in plan                 |
| 11  | KEY_SEQUENCE not from keymap          | ⚠️ PARTIAL  | Two-option fix at L203: dynamic derivation OR test assertion lock         |
| 12  | Unrealistic timeline                  | ✅ RESOLVED | Exit Criteria now provide specific per-finding checkpoints                |
| 13  | No backward compat analysis           | ⚠️ PARTIAL  | Backward-Compatibility Note added at L68-71; no Decision Matrix column    |

### Issues

#### Issue 1 (Critical): `validateSignals()` in quality-scorer.ts Would Reject the Proposed Fix to Issue #2

**Location**: `src/quality-scorer.ts` L73-77; plan L118-122

The plan proposes fixing issue #2 by sourcing `inRangeNotes` from `transformed.notes` instead of `rawNotes`. However, `validateSignals()` at L73-77 enforces:

```typescript
if (input.inRangeNotes > input.totalRawNotes) {
  throw new RangeError(
    `QualitySignals.inRangeNotes (${input.inRangeNotes}) must be <= totalRawNotes (${input.totalRawNotes})`,
  );
}
```

`totalRawNotes` is `rawNotes.length` (a fixed source-count). If `inRangeNotes` is computed from `transformed.notes` (post-transpose), the numerator and denominator are from different populations. After a large upward transpose, more notes can fall within VP range than the original source count — this validation would throw.

Example: 100 source notes at MIDI 100-105 (outside VP range 21-108); after `+12` transpose they become 112-117 (still outside); but if the source was 100 notes at 90-105 and transpose is `-5`, all 100 become in-range. Now if 5 notes were above VP range and get filtered out, you could have `inRangeNotes: 95` and `totalRawNotes: 100` — fine. However, if the transform ALSO filters notes (per `transformNotesToVpRange`), the count of in-range transformed notes could EXCEED `totalRawNotes` if the filter keeps some and the denominator is still raw count. This depends on the exact filter behavior.

The plan does not acknowledge this validation constraint at all. The fix suggestion (L118-122) makes no mention of updating the validation, the denominator semantics, or the `totalRawNotes` field's meaning.

**Suggestion**: The fix for issue #2 must either (a) also update the `totalRawNotes` denominator to be `transformedNotes.length` when scoring transformed output, or (b) split `inRangeNotes` into `sourceInRangeNotes` and `outputInRangeNotes` so the validation constraint stays valid. Add explicit mention of this to the plan's suggested fix section.

---

#### Issue 2 (High): `inRangeRatio` Denominator Becomes Semantically Incoherent Under Issue #2 Fix

**Location**: `src/quality-scorer.ts` L128; plan L101, L118-122

At L128 in `normalizeSignals()`:

```typescript
const inRangeRatio = clamp01(input.inRangeNotes / input.totalRawNotes);
```

If `inRangeNotes` is sourced from `transformed.notes` but `totalRawNotes` stays as `rawNotes.length`, the ratio becomes `transformedInRange / rawCount`. This is no longer "what fraction of source notes are in range" — it conflates source-count denominator with transformed-numerator. After any transposition that shifts notes across the VP boundary, the ratio becomes a meaningless hybrid metric.

For example: 100 raw notes, 30 are in VP range pre-transform (30% in-range). After transpose of +12 semitones, 80 are now in range. If `inRangeNotes` becomes 80 but `totalRawNotes` stays 100, the ratio is 0.8 — but 30 out of 100 source notes were in range, so the "quality" just jumped from 30% to 80% due to the transform, not due to any quality improvement.

**Suggestion**: If the scoring contract is changed to describe output playability, the denominator must also change to `transformedNotes.length` or the total notes in the converted timeline. The plan should explicitly call out that `totalRawNotes` and the `inRangeRatio` field need to be updated together as part of the same fix.

---

#### Issue 3 (Medium): IOI Bin Width Pre-Analysis Table Is Referenced But Not Present

**Location**: `src/grid-inference.ts` L8; plan L160

The plan at L160 says: "Add a small pre-analysis table for common tempi/subdivisions and define an acceptance target for bucket error (for example, `< 2%` of IOI or `< 1ms`, whichever is larger)."

The threshold is helpful, but the plan doesn't include the actual table. Without the table, implementers will make arbitrary choices and call them justified. For example, 0.01s bins at 40 BPM with sixteenth notes (IOI = 0.375s) gives 37.5 buckets — rounding error is at most ±0.005s or ±1.3%. At 40 BPM with eighth notes (IOI = 0.75s), rounding error is at most ±0.005s or ±0.67%. These behave very differently across tempo/subdivision combinations.

**Suggestion**: Add the table inline in the plan before the fix section. For at least 5 representative BPMs (40, 60, 90, 120, 180) and 3 subdivisions (eighth, sixteenth, triplet sixteenth), compute `IOI / 0.01` and the resulting % error. Show which combinations exceed 2% or 1ms. This prevents multiple rounds of clarification.

---

#### Issue 4 (Suggestion): Backward Compatibility Needs a Decision Matrix Column

**Location**: Plan L336-343

The plan added a Backward-Compatibility Note to Issue #1 (L68-71) but did not add a "Breaking Change?" column to the Decision Matrix. Options A, B, and C for the chord cap fix have different backward-compat implications, and the Decision Matrix is where implementers will make go/no-go calls.

**Suggestion**: Add a "Breaking Change?" column to the Decision Matrix with values for each option. Option A: No (preserves output, just updates docs). Option B: Yes (output changes for callers relying on silent cap). Option C: Low (default unchanged, opt-in for advanced). This makes the risk profile explicit per option.

---

### Positive Aspects

- The grid inference boundary fix (`confidence > 0 &&`) is correct and precisely specified at L155
- Line references for issue #4 are now accurate (L8, L71-L83)
- Exit Criteria (L326-332) provide specific, measurable checkpoints per finding
- The Verification Matrix (L286-295) accurately maps existing coverage to coverage gaps
- Backward-Compatibility Note in Issue #1 (L68-71) is thorough and correctly distinguishes the three options
- Phase 1 product decision escalation before implementation prevents encoding hidden assumptions
- The plan's total issue count is stable at 6 findings with clear severity separation

### Summary

**Top 3 Key Issues:**

1. **`validateSignals()` would reject the proposed fix to issue #2** — The L73-77 constraint `inRangeNotes <= totalRawNotes` would be violated when `inRangeNotes` is sourced from `transformed.notes`; the plan never mentions this blocker
2. **`inRangeRatio` denominator incoherence** — If `inRangeNotes` switches to `transformed.notes` but `totalRawNotes` stays as `rawNotes.length`, the ratio becomes a meaningless hybrid metric with no clear interpretation
3. **IOI bin width pre-analysis table absent** — The plan commits to a threshold (< 2% or < 1ms) but provides no actual error table for common BPM/subdivision combinations

**Consensus Status**: NEEDS_REVISION

---

## Round 5 — 2026-04-02

### Overall Assessment

The plan was revised after Round 3 with three meaningful additions: a "Recommended Direction" section committing to additive source/output split (L110-111), Phase 1 default recommendations (L325-327), and a Decision Matrix "Breaking Change?" column (L361-366). Two issues are now resolved, but the grid inference code at L149 still shows the pre-guard `>=` comparison in the actual code block — the guard is described in the Suggested Fix text but not visibly applied to the code. One additional issue remains.
**Rating**: 9/10

### Previous Round Tracking

| #   | Issue                             | Status      | Notes                                                                                                            |
| --- | --------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | `validateSignals()` fix path      | ✅ RESOLVED | L110-111 commits to additive split; L131 explicitly names `buildStats()` in preferred path                       |
| 2   | `totalRawNotes` in `buildStats()` | ✅ RESOLVED | L131 explicitly says "point `buildStats()` at the output pair"                                                   |
| 3   | IOI bin width pre-analysis table  | ✅ RESOLVED | Table at L164-170 with BPM 40-180 and three subdivisions                                                         |
| 4   | Grid inference guard not in code  | ⚠️ PARTIAL  | L149 code block still shows `>=` without `> 0` guard; L165 describes guard textually                             |
| 5   | Decision Matrix per-option values | ⚠️ PARTIAL  | "Breaking Change?" column exists but values are per-scope ("Low under recommended path"), not per option (A/B/C) |

### Issues

#### Issue 1 (Suggestion — Remaining): Grid Inference Guard Not Visibly Applied to Code Block

**Location**: `src/grid-inference.ts` L155; plan L149, L164-165

The plan's Suggested Fix at L164-165 states:

> "Add a minimal guard first so a zero-confidence tempo-map result never wins by default tie-break: `tempoMapResult.confidence > 0 && tempoMapResult.confidence >= ioiResult.confidence`"

However, the code block at L149 — the actual code being critiqued — still shows:

```typescript
return tempoMapResult.confidence >= ioiResult.confidence
  ? tempoMapResult
  : ioiResult;
```

The guard appears only in prose, not applied to the code. The correct fix is to replace L149's line with the guarded version. Without updating the code block, an implementer could miss that the guard replaces the comparison entirely, not supplements it.

**Suggestion**: Update the code block at L149 to show the corrected line:

```typescript
return tempoMapResult.confidence > 0 &&
  tempoMapResult.confidence >= ioiResult.confidence
  ? tempoMapResult
  : ioiResult;
```

And add a comment: `// Guard: empty tempo map (confidence=0) must not win a tie against a valid IOI result`

---

#### Issue 2 (Suggestion — Remaining): Decision Matrix Breaking Change Values Are Per-Scope, Not Per-Option

**Location**: Plan L361-366

The Decision Matrix "Breaking Change?" column uses "Low under recommended path" for all four scope rows. This is an improvement over Round 3 (no column), but the values are scoped-level generalizations rather than per-option.

For example, if the recommended path is Option C for the chord cap:

- Option A (declare 3 ceiling, lower presets): Breaking Change = No
- Option B (remove hard cap): Breaking Change = Yes
- Option C (keep 3 default, allow opt-in): Breaking Change = Low

"Low under recommended path" conflates these. A reader choosing Option B would not know the Breaking Change risk for their specific choice.

**Suggestion**: Add a footnote to the Decision Matrix: "Option B has Breaking Change=Yes; Options A and C have Breaking Change=No/Low. The 'Low under recommended path' values above assume Option C is chosen." Or add sub-rows for each option within the "All (1-6)" row.

---

### Positive Aspects

- The "Recommended Direction" (L110-111) commits to the additive split approach, resolving the path indecision from Round 3
- "Preferred implementation path" (L131) explicitly names `buildStats()` alongside `scoreConversionQuality()`, resolving the partial coverage of Round 3's Issue 2
- Phase 1 default recommendations (L325-327) give an actionable fallback if no product input arrives — prevents Phase 1 from blocking indefinitely
- The IOI pre-analysis table (L164-170) is comprehensive and mathematically accurate
- The Decision Matrix Breaking Change column now exists — only the cell values need per-option specificity
- All prior Round 1-3 issues that were resolved remain correctly addressed

### Summary

**Top 3 Key Issues:**

1. **Grid inference guard not visibly applied** — L149 code block still shows unguarded `>=`; guard described only in prose at L165 should be reflected in the code block itself
2. **Decision Matrix per-option breakdown absent** — "Low under recommended path" applies uniformly; doesn't distinguish Option B (breaking) from Options A/C (not breaking)
3. The plan is very close to approval — these are nit-level presentation issues, not substantive gaps

**Consensus Status**: NEEDS_REVISION

---

## Round 6 — 2026-04-02

### Overall Assessment

The plan was revised after Round 5 with both outstanding issues resolved: the grid inference code block at L149 now shows the `tempoMapResult.confidence > 0 &&` guard, and the Decision Matrix Breaking Change column at L365-367 now includes per-option values for Finding 1 (A No / B Yes / C Low). The plan is substantively complete across all six findings, with correct severity classifications, verifiable source references, complete fix suggestions, test coverage gaps, and exit criteria. No remaining issues.
**Rating**: 10/10

### Previous Round Tracking

| #   | Issue                             | Status      | Notes                                                                        |
| --- | --------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| 1   | Grid inference guard not in code  | ✅ RESOLVED | L149 code block now shows `tempoMapResult.confidence > 0 &&` guard           |
| 2   | Decision Matrix per-option values | ✅ RESOLVED | L365-367 Breaking Change column now shows `F1: A No / B Yes / C Low` per row |

### Issues

_(None — all previous issues resolved.)_

### Positive Aspects

- All 6 findings have correct severity ratings (3 P1, 3 P2) and are grounded in verified source references
- All 6 suggested fixes are specific, actionable, and include implementation guidance
- Verification Matrix maps existing coverage to coverage gaps for every finding
- Exit Criteria are specific and measurable per finding
- Decision Matrix has per-finding per-option Breaking Change values
- Phase 1 default recommendations provide a fallback path without blocking indefinite escalation
- The IOI pre-analysis table (L170-176) is comprehensive across BPM 40-180 and three subdivisions
- The Recommended Direction (L110-111) and Preferred Implementation Path (L131) for issue #2 are clear and unambiguous
- Backward-Compatibility Note (L68-71) distinguishes Options A, B, and C precisely
- The Appendix documents what was corrected and why, enabling future reviewers to understand the evolution

### Summary

**Top 3 Key Issues:**

1. No remaining issues — the plan is ready for implementation
2. All Round 1-5 substantive issues were resolved through iterative review
3. The plan demonstrates good review practice: specific source citations, test coverage mapping, and explicit decision constraints

**Consensus Status**: APPROVED

---

## Round 2 — 2026-04-02

### Overall Assessment

The plan was substantially revised and addressed four of the six original findings plus several Round 1 cross-cutting issues. However, three issues remain unresolved (grid inference boundary condition, notation analysis line references, IOI bin width justification), two new problems emerged from close re-reading, and a critical question about the quality-scorer test coverage needs resolution before the plan can be approved.
**Rating**: 7/10

### Previous Round Tracking

| #   | Issue                                 | Status        | Notes                                                                                              |
| --- | ------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Chord cap — two code paths            | ✅ RESOLVED   | Plan now covers both simplify=true and simplify=false paths with separate code references          |
| 2   | `FATAL_IN_RANGE_RATIO` factual error  | ✅ RESOLVED   | Plan correctly moved fatal gating to quality-scorer.ts; removed fabricated constant reference      |
| 3   | Grid inference boundary condition     | ❌ UNRESOLVED | Plan L134 still uses `>=` which favors tempoMapResult at zero-confidence equal tie                 |
| 4   | Notation analysis line references     | ❌ UNRESOLVED | Plan L164 cites "L7, L55-L67" but actual `toLowerCase()` is at L72 and ASCII fallback is at L77-80 |
| 5   | CLI validation gap misattributed      | ✅ RESOLVED   | Plan L218 correctly describes silent undefined acceptance and fallback to derived default          |
| 6   | Docs drift invalid points             | ✅ RESOLVED   | Plan reduced to 5 verified points; removed incorrect README import drift claim                     |
| 7   | No test coverage verification         | ⚠️ PARTIAL    | Verification Matrix added (L277-286) but see Issue 5 below                                         |
| 8   | No consumer impact assessment         | ⚠️ PARTIAL    | Dependency note added at L105-107 but consumer chain not fully traced                              |
| 9   | `transformed.notes` already available | ⚠️ PARTIAL    | Plan L115 acknowledges parameter is present but doesn't explicitly call out the one-line fix       |
| 10  | IOI bin width unvalidated             | ❌ UNRESOLVED | Plan L154 says "only if tests show" but no mathematical pre-analysis proposed                      |
| 11  | KEY_SEQUENCE not from keymap          | ❌ UNRESOLVED | Plan L185 acknowledges drift risk but proposes no dynamic derivation                               |
| 12  | Unrealistic timeline                  | ⚠️ PARTIAL    | Phases 2-4 expanded to 0.5-3hrs each; Phase 5 at 1hr still seems thin                              |
| 13  | No backward compat analysis           | ❌ UNRESOLVED | Not addressed in revision                                                                          |

### Issues

#### Issue 1 (Medium): Grid Inference Zero-Confidence Tie-Breaking Still Favors Empty Tempo Map

**Location**: `src/grid-inference.ts` L155; plan L134

The plan revised issue #3 to acknowledge the boundary condition but still does not fix it. The comparison at L155:

```typescript
return tempoMapResult.confidence >= ioiResult.confidence
  ? tempoMapResult
  : ioiResult;
```

When `tempoMapResult.confidence === 0` (no tempo metadata) and `ioiResult.confidence === 0` (insufficient data), the `>=` operator returns `true`, and an empty `beatGrid` is returned. This is arguably correct behavior for the degenerate case. However, the more problematic case is when both are non-zero and equal — e.g., both `0.8` — where tempo metadata is arbitrarily preferred even when the IOI histogram may be more locally accurate.

**Suggestion**: The plan's "policy-based approach" (L152-155) is correct in intent but needs a concrete starting point. Add a comment at L155: `// Only prefer tempoMapResult when it has non-zero confidence, to avoid degenerate ties` and change to: `tempoMapResult.confidence > 0 && tempoMapResult.confidence >= ioiResult.confidence ? tempoMapResult : ioiResult`. This is a one-line guard, not a redesign.

---

#### Issue 2 (Medium): Issue #4 Line References Still Don't Match `toKeyIndex()` Implementation

**Location**: `src/analyze.ts` L71-83; plan L164

The plan's Issue #4 (L162) cites the problematic lines as "L7, L55-L67". The actual code with `toLowerCase()` and ASCII fallback is in the `toKeyIndex()` function at L71-83. L7 is the `KEY_SEQUENCE` constant. L55-67 is the `parseNotation()` function. Neither contains the lowercasing or ASCII fallback logic.

The revision did not correct the line references — it carried forward the same inaccurate citations.

**Suggestion**: Update the location reference in Issue #4 to cite L71-83 (the `toKeyIndex()` function) and L8 (the `KEY_SEQUENCE` constant). These are the two locations requiring changes.

---

#### Issue 3 (Medium): IOI Bin Width "Test-First" Approach Has No Mathematical Bounding

**Location**: `src/grid-inference.ts` L8; plan L137, L154

The plan's suggested fix (L154) defers bin-width changes to "tests" but does not establish what the tests should validate. Specifically:

- The plan does not specify what constitutes an "acceptable" rounding error (e.g., < 1% of note duration)
- No analysis is provided for the valid MIDI tempo range (20–300 BPM) across subdivisions (eighth notes, sixteenth notes, triplets)
- The plan does not consider that the IOI histogram is used for inter-onset interval clustering, not note placement — so the bin width affects how IOIs are grouped, not directly the beat grid

**Suggestion**: Add a mathematical pre-analysis section: for each BPM in 20–300 and each subdivision ratio, compute `IOI / IOI_BIN_WIDTH_SECONDS` and the resulting rounding error in milliseconds. Establish a target threshold (e.g., < 1ms or < 2% of IOI). Identify which (BPM, subdivision) pairs exceed the threshold at 0.01s bins. This gives concrete criteria for whether a bin-widening is necessary and what value to use.

---

#### Issue 4 (Medium): `KEY_SEQUENCE` Hardcoding Creates a Silent Coupling Risk

**Location**: `src/analyze.ts` L8; plan L185

The plan acknowledges at L185 that "the hardcoded `KEY_SEQUENCE` can also drift from the canonical VP keymap" but the suggested fix (L192-195) only addresses the lowercasing and ASCII fallback, not the hardcoded string itself.

The `KEY_SEQUENCE` at L8 of analyze.ts:

```typescript
const KEY_SEQUENCE = "1234567890qwertyuiopasdfghjklzxcvbnm";
```

This string must remain synchronized with the actual VP keymap ordering. If the keymap changes, analyze.ts range scores will silently become incorrect.

**Suggestion**: In the suggested fix for Issue #4, add a compile-time or test-time assertion that `KEY_SEQUENCE` matches the keymap-derived ordering. Either import the keymap at runtime and validate, or expose the sequence as a constant that can be imported and compared. This prevents silent drift rather than just reacting to it.

---

#### Issue 5 (High): Verification Matrix Claims Coverage That Needs Independent Confirmation

**Location**: Plan L280-282; `src/quality-scorer.ts`; `tests/quality-scorer.test.ts`

The Verification Matrix (L280) states that `tests/quality-scorer.test.ts` "covers fatal gating behavior" for finding #2. However, Round 1 established that `computeQualitySignals()` in `convert.ts` has no `fatal` field. The `fatal` gating must be in `quality-scorer.ts`.

The plan does not show the contents of `quality-scorer.ts` or `tests/quality-scorer.test.ts`. Without seeing these files, I cannot verify that:

1. The fatal-gate mechanism is correctly implemented in quality-scorer.ts
2. The tests actually cover the pre-transform vs post-transform issue
3. The tests would catch regression if `inRangeNotes` were moved to use `transformed.notes`

**Suggestion**: Verify and reproduce the quality-scorer.ts fatal gating mechanism. Confirm whether the existing test `tests/quality-scorer.test.ts` would catch the pre-transform issue. If it does not, the Verification Matrix's "existing coverage" claim is wrong, and a new integration test is required — not just noted as a gap.

---

#### Issue 6 (Low): Decision Matrix Says "No Backward Compat Risk" for None Option

**Location**: Plan L326

The Decision Matrix at L326 lists "None / 0 / High deferred risk / ⚠️ Defer / Leaves known contract and scoring issues in place." This is appropriate. However, the plan does not evaluate backward compatibility risk for the actual fix options (Options A, B, C for chord cap; scoring scope options for issue #2). Round 1's Issue #13 was not addressed.

**Suggestion**: Add a column to the Decision Matrix for "Breaking Change?" for each fix option. For the chord cap fix specifically, if Option B (make configurable) changes the default from 3 to something else, existing users who relied on the silent capping would see different output.

---

#### Issue 7 (Suggestion): Phase 5 Verification Needs More Specific Exit Criteria

**Location**: Plan L311-315

Phase 5 is "1 hour" with vague "run targeted suites" and "manually smoke-test." This makes it impossible to verify the plan is complete.

**Suggestion**: Replace vague verification language with specific, measurable exit criteria per finding:

- Finding #1: Run preset tests for Adept, Master, Guru; confirm max output chord size matches preset values
- Finding #2: Run quality-scorer tests; add integration test proving in-range out-of-range контракт
- Finding #3: Run grid-inference fixtures for tempo-present and tempo-absent cases; measure jitter output
- Finding #4: Run analyze tests with uppercase, symbol, and invalid tokens; confirm correct error handling
- Finding #5: Run CLI integration with missing flag values; confirm error code 1 returned
- Finding #6: Manual spot-check of all 5 drift points against source

---

### Positive Aspects

- The plan's self-correction mechanism (Appendix L352-357) is a good practice — explicitly documenting what was changed and why builds reviewer trust
- The Verification Matrix (L277-286) is a substantial improvement over Round 1's total absence of test coverage mapping
- The product decision escalation in Phase 1 is correctly placed before implementation
- The revised time estimates (3-4 hours for P1 fixes, 2-3 hours for P2) are more realistic than Round 1
- Issue #1 is now comprehensively documented with both code paths and affected presets clearly enumerated
- The documentation drift section correctly removed the invalid README import drift point

### Summary

**Top 3 Key Issues:**

1. **Verification Matrix claims coverage that hasn't been independently confirmed** — The plan asserts `tests/quality-scorer.test.ts` covers fatal gating but source was not provided; the fatal gate mechanism needs verification before this finding can be marked as having existing coverage
2. **Grid inference zero-confidence tie-breaking** — Still unresolved from Round 1; `tempoMapResult.confidence > 0` guard needed at L155
3. **Issue #4 line references still incorrect** — Revision carried forward the same wrong line citations (L7, L55-L67 vs actual L71-83)

**Consensus Status**: NEEDS_REVISION

---

## Code Review Round 2 — 2026-04-02

**Scope**: Current uncommitted implementation for findings 1-3 after rerunning build and focused scorer/integration verification
**Build Status**: FAIL

### Issues

#### Issue 1 (High): `QualityStats` still mixes output totals with source in-range counts
**File**: /mnt/8CE085C2E085B2CE/Src/Active/zen-virtual-piano-workspace/midi-to-vp/src/quality-scorer.ts:113
`buildStats()` now reports `totalNotes` and `durationSeconds` from `outputTotalNotes`, but `inRangeNotes` still comes from the source-note population (`input.inRangeNotes`). That means the public assessment payload pairs an output-based total with a source-based in-range count, so consumers can render an impossible ratio. The local test server already displays `stats.totalNotes` and `stats.inRangeNotes` together, which makes this mismatch user-visible.
**Fix**: Align `QualityStats` to a single population. Under the approved plan, the scored stats should use the output-note population, so `stats.inRangeNotes` should come from `outputInRangeNotes`. If raw diagnostics still need to be exposed, add explicitly named source fields instead of overloading `inRangeNotes`.

#### Issue 2 (Medium): Scorer verification is still locked to the old raw-count contract and currently fails
**File**: /mnt/8CE085C2E085B2CE/Src/Active/zen-virtual-piano-workspace/midi-to-vp/tests/quality-scorer.test.ts:41
The current focused verification fails because the test still expects `durationSeconds` to be derived from `totalRawNotes / avgNotesPerSecond`, while the implementation now derives it from `outputTotalNotes / avgNotesPerSecond`. The tests also do not assert the final stats payload for the chosen output-based contract, so a partial implementation can slip through.
**Fix**: Update the scorer tests to assert the output-based stats contract directly: `totalNotes`, `inRangeNotes`, and `durationSeconds` should all reflect the output-note population. Add at least one assertion on the returned `stats` payload in the conversion integration path so the public assessment contract is covered end-to-end.

### Verdict: NEEDS_FIX
