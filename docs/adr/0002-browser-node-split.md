# ADR 0002: Browser-Safe and Node.js Code Separation

**Status**: Accepted  
**Date**: 2026-03-14  
**Deciders**: Development team

## Context

**Problem**: Test server (browser-based Vite app) imports `convertMidiToVp` from `convert.ts`, which contained a top-level import of `node:fs/promises`:

```typescript
// convert.ts (original)
import { readFile } from 'node:fs/promises';  // ❌ Browser incompatible

export function convertMidiToVp(input: Uint8Array) { ... }
export async function convertMidiFileToVp(path: string) {
  const data = await readFile(path);  // Uses Node.js API
  return convertMidiToVp(data);
}
```

**Error**:
```
Module "node:fs/promises" has been externalized for browser compatibility.
Cannot access "node:fs/promises.readFile" in client code.
```

Vite cannot bundle Node.js-specific modules for the browser, even if they're not called.

## Decision

**Split into two files**:

1. **`convert.ts`**: Browser-safe core conversion logic
   - Accepts `Uint8Array | Buffer` input
   - No Node.js imports
   - Can be imported by both Node.js and browser code

2. **`node.ts`**: Node.js-specific file operations
   - Imports `node:fs/promises`
   - Wraps `convertMidiToVp` with file reading
   - Only imported by CLI and Node.js consumers

**Structure**:
```typescript
// convert.ts (browser-safe)
export function convertMidiToVp(input: Uint8Array | Buffer, options?) { ... }

// node.ts (Node.js only)
import { readFile } from 'node:fs/promises';
import { convertMidiToVp } from './convert.js';

export async function convertMidiFileToVp(path: string, options?) {
  const data = await readFile(path);
  return convertMidiToVp(data, options);
}

// index.ts (main export)
export { convertMidiToVp } from './convert.js';
export { convertMidiFileToVp } from './node.js';

// browser.ts (browser-safe export surface)
export { convertMidiToVp } from './convert.js';
```

**Package Exports Conditions**:
```json
{
  "exports": {
    ".": {
      "browser": "./dist/esm/browser.js",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    },
    "./browser": {
      "import": "./dist/esm/browser.js",
      "require": "./dist/cjs/browser.js"
    },
    "./node": {
      "import": "./dist/esm/node.js",
      "require": "./dist/cjs/node.js"
    }
  }
}
```

**Usage**:
```typescript
// Browser code (test server)
import { convertMidiToVp } from '@zen/midi-to-vp';  // ✅ Works
import { convertMidiToVp as browserConvert } from '@zen/midi-to-vp/browser';  // ✅ Explicit browser entry

// Node.js code (CLI, server)
import { convertMidiFileToVp } from '@zen/midi-to-vp/node';  // ✅ Works
import { convertMidiFileToVp as nodeConvert } from '@zen/midi-to-vp/node';    // ✅ Explicit Node entry
```

## Consequences

### Positive
- **Browser compatibility**: Test server and browser builds work
- **Clear separation**: API boundary between browser/Node.js is explicit
- **No Vite config hacks**: No need for `externals` or polyfills
- **Type safety maintained**: Both functions fully typed
- **Explicit compatibility**: Browser-aware export conditions prevent accidental Node import in client bundles

### Negative
- **Extra file**: One more file in source tree
- **Export complexity**: Requires maintaining index + browser entry + conditional exports
- **Documentation split**: Need to document browser vs Node.js usage

### Neutral
- API surface unchanged - users import the same functions
- Bundle size identical (tree-shaking removes unused code)

## Alternatives Considered

### 1. Conditional Imports
```typescript
const readFile = typeof window === 'undefined' 
  ? require('node:fs/promises').readFile 
  : null;
```
- **Rejected**: Vite still tries to bundle the import
- Doesn't solve the bundler issue
- Fragile runtime detection

### 2. Vite Configuration
```typescript
// vite.config.ts
export default {
  resolve: {
    alias: { 'node:fs/promises': 'empty-module' }
  }
}
```
- **Rejected**: Requires test server to know library internals
- Breaks if library changes
- Config pollution

### 3. Separate npm Packages
- `@zen/midi-to-vp-core` (browser)
- `@zen/midi-to-vp-node` (Node.js)
- **Rejected**: Over-engineered for this use case
- Splitting one package into two is excessive
- Maintenance overhead

### 4. Dynamic Import
```typescript
export async function convertMidiFileToVp(path: string) {
  const { readFile } = await import('node:fs/promises');
  // ...
}
```
- **Rejected**: Still fails in browser at runtime
- Doesn't prevent Vite from seeing the import
- Just delays the error

## Implementation Notes

**Files Modified**:
- `src/convert.ts`: Removed `readFile` import and `convertMidiFileToVp`
- `src/node.ts`: Created with `convertMidiFileToVp`
- `src/index.ts`: Updated to export from both files
- `src/browser.ts`: Added browser-only export surface
- `package.json`: Added browser conditional export and explicit `./browser` / `./node` entries
- `src/cli.ts`: Changed import from `./convert.js` to `./node.js`

**Testing**:
```bash
# Build library
cd midi-to-vp && yarn build

# Test browser server
cd test-server && yarn dev  # ✅ No errors

# Test CLI
midi-to-vp test.mid  # ✅ Still works
```

## Related Decisions

- [ADR 0001](0001-dual-output-build-system.md): Dual ESM/CJS builds remain unaffected
