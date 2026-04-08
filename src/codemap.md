## Responsibility

- Core conversion pipeline: MIDI bytes → Virtual Piano notation (extended/standard) with rich metadata and quality signals

## Design

- **Pipeline stages**: `parse.ts` (@tonejs/midi) → `normalize.ts` (grid snapping) → `transform.ts` (transpose/fold into VP range, dedupe) → `quantize.ts` (slot timeline, chord simplification) → `serialize.ts` (extended/standard notation)
- **Types**: all domain types in `types.ts` (NoteEvent, QuantizedNoteEvent, TimelineSlot, ConversionOptions, ConversionResult, quality signals)
- **Quality**: `grid-inference.ts` builds beat grid from tempo map or IOI histogram; `quality-scorer.ts` normalizes signals, applies artifact caps, computes reasons and overall score
- **Keymap**: `keymap.ts` maps MIDI note numbers to VP keyboard characters and vice versa
- **Difficulty presets**: `presets.ts` maps Novice → Guru levels to conversion option sets
- **Analysis**: `analyze.ts` parses notation string and computes difficulty metrics
- **CLI**: `src/cli.ts` argument parsing, file I/O, JSON/notation output
- **Node helper**: `src/node.ts` wraps file read → `convertMidiToVp`
- **Browser entry**: `src/browser.ts` re-exports for browser bundle consumers

## Flow

- `convert.ts` composes all stages; `runConversion()` orchestrates the full pipeline
- Options: `notationMode`, `quantization.slotsPerQuarter`, `includePercussion`, `dedupe`, `simplifyChords`, `maxChordSize`, `transposeSemitones`, `format`, `keymap`
- Outputs: timeline, extended/standard/selected notation strings, transpose semitones, tempo segments, metadata (quality signals, VP range, slot count, track count)

## Integration

- API surface exported from `src/index.ts` (Node ESM/CJS) and `src/browser.ts` (browser)
- Used by `test-server` web UI and automated tests
