## Responsibility

- Local web UI (Vite + React) to experiment with the library in the browser

## Design

- React app handles file upload, runs `convertMidiToVp`, displays notation/timeline/JSON and quality analysis
- Uses `@zen/midi-to-vp/browser` exports for conversion, analysis, and scoring
- Tailwind + MUI for layout and controls

## Flow

- User selects `.mid` file → read to `Uint8Array` → `convertMidiToVp()` with interactive options → UI renders results and enables downloads
- Pre-analysis on file select recommends difficulty profile and shows initial score

## Integration

- For local development: `yarn dev` (requires building library first: `yarn build`)
- Runs on `http://localhost:3100` by default
