# AGENTS.md

## First

Load `~/.codex/AGENTS.md` file and follow the global instructions.

## Project Overview

**@zen/midi-to-vp** is a lightweight, production-ready Node.js library and CLI for converting MIDI files into Virtual Piano notation formats. It's part of the Zen Virtual Piano monorepo but designed as a standalone, reusable package.

### Key Technologies
- **Runtime**: Node.js >= 18
- **Language**: TypeScript 5.9+
- **MIDI Parser**: @tonejs/midi 2.0
- **Build**: TypeScript compiler (dual ESM + CJS output)
- **Testing**: Vitest 3.0
- **Package Manager**: Yarn 1 (Classic)

---

## Agent Collaboration Rules

### Execution Continuity
- Complete requested tasks end-to-end without asking for "Continue Response" unless explicitly paused by the user.

### Project Discovery Order
1. Start with `README.md` for API reference and usage examples
2. Check `docs/architecture.md` for design decisions and pipeline overview
3. Review `docs/adr/` for architectural decision records (if present)
4. Check `docs/lessons/` for past mistakes and learnings

### Greeting Protocol
- On greeting-only messages (`hello`, `good morning`, etc.):
  1. Summarize recent work from git history (last 1-2 working days)
  2. Suggest five possible next steps with impact (`Small`/`Medium`/`Large`) and risk (`Low`/`Medium`/`High`)

### Documentation Workflow
- **Significant decisions**: Update `docs/architecture.md` and create ADR in `docs/adr/NNNN-title.md`
- **Minor decisions**: Use `docs/decision-log.md` (if it exists)
- **Lessons learned**: Record in `docs/lessons/NNNN-slug.md` following lesson-decision-records skill format
- Always cross-reference between architecture.md ↔ ADR ↔ lessons

### Skills Transparency
- When using specialized skills, briefly mention them (e.g., "Using `systematic-debugging` skill...")

---

## Workspace Details

**Location**: `midi-to-vp/` (root-level workspace in Zen Virtual Piano monorepo)  
**Package Name**: `@zen/midi-to-vp`  
**Workspace Type**: Standalone library package (no UI components)

---

## Development Workflow

### Setup
```bash
# From monorepo root
yarn install

# From midi-to-vp/
yarn install
```

### Common Commands

**Local Development**
```bash
cd midi-to-vp

# Type checking
yarn type-check

# Run tests
yarn test

# Watch mode
yarn test:watch

# Coverage (target: 80% branches)
yarn test:coverage

# Build all outputs
yarn build
```

**From Monorepo Root**
```bash
# Build only this package
yarn turbo run build --filter=@zen/midi-to-vp

# Test only this package
yarn turbo run test --filter=@zen/midi-to-vp

# Type-check only this package
yarn turbo run type-check --filter=@zen/midi-to-vp
```

### Testing the CLI Locally
```bash
# After building
cd midi-to-vp
node dist/cjs/cli.js path/to/test.mid

# Or link globally
yarn link
midi-to-vp path/to/test.mid
```

### Testing with Web UI
```bash
# Build the library first
yarn build

# Start test server
cd test-server
yarn install
yarn dev
# Opens http://localhost:3100
```

The test server provides:
- MIDI file upload interface
- Live option configuration
- Real-time conversion preview
- Download notation and JSON results

---

## Code Style & Conventions

### Naming Conventions
- **Files**: `kebab-case.ts` (e.g., `convert.ts`, `quantize.ts`)
- **Functions**: `camelCase` (e.g., `convertMidiToVp`, `buildTimeline`)
- **Types/Interfaces**: `PascalCase` (prefer `type` over `interface`)
- **Constants**: `UPPER_SNAKE_CASE` for true constants (e.g., `DEFAULT_SLOTS_PER_QUARTER`)

### TypeScript Guidelines
- Prefer explicit return types for public API functions
- Use `readonly` for immutable data structures
- Avoid `any`; use `unknown` for truly dynamic data
- Export types used in public API from `types.ts`

### Module System
- **Source**: ESM with `.js` extensions in imports (for Node.js ESM compatibility)
- **Output**: Dual ESM + CJS builds via separate tsconfig files
- **Imports**: Always use relative paths with `.js` extension

Example:
```typescript
import { parseMidiBuffer } from './parse.js';
import type { ConversionOptions } from './types.js';
```

### Error Handling
- Throw descriptive errors for invalid inputs
- Use `Error` instances, not plain strings
- Collect warnings in `ConversionResult.warnings[]` for non-fatal issues

---

## Architecture Overview

**Pipeline**: Parse → Normalize → Transform → Quantize → Serialize

1. **Parse** (`parse.ts`): Load MIDI with `@tonejs/midi`, extract tempo map and notes
2. **Normalize** (`normalize.ts`): Convert to uniform `NoteEvent[]` with absolute time
3. **Transform** (`transform.ts`): Transpose to Virtual Piano range, filter percussion
4. **Quantize** (`quantize.ts`): Snap to time grid, build timeline, simplify chords
5. **Serialize** (`serialize.ts`): Format timeline into `extended` or `zen` notation strings

See `docs/architecture.md` for detailed design decisions.

---

## Testing Guidelines

### Test Organization
- **Unit tests**: `tests/unit/*.test.ts` - Pure function tests
- **Integration tests**: `tests/integration/*.test.ts` - End-to-end conversion flows
- **CLI tests**: `tests/cli.test.ts` - CLI argument parsing and file output

### Coverage Target
- **Minimum**: 80% branch coverage
- Run `yarn test:coverage` before submitting PRs
- Check `coverage/` directory for HTML reports

### Test Patterns
```typescript
import { describe, expect, it } from 'vitest';

describe('convertMidiToVp', () => {
  it('should convert simple melody to extended notation', () => {
    const input = createTestMidiBuffer([
      { midi: 60, start: 0, duration: 0.5 }
    ]);
    
    const result = convertMidiToVp(input, { notationMode: 'extended' });
    
    expect(result.notation.extended).toContain('C4');
    expect(result.warnings).toHaveLength(0);
  });
});
```

### Running Specific Tests
```bash
yarn vitest run -t "convertMidiToVp"
```

---

## Build System

### Output Structure
```
dist/
├── esm/              # ES modules (import)
│   ├── index.js
│   ├── cli.js
│   └── ...
├── cjs/              # CommonJS (require)
│   ├── package.json  # {"type": "commonjs"}
│   ├── index.js
│   └── ...
└── types/            # TypeScript declarations
    ├── index.d.ts
    └── ...
```

### Build Process
1. `build:esm` - TypeScript → `dist/esm/` with `"type": "module"`
2. `build:cjs` - TypeScript → `dist/cjs/` with CommonJS syntax
3. `build:types` - Generate `.d.ts` files in `dist/types/`
4. `build:cjs-meta` - Copy `package.cjs.json` to `dist/cjs/package.json`

### tsconfig Files
- `tsconfig.json` - Development and type-checking
- `tsconfig.build.base.json` - Shared build config
- `tsconfig.build.esm.json` - ESM output
- `tsconfig.build.cjs.json` - CJS output
- `tsconfig.build.types.json` - Declarations only

---

## Conversion Pipeline Details

### Notation Modes

**Extended Mode** (Full Range)
- Format: `C4 D4 E4 [C4 E4 G4]` (note names + octave)
- Range: All MIDI notes that fit in Virtual Piano keymap
- Use case: Full expressiveness, multiple octaves

**Zen Mode** (36-Key Compact)
- Format: `a s d [asf]` (single chars)
- Range: 36 keys mapped to `[a-z][0-9]`
- Use case: Compact notation, single-octave melodies

### Key Concepts

**Quantization**: Snaps note timings to discrete time slots
- `slotsPerQuarter=4` → 16th note resolution
- `slotsPerQuarter=8` → 32nd note resolution

**Transpose**: Automatically shifts notes to fit Virtual Piano range
- Detects min/max MIDI notes in source
- Calculates optimal transpose offset
- Reports in `ConversionResult.transposeSemitones`

**Chord Simplification**: Reduces polyphony for playability
- Keeps top N notes (default: 4)
- Preserves bass + highest notes
- Configurable via `maxChordSize`

**Deduplication**: Removes exact duplicate notes at same time slot
- Enabled by default (`dedupe: true`)
- Useful for fixing layered MIDI tracks

---

## Common Tasks

### Adding a New Conversion Option
1. Add field to `ConversionOptions` in `types.ts`
2. Update default handling in `convert.ts`
3. Add CLI flag in `cli.ts` (if applicable)
4. Write tests in `tests/integration/`
5. Update README.md API reference

### Adding a New Notation Mode
1. Add mode to `VpNotationMode` union in `types.ts`
2. Implement serialization logic in `serialize.ts`
3. Update CLI `--mode` validation in `cli.ts`
4. Add tests for new format
5. Document in README.md

### Debugging MIDI Parsing Issues
1. Use `convertMidiFileToVp` with default options to get full result
2. Inspect `result.normalizedNotes` for raw MIDI data
3. Check `result.transformedNotes` for transpose/filter effects
4. Review `result.warnings` for non-fatal issues
5. Verify `result.metadata.tempoBpm` and `result.tempoSegments`

---

## Troubleshooting

### Build Errors
**Problem**: `Cannot find module './parse.js'`  
**Solution**: Ensure all imports use `.js` extension, not `.ts`

**Problem**: CJS build fails with `export` syntax  
**Solution**: Check `tsconfig.build.cjs.json` has `"module": "commonjs"`

### Test Failures
**Problem**: Tests can't find source files  
**Solution**: Run `yarn build` first if testing CLI output

**Problem**: Vitest import errors  
**Solution**: Check `vitest.config.ts` has correct `resolve.alias` settings

### CLI Not Working After Build
**Problem**: `midi-to-vp: command not found`  
**Solution**: 
```bash
yarn link           # Link package globally
# Or use directly:
node dist/cjs/cli.js input.mid
```

---

## Pull Request Guidelines

**Title Format**: `<type>(midi-to-vp): <description>`
- Examples: 
  - `feat(midi-to-vp): add support for tempo changes`
  - `fix(midi-to-vp): correct chord simplification logic`
- Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`

**Pre-commit Checklist**:
1. ✅ Run `yarn type-check`
2. ✅ Run `yarn test` (all tests pass)
3. ✅ Run `yarn test:coverage` (>= 80% branch coverage)
4. ✅ Run `yarn build` (successful build)
5. ✅ Update README.md if API changed
6. ✅ Update `docs/architecture.md` for architectural changes
7. ✅ Create ADR for significant decisions

**Additional Requirements**:
- Add/update tests for all code changes
- Maintain 80% branch coverage minimum
- Follow existing code style and naming conventions

---

## After Completing Work

**Always provide**:
1. **Next Steps**: 5 alternatives with impact/risk levels
2. **Commit Suggestions** (optional): 5 possible commit messages

---

## Resources

- **Main Repo**: See root `AGENTS.md` for monorepo context
- **MIDI Spec**: Use `@tonejs/midi` documentation for MIDI parsing questions
- **Virtual Piano**: Reference https://virtualpiano.net for notation examples

---

## Remember

This package is **standalone** and **reusable**:
- No dependencies on other Zen Virtual Piano workspaces
- Keep API surface minimal and focused
- Prioritize performance and correctness
- Maintain full TypeScript type safety
