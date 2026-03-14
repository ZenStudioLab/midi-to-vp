# ADR 0005: Quantization and Timeline Algorithm

**Status**: Accepted  
**Date**: 2026-03-14  
**Deciders**: Development team

## Context

MIDI timing is continuous (`startSec`, `durationSec`) while Virtual Piano notation needs a discrete timeline.
The converter requires:
- Deterministic slot assignment
- Stable behavior for repeated runs
- Playable chord density for different difficulty targets

Quantization and timeline behavior must remain predictable across CLI and API usage.

## Decision

Use a **slot-grid quantization strategy** with deterministic sorting and bounded chord simplification.

### Quantization Rules

In `quantize.ts`:
- `startSlot = round(startSec / stepSec)`
- `durSlots = max(1, round(durationSec / stepSec))`
- `endSlot = startSlot + durSlots`
- Notes outside keymap are skipped
- Quantized notes are sorted by `startSlot`, then `midi`

### Timeline Construction Rules

In `buildTimeline`:
- Build slots from `0` to `max(startSlot)` inclusive
- Merge same-pitch notes per slot by keeping the highest velocity note
- If `simplifyChords` is enabled, apply `maxChordSize` policy:
  - Keep melody only when `maxChordSize <= 1`
  - Keep bass + melody when `maxChordSize === 2`
  - Keep bass + melody + highest-velocity middle voices when `maxChordSize > 2`

### Serialization Coupling

Serialized output keeps timeline slot count intact. Rendering differs by notation mode:
- `extended`: rests rendered as `-`
- `zen`: uses sustain-aware `-` and idle `|`

## Consequences

### Positive
- Deterministic output across environments
- Predictable rhythm simplification for downstream tools
- Supports user-tunable complexity via `slotsPerQuarter`, `simplifyChords`, `maxChordSize`
- Low implementation complexity with good testability

### Negative
- Rounding can shift events near boundaries by half-step tolerance
- Very dense polyphony is intentionally reduced in simplified modes
- Timeline currently ignores trailing sustain-only tail slots after final start slot

### Neutral
- Algorithmic complexity remains O(n log n) because of sorting
- Behavior is optimized for readability/playability, not score-perfect transcription

## Alternatives Considered

### 1. Floor/Ceil-only Quantization
- **Rejected**: Biases rhythm consistently early or late
- Rounding gives better average timing fidelity

### 2. Keep All Chord Notes
- **Rejected**: Produces unplayable notation for complex MIDI files
- Violates goal of practical Virtual Piano output

### 3. Tempo-segment-aware Variable Grid
- **Rejected (for now)**: Higher complexity and harder debugging
- Current constant step from base tempo is sufficient for v0.1.x goals

## Implementation Notes

Primary implementation:
- `src/quantize.ts` (`quantizeNotes`, `buildTimeline`, `simplifyChord`)
- `src/serialize.ts` for notation-mode-specific rest rendering

Primary controls:
- `quantization.slotsPerQuarter`
- `simplifyChords`
- `maxChordSize`

## Related Decisions

- [ADR 0003](0003-conversion-pipeline-architecture.md): Conversion stage boundaries
- [ADR 0006](0006-default-keymap-design.md): MIDI→Virtual Piano mapping constraints
