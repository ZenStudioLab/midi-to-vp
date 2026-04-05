# @zen/midi-to-vp Architecture

**Version**: 0.1.0  
**Last Updated**: 2026-04-05  
**Status**: Production-ready

## Overview

`@zen/midi-to-vp` is a standalone Node.js library and CLI that converts MIDI files into Virtual Piano notation formats.

**Core Pipeline**: Parse → Normalize → Transform → Quantize → Serialize

For detailed architectural decisions, see [`docs/adr/`](./adr/):
- [ADR 0001: Dual ESM/CJS Build System](./adr/0001-dual-output-build-system.md)
- [ADR 0002: Browser-Safe and Node.js Code Separation](./adr/0002-browser-node-split.md)
- [ADR 0003: Five-Stage Conversion Pipeline](./adr/0003-conversion-pipeline-architecture.md)
- [ADR 0004: Choice of @tonejs/midi Parser](./adr/0004-tonejs-midi-parser.md)
- [ADR 0005: Quantization and Timeline Algorithm](./adr/0005-quantization-and-timeline-algorithm.md)
- [ADR 0006: Default Keymap Design](./adr/0006-default-keymap-design.md)
- [ADR 0007: CLI Architecture and Output Contract](./adr/0007-cli-architecture.md)

### Design Principles

1. **Standalone**: No dependencies on other Zen Virtual Piano workspaces
2. **Dual Output**: ESM + CJS with full TypeScript support
3. **Performance**: O(n log n) conversion, <200ms for typical files
4. **Type Safety**: Full TypeScript coverage with exported types
5. **Testable**: Clear separation of concerns, 80%+ coverage target

## Pipeline Architecture

See [ADR 0003: Five-Stage Conversion Pipeline](./adr/0003-conversion-pipeline-architecture.md)

```
MIDI Binary → Parse → Normalize → Transform → Quantize → Serialize → Notation
              ↓        ↓           ↓           ↓           ↓
            Tempo    NoteEvent[] Transpose  Timeline   Extended/Standard
                                  Filter    Simplify      Text
```

## Module Responsibilities

| Module | File | Responsibility |
|--------|------|----------------|
| **Parse** | `parse.ts` | Extract tempo, tracks, notes from MIDI binary using [@tonejs/midi](./adr/0004-tonejs-midi-parser.md) |
| **Normalize** | `normalize.ts` | Convert to `NoteEvent[]` with absolute time (seconds) |
| **Transform** | `transform.ts` | Auto-transpose, filter percussion, dedupe with [default keymap constraints](./adr/0006-default-keymap-design.md) |
| **Quantize** | `quantize.ts` | Snap to grid, build `TimelineSlot[]`, simplify chords per [ADR 0005](./adr/0005-quantization-and-timeline-algorithm.md) |
| **Serialize** | `serialize.ts` | Format to Extended or Standard VP key notation |
| **CLI** | `cli.ts` | Parse options, validate inputs, and write outputs via [ADR 0007](./adr/0007-cli-architecture.md) |

**Orchestration**: `convert.ts` chains modules, returns `ConversionResult` with intermediate outputs for debugging.

## Data Types

**Pipeline Progression**:
```
Uint8Array → ParsedMidiData → NoteEvent[] → TransformResult → 
QuantizedNoteEvent[] → TimelineSlot[] → string (notation)
```

**Key Types** (see `types.ts`):
- `NoteEvent`: MIDI note with absolute time (seconds)
- `QuantizedNoteEvent`: Extends `NoteEvent` with `startSlot`, `vpKey`
- `TimelineSlotType`: `onset | sustain | rest`
- `TimelineSlot`: `{ slot: number, slotType: TimelineSlotType, activeNoteCount: number, notes: QuantizedNoteEvent[] }`
- `ConversionResult`: Full output with intermediate arrays, notation, metadata, warnings

`TimelineSlot` semantics:
- `onset`: one or more new notes begin in this slot; `notes` is non-empty
- `sustain`: no new onset, but one or more prior notes remain active; `notes` is empty and `activeNoteCount > 0`
- `rest`: no active notes; `notes` is empty and `activeNoteCount === 0`

**Notation Modes**:
- **Standard**: VP key output without dash placeholders
- **Extended**: VP key output where adjacent `-` characters mean sustain continuation and space-separated `-` groups mean rest or pause

This replaces older shorthand such as "all empty slots are `-`". Extended-notation parsers must preserve whitespace boundaries.

**Player Difficulty Profiles** (built-in API contract):
- **Novice**: standard notation, lowest density
- **Apprentice**: standard notation, balanced beginner profile
- **Adept**: standard notation, moderate complexity
- **Master**: extended notation, higher rhythmic resolution
- **Guru**: extended notation, maximum fidelity

Profiles are exposed via `getDifficultyPreset(level)` and `convertMidiWithLevel(input, { level, ...overrides })`.

**Analysis Service**:
- `analyzeVpNotation(notation)` computes `noteDensity`, `chordComplexity`, `rhythmicComplexity`, `rangeScore`, `overallScore`, `recommendedLevel`, and `confidence`.

## Performance

| Complexity | Typical File | Notes |
|------------|--------------|-------|
| O(n log n) | < 200ms for 10K notes | Dominated by quantize sorting |

Memory: ~5x input size for intermediates, ~10x for full JSON result.

## Testing

- **Unit**: `tests/unit/*.test.ts` - Pure functions per module
- **Integration**: `tests/integration/*.test.ts` - Full conversion flows
- **CLI**: `tests/cli.test.ts` - Argument parsing, file I/O
- **Target**: 80% branch coverage minimum

## Dependencies

**Production**: `@tonejs/midi` ^2.0.28 (MIDI parsing) - see [ADR 0004](./adr/0004-tonejs-midi-parser.md)  
**Dev**: TypeScript, Vitest, @types/node

## References

- **API & Usage**: `README.md`
- **Test Server**: `test-server/README.md` (web UI for manual testing)
- **Decisions**: `docs/adr/` (architectural decision records)
- **AI Collaboration**: `AGENTS.md`
