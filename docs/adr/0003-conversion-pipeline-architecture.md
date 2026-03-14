# ADR 0003: Five-Stage Conversion Pipeline

**Status**: Accepted  
**Date**: 2026-03-14  
**Deciders**: Development team

## Context

MIDI to Virtual Piano notation conversion requires multiple transformations:
- Parse binary MIDI format
- Normalize timing to absolute seconds
- Adapt notes to VP key range (transpose if needed)
- Quantize to playable time grid
- Format as human-readable notation

Need clear separation of concerns and testable components.

## Decision

Implement a **five-stage pipeline**:

```
Parse → Normalize → Transform → Quantize → Serialize
```

### Stage 1: Parse (`parse.ts`)
- **Input**: Binary MIDI file (Uint8Array)
- **Output**: `ParsedMidiData { tempoSegments, tempoBpm, trackCount }`
- **Responsibility**: Extract structured data from MIDI using `@tonejs/midi`

### Stage 2: Normalize (`normalize.ts`)
- **Input**: `@tonejs/midi` Midi object
- **Output**: `NoteEvent[]` (flat array with absolute timing)
- **Responsibility**: Convert tick-based timing to seconds, flatten tracks

### Stage 3: Transform (`transform.ts`)
- **Input**: `NoteEvent[]`, `VpKeymap`, options
- **Output**: `TransformResult { notes, transposeSemitones, warnings }`
- **Responsibility**: Auto-transpose, filter percussion, deduplicate

### Stage 4: Quantize (`quantize.ts`)
- **Input**: `NoteEvent[]`, step size, keymap
- **Output**: `TimelineSlot[]` (quantized timeline)
- **Responsibility**: Snap to grid, build timeline, simplify chords

### Stage 5: Serialize (`serialize.ts`)
- **Input**: `TimelineSlot[]`, notation mode
- **Output**: `string` (Extended or Zen notation)
- **Responsibility**: Format timeline as text

**Orchestration** (`convert.ts`):
```typescript
export function convertMidiToVp(input, options) {
  const { midi, parsed } = parseMidiBuffer(input);         // 1
  const normalized = normalizeMidiNotes(midi);             // 2
  const transformed = transformNotesToVpRange(...);        // 3
  const quantized = quantizeNotes(...);                    // 4
  const timeline = buildTimeline(quantized);               // 4b
  const notation = serializeVpTimeline(timeline);          // 5
  return { normalized, transformed, quantized, timeline, notation, ... };
}
```

## Consequences

### Positive
- **Testable**: Each stage can be tested independently
- **Debuggable**: Intermediate outputs included in result
- **Maintainable**: Clear responsibilities, single-purpose modules
- **Extensible**: Easy to add stages or modify existing ones
- **Traceable**: Can inspect data at each pipeline step

### Negative
- **Memory overhead**: Stores intermediate arrays (normalized, transformed, quantized)
- **More files**: 5 module files vs monolithic approach
- **Abstraction cost**: Need to understand pipeline flow

### Neutral
- Performance: O(n log n) overall (dominated by quantize sorting)
- Typical conversion: < 200ms for 10,000 notes

## Alternatives Considered

### 1. Monolithic Function
```typescript
function convert(midiBuffer) {
  // Parse and convert in one pass
}
```
- **Rejected**: Hard to test, hard to debug
- All logic entangled
- Can't inspect intermediate states

### 2. Class-Based Pipeline
```typescript
class MidiConverter {
  parse() { ... }
  normalize() { ... }
  transform() { ... }
}
```
- **Rejected**: Unnecessary OOP complexity
- State management overhead
- Functional composition is simpler

### 3. Streaming Pipeline
```typescript
midi.pipe(parse).pipe(normalize).pipe(...)
```
- **Rejected**: Over-engineered for file-based conversion
- Added complexity for minimal benefit
- MIDI files are small enough for in-memory processing

## Implementation Notes

**Data Flow**:
```typescript
Uint8Array → ParsedMidiData → NoteEvent[] → NoteEvent[] → 
QuantizedNoteEvent[] → TimelineSlot[] → string
```

**Type Hierarchy**:
- `NoteEvent`: Raw MIDI note with absolute time
- `QuantizedNoteEvent`: Extends `NoteEvent` with `startSlot`, `durSlots`, `vpKey`
- `TimelineSlot`: `{ slot: number, notes: QuantizedNoteEvent[] }`

**Why Include Intermediates in Result**:
- Debugging: Inspect where conversion went wrong
- Analysis: Examine transpose offset, warnings
- Future features: Could export intermediate formats

## Related Decisions

- [ADR 0004](0004-tonejs-midi-parser.md): Choice of MIDI parser for Stage 1
