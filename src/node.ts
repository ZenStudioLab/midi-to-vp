import { readFile } from 'node:fs/promises';
import { convertMidiToVp } from './convert.js';
import type { ConversionOptions, ConversionResult } from './types.js';

export async function convertMidiFileToVp(inputPath: string, options: ConversionOptions = {}): Promise<ConversionResult> {
  const data = await readFile(inputPath);
  return convertMidiToVp(data, options);
}
