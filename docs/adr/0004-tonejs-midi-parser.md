# ADR 0004: Choice of @tonejs/midi for MIDI Parsing

**Status**: Accepted  
**Date**: 2026-03-14  
**Deciders**: Development team

## Context

MIDI file parsing requires handling:
- Binary MIDI format (Standard MIDI File - SMF)
- Track structure and events
- Tempo changes and time signatures
- Tick-to-second conversion
- Edge cases in MIDI specification

Need a reliable, well-maintained library with TypeScript support.

## Decision

Use **@tonejs/midi** version 2.0+ as the MIDI parser.

**Installation**:
```json
{
  "dependencies": {
    "@tonejs/midi": "^2.0.28"
  }
}
```

**Usage**:
```typescript
import { Midi } from '@tonejs/midi';

const midi = new Midi(uint8Array);
midi.header.ppq;           // Pulses per quarter note
midi.header.tempos;        // Tempo events
midi.tracks;               // Note events by track
```

## Consequences

### Positive
- **Mature library**: 6+ years, actively maintained
- **TypeScript native**: Full type definitions included
- **Comprehensive**: Handles tempo, tracks, all MIDI events
- **Battle-tested**: Used by Tone.js ecosystem
- **Good API**: Clean, well-documented interface
- **Small footprint**: ~50KB minified
- **No dependencies**: Self-contained

### Negative
- **Adds dependency**: Only production dependency in package
- **Opinionated structure**: Must adapt to their data model
- **No streaming**: Loads entire file into memory
- **Limited documentation**: Some edge cases undocumented

### Neutral
- Performance: Fast enough for typical MIDI files (< 1MB)
- File size acceptable for library of this scope

## Alternatives Considered

### 1. midi-parser-js
- **Rejected**: No TypeScript support
- Less maintained (last update 2019)
- More low-level API

### 2. jsmidgen
- **Rejected**: Focused on MIDI generation, not parsing
- Would need separate parser
- API not suitable

### 3. Custom Parser
```typescript
function parseMidi(buffer: Uint8Array) {
  // Manual binary parsing
}
```
- **Rejected**: Reinventing the wheel
- MIDI spec has many edge cases
- Would take weeks to implement correctly
- High maintenance burden

### 4. midifile
- **Rejected**: Node.js only (uses Buffer)
- No browser compatibility
- Less active maintenance

## Implementation Notes

**Wrapper Function**:
```typescript
export function parseMidiBuffer(input: Uint8Array | Buffer) {
  const midi = new Midi(input);
  
  // Extract tempo segments
  const tempoSegments = midi.header.tempos.map(t => ({
    ticks: t.ticks,
    bpm: t.bpm,
    timeSec: t.time
  }));
  
  return {
    midi,
    parsed: {
      tempoSegments,
      tempoBpm: tempoSegments[0]?.bpm ?? 120,
      trackCount: midi.tracks.length
    }
  };
}
```

**Tempo Handling**:
- Uses first tempo event if present
- Defaults to 120 BPM if no tempo events
- Future: Could support tempo changes mid-song

**Time Conversion**:
- `@tonejs/midi` provides `note.time` in seconds
- No manual PPQ calculation needed
- Library handles it correctly

## Risks and Mitigations

**Risk**: Library becomes unmaintained
- **Mitigation**: Part of active Tone.js ecosystem
- Switching cost is low (only used in `parse.ts`)

**Risk**: Breaking changes in future versions
- **Mitigation**: Pin to major version (`^2.0.28`)
- Thorough test coverage catches regressions

## Related Decisions

- [ADR 0003](0003-conversion-pipeline-architecture.md): Parser is Stage 1 of pipeline
