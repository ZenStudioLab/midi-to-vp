# ADR 0001: Dual ESM/CJS Build System

**Status**: Accepted  
**Date**: 2026-03-14  
**Deciders**: Development team

## Context

The library needs to support both modern and legacy Node.js ecosystems:
- Modern Node.js projects use ESM (`import`/`export`)
- Many existing projects still use CommonJS (`require`)
- TypeScript definitions must work with both formats
- Build complexity should remain minimal
- No bundler dependencies for better maintainability

## Decision

Implement dual ESM + CJS builds using only TypeScript compiler:

**Build Process**:
```bash
build:esm   → dist/esm/    (module: "ESNext")
build:cjs   → dist/cjs/    (module: "CommonJS")
build:types → dist/types/  (declarations only)
```

**Package.json Configuration**:
```json
{
  "type": "module",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    }
  }
}
```

**Source Code Requirements**:
- Use `.js` extensions in import statements (required for Node.js ESM)
- Write ESM-style code in source
- Let TypeScript handle CJS transformation

**CJS Marker**:
- Add `package.json` in `dist/cjs/` with `{"type": "commonjs"}`
- Tells Node.js to treat `.js` files as CommonJS in that directory

## Consequences

### Positive
- **Broad compatibility**: Works with both module systems
- **No bundler needed**: TypeScript handles everything
- **Tree-shakeable**: ESM output enables dead code elimination
- **Type safety**: Single declaration file for both formats
- **Simple maintenance**: No Babel, no Rollup configuration

### Negative
- **Three separate builds**: Slightly slower build times
- **Larger dist size**: Two copies of code in output
- **Import extensions**: Must use `.js` in source (TypeScript quirk)
- **CJS overhead**: Extra `package.json` file needed

### Neutral
- Users don't notice - module resolution "just works"
- Build time: ~3 seconds (acceptable for library size)

## Alternatives Considered

### 1. ESM Only
- **Rejected**: Breaks compatibility with CommonJS projects
- Many tools/frameworks still require CJS
- Would limit adoption

### 2. CJS Only
- **Rejected**: No tree-shaking benefits
- Against modern JavaScript direction
- Poor developer experience for ESM users

### 3. Use Bundler (Rollup/esbuild)
- **Rejected**: Adds dependency and complexity
- TypeScript alone is sufficient
- More moving parts to maintain
- Potential version conflicts

### 4. Use Babel
- **Rejected**: Unnecessary transformation layer
- TypeScript can emit both formats
- More configuration overhead

## Implementation Notes

**tsconfig Files**:
- `tsconfig.build.base.json`: Shared settings
- `tsconfig.build.esm.json`: Extends base, sets `module: "ESNext"`
- `tsconfig.build.cjs.json`: Extends base, sets `module: "CommonJS"`
- `tsconfig.build.types.json`: Extends base, `emitDeclarationOnly: true`

**Verification**:
```bash
# ESM import works
node --input-type=module -e "import('@zen/midi-to-vp').then(console.log)"

# CJS require works
node -e "console.log(require('@zen/midi-to-vp'))"
```

## Related Decisions

- [ADR 0002](0002-browser-node-split.md): Browser/Node.js code separation for Vite compatibility
