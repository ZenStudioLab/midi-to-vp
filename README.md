# @zen/midi-to-vp

**MIDI to Virtual Piano Notation Converter** - A high-performance Node.js library and CLI for converting MIDI files into Virtual Piano notation format.

## Features

- 🎹 **Dual Notation Modes**: Extended (full range) and Zen (compact) notation formats
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

# Zen mode with custom quantization
midi-to-vp input.mid --mode zen --slots-per-quarter 8
```

### Programmatic API

```typescript
import { convertMidiFileToVp, convertMidiToVp } from '@zen/midi-to-vp';

// Convert from file path
const result = await convertMidiFileToVp('song.mid', {
  notationMode: 'extended',
  quantization: { slotsPerQuarter: 4 },
  simplifyChords: true,
  maxChordSize: 4
});

console.log(result.notation.extended);
console.log(`Transposed: ${result.transposeSemitones} semitones`);
console.log(`Total slots: ${result.metadata.totalSlots}`);

// Convert from buffer
const buffer = await readFile('song.mid');
const result2 = convertMidiToVp(buffer, { notationMode: 'zen' });
```

## API Reference

### `convertMidiFileToVp(inputPath, options?)`

Converts a MIDI file to Virtual Piano notation.

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

### ConversionOptions

```typescript
{
  notationMode?: 'extended' | 'zen';        // Default: 'extended'
  quantization?: {
    slotsPerQuarter?: number;               // Default: 4
  };
  includePercussion?: boolean;              // Default: false
  dedupe?: boolean;                         // Default: true
  simplifyChords?: boolean;                 // Default: true
  maxChordSize?: number;                    // Default: 4
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
  timeline: TimelineSlot[];                 // Grouped by time slots
  transposeSemitones: number;               // Auto-transpose offset
  warnings: string[];                       // Conversion warnings
  notation: {
    extended: string;                       // Extended notation
    zen: string;                            // Zen notation
    selected: string;                       // Based on mode
    mode: 'extended' | 'zen';
  };
  tempoSegments: TempoSegment[];            // Tempo map
  metadata: {
    tempoBpm: number;
    slotsPerQuarter: number;
    stepSec: number;
    totalSlots: number;
    sourceTrackCount: number;
    vpRange: { minMidi: number; maxMidi: number };
  };
}
```

## CLI Reference

```bash
midi-to-vp <input.mid> [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--out <path>` | JSON output path | `<input>.vp.json` |
| `--notation-out <path>` | Notation text output path | - |
| `--mode <extended\|zen>` | Notation mode | `extended` |
| `--slots-per-quarter <n>` | Quantization resolution | `4` |
| `--max-chord-size <n>` | Max notes per chord | `4` |
| `--include-percussion` | Keep MIDI channel 10 | `false` |
| `--no-dedupe` | Disable duplicate removal | - |
| `--no-chord-simplify` | Disable chord simplification | - |
| `--json-indent <n>` | JSON indentation width | `2` |
| `--help` | Show help message | - |

### Examples

```bash
# High-resolution quantization (16th notes)
midi-to-vp song.mid --slots-per-quarter 16

# Keep all chord notes
midi-to-vp complex.mid --no-chord-simplify

# Include percussion track
midi-to-vp drums.mid --include-percussion

# Zen mode with formatted output
midi-to-vp tune.mid --mode zen --notation-out zen-sheet.txt
```

## Notation Formats

### Extended Notation
Full note names with octave numbers:
```
C4 D4 E4 | F4 G4 A4 | [C4 E4 G4]
```

### Zen Notation
Compact alphanumeric representation (36-key range):
```
a s d | f g h | [asf]
```

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
- View notation output (Extended & Zen)
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
