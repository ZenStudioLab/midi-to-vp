## Responsibility

- Standalone library and CLI for converting MIDI files to Virtual Piano notation (standard/extended)

## Design

- TypeScript source with dual ESM/CJS outputs and `.d.ts` types; tests via Vitest
- Public API re‑exports from `src/index.ts` (conversion, analysis/scoring, serialization, keymap)
- CLI (`src/cli.ts`) wraps file I/O, argument parsing, and JSON/notation output paths
- **Pipeline**: Parse → Normalize → Transform → Quantize → Serialize

## Flow

- CLI: parse options → run `convertMidiFileToVp` → write JSON result and optional notation text; exits with code 0/1
- Library: `convertMidiToVp` pipeline (parse → normalize → transform → quantize → serialize) with metadata and quality signals

## Integration

- Used directly by apps and by the `test-server` web UI via `@zen/midi-to-vp/browser`
