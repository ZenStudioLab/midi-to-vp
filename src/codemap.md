## Responsibility

- Core conversion pipeline from MIDI bytes to Virtual Piano notation and rich metadata/scoring

## Design

- Stages: `parse.ts` (@tonejs/midi) → `normalize.ts` (grid snapping) → `transform.ts` (transpose/fold into VP range, dedupe) → `quantize.ts` (slots, chord simplification) → `serialize.ts` (extended/standard)
- Types defined in `types.ts` (events, timeline, options, results, quality signals)
- Quality: `grid-inference.ts` builds beat grid; `quality-scorer.ts` normalizes signals, applies artifact caps, computes reasons and score
- Keymap: `keymap.ts` maps MIDI to VP keys and bounds
- CLI wrapper in `src/cli.ts`; Node helpers in `src/node.ts`; browser entry `src/browser.ts`

## Flow

- `convert.ts` composes stages; options include `notationMode`, `quantization.slotsPerQuarter`, `includePercussion`, `dedupe`, `simplifyChords`, `maxChordSize`, `transposeSemitones`, `format`
- Outputs: timeline, per‑mode notation, transpose amount, tempo segments, and metadata (quality signals/range, slots, tracks)

## Integration

- API surface exported from `src/index.ts` for Node and browser bundles; used by test‑server UI and automated tests
