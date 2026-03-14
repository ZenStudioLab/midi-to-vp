# ADR 0006: Default Keymap Design

**Status**: Accepted  
**Date**: 2026-03-14  
**Deciders**: Development team

## Context

Virtual Piano notation depends on a stable mapping between MIDI notes and keyboard tokens.
The library needs a default map that is:
- Compatible with established Virtual Piano key conventions
- Deterministic and serializable
- Easy to override with custom keymaps

## Decision

Implement a **static default keymap** in `keymap.ts` using explicit note-token pairs from `C2` to `C7`.

### Mapping Model

- Source of truth: `NOTE_TO_KEY` constant list
- MIDI note derivation: `noteNameToMidi(note: string)` from pitch class + octave
- Runtime outputs:
  - `midiToKey: Record<number, string>`
  - `keyToMidi: Record<string, number>`
  - `minMidi` / `maxMidi` computed from map

### Token Strategy

- Natural notes and common symbols/letters for white keys
- Shifted symbols/uppercase letters for accidentals
- Single-token-per-note representation to keep notation compact

### Extensibility

`ConversionOptions.keymap` accepts custom maps, but default behavior remains stable and versioned.

## Consequences

### Positive
- Stable, deterministic notation across runs
- Fast lookup in both directions (MIDI→key and key→MIDI)
- Clear VP range boundaries available in metadata
- Easy to unit test and reason about

### Negative
- Static table must be manually maintained if token standards evolve
- Range-limited output requires transposition/filtering for out-of-range files
- Symbol-heavy accidental tokens can be less beginner-friendly in raw text

### Neutral
- Custom keymaps are supported without changing core quantization/serialization logic
- Default map favors compatibility over personalization

## Alternatives Considered

### 1. Algorithmic Mapping Generation
- **Rejected**: Harder to guarantee compatibility with VP community notation
- Explicit table is clearer and safer

### 2. Smaller 36-key-only Base Map
- **Rejected**: Too restrictive for advanced songs
- Current default supports broader range while still enabling compact output mode

### 3. Runtime Remote Keymap Fetch
- **Rejected**: Adds network/state complexity to a local conversion library
- Increases failure modes and reproducibility issues

## Implementation Notes

Primary implementation:
- `src/keymap.ts`

Primary consumers:
- `src/transform.ts` (range adaptation)
- `src/quantize.ts` (note filtering + VP token assignment)
- `src/convert.ts` (range metadata in output)

## Related Decisions

- [ADR 0003](0003-conversion-pipeline-architecture.md): Pipeline placement of keymap-dependent stages
- [ADR 0005](0005-quantization-and-timeline-algorithm.md): Quantization behavior on mapped notes
