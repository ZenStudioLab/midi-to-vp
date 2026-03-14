# MIDI to VP Test Server

Web-based test interface for the `@zen/midi-to-vp` library.

## Features

- 📤 **MIDI File Upload**: Drag & drop or file picker
- ⚙️ **Live Options**: Adjust conversion parameters in real-time
- 📊 **Results Display**: View notation, timeline, and full JSON output
- 💾 **Download**: Export notation and JSON results
- 🎨 **Modern UI**: Built with TailwindCSS + Material-UI

## Quick Start

```bash
# From midi-to-vp/test-server
yarn install
yarn dev
```

Server runs at: http://localhost:3100

## Usage

1. **Upload MIDI File**: Click "Choose MIDI File" or drag & drop
2. **Configure Options**:
   - Notation Mode: Extended (full range) or Zen (compact)
   - Slots Per Quarter: Quantization resolution (default: 4)
   - Max Chord Size: Limit simultaneous notes (default: 4)
   - Toggles: Percussion, Deduplication, Chord Simplification
3. **Convert**: Click "Convert to Virtual Piano Notation"
4. **View Results**:
   - **Notation Tab**: Extended & Zen notation output
   - **Timeline Tab**: Quantized timeline structure
   - **Raw JSON Tab**: Full conversion result
5. **Download**: Export notation or JSON

## Development

```bash
# Install dependencies
yarn install

# Start dev server
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

## Tech Stack

- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Material-UI**: Component library
- **TailwindCSS**: Utility-first CSS
- **@zen/midi-to-vp**: Core conversion library

## Project Structure

```
test-server/
├── src/
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # React entry point
│   └── index.css        # Tailwind imports
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # TailwindCSS config
├── postcss.config.js    # PostCSS config
└── package.json         # Dependencies
```

## Notes

- This is a development/testing tool, not intended for production deployment
- Uses workspace protocol to reference `@zen/midi-to-vp` from parent directory
- Requires parent package to be built first: `cd .. && yarn build`
