# ADR 0007: CLI Architecture and Output Contract

**Status**: Accepted  
**Date**: 2026-03-14  
**Deciders**: Development team

## Context

`@zen/midi-to-vp` ships both library and CLI interfaces.
The CLI must provide:
- Predictable defaults
- Explicit option parsing and validation
- Clear output artifacts for automation workflows
- Stable non-zero exit signaling on failure

## Decision

Implement a **single-file CLI orchestration** (`src/cli.ts`) with a strict parse → validate → convert → write flow.

### Parsing and Defaults

- One-pass argument parser over `argv`
- Defaults:
  - `mode: 'extended'`
  - `slotsPerQuarter: 4`
  - `maxChordSize: 3`
  - `includePercussion: false`
  - `dedupe: true`
  - `simplifyChords: true`
  - `jsonIndent: 2`
- Unsupported flags or invalid mode values throw early parse errors

### Validation

- Require positional MIDI input path unless `--help`
- Numeric fields (`slotsPerQuarter`, `maxChordSize`, `jsonIndent`) must be finite and within valid bounds

### Conversion and File Output

- Node-only conversion path via `convertMidiFileToVp` (`src/node.ts`)
- Writes JSON result to:
  - `--out <path>` if provided
  - Otherwise `<input>.vp.json`
- Optional notation text file via `--notation-out <path>`
- Creates output directories recursively as needed

### Process Contract

- `runCli()` returns exit code instead of throwing to caller:
  - `0` on success or `--help`
  - `1` on error (prints `[midi-to-vp] <message>` to stderr)
- Direct script execution (`cli.(js|ts)`) calls `process.exit(exitCode)`

## Consequences

### Positive
- Easy to test deterministically (function-level `runCli`)
- Clear separation between parsing/validation and conversion logic
- CI-friendly artifacts (JSON + optional notation text)
- Stable automation behavior via explicit exit codes

### Negative
- Manual argument parsing requires ongoing maintenance for new flags
- Help output and parser logic must be kept in sync by convention
- Current CLI does not yet encode profile presets (`easy` → `hardcore`) directly

### Neutral
- CLI remains intentionally thin around core conversion API
- Structured JSON output mirrors programmatic `ConversionResult`

## Alternatives Considered

### 1. Use Commander/Yargs
- **Rejected**: Extra dependency for relatively small option surface
- Built-in parser is sufficient and transparent

### 2. Throw Errors and Let Node Crash
- **Rejected**: Less controlled output/exit behavior for scripts and CI
- Explicit return codes improve integration reliability

### 3. Split CLI into Many Modules
- **Rejected (for now)**: Added indirection without current complexity pressure
- Single module remains readable and testable

## Implementation Notes

Primary implementation:
- `src/cli.ts`
- `src/node.ts` (file-reading bridge for conversion)

Integration coverage:
- `tests/integration-cli.test.ts`

## Related Decisions

- [ADR 0002](0002-browser-node-split.md): Node-only boundaries for file I/O
- [ADR 0003](0003-conversion-pipeline-architecture.md): Conversion internals invoked by CLI
