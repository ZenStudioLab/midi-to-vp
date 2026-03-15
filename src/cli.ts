#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { convertMidiFileToVp } from './node.js';
import type { ConversionOptions, VpNotationMode } from './types.js';

type CliOptions = {
  inputPath?: string;
  outPath?: string;
  notationOutPath?: string;
  mode: VpNotationMode;
  slotsPerQuarter: number;
  includePercussion: boolean;
  dedupe: boolean;
  simplifyChords: boolean;
  maxChordSize: number;
  jsonIndent: number;
  showHelp: boolean;
};

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: midi-to-vp <input.mid> [options]

Options:
  --out <path>               JSON output path
  --notation-out <path>      Notation text output path
  --mode <extended|standard|minimal> Selected notation mode (default: extended)
  --slots-per-quarter <n>    Quantization resolution (default: 4)
  --max-chord-size <n>       Max notes to keep per chord (default: 4)
  --include-percussion       Keep MIDI channel 10 notes
  --no-dedupe                Disable duplicate-note dedupe
  --no-chord-simplify        Disable chord simplification
  --json-indent <n>          JSON indentation width (default: 2)
  --help                     Show this help
`);
}

function getDefaultOutPath(inputPath: string): string {
  const ext = path.extname(inputPath);
  if (!ext) {
    return `${inputPath}.vp.json`;
  }

  return inputPath.slice(0, -ext.length) + '.vp.json';
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: 'extended',
    slotsPerQuarter: 4,
    includePercussion: false,
    dedupe: true,
    simplifyChords: true,
    maxChordSize: 4,
    jsonIndent: 2,
    showHelp: false
  };

  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    switch (arg) {
      case '--help':
        options.showHelp = true;
        break;
      case '--out':
        options.outPath = argv[index + 1];
        index += 1;
        break;
      case '--notation-out':
        options.notationOutPath = argv[index + 1];
        index += 1;
        break;
      case '--mode': {
        const mode = argv[index + 1] as VpNotationMode;
        if (mode !== 'extended' && mode !== 'standard' && mode !== 'minimal') {
          throw new Error(`Unsupported mode: ${mode}`);
        }
        options.mode = mode;
        index += 1;
        break;
      }
      case '--slots-per-quarter':
        options.slotsPerQuarter = Number.parseInt(argv[index + 1], 10);
        index += 1;
        break;
      case '--max-chord-size':
        options.maxChordSize = Number.parseInt(argv[index + 1], 10);
        index += 1;
        break;
      case '--include-percussion':
        options.includePercussion = true;
        break;
      case '--no-dedupe':
        options.dedupe = false;
        break;
      case '--no-chord-simplify':
        options.simplifyChords = false;
        break;
      case '--json-indent':
        options.jsonIndent = Number.parseInt(argv[index + 1], 10);
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.inputPath = positional[0];
  return options;
}

function validateOptions(options: CliOptions): void {
  if (options.showHelp) {
    return;
  }

  if (!options.inputPath) {
    throw new Error('Missing input file path.');
  }

  if (!Number.isFinite(options.slotsPerQuarter) || options.slotsPerQuarter <= 0) {
    throw new Error('Invalid --slots-per-quarter value.');
  }

  if (!Number.isFinite(options.maxChordSize) || options.maxChordSize <= 0) {
    throw new Error('Invalid --max-chord-size value.');
  }

  if (!Number.isFinite(options.jsonIndent) || options.jsonIndent < 0) {
    throw new Error('Invalid --json-indent value.');
  }
}

function toConversionOptions(cli: CliOptions): ConversionOptions {
  return {
    notationMode: cli.mode,
    includePercussion: cli.includePercussion,
    dedupe: cli.dedupe,
    simplifyChords: cli.simplifyChords,
    maxChordSize: cli.maxChordSize,
    quantization: {
      slotsPerQuarter: cli.slotsPerQuarter
    }
  };
}

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    validateOptions(parsed);

    if (parsed.showHelp) {
      printHelp();
      return 0;
    }

    const inputPath = parsed.inputPath as string;
    const outPath = parsed.outPath ?? getDefaultOutPath(inputPath);

    const result = await convertMidiFileToVp(inputPath, toConversionOptions(parsed));

    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(result, null, parsed.jsonIndent)}\n`, 'utf8');

    if (parsed.notationOutPath) {
      await mkdir(path.dirname(parsed.notationOutPath), { recursive: true });
      await writeFile(parsed.notationOutPath, `${result.notation.selected}\n`, 'utf8');
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`[midi-to-vp] ${message}`);
    return 1;
  }
}

if (process.argv[1] && /cli\.(js|ts)$/.test(process.argv[1])) {
  void runCli().then((exitCode) => {
    process.exit(exitCode);
  });
}
