---
source: /home/zenji/.config/Code/User/workspaceStorage/dcf700dec7f4665114ed633ea10e6d59/GitHub.copilot-chat/memory-tool/memories/MjQzNWMwMTYtMzY2Yi00ZWFmLThiNjctODFlZjc0ZDliMDM2/plan.md
saved: 2026-04-03
---

## Plan: Preserve Pause vs Sustain Notation

Fix the extended-notation pipeline so adjacent dashes represent sustain while space-separated dashes represent real rests. Today the quantizer tracks duration, but `buildTimeline` truncates sustain-only tails and both serializer and analyzer collapse sustain/rest into the same `-` stream.

## Semantic Contract (resolved before implementation)

1. **Onset slot**: slot with one or more new note onsets, serialized as note token (`C`) or chord token (`[CEG]`).
2. **Sustain slot**: slot with no new onsets, but at least one note remains active from prior slots, serialized as adjacent `-` directly after the preceding onset/sustain token.
3. **Rest slot**: slot with no active notes, serialized as a dash token separated from its neighbors by spaces. Spacing rules are applied in serializer order:
   - At string position 0 (leading rest), the first rest token has **no leading space** — the output string begins with `-`, not ` -`.
   - Every rest slot that is **not at string position 0** is prefixed by exactly one space: ` -`.
   - An onset token (`C`, `[CEG]`) that immediately follows a rest run is prefixed by exactly one space: ` C`.
   - An onset token that immediately follows a sustain run is **not** prefixed by a space: `C---D` (no space before `D`).
4. **Leading rests**: serialize as space-delimited dashes at string start with no leading space (`- - C` for two rest slots before first note; the initial `-` carries no space prefix — it is the position-0 exception from rule 3).
5. **Trailing sustain**: must serialize through the true final end slot.
6. **Trailing rests**: preserve only if the timeline intentionally includes them; default behavior keeps only musical content through last active slot.

## Concrete Data Model Changes

Update `midi-to-vp/src/types.ts` and consumers to use explicit slot semantics:

```ts
export type TimelineSlotType = "onset" | "sustain" | "rest";

export type TimelineSlot = {
  slot: number;
  slotType: TimelineSlotType;
  notes: QuantizedNoteEvent[]; // non-empty only when slotType === "onset"
  activeNoteCount: number; // active voices in this slot (onset + sustain)
};
```

Compatibility: this updates the public `ConversionResult.timeline` contract and should be documented as a behavior/API change in release notes.

## Steps

1. **Lock semantic contract in docs first**
   - Update `midi-to-vp/docs/adr/0005-quantization-and-timeline-algorithm.md` and `midi-to-vp/docs/architecture.md` with the finalized rules above.
   - Mark older wording ("all empty slots are '-'") as superseded.

2. **Implement explicit slot typing in timeline model**
   - Update `midi-to-vp/src/types.ts` with `TimelineSlotType` and enriched `TimelineSlot`.
   - Update dependent typings in `midi-to-vp/src/convert.ts`, `midi-to-vp/src/serialize.ts`, and `midi-to-vp/src/analyze.ts`.

3. **Fix timeline materialization to true musical end**
   - In `midi-to-vp/src/quantize.ts`, compute:
     - `maxStartSlot = max(note.startSlot)`
     - `maxEndSlotExclusive = max(note.endSlot)` — **`note.endSlot` is exclusive**: it is the first slot index where the note is silent. A note with `startSlot = 0` and duration of 3 quanta has `endSlot = 3` and is active in slots 0, 1, and 2.
   - Test assertion to encode the convention: let `lastActiveIndex = maxEndSlotExclusive - 1` (for a note with `endSlot = 3`, `lastActiveIndex = 2`). For a note with duration > 1 quantum, assert `expect(slots[lastActiveIndex].slotType).toBe('sustain')` and `expect(slots).toHaveLength(lastActiveIndex + 1)` — confirms sustain slots are materialized and the exclusive boundary is not over-run.
   - Build slots from `0..(maxEndSlotExclusive - 1)` with an explicit loop change:
     - current: `for (let slot = 0; slot <= maxSlot; slot += 1)`
     - target: `for (let slot = 0; slot < maxEndSlotExclusive; slot += 1)`
   - For each slot:
     - gather onset notes where `note.startSlot === slot`
     - compute `activeNoteCount = count(note.startSlot <= slot && slot < note.endSlot)`
     - set `slotType`:
       - `onset` if onset notes exist
       - `sustain` if no onset notes and `activeNoteCount > 0`
       - `rest` otherwise
     - write `activeNoteCount` onto each `TimelineSlot`
   - In `quantizeNotes`, skip any note with `durationSec <= 0` before computing `startSlot`/`endSlot`, so `endSlot` is always meaningful for the notes that survive filtering. Guard in `buildTimeline`: at the top of `buildTimeline`, if the input `quantized` array is empty after this filter, return `[]` immediately — do not call `Math.max()` on an empty array (which returns `-Infinity`) or enter the slot-building loop. An empty timeline causes the serializer to emit an empty string and the analyzer to return zero/default metrics; no special downstream handling is needed.
   - Preserve existing chord simplification behavior only for onset notes.

4. **Rework extended serialization with explicit boundary rules**
   - In `midi-to-vp/src/serialize.ts`, base output on `slotType`, not `notes.length`.
   - Use this mapping:
     - onset: `renderSlotToken(slot.notes)` — the existing helper in `serialize.ts` that constructs single-note and chord tokens; only called when `slotType === "onset"`. Prefix with one space (` C`, ` [CEG]`) **only when the immediately preceding serialized slot was a rest**. In all other cases — no preceding slot (position 0), or following a sustain or onset — emit with no space prefix (`C`, `C---D`).
     - sustain: emit `-` appended directly to the prior token (no space).
     - rest: emit `-`, prefixed by one space (` -`) unless this is the very first token in the output string (position 0 → emit `-` with no prefix).
   - Implementation guard: never call `renderSlotToken` for sustain/rest slots; these slots have `notes: []` by contract.
   - Standard mode path: iterate the same `TimelineSlot[]` produced by `buildTimeline`; add a gate `if (slot.slotType !== 'onset') continue` at the top of the loop body to skip sustain/rest slots. By the `TimelineSlot` type contract, `slotType === 'onset'` is equivalent to `notes.length > 0`; switching the gate is a mechanical substitution with no behavioral change for the onset-slot set, which is why standard output remains byte-for-byte equal to pre-feature output for all existing fixtures — verified by the standard-mode guard test in Step 7.

5. **Define edge-case outputs with golden examples**
   - Add/update test fixtures to encode these exact expectations:

| Scenario | Expected extended output |
| --- | --- |
| Single note held 3 extra slots | `C---` |
| Note, two-slot rest, note | `C - - D` |
| Chord held then rest | `[CEG]-- -` |
| Leading two-slot rest then note | `- - C` |
| Leading two-slot rest then sustained chord | `- - [CEG]--` |
| Final held note to timeline end | `D----` |
| Held note ending immediately into new onset, no gap | `C---D` |

6. **Upgrade parsing and analysis to preserve semantics**
   - In `midi-to-vp/src/analyze.ts`, replace whitespace-stripping parser with a token scanner that retains spacing boundaries.
   - Scanner design (minimum contract):
     1. tokenize note/chord onsets (`A`, `[CEG]`)
     2. tokenize adjacent dash runs as sustain slots
     3. tokenize space-delimited dash groups as rest slots
     4. keep leading `- -` groups as rests before first onset
   - Parsed model must distinguish sustain vs rest slots before scoring.
   - Ensure rhythmic complexity and rest metrics use true rest slots only.

7. **Regression tests and migration sequence**
   - Update `midi-to-vp/tests/quantize-serialize.test.ts` and `midi-to-vp/tests/analyze.test.ts`.
   - Add serializer/parser round-trip tests for all scenarios in Step 5. Each of the seven rows in the Step 5 table must correspond to exactly one serializer round-trip test identified by its scenario label; partial coverage (fewer than seven tests) is not acceptable.
   - Keep TDD flow explicit:
     1. add failing assertions for new contract
     2. implement quantize/serialize/analyze changes
     3. make tests pass
   - Add a standard-mode guard test with explicit assertion:
     - for existing fixtures, `result.notation.standard` must be byte-for-byte equal before and after this feature.

8. **Documentation and compatibility notes**
   - Update `midi-to-vp/README.md` examples for both dash forms.
   - Update `midi-to-vp/docs/plans/2026-03-15-notation-levels-analysis.md` if still referenced.
   - **Required delivery item (must be checked before merge)**: Draft and commit a changelog/release note entry with this exact content: _"Extended notation now emits adjacent dashes for sustain continuation and space-separated dash groups for rest/pause. Consumers that strip whitespace before parsing extended notation strings must update their parsers."_
   - PR template must include a completion checkbox for the changelog entry above; the PR may not be merged without it.

9. **Performance and safety guardrails**
   - Add one stress test for long sustain tails to ensure timeline growth remains bounded and predictable.
   - Add explicit threshold monitoring (`totalSlots`, serialization time) in the stress test so regressions are visible in CI.
   - Document limits tied to existing input limits (`INPUT_LIMIT_EXCEEDED_*`) rather than adding hidden truncation.

## Relevant Files

- `midi-to-vp/src/quantize.ts` - timeline generation currently capped at `max(startSlot)`.
- `midi-to-vp/src/types.ts` - `TimelineSlot` must carry slot semantics.
- `midi-to-vp/src/serialize.ts` - extended serializer currently maps all empty slots to `-`.
- `midi-to-vp/src/analyze.ts` - parser strips whitespace and cannot separate sustain/rest semantics.
- `midi-to-vp/src/convert.ts` - exposes timeline in public conversion result.
- `midi-to-vp/tests/quantize-serialize.test.ts` - update flattened-dash expectations.
- `midi-to-vp/tests/analyze.test.ts` - update scoring expectations based on true rest detection.
- `midi-to-vp/docs/adr/0005-quantization-and-timeline-algorithm.md` - normalize contract language.
- `midi-to-vp/docs/architecture.md` - document notation grammar.
- `midi-to-vp/README.md` - public notation examples and compatibility notes.

## Verification

1. Run failing-first targeted tests for new semantics in quantize/serialize/analyze.
2. Verify extended output differentiates sustain vs rest for every Step 5 scenario.
3. Verify parser/analyzer round-trips those strings without collapsing spaces.
4. Verify standard mode output is unchanged for existing fixtures.
5. Inspect one crafted MIDI fixture with sustain + pause and confirm:
   - `result.timeline[*].slotType` transitions are correct
   - `result.notation.extended` matches slot semantics exactly.

## Decisions

- Included scope: extended notation semantics, timeline typing, serializer behavior, parser/analyzer updates, tests, docs, and compatibility notes.
- Excluded scope: new notation symbols, UI redesign, and difficulty rubric retuning unrelated to sustain/rest semantics.
- Source of truth: adjacent `-` means sustain continuation; spaced `-` groups mean rest/pause.
- Risk note: this is a behavior change and a timeline shape change; docs/tests/changelog must ship together.
- Versioning note: this change is a breaking change to `ConversionResult.timeline` shape and extended notation string format. The decision of whether to bump to 2.0.0 (or 1.0.0 if not yet stable) is **mandatory** and must be made by the maintainer/release owner **before the PR is merged**. The decision and rationale must be recorded in the release notes.
