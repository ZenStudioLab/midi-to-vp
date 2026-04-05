# Plan Review: Preserve Pause vs Sustain Notation

**Plan File**: midi-to-vp/docs/plans/active/2026-04-03-preserve-pause-vs-sustain-notation.md
**Reviewer**: opencode (default: Codex)

---

## Round 1 — 2026-04-03

### Overall Assessment

The plan identifies a genuine semantic problem where adjacent dashes (`--`) and space-separated dash groups (`- -`) are both rendered as `-` tokens, collapsing the distinction between sustain continuation and rests. However, the plan defers too many critical decisions to implementation, provides insufficient detail on the type system changes required, and lacks concrete acceptance criteria. Several "Further Considerations" are left as open questions rather than resolved within the plan itself.
**Rating**: 5/10

### Issues

#### Issue 1 (High): TimelineSlot type change is underspecified

**Location**: Step 2 — "[midi-to-vp/src/types.ts](midi-to-vp/src/types.ts) — TimelineSlot shape will need explicit sustain/rest metadata"

The plan states TimelineSlot "will need explicit sustain/rest metadata" but provides zero detail on what that metadata looks like. Reading the current code at `types.ts:27-30`, `TimelineSlot` is `{ slot: number; notes: QuantizedNoteEvent[] }`. The plan doesn't specify:

- Whether metadata is a discriminated union (`type: 'onset' | 'sustain' | 'rest'`), a boolean flag, or an enum
- Whether `notes` can contain entries during a sustain slot (it shouldn't — sustain slots have no new note onsets)
- How the new shape propagates to `ConversionResult.timeline` which exposes `TimelineSlot[]` in the public API

**Suggestion**: Add a concrete proposed type to the plan, e.g.:

```typescript
type SlotType = "onset" | "sustain" | "rest";
type TimelineSlot = {
  slot: number;
  slotType: SlotType;
  notes: QuantizedNoteEvent[]; // only non-empty when slotType === 'onset'
};
```

Then explicitly call out that `ConversionResult.timeline` type signature changes and whether this is a breaking API change.

---

#### Issue 2 (Critical): buildTimeline does not materialize sustain-only slots beyond maxSlot

**Location**: Step 3 — "materialize sustain-only slots through the true final end slot, not only through the maximum start slot"

Reading `quantize.ts:94-135`, the `buildTimeline` function:

1. Iterates only through `maxSlot` (line 112), where `maxSlot` is derived from `note.startSlot` (lines 105-107)
2. Never computes the maximum `endSlot` across all notes
3. A note starting at slot 5 with duration 10 will have `endSlot=15`, but if no other note starts after slot 5, `maxSlot=5` and the timeline will only have slots 0-5, missing slots 6-14 entirely

The plan correctly identifies this as the root cause but Step 3 doesn't specify how to compute the true final slot. It also doesn't clarify whether ALL intermediate slots (onset + sustain + rest) should be materialized, or only sustain slots.

**Suggestion**: Step 3 should explicitly state:

1. Compute `maxEndSlot = Math.max(...quantized.map(n => n.endSlot))` before building the timeline
2. Iterate `slot <= maxEndSlot` instead of `slot <= maxSlot`
3. For each slot, determine `slotType` based on whether `notes.length > 0` (onset) vs prior slot had notes (sustain) vs no notes (rest)

---

#### Issue 3 (High): Leading rest representation is undefined

**Location**: Further Considerations #1 — "Leading rests need an explicit representation because there is no preceding note to attach adjacency to"

The plan acknowledges this as a problem but does NOT resolve it. At serialize time, a leading rest has no preceding note to be "adjacent" to, so it's unclear whether:

- A leading single rest serializes as `-` (indistinguishable from sustain) or `- -` (space-prefixed group) or ` -` (space before group)
- A leading rest of N slots serializes as `-`.repeat(N) (adjacent dashes) or `- `.repeat(N).trim() (space-separated)

This is a **user-facing semantic contract** that must be defined before implementation.

**Suggestion**: Resolve Further Consideration #1 in the plan itself. Propose: "A leading rest serializes as a space-prefixed dash group at the start of the string, e.g., ` - - C4` for two leading rests followed by C4." This makes the semantic intent clear: leading rest groups are always space-delimited because adjacency requires a preceding note.

---

#### Issue 4 (High): Whitespace stripping in analyze.ts will destroy the distinction before parsing

**Location**: Step 5 — "The parser must understand the new token boundary rules"

Reading `analyze.ts:34`: `const cleaned = notation.replace(/\s+/g, '').trim()` — this **removes ALL whitespace**, so `C4 - - D4` becomes `C4--D4` and the distinction between sustain and rest is already lost before the parser even looks at it.

The plan says to "update notation parsing" but doesn't specify that the fundamental parsing approach must change. The current parser at `analyze.ts:33-71` treats every `-` identically as a rest (line 46: `slots.push({ notes: [], isRest: true })`). Changing the serializer is useless if the analyzer will collapse the distinction immediately on parse.

**Suggestion**: Step 5 should explicitly state that `parseNotation` must be redesigned to:

1. NOT strip whitespace indiscriminately
2. Distinguish between adjacent dashes (sustain) and space-separated dash groups (rest)
3. Preserve the distinction in the internal `ParsedSlot` representation, e.g., `{ notes: [], isRest: true, isSustain: false }` vs `{ notes: [], isRest: false, isSustain: true }`

---

#### Issue 5 (High): Edge cases for chord sustain are not specified

**Location**: Step 4 — "codify exact edge cases for chord sustain, leading rests, trailing rests, and transitions from sustained chord to rest"

The plan lists these edge cases but does NOT codify them. Example ambiguities:

- **Chord sustain**: If a chord `[C4 E4 G4]` is held for 5 slots, does it serialize as `[C4 E4 G4]-----` (adjacent dashes after closing bracket) or `[C4 E4 G4] - - - - -`? The current serializer emits `-` per empty slot, so the distinction doesn't exist yet.
- **Transition from sustained chord to rest**: If `[C4 E4]` is held for 3 slots then there's silence for 2 slots, what does the boundary look like? `-----` (5 sustain dashes) vs `--- - -` (3 sustain + 2 rest)?
- **Trailing sustain tail**: If a note ends at slot 10 but the timeline has no notes after, does it serialize as `C4-----` or stop at the note?

**Suggestion**: Step 4 should include a concrete edge case table with proposed serialization rules, e.g.:

| Scenario                    | Serialization | Rationale                                             |
| --------------------------- | ------------- | ----------------------------------------------------- |
| Chord held for 3 slots      | `[CEG]---`    | Adjacent dashes directly follow chord closing bracket |
| Gap after chord (no notes)  | `[CEG] - -`   | Space separates sustain from rest group               |
| Leading single rest         | ` -`          | Space-prefixed single dash group                      |
| Leading 3 rests             | ` - - -`      | Space-prefixed space-separated group                  |
| Final note held to true end | `C4----`      | Adjacent dashes to timeline end                       |

---

#### Issue 6 (Medium): Verification step 1 is self-contradictory

**Location**: Verification #1 — "confirm failures first for the new semantic cases before implementation"

This sounds like a test-driven development approach, but "new semantic cases" for behavior that doesn't exist yet cannot be written as passing/failing assertions against current code. The existing tests at `tests/quantize-serialize.test.ts` encode the **current** (broken) behavior. Writing "new semantic cases" that assert correct behavior would fail against current code, but the plan doesn't explain how to structure this as a legitimate TDD workflow (write failing tests → implement → tests pass).

**Suggestion**: Clarify Verification #1 as: "Write the expected serialization outputs for known fixtures (sustained single note, note-rest-note, chord sustain) as comment-block test assertions, then verify they fail against current output before implementing."

---

#### Issue 7 (Medium): No mention of standard mode compatibility

**Location**: Decisions — Excluded scope: "standard-mode notation changes"

The plan explicitly excludes standard mode, but the `serialize.ts:64-71` code shows standard mode simply omits all `-` tokens. If the timeline is extended to include sustain-only slots (fixing the `maxSlot` bug in Step 3), standard mode behavior may implicitly change because it iterates over the same timeline. The plan doesn't analyze whether fixing `buildTimeline` to include true final slots would change standard mode output.

**Suggestion**: Add a verification point confirming standard mode output is unchanged after Step 3 changes. Specifically: standard mode should still only emit note tokens (no `-` markers), and the list of note tokens should be identical before/after the timeline materialization change.

---

#### Issue 8 (Medium): No performance analysis for full timeline materialization

**Location**: Step 3 — "materialize sustain-only slots through the true final end slot"

Consider a MIDI with a note starting at slot 0 with duration 100,000 slots (about 10 minutes at 16th note resolution). The current implementation only creates slots 0-maxStartSlot. Extending to true final end slot could create 100,001 slots for a single sustained note, dramatically increasing memory and serialization cost with no musical information added.

**Suggestion**: Add a note about performance: if a note's sustain extends far beyond other notes, consider truncating or representing long sustain tails compactly. Or explicitly document that the implementation must handle worst-case slot counts gracefully.

---

#### Issue 9 (Medium): Regression test migration path is unclear

**Location**: Relevant files — "[midi-to-vp/tests/quantize-serialize.test.ts](midi-to-vp/tests/quantize-serialize.test.ts) — existing output expectations currently encode the flattened dash behavior"

The plan acknowledges tests encode the wrong behavior but doesn't specify the migration strategy:

1. Should tests be updated in the same commit as the fix?
2. Should tests be written first (TDD), demonstrating the new expected behavior fails the old code?
3. Should there be a snapshot update mechanism?

**Suggestion**: In Step 6, add: "Tests should be updated to assert the new behavior in the same commit. Use Vitest's `--update` flag to regenerate snapshots after verifying the new output is correct."

---

#### Issue 10 (Low): Release notes / changelog is mentioned but not planned

**Location**: Further Considerations #3 — "note the breaking change in release notes"

This is a good instinct but appears only as an afterthought in "Further Considerations." The plan's Decisions section says "this is a behavior change for existing extended output" but there's no step to actually document this. If this is a library with external consumers, a changelog entry is essential.

**Suggestion**: Add a step after Step 7: "8. Draft changelog entry documenting the breaking change: extended notation now uses adjacent dashes for sustain and space-separated dash groups for rests. Consumers parsing extended notation by stripping whitespace will need to update their parsers."

---

#### Issue 11 (Low): ConversionResult.timeline type change is a breaking API change

**Location**: Relevant files — "[midi-to-vp/src/convert.ts](midi-to-vp/src/convert.ts) — passes timeline into both serializers and exposes selected notation; verify no API contract regressions"

The plan mentions verifying no API contract regressions but doesn't acknowledge that `ConversionResult.timeline` type will change (from `TimelineSlot[]` with implicit semantics to a type with explicit `slotType` field). For a library package, this is a breaking change requiring a major version bump per semver.

**Suggestion**: In the Decisions section, explicitly state: "This change constitutes a breaking API change to `ConversionResult.timeline`. The package version should be bumped to 2.0.0 (or 1.0.0 if not yet stable) and the changelog updated accordingly."

---

#### Issue 12 (Suggestion): The "source of truth" principle is vague

**Location**: Decisions — "Source of truth: the user rule wins; adjacent dashes mean sustain and spaced dashes mean pause/rest"

This is correct but could be more actionable. The "user rule" is stated here but nowhere in the codebase (as of the current files) is this contract documented. It needs to live not just in this plan but in a permanent ADR and the architecture doc.

**Suggestion**: Step 1 should specifically state: "Document the semantic contract as an ADR update: adjacent dashes = sustain continuation, space-separated dash groups = rest/pause. This becomes the permanent source of truth and supersedes any conflicting statements in existing ADRs or documentation."

---

### Positive Aspects

- Correctly identifies the root cause: `buildTimeline` only uses `maxSlot` from `startSlot`, not `endSlot`
- Explicitly states the behavior change is breaking and requires test/doc updates in the same change
- Correctly identifies that `analyze.ts` strips whitespace which destroys the distinction
- Excludes standard mode appropriately (avoiding scope creep)
- Good file-level dependency tracking in the Relevant Files section

---

### Summary

**Top 3 key issues:**

1. **TimelineSlot type change is underspecified** (Issue 1) — the plan must define the new slot metadata structure, not defer it to implementation
2. **buildTimeline doesn't materialize sustain slots beyond maxSlot** (Issue 2) — this is the core bug and the fix algorithm must be explicitly described
3. **Leading rest representation is unresolved** (Issue 3) — a semantic contract for leading rests must be defined before implementation

---

## Round 2 — 2026-04-03

### Overall Assessment

Significant progress from Round 1. The plan now includes concrete type definitions, explicit semantic contract rules, and a golden examples table. However, after tracing the proposed implementation through the existing code, several new critical gaps emerge — particularly around the `activeNoteCount` field that appears nowhere in the implementation logic, and the fact that `buildTimeline` still only iterates through `maxSlot` (from `startSlot`) even though the plan claims it will iterate through `maxEndSlotExclusive`.

**Rating**: 6.5/10

---

### Previous Round Tracking

| Issue                                       | Severity   | Round 1 Status | Round 2 Status        | Notes                                                                          |
| ------------------------------------------- | ---------- | -------------- | --------------------- | ------------------------------------------------------------------------------ |
| Issue 1: TimelineSlot type underspecified   | High       | Open           | ✅ Resolved           | Concrete type now in Semantic Contract                                         |
| Issue 2: buildTimeline maxSlot bug          | Critical   | Open           | ⚠️ Partially Resolved | Plan specifies maxEndSlot but implementation still uses maxSlot from startSlot |
| Issue 3: Leading rest representation        | High       | Open           | ✅ Resolved           | Semantic Contract explicitly defines `- - C` format                            |
| Issue 4: Whitespace stripping in analyze.ts | High       | Open           | ⚠️ Partially Resolved | Step 6 mentions token scanner but no concrete redesign                         |
| Issue 5: Edge cases table                   | High       | Open           | ✅ Resolved           | Step 5 golden examples table added                                             |
| Issue 6: TDD workflow unclear               | Medium     | Open           | ❌ Unresolved         | No clarification of write-failing-tests-first workflow                         |
| Issue 7: Standard mode compatibility        | Medium     | Open           | ⚠️ Partially Resolved | Step 7 mentions guard test but no pre-change analysis                          |
| Issue 8: Performance analysis               | Medium     | Open           | ❌ Unresolved         | No performance bounds documented                                               |
| Issue 9: Regression test migration          | Medium     | Open           | ❌ Unresolved         | No specific migration strategy                                                 |
| Issue 10: Release notes not planned         | Low        | Open           | ❌ Unresolved         | Still no dedicated step                                                        |
| Issue 11: Breaking API change               | Low        | Open           | ❌ Unresolved         | No semver version bump explicit                                                |
| Issue 12: Source of truth vague             | Suggestion | Open           | ⚠️ Partially Resolved | In Decisions but not in ADR                                                    |

---

### Issues

#### Issue 1 (Critical): `activeNoteCount` is specified in type but never computed in implementation logic

**Location**: Semantic Contract + Step 3 — "activeNoteCount: number; // active voices in this slot (onset + sustain)"

The plan defines `TimelineSlot` with `activeNoteCount` and uses it in the semantic description, but examining the proposed Step 3 algorithm reveals it only classifies `slotType` (onset/sustain/rest) — it never actually computes `activeNoteCount`. The algorithm states:

- "count active notes where `note.startSlot <= slot && slot < note.endSlot`"

This `activeNoteCount` computation is described in the algorithm but is **never assigned to any field in the proposed TimelineSlot output**. The existing `buildTimeline` at `quantize.ts:94-135` has no `activeNoteCount` logic whatsoever.

**Suggestion**: Either:

1. Add `activeNoteCount` to the explicit algorithm in Step 3 (e.g., `slot.activeNoteCount = countActiveNotes(slot)`), OR
2. Remove `activeNoteCount` from the TimelineSlot type if it's not needed for the semantic distinction

---

#### Issue 2 (Critical): Plan specifies `maxEndSlotExclusive` but buildTimeline still only iterates to `maxSlot`

**Location**: Step 3 — "Build slots from `0..(maxEndSlotExclusive - 1)`"

The plan correctly specifies `maxEndSlotExclusive = max(note.endSlot)` and iterating through that range. However, the existing `buildTimeline` at `quantize.ts:112` only iterates to `maxSlot` (derived from `note.startSlot` at lines 105-107). The plan's own pseudocode for Step 3 says:

> "Iterate `slot <= maxEndSlot` instead of `slot <= maxSlot`"

But no Step 3 implementation detail actually describes how to compute `maxEndSlot`. The discrepancy between "compute `maxEndSlotExclusive`" and the actual `for (let slot = 0; slot <= maxSlot; slot += 1)` at `quantize.ts:112` is unresolved.

**Suggestion**: Step 3 pseudocode should explicitly show:

```typescript
const maxEndSlot = Math.max(...quantized.map((n) => n.endSlot));
for (let slot = 0; slot < maxEndSlot; slot += 1) {
  // Note: < not <=
  // ...
}
```

---

#### Issue 3 (High): Serializer logic doesn't align with proposed TimelineSlot type

**Location**: Step 4 + Step 5 — serializer maps to `slotType` but existing code checks `notes.length`

The plan's Step 4 serializer mapping says:

- onset → `renderSlotToken(slot.notes)`
- sustain → `-` appended adjacent
- rest → `-` token separated by spaces

But `renderSlotToken` at `serialize.ts:3-14` returns empty string for `notes.length === 0`. For a sustain slot (no onset notes, but `activeNoteCount > 0`), `slot.notes` would be empty per the new type. The serializer needs to check `slotType`, not `notes.length`.

Similarly, the existing check at `serialize.ts:58` (`slot.notes.length > 0 ? renderSlotToken(slot.notes) : '-'`) would misclassify sustain slots as rests because they have empty notes.

**Suggestion**: Step 4 serializer mapping must explicitly call out that `renderSlotToken` is only called for onset slots. For sustain and rest slots, the dash token is emitted based on `slotType`, not `notes.length`.

---

#### Issue 4 (High): `analyze.ts` redesign is underspecified — no concrete token scanning approach

**Location**: Step 6 — "replace whitespace-stripping parser with a token scanner that retains spacing boundaries"

The plan identifies the problem correctly but gives no guidance on HOW to scan tokens while retaining spacing. A concrete approach would be:

1. Scan for note tokens (`[notes]`, single chars) vs dash groups
2. For each dash group, determine if adjacent to prior token (sustain) or isolated (rest)
3. The leading rest case is particularly tricky: ` - - C4` has spaces before first dash

**Suggestion**: Add concrete pseudocode for the token scanner:

```typescript
function scanTokens(notation: string): Token[] {
  // 1. Match leading spaces before first dash group → leadingRest
  // 2. Match chord brackets [notes] → onset
  // 3. Match adjacent dash sequences → sustain
  // 4. Match space-separated dash groups → rest
}
```

---

#### Issue 5 (High): No validation that `durSlots` is always > 0 before computing `endSlot`

**Location**: `quantize.ts:60-61`

```typescript
const durSlots = Math.max(1, Math.round(note.durationSec / stepSec));
const endSlot = startSlot + durSlots;
```

The `Math.max(1, ...)` guards against zero-duration notes, but if `note.durationSec` is extremely small or zero, `durSlots` becomes 1. The `endSlot` computation is correct here due to the guard. However, if a note has negative duration (invalid MIDI data), this would silently produce incorrect results.

**Suggestion**: Add an assertion or early-return for invalid note durations before computing endSlot:

```typescript
if (note.durationSec <= 0) continue; // Skip invalid notes
```

---

#### Issue 6 (Medium): Step 7 regression test mentions "standard-mode guard test" but doesn't specify its scope

**Location**: Step 7 — "Add a standard-mode guard test confirming output is unchanged by timeline expansion"

The intent is good but the test scope is unclear. Does this test:

1. Compare standard notation string output before/after change?
2. Compare only the list/number of note tokens?
3. Compare that no additional slots are inserted into standard output?

A guard test with ambiguous scope could pass even if standard mode subtly changes.

**Suggestion**: Step 7 should specify: "Verify standard mode emits identical note tokens (ignoring timeline length) before and after the change. Specifically assert that `result.notation.standard` is unchanged for existing fixtures."

---

#### Issue 7 (Medium): No upper bound on timeline slot count

**Location**: Step 3 — timeline materialization to `maxEndSlot`

A MIDI with a single note at slot 0 with duration 1,000,000 slots (at 16th note resolution, ~17 minutes) would create a 1,000,000-element timeline. This has memory and serialization cost implications.

**Suggestion**: Add a Step 9 or an explicit note in Step 3: "If `maxEndSlot - maxSlot > REASONABLE_SUSTAIN_TAIL` (e.g., > 100 slots), consider truncating the sustain tail with an ellipsis marker or warning."

---

#### Issue 8 (Low): The plan claims Step 3 fixes `buildTimeline` but the implementation isn't in scope

**Location**: Step 3 — "materialize sustain-only slots through the true final end slot"

The step is listed in the implementation scope but the actual `quantize.ts` modification isn't clearly scoped. Is modifying `buildTimeline` in scope or is this a separate fix?

**Suggestion**: Clarify: "Step 3 modifies `buildTimeline` in `quantize.ts` to iterate through `maxEndSlot` instead of `maxSlot`."

---

### Positive Aspects

- **Semantic Contract section is now concrete** — the 6 bullet points resolve Round 1 Issues 1, 3, and 5
- **Golden examples table** in Step 5 is excellent — provides unambiguous reference for all edge cases
- **`slotType` discriminated union** is clean and unambiguous
- **ADR reference in Step 1** ensures the decision persists
- **Changelog mention in Step 8** is better than nothing

---

### Summary

**Top 3 remaining blocking issues:**

1. **`activeNoteCount` field specified but never computed** (Issue 1) — the type defines it but the algorithm never populates it
2. **Serializer logic doesn't use `slotType`** (Issue 3) — the Step 4 mapping describes `slotType`-based output but the existing code checks `notes.length`
3. **`maxEndSlot` iteration vs `maxSlot` iteration** (Issue 2) — the plan specifies the fix correctly but doesn't show how the existing `for (let slot = 0; slot <= maxSlot; slot += 1)` loop changes

**Consensus Status**: NEEDS_REVISION

The plan has resolved most of Round 1's structural issues (type definition, semantic contract, edge cases). What remains are implementation-level gaps that would cause the implementation to deviate from the spec: missing `activeNoteCount` computation, serializer checking wrong field, and an underspecified token scanner approach.

---

### Recommendation

Approve for implementation once the following are addressed in the plan itself:

1. Add `activeNoteCount` computation to Step 3 algorithm OR remove it from the type
2. Show exactly how `buildTimeline` loop changes from `slot <= maxSlot` to `slot < maxEndSlot`
3. Clarify serializer must check `slotType` field, not `notes.length`
4. Add concrete token scanner pseudocode to Step 6

---

## Round 3 — 2026-04-03

### Overall Assessment

Round 3 confirms the remaining Round 2 blockers were addressed in the updated plan. The plan now clearly defines loop bounds for timeline materialization, explicit `activeNoteCount` handling, `slotType`-driven serialization rules, and minimum token-scanner behavior for analysis parsing. Remaining concerns are minor wording-level improvements, not implementation blockers.
**Rating**: 8.5/10

### Previous Round Tracking (R3)
| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 1 | `activeNoteCount` computation missing | Resolved | Step 3 now defines computation and field assignment |
| 2 | `maxEndSlot` loop change underspecified | Resolved | Step 3 now includes current vs target loop form |
| 3 | Serializer ambiguity (`slotType` vs `notes.length`) | Resolved | Step 4 now requires `slotType`-based branching and render guard |
| 4 | Token scanner design too abstract | Resolved | Step 6 now includes minimum scanner contract |
| 5 | Duration validation gap | Resolved | Step 3 now includes invalid-duration skip |
| 6 | Standard-mode guard test scope unclear | Resolved | Step 7 now requires byte-for-byte assertion |
| 7 | Performance visibility gap | Resolved | Step 9 adds threshold monitoring in stress tests |
| 8 | Step 3 implementation scope unclear | Resolved | Step 3 explicitly scopes `buildTimeline` loop update |

### Issues
#### Issue 1 (Suggestion): Promote release-note work from bullet to explicit checklist item
**Location**: Step 8
The changelog note exists, but making it an explicit deliverable checkbox can prevent accidental omission in implementation PRs.
**Suggestion**: Add a sub-item in Step 8 with a required completion checkbox for release-note text.

#### Issue 2 (Suggestion): Clarify whether semver bump is mandatory or conditional
**Location**: Decisions -> Versioning note
The current wording says "if consumed externally" which is correct but leaves ownership of that decision implicit.
**Suggestion**: Add one sentence naming the decision owner (maintainer/release owner) and expected decision timing (before merge).

### Positive Aspects
- Semantic contract is explicit and testable.
- Core algorithm changes are now concrete enough to implement directly.
- Parser/serializer boundaries are materially clearer than in Round 1.
- Verification includes regression and compatibility checks.

### Summary
Top strengths: explicit timeline semantics, concrete loop/serialization rules, and targeted verification strategy.
**Consensus Status**: APPROVED

---

## Round 4 — 2026-04-03

### Overall Assessment

The plan is structurally sound and all prior blockers are resolved. However, two logical gaps in the serializer specification will cause two independent implementors to produce different character sequences for identical inputs: the onset-after-rest spacing rule is missing, and the leading-rest exception (no space at string position 0) is expressed only in the golden examples, not in the contract. A third issue — the `endSlot` exclusive/inclusive convention — is silently assumed throughout Step 3 but never declared, making it a correctness trap for anyone who looks at the existing code first. These are not cosmetic issues; they determine whether the golden example `C - - D` is reproducible from the stated algorithm.

**Rating**: 8/10

### Previous Round Tracking (R4)
| # | Issue | R3 Status | R4 Status | Notes |
|---|-------|-----------|-----------|-------|
| R3-1: Promote changelog to merge-blocking checklist | Applied | Confirmed | Step 8 now reads "required merge-blocking delivery item" with PR checkbox |
| R3-2: Semver ownership and timing explicit | Applied | Confirmed | Decisions section now names maintainer/release owner with "BEFORE merge" deadline |

### Issues

#### Issue 1 (High): Onset-after-rest spacing rule is absent from the serializer spec

**Location**: Step 4 — serializer mapping bullets; confirmed by golden example `C - - D`

The four serializer rules are:
- onset → `renderSlotToken(slot.notes)`
- sustain → adjacent `-`
- rest → space-separated `-`

Applying these rules mechanically to the sequence onset, rest, rest, onset:

```
C             (onset: renderSlotToken)
 -            (rest: space + dash)
 -            (rest: space + dash)
D             (onset: renderSlotToken — no leading space stated)
```

Result: `C - -D`

The golden example demands `C - - D`. The space before `D` requires a rule that is nowhere stated: an onset token must be prefixed with a space when the immediately preceding slot is a rest. The same gap applies to `- - C`: the `C` after two leading rests needs a leading space, but the onset rule carries no context-awareness about preceding slot type.

Two implementors will independently produce `C - -D` and `C - - D` — both faithful to the written rules in their own way.

**Suggestion**: Add an explicit rule to Step 4: "When emitting an onset token whose immediately preceding serialized slot was a rest, prefix the token with a single space." Alternatively, define a `previousSlotType` context variable and expand the onset bullet to: `onset after rest → ' ' + renderSlotToken(slot.notes); onset otherwise → renderSlotToken(slot.notes)`." Annotate the golden examples table with per-character separators (e.g., `C·_·-·_·-·_·D` where `_` = space and `·` = no separator) so separator positions are unambiguous.

---

#### Issue 2 (High): Leading-rest space exception exists only in the example, not in the contract

**Location**: Semantic Contract point 3 vs golden example "Leading two-slot rest then note: `- - C`"

Semantic Contract point 3 states: rest slots serialize as ` -` (space then dash). Applied literally from string position 0, a two-slot leading rest would produce ` - - C` (leading space), not `- - C`. The golden example clearly shows no leading space. The rule "no leading space at string position 0" is derivable only by cross-referencing the example — it is never stated in the contract.

This interacts with Issue 1: together they form the complete spacing model, but neither component is written down. An implementor who writes the serializer from the contract alone (without studying the examples) will emit ` - - C` instead of `- - C`.

**Suggestion**: Add to Semantic Contract point 3 (or as a point 3a): "At string position 0, the first rest token is emitted as `-` with no leading space. All subsequent rest tokens in any run are emitted as ` -` (space + dash). The effect is that rest runs read as space-joined dash sequences, and the entire run is separated from adjacent non-rest tokens by a single space on each side." This single statement fully captures the spacing model and makes all five golden examples derivable without cross-referencing.

---

#### Issue 3 (Medium): `endSlot` exclusive-or-inclusive convention is assumed throughout but never declared

**Location**: Step 3 — "compute `maxEndSlotExclusive = max(note.endSlot)`"; also Step 3 `activeNoteCount` formula: `count(note.startSlot <= slot && slot < note.endSlot)`

The variable is named `maxEndSlotExclusive`, strongly implying that `note.endSlot` is already an exclusive index (the first slot where the note is silent). The `activeNoteCount` formula confirms this: `slot < note.endSlot` is correct only if `endSlot` is exclusive.

This convention is never stated. If the existing codebase stores `endSlot` as the last active slot (inclusive — a common alternative), then:
- `max(note.endSlot)` underestimates by one slot
- `slot < maxEndSlotExclusive` drops the final sustain slot
- `slot < note.endSlot` in the `activeNoteCount` filter incorrectly excludes the note on its last active slot

All three errors are silent — no assertion fails, the code compiles, the final sustain just disappears — which is exactly the regression this plan is trying to fix.

**Suggestion**: Add an explicit declaration in Step 3: "`note.endSlot` is exclusive throughout this codebase — it is the first slot at which the note is no longer active (i.e., a note with `startSlot = 0` and `durationInSlots = 3` has `endSlot = 3`, not `2`). If existing code stores an inclusive value, rename the field to `endSlotExclusive` in this change." Add a test assertion: for a note with duration= 3 slots starting at slot 0, assert `note.endSlot === 3`.

---

#### Issue 4 (Medium): Standard mode serializer path after loop change is unspecified

**Location**: Step 4 — "Keep standard mode behavior unchanged: emit only onset note/chord tokens"

Step 3 changes the timeline loop so that sustain and rest `TimelineSlot`s are now always present in the output array. Step 4 declares standard mode is "unchanged," but does not say how that mode is achieved. Two divergent implementations are possible:

- **Path A**: Both modes share the same `TimelineSlot[]` array. Standard mode serializer adds a gate: `if (slot.slotType !== "onset") continue`. This is correct but changes the loop structure.
- **Path B**: Standard mode retains its own separate loop with the old bounds (`for slot <= maxStartSlot`), never consuming the extended `TimelineSlot[]`. This also produces the same output for standard mode, but the code has two loop paths with different bounds.

Path B would pass the Step 7 byte-for-byte guard test but leaves stale logic. Path A is cleaner but requires the standard mode branch to explicitly filter on `slotType`. Neither is obvious from "unchanged."

**Suggestion**: Specify in Step 4: "Both extended and standard modes consume the same `TimelineSlot[]` computed in Step 3. Standard mode serializer skips all slots where `slotType !== 'onset'` and emits only `renderSlotToken(slot.notes)` for the remaining onset slots."

---

#### Issue 5 (Low): `renderSlotToken` is referenced but never defined

**Location**: Step 4 — "onset: `renderSlotToken(slot.notes)`"; also Step 4 — "Implementation guard: never call `renderSlotToken` for sustain/rest slots"

`renderSlotToken` is used twice in Step 4 as if it is an established function, but the plan never defines it. Questions left open:
- Is it an existing function in `serialize.ts` or does it need to be created?
- For a single onset note, does it return `"C"` (pitch only) or a decorated form?
- For multiple onset notes (chord), does it return `"[CEG]"` (bracket notation)?
- What does it return for an empty `notes` array — empty string, or should it be unreachable?

An implementor will invent their own signature, potentially diverging from existing behavior.

**Suggestion**: Add a parenthetical in Step 4: "`renderSlotToken` is the existing single/chord token formatter already in `serialize.ts` (single note → pitch-class token; multiple notes → `'[' + sorted tokens + ']'`). Do not create a new function; call the existing one. The guard ensures it is never invoked with an empty array."

---

#### Issue 6 (Low): No golden example for onset immediately following sustained notes (onset-after-sustain boundary)

**Location**: Step 5 — golden examples table

The examples cover onset→sustain (`C---`), onset→rest→onset (`C - - D`), and onset→sustain→rest (`[CEG]-- -`). No example covers onset→sustain→onset — a new note beginning in the slot immediately after a held note ends (no gap, no rest).

Example: note C at slots 0–2, note D at slot 3. Expected: `C---D` or `C--- D`?

Under the rules as written: slot 3 is an onset following sustains, onset rule says `renderSlotToken(slot.notes)` with no mention of leading space, so the result should be `C---D`. But this is not confirmed by any example, and a developer who over-applies Issue 1's fix ("space before onset when preceded by...") might emit `C--- D` instead.

**Suggestion**: Add a row to the golden examples table: "Held note ending, new note beginning same slot (no gap): `C---D`." This anchors the onset-after-sustain boundary and prevents over-application of the rest–onset spacing rule.

---

#### Issue 7 (Suggestion): Interaction between `durationSec <= 0` skip and `maxEndSlotExclusive` is not mentioned

**Location**: Step 3 — "In `quantizeNotes`, skip notes with `durationSec <= 0` before slot math" and "compute `maxEndSlotExclusive = max(note.endSlot)`"

If ALL notes in a file have `durationSec <= 0` and are skipped, `quantized` will be empty. `max(note.endSlot)` over an empty set is `undefined` or `-Infinity` in JavaScript, and `slot < undefined` is always false — producing an empty timeline rather than a meaningful error.

**Suggestion**: Add a guard: "If `quantized.length === 0` after filtering, return an empty timeline or throw `INPUT_LIMIT_EXCEEDED_EMPTY` (or the appropriate existing error constant). Document this in the `INPUT_LIMIT_EXCEEDED_*` constants section referenced in Step 9."

---

### Positive Aspects

- The `TimelineSlotType` discriminated union is minimal and exhaustive; the three-way branch covers every possible slot state cleanly.
- The `activeNoteCount` formula (`note.startSlot <= slot && slot < note.endSlot`) is now explicit in Step 3. The `slotType` derivation (`onset` if onset notes exist; `sustain` if no onsets but `activeNoteCount > 0`; `rest` otherwise) is unambiguous.
- Step 8's merge-blocking changelog requirement with a required PR checkbox is the right level of process enforcement for a breaking change.
- The semver decision ownership and "BEFORE merge" timing eliminate the ambiguity from R3.
- The Step 9 performance and safety section and its tie-in to existing `INPUT_LIMIT_EXCEEDED_*` constants is well-scoped.

### Summary

Two HIGH issues define the core remaining gap: the serializer algorithm as written produces `C - -D` and ` - - C` rather than the golden examples' `C - - D` and `- - C`. These require two small but explicit rules that are currently implicit. Issue 3 (`endSlot` convention) is a latent correctness trap that will silently drop the final sustain slot if the existing codebase uses an inclusive convention. All three should be resolved before implementation begins; Issues 5–7 are low-cost cleanup that can be addressed in the same pass.

**Consensus Status**: NEEDS_REVISION

---

## Round 5 — Adversarial Plan Review

**Status**: NEEDS_REVISION
**Reviewer**: Adversarial Plan Review Agent (R5)

### Positive Aspects

- The four spacing rules in Semantic Contract point 3 — combined with Step 4 — collectively produce the correct character sequences. All six golden example rows are derivable when both sections are consulted together.
- Step 4's rest-rule formulation ("prefixed by one space unless this is the very first token in the output string") is unambiguous on its own and would produce correct output if implemented as written.
- The `endSlot` exclusive convention is now declared explicitly with both a definition sentence and an example invariant, eliminating the inclusive/exclusive ambiguity from R4.
- The onset-after-rest and onset-after-sustain cases (R4 Issues 1 and 6) are present in both the Semantic Contract and Step 4, making those two golden examples derivable from the algorithm.
- The merge-blocking changelog checklist and named semver decision owner from R3/R4 are confirmed present.

---

### Issues Found

#### Issue 1 (HIGH): Semantic Contract rule 2 is internally inconsistent with Step 4 — the ADR will encode the ambiguous rule

**Location**: Semantic Contract point 3, rule 2 vs. Step 4 serializer bullet for `rest`

The Semantic Contract states:
> "Every **subsequent rest slot in a run** is prefixed by exactly one space: ` -`."

Step 4 states:
> "rest: emit `-`, prefixed by one space (` -`) unless **this is the very first token in the output string** (position 0 → emit `-` with no prefix)."

These are different rules. "Subsequent rest slot in a run" naturally reads as "the 2nd, 3rd, … rest token within a contiguous rest run." Under that reading, the **first** rest in a non-position-0 run — for example, slot 1 in `C - - D` — is neither covered by rule 1 (it is not at position 0) nor by rule 2 (it is not *subsequent within* its run; it *is* the first rest in that run). A developer implementing the serializer purely from the Semantic Contract would find no rule for this slot, and either add no prefix (producing `C- - D`) or guess.

Step 4 resolves this correctly ("unless this is the very first token"), but the Semantic Contract is written first into the ADR in Step 1 ("Update… with the finalized rules above"). The ADR will therefore canonize the ambiguous "in a run" formulation, not Step 4's clear one. Any future developer reading the ADR without also consulting Step 4 will reproduce the bug this plan was written to fix.

**Required fix**: Rewrite Semantic Contract point 3, rule 2 to match Step 4's formulation: "Every rest slot that is **not at string position 0** is prefixed by exactly one space: ` -`." Remove "in a run" entirely.

---

#### Issue 2 (MEDIUM): `lastActiveIndex` used in test assertion is undefined — the assertion cannot be written as given

**Location**: Step 3, test assertion paragraph

The assertion reads:
> "assert `slots[lastActiveIndex].slotType === 'sustain'` and `slots[lastActiveIndex + 1] === undefined`"

`lastActiveIndex` is never defined in the plan. A developer transcribing this assertion verbatim will get a `ReferenceError`. The correct value (`maxEndSlotExclusive - 1`) must be inferred from context, but the plan does not state it.

Additionally, `slots[lastActiveIndex + 1] === undefined` is weaker than intended. In JavaScript, accessing beyond an array's length always returns `undefined`, including on sparse arrays with holes. The explicit assertion `expect(slots).toHaveLength(lastActiveIndex + 1)` tests the same constraint with a more readable failure message and cannot silently pass due to sparseness.

**Required fix**: Add before the assertion: "Let `lastActiveIndex = maxEndSlotExclusive - 1` (for a note with `endSlot = 3`, `lastActiveIndex = 2`)." Replace `slots[lastActiveIndex + 1] === undefined` with `expect(slots).toHaveLength(lastActiveIndex + 1)`.

---

#### Issue 3 (MEDIUM): Empty-quantized guard returns `TimelineSlot[]` but is attributed to `quantizeNotes` — wrong function

**Location**: Step 3, empty-quantized guard paragraph

The paragraph opens "In `quantizeNotes`, skip invalid durations (`durationSec <= 0`)…" and continues:
> "**Guard required**: if after filtering the `quantized` array is empty… return an empty `TimelineSlot[]` immediately."

`quantizeNotes` maps input notes to `QuantizedNoteEvent[]`; its return type is `QuantizedNoteEvent[]`, not `TimelineSlot[]`. The guard described — returning `TimelineSlot[]` if the filtered output is empty — belongs at the top of `buildTimeline` (which receives `QuantizedNoteEvent[]` and returns `TimelineSlot[]`), not in `quantizeNotes`.

A developer reading this paragraph will try to add the guard to `quantizeNotes` and encounter a type error. If they work around it, the guard ends up in the wrong function, leaving `buildTimeline` unprotected.

The plan also never states how `convert.ts` handles an empty `TimelineSlot[]` from `buildTimeline`, leaving the downstream behavior unspecified.

**Required fix**: Restructure as two separate sentences: "In `quantizeNotes`, skip any note with `durationSec <= 0` before computing `endSlot`. At the top of `buildTimeline`, if the input `quantized` array is empty, return `[]` immediately — do not call `Math.max()` on an empty array. An empty timeline causes the serializer to emit an empty string and the analyzer to return zero/default metrics; no special handling is needed downstream."

---

#### Issue 4 (LOW): No golden example for rest-then-chord-onset — the only untested onset-after-rest with bracket notation

**Location**: Step 5 golden examples table

The six examples include `- - C` (rest→single-note onset) and `[CEG]-- -` (chord-onset→sustain→rest), but none covers **rest → chord onset** (`- - [CEG]--`). This is the only case where a developer could accidentally place the space prefix inside the bracket (`- -[ CEG]--`) or omit it entirely (`- -[CEG]--`) and no existing example would catch the error.

**Required fix**: Add one row to the Step 5 table:

| Scenario | Expected extended output |
|---|---|
| Leading two-slot rest then sustained chord | `- - [CEG]--` |

---

#### Issue 5 (LOW): Onset-at-position-0 has no explicit branch in the Step 4 onset rule

**Location**: Step 4, onset serializer bullet

Step 4 provides two explicit onset branches: "preceding was rest → prefix with space" and "preceding was sustain or onset → no prefix." For the first slot (position 0), there is no preceding slot — neither branch applies. The plan relies on the developer handling `previousSlot === undefined` as a falsy condition without stating it. A developer writing an exhaustive switch over `previousSlotType` will find the `default` (no preceding slot) case missing from the spec.

**Required fix**: Add a third clause: "If there is no preceding slot (position 0), emit with no prefix." Or consolidate the three cases: "Prefix with one space only when the immediately preceding serialized slot was a rest; in all other situations — position 0, or following a sustain or onset — emit with no prefix."

---

#### Issue 6 (Suggestion): Step 7 references "all scenarios in Step 5" by phrase rather than by explicit enumeration

**Location**: Step 7

"Add serializer/parser round-trip tests for all scenarios in Step 5" leaves "all scenarios" open to interpretation. A developer could write four test cases and consider the step satisfied. There is no 1-to-1 mapping requirement stated.

**Recommended fix**: Add: "Each of the six rows in the Step 5 table must correspond to exactly one serializer round-trip test referenced by its scenario label. Partial coverage (fewer than six) is not acceptable."

---

#### Issue 7 (Suggestion): Standard-mode gate equivalence between `notes.length > 0` and `slotType === 'onset'` not stated

**Location**: Step 4, standard mode path

The plan says the gate changes from `notes.length > 0` to `slotType !== 'onset'` and that output "must remain byte-for-byte equal," but never asserts these two conditions are equivalent under the new type contract. A reviewer auditing the change could treat this as a semantic difference requiring justification.

**Recommended fix**: Add one sentence: "By the `TimelineSlot` type contract, `slotType === 'onset'` is equivalent to `notes.length > 0`; switching the gate is a mechanical substitution with no behavioral change for the onset-slot set, which is why standard output remains byte-for-byte equal."

---

### Summary

The plan is within one focused revision pass of being implementable. Issue 1 is the most consequential: the Semantic Contract and Step 4 carry materially different formulations of the rest-prefix rule, and the ADR is written from the Semantic Contract. If left as-is, the ADR will encode the ambiguous "subsequent in a run" wording, making the plan a correctness trap for any future implementation from the canonical document alone. Issues 2 and 3 are mechanical precision failures that will cause test-writing and function-placement errors respectively. Issues 4 and 5 are low-cost additions (one table row, one sentence) that close the only remaining untested boundary. All seven items can be resolved in a single editorial pass with no structural changes to the plan.

---

## Round 6 — Adversarial Plan Review

**Status**: APPROVED
**Reviewer**: Adversarial Plan Review Agent (R6)

### R5 Verification Results

**R5-I1 (HIGH) — Semantic Contract rule 2 rewritten: ✅ RESOLVED**
Semantic Contract point 3, rule 2 now reads "Every rest slot that is **not at string position 0** is prefixed by exactly one space: ` -`." The phrase "subsequent rest slot in a run" is gone. All four rules are now internally consistent: rule 1 covers the position-0 exception, rule 2 covers all other rests, rule 3 covers onset-after-rest, rule 4 covers onset-after-sustain. Cross-checked against the golden examples and Step 4 — no contradiction.

**R5-I2 (MEDIUM) — `lastActiveIndex` defined before use, `.toHaveLength()` used: ✅ RESOLVED**
Step 3 now reads: "let `lastActiveIndex = maxEndSlotExclusive - 1` (for a note with `endSlot = 3`, `lastActiveIndex = 2`)." The test assertion uses `expect(slots).toHaveLength(lastActiveIndex + 1)` and no longer references `=== undefined`. Both fixes applied correctly.

**R5-I3 (MEDIUM) — Empty-quantized guard correctly split into two distinct operations: ✅ RESOLVED**
Step 3 now clearly attributes the `durationSec <= 0` skip to `quantizeNotes`, and the guard returning `[]` early to `buildTimeline`. The downstream behavior ("serializer emits empty string, analyzer returns zero/default metrics; no special handling needed") is stated. The type error trap (returning `TimelineSlot[]` from `quantizeNotes`) is eliminated.

**R5-I4 (LOW) — `- - [CEG]--` row added: ✅ RESOLVED**
Step 5 table now has seven rows. The new row "Leading two-slot rest then sustained chord → `- - [CEG]--`" is present. The table now covers all four onset-prefix boundary combinations: onset-at-position-0, onset-after-rest (single note), onset-after-rest (chord), and onset-after-sustain.

**R5-I5 (LOW) — Position-0 onset case explicit in Step 4: ✅ RESOLVED**
Step 4 onset bullet now reads: "In all other cases — no preceding slot (position 0), or following a sustain or onset — emit with no space prefix." All three situations are explicitly named; the default case (`previousSlot === undefined`) is no longer implicit.

**R5-I6 (Suggestion) — Step 7 "seven rows" requirement explicit: ✅ RESOLVED**
Step 7 now reads: "Each of the **seven rows** in the Step 5 table must correspond to exactly one serializer round-trip test identified by its scenario label; partial coverage (fewer than seven tests) is not acceptable." The count matches the Step 5 table.

**R5-I7 (Suggestion) — Equivalence note between `notes.length > 0` and `slotType === 'onset'` added: ✅ RESOLVED**
Step 4 standard mode path now includes: "By the `TimelineSlot` type contract, `slotType === 'onset'` is equivalent to `notes.length > 0`; switching the gate is a mechanical substitution with no behavioral change for the onset-slot set…" The sentence also ties this to the Step 7 byte-for-byte guard test.

---

### Final Sweep Findings

**Spacing rules completeness — all seven golden rows trace correctly:**

Traced character-by-character from Semantic Contract + Step 4 alone:

| Row | Trace | Result |
|---|---|---|
| `C---` | onset(C, pos-0)→`C`; sustain→`-`; sustain→`-`; sustain→`-` | `C---` ✅ |
| `C - - D` | onset(C, pos-0)→`C`; rest(not-0)→` -`; rest(not-0)→` -`; onset(D, after-rest)→` D` | `C - - D` ✅ |
| `[CEG]-- -` | onset([CEG], pos-0)→`[CEG]`; sustain→`-`; sustain→`-`; rest(not-0)→` -` | `[CEG]-- -` ✅ |
| `- - C` | rest(pos-0)→`-`; rest(not-0)→` -`; onset(C, after-rest)→` C` | `- - C` ✅ |
| `- - [CEG]--` | rest(pos-0)→`-`; rest(not-0)→` -`; onset([CEG], after-rest)→` [CEG]`; sustain→`-`; sustain→`-` | `- - [CEG]--` ✅ |
| `D----` | onset(D, pos-0)→`D`; sustain×4→`----` | `D----` ✅ |
| `C---D` | onset(C, pos-0)→`C`; sustain×3→`---`; onset(D, after-sustain)→`D` | `C---D` ✅ |

All seven rows are fully derivable from the contract and Step 4 without consulting a separate section.

**Chord bracket and space interaction for `- - [CEG]--`:**
The trace confirms the space preceding `[CEG]` is emitted by the onset rule ("preceding slot was rest → prefix ` `"), and `[` appears immediately after that single space character. No accidental double-space, no space inside the bracket.

**Step 7 row count:**
Step 7 says "seven rows" and "fewer than seven tests"; Step 5 has exactly seven rows. Consistent.

**One Suggestion-level observation (non-blocking):**
Semantic Contract point 3 rules cover four slot-transition cases: rest-at-position-0, rest-elsewhere, onset-after-rest, onset-after-sustain. The case of **onset immediately following another onset** (two back-to-back single-quantum notes with no sustain between them) is not listed as an explicit rule in the Semantic Contract, though Step 4's "In all other cases…emit with no space prefix" subsumes it. This omission does not affect any of the seven golden examples and would only surface as a question when implementing from the ADR alone. Since the ADR is populated from the Semantic Contract (Step 1), a future implementor encountering this edge case would need to consult Step 4. Adding "onset after onset → no prefix" as a parenthetical to Semantic Contract rule 3 or 4 would close the gap entirely, but this is not blocking since the edge case is musically unusual and Step 4 is unambiguous.

---

### Summary

All seven R5 issues are fully and correctly resolved. Every fix was applied to the right location with the right formulation. The Semantic Contract and Step 4 are internally consistent, consistent with each other, and produce the correct character sequence for all seven golden examples when traced independently. The `- - [CEG]--` row traces cleanly with the space landing before `[`. Step 7 says "seven" explicitly. The guard placement issue (R5-I3) is correctly resolved across two functions. The plan is ready for implementation.
