import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCli } from '../src/cli';
import { createMidiFixture } from './helpers/midi-fixture';

describe('integration: cli', () => {
  it('converts a MIDI file and writes JSON + notation outputs', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'midi-to-vp-'));
    const midiPath = path.join(tempDir, 'input.mid');
    const jsonPath = path.join(tempDir, 'output.json');
    const notationPath = path.join(tempDir, 'output.txt');

    await writeFile(midiPath, createMidiFixture());

    const exitCode = await runCli([
      midiPath,
      '--out',
      jsonPath,
      '--notation-out',
      notationPath,
      '--mode',
      'extended',
      '--slots-per-quarter',
      '4'
    ]);

    expect(exitCode).toBe(0);

    const jsonText = await readFile(jsonPath, 'utf8');
    const notationText = await readFile(notationPath, 'utf8');
    const parsed = JSON.parse(jsonText) as { notation: { extended: string } };

    expect(parsed.notation.extended).toBe('[tu]y--d');
    expect(notationText.trim()).toBe('[tu]y--d');
  });

  it('accepts standard mode as alias for compact notation', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'midi-to-vp-'));
    const midiPath = path.join(tempDir, 'input.mid');
    const jsonPath = path.join(tempDir, 'output-standard.json');

    await writeFile(midiPath, createMidiFixture());

    const exitCode = await runCli([
      midiPath,
      '--out',
      jsonPath,
      '--mode',
      'standard',
      '--slots-per-quarter',
      '4'
    ]);

    expect(exitCode).toBe(0);

    const jsonText = await readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(jsonText) as { notation: { mode: string; selected: string; standard: string } };

    expect(parsed.notation.mode).toBe('standard');
    expect(parsed.notation.selected).toBe(parsed.notation.standard);
  });
});
