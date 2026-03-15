# MIDI-to-VP Workspace Library Plan

## Goal
Create a reusable Yarn workspace package `@zen/midi-to-vp` that converts MIDI files into structured JSON plus Virtual Piano notation (`extended` and `zen` modes), with a programmatic API and CLI.

## Key Decisions
- Package location: `midi-to-vp/` as a root workspace package (not submodule)
- Parser: `@tonejs/midi`
- Default notation mode: `extended`
- Build target: dual ESM + CJS + declarations using TypeScript only
- v1 surface: programmatic API + CLI
- Output: rich `ConversionResult` including normalized events, quantized timeline, transpose info, warnings, and notation outputs

## Implementation Outline
1. Wire workspace and scaffold package configs (`package.json`, tsconfig variants, vitest config)
2. Write failing tests first for parsing, filtering, transpose, quantization, serialization, chord simplification, integration, and CLI output
3. Implement parse/normalize/filter-transform/quantize/serialize pipeline
4. Implement CLI argument parsing and file output support
5. Run package tests, build, and turbo filtered checks

## Acceptance
- `yarn workspace @zen/midi-to-vp test` passes
- `yarn workspace @zen/midi-to-vp build` emits `dist/esm`, `dist/cjs`, and `dist/types`
- `yarn turbo run test --filter=@zen/midi-to-vp` and type-check pass for the package
