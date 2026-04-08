## Responsibility

- Local web UI (Vite + React + MUI) to experiment with the library in the browser

## Design

- `src/App.tsx` handles file upload, runs `convertMidiToVp`, shows notation/timeline/JSON and quality analysis
- Uses `@zen/midi-to-vp/browser` exports for conversion, analysis, and scoring
- Tailwind + MUI for layout and controls

## Flow

- User selects a `.mid` → file read to `Uint8Array` → `convertMidiToVp` with interactive options → UI renders results and enables downloads
- Pre‑analysis on select recommends a difficulty profile and shows an initial score

## Integration

- For local development: `yarn dev` (see `vite.config.ts`); requires building the library first (`yarn build`)
