# @zen/midi-to-vp

**MIDI to Virtual Piano Notation Converter** - A high-performance Node.js library and CLI for converting MIDI files into Virtual Piano notation format.

## Features

- 🎹 **Two Notation Modes**: Standard (compact) and Extended (sustain/rest-aware)
- 🧭 **Player Difficulty Profiles**: Built-in presets for `Novice`, `Apprentice`, `Adept`, `Master`, `Guru`
- 📊 **Sheet Analysis**: Analyze notation and get difficulty recommendations
- 🎼 **Smart Conversion**: Automatic transpose, quantization, and chord simplification
- 📦 **Dual Format**: ESM + CJS with full TypeScript definitions
- ⚡ **Performance**: Built with `@tonejs/midi` for reliable MIDI parsing
- 🔧 **Flexible API**: Programmatic API and CLI interface
- 🎯 **Configurable**: Fine-tune quantization, filtering, and formatting options

## Installation

```bash
# Install in your project
yarn add @zen/midi-to-vp

# Or with npm
npm install @zen/midi-to-vp
```

## Quick Start

### CLI Usage

```bash
# Basic conversion (outputs .vp.json)
midi-to-vp input.mid

# Custom output path
midi-to-vp input.mid --out result.json

# Export notation to text file
midi-to-vp input.mid --notation-out sheet.txt

# Standard mode with custom quantization
midi-to-vp input.mid --mode standard --slots-per-quarter 8
```

### Programmatic API

```typescript
import {
  convertMidiToVp,
  tryConvertMidiToVp,
  convertMidiWithLevel,
  getDifficultyPreset,
  analyzeVpNotation
} from '@zen/midi-to-vp';
import { convertMidiFileToVp } from '@zen/midi-to-vp/node';
import { convertMidiToVp as convertMidiToVpBrowser } from '@zen/midi-to-vp/browser';

// Convert from file path
const result = await convertMidiFileToVp('song.mid', {
  notationMode: 'extended',
  quantization: { slotsPerQuarter: 4 },
  simplifyChords: true,
  maxChordSize: 3
});

console.log(result.notation.extended);
console.log(`Transposed: ${result.transposeSemitones} semitones`);
console.log(`Total slots: ${result.metadata.totalSlots}`);

// Convert from buffer
const buffer = await readFile('song.mid');
const result2 = convertMidiToVp(buffer, { notationMode: 'standard' });

// Browser-safe import (no Node.js fs dependency)
const browserResult = convertMidiToVpBrowser(buffer, { notationMode: 'standard' });

// Classified conversion outcome without throwing on invalid MIDI
const safeResult = tryConvertMidiToVp(buffer, { notationMode: 'extended' });
if (!safeResult.ok) {
  console.error(safeResult.reason, safeResult.details);
}

// Convert with built-in difficulty preset
const masterResult = convertMidiWithLevel(buffer, { level: 'Master' });
const novicePreset = getDifficultyPreset('Novice');
const analysis = analyzeVpNotation(masterResult.notation.selected);
```

## API Reference

### `convertMidiFileToVp(inputPath, options?)`

Converts a MIDI file to Virtual Piano notation.

Import from `@zen/midi-to-vp/node`.

**Parameters:**
- `inputPath` (string): Path to MIDI file
- `options` (ConversionOptions): Conversion configuration

**Returns:** `Promise<ConversionResult>`

### `convertMidiToVp(input, options?)`

Converts MIDI binary data to Virtual Piano notation.

**Parameters:**
- `input` (Uint8Array | Buffer): MIDI file data
- `options` (ConversionOptions): Conversion configuration

**Returns:** `ConversionResult`

### `tryConvertMidiToVp(input, options?)`

Converts MIDI binary data and returns a structured success/failure outcome instead of throwing for classified converter failures.

**Parameters:**
- `input` (`Uint8Array`): MIDI file data
- `options` (`ConversionOptions`): Conversion configuration

**Returns:** `ConversionOutcome`

### `getDifficultyPreset(level)`

Returns built-in conversion options for player-friendly profiles.

**Parameters:**
- `level` (`'Novice' | 'Apprentice' | 'Adept' | 'Master' | 'Guru'`)

**Returns:** `ConversionOptions`

### `convertMidiWithLevel(input, options)`

Converts MIDI data using a built-in difficulty profile, with optional overrides.

**Parameters:**
- `input` (`Uint8Array | Buffer`): MIDI file data
- `options.level` (`'Novice' | 'Apprentice' | 'Adept' | 'Master' | 'Guru'`)
- `options` (`Partial<ConversionOptions>`): Optional values to override preset defaults

**Returns:** `ConversionResult`

### `analyzeVpNotation(notation)`

Analyzes a notation string and returns difficulty metrics + recommended profile.

**Returns:** `AnalysisResult`

### ConversionOptions

```typescript
{
  notationMode?: 'extended' | 'standard'; // Default: 'extended'
  quantization?: {
    slotsPerQuarter?: number;               // Default: 4
  };
  includePercussion?: boolean;              // Default: false
  dedupe?: boolean;                         // Default: true
  simplifyChords?: boolean;                 // Default: true
  maxChordSize?: number;                    // Default: 3
  format?: {
    groupSlots?: number;
    lineBreakEveryGroups?: number;
  } | null;
  keymap?: VpKeymap;                        // Custom key mapping
}
```

### ConversionResult

```typescript
{
  normalizedNotes: NoteEvent[];             // Raw MIDI notes
  transformedNotes: NoteEvent[];            // After transpose/filter
  quantizedNotes: QuantizedNoteEvent[];     // Quantized to timeline
  timeline: TimelineSlot[];                 // Grouped by time slots with explicit onset/sustain/rest semantics
  transposeSemitones: number;               // Auto-transpose offset
  warnings: string[];                       // Conversion warnings
  notation: {
    extended: string;                       // Extended notation
    standard: string;                       // Standard notation
    selected: string;                       // Based on mode
    mode: 'extended' | 'standard';
  };
  tempoSegments: TempoSegment[];            // Tempo map
  metadata: {
    tempoBpm: number;
    slotsPerQuarter: number;
    stepSec: number;
    totalSlots: number;
    sourceTrackCount: number;
    qualitySignals: {
      totalRawNotes: number;
      inRangeNotes: number;
      outputTotalNotes: number;
      outputInRangeNotes: number;
      averageChordSize: number;
      peakChordSize: number;
      avgNotesPerSecond: number;
      timingJitter: number;
      p95ChordSize: number;
      hardChordRate: number;
      p95NotesPerSecond: number;
      maxNotesPerSecond: number;
      gridConfidence: number;
    };
    vpRange: { minMidi: number; maxMidi: number };
  };
}
```

### TimelineSlot

```typescript
{
  slot: number;
  slotType: 'onset' | 'sustain' | 'rest';
  activeNoteCount: number;
  notes: QuantizedNoteEvent[];
}
```

`notes` is populated only for onset slots. Sustain and rest slots stay explicit through `slotType` plus `activeNoteCount`.

## CLI Reference

```bash
midi-to-vp <input.mid> [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--out <path>` | JSON output path | `<input>.vp.json` |
| `--notation-out <path>` | Notation text output path | - |
| `--mode <extended\|standard>` | Notation mode | `extended` |
| `--slots-per-quarter <n>` | Quantization resolution | `4` |
| `--max-chord-size <n>` | Max notes per chord | `3` |
| `--include-percussion` | Keep MIDI channel 10 | `false` |
| `--no-dedupe` | Disable duplicate removal | - |
| `--no-chord-simplify` | Disable heuristic chord reduction; still respects `--max-chord-size` | - |
| `--json-indent <n>` | JSON indentation width | `2` |
| `--help` | Show help message | - |

### Examples

```bash
# High-resolution quantization (16th notes)
midi-to-vp song.mid --slots-per-quarter 16

# Preserve dense chords up to 6 notes
midi-to-vp complex.mid --no-chord-simplify --max-chord-size 6

# Include percussion track
midi-to-vp drums.mid --include-percussion

# Standard mode with formatted output
midi-to-vp tune.mid --mode standard --notation-out standard-sheet.txt
```

## Notation Formats

### Extended Notation
VP key tokens with explicit sustain and rest boundaries:
```
C---D
C - - D
[CEG]-- -
```

Adjacent dashes continue the preceding note or chord sustain. Space-separated dash groups indicate true rest or pause slots. This supersedes older wording that described all empty slots as `-`.

### Standard Notation
Compact VP key tokens without dash placeholders:
```
[tu]yd
```

## Player Difficulty Profiles

`@zen/midi-to-vp` exposes `notationMode: 'extended' | 'standard'` in code.

Built-in profile presets:

| Level | API `notationMode` | `slotsPerQuarter` | `simplifyChords` | `maxChordSize` | `dedupe` |
|------|---------------------|-------------------|------------------|----------------|----------|
| `Novice` | `standard` | `2` | `true` | `2` | `true` |
| `Apprentice` | `standard` | `4` | `true` | `3` | `true` |
| `Adept` | `standard` | `4` | `true` | `4` | `true` |
| `Master` | `extended` | `8` | `false` | `5` | `true` |
| `Guru` | `extended` | `8` | `false` | `6` | `false` |

Use `getDifficultyPreset(level)` to fetch these values, or `convertMidiWithLevel(input, { level, ...overrides })` to convert directly with a profile.

## Development

```bash
# Install dependencies
yarn install

# Run tests
yarn test

# Watch mode
yarn test:watch

# Coverage report
yarn test:coverage

# Type checking
yarn type-check

# Build library
yarn build

# Clean build artifacts
yarn clean
```

## Test Server

A web-based test interface is available in `test-server/` for interactive testing:

```bash
# First, build the library
yarn build

# Then start the test server
cd test-server
yarn install
yarn dev
```

Visit http://localhost:3100 to:
- Upload MIDI files
- Configure conversion options in real-time
- View notation output (Extended & Standard)
- Download results as text or JSON

See [`test-server/README.md`](./test-server/README.md) for details.

## Project Structure

```
midi-to-vp/
├── src/
│   ├── index.ts         # Public API exports
│   ├── cli.ts           # CLI implementation
│   ├── convert.ts       # Main conversion pipeline
│   ├── parse.ts         # MIDI parsing with @tonejs/midi
│   ├── normalize.ts     # Event normalization
│   ├── transform.ts     # Transpose & filter
│   ├── quantize.ts      # Time quantization
│   ├── serialize.ts     # Notation formatting
│   ├── keymap.ts        # VP key mapping
│   └── types.ts         # TypeScript definitions
├── tests/
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── docs/
│   ├── architecture.md  # Architecture documentation
│   └── lessons/         # Lesson decision records
└── dist/
    ├── esm/            # ES modules
    ├── cjs/            # CommonJS modules
    └── types/          # Type definitions
```

## Requirements

- **Node.js**: >= 18
- **Package Manager**: Yarn 1.x or npm

## License

MIT

## Contributing

This is part of the Zen Virtual Piano monorepo. See the main repository for contribution guidelines.

## Related

- [Zen Virtual Piano](https://github.com/zenStudios/zen-virtual-piano) - Main project
- [@tonejs/midi](https://github.com/Tonejs/Midi) - MIDI parsing library
- [Virtual Piano](https://virtualpiano.net/) - Online piano platform
