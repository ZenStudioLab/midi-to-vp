import {
  convertMidiToVp,
  tryConvertMidiToVp,
  convertMidiWithDifficulty,
  convertMidiWithLevel,
} from '@zen/midi-to-vp/browser';

import type { ConversionOutcome, ConversionResult } from '@zen/midi-to-vp/browser';

declare const bytes: Uint8Array;

const converted: ConversionResult = convertMidiToVp(bytes, { notationMode: 'standard' });
const attempted: ConversionOutcome = tryConvertMidiToVp(bytes, { notationMode: 'extended' });
const withDifficulty: ConversionResult = convertMidiWithDifficulty(bytes, 'Adept');
const withLevel: ConversionResult = convertMidiWithLevel(bytes, { level: 'Master' });

void [converted, attempted, withDifficulty, withLevel];