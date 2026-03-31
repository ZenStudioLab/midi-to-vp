import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PACKAGE_JSON_PATH = path.resolve(__dirname, '..', 'package.json');
const BROWSER_ENTRY_PATH = path.resolve(__dirname, '..', 'src', 'browser.ts');

type PackageJson = {
  exports?: {
    [key: string]: unknown;
  };
};

describe('package exports: browser compatibility', () => {
  it('declares a browser-specific main export that avoids Node-only modules', async () => {
    const packageJsonText = await readFile(PACKAGE_JSON_PATH, 'utf8');
    const packageJson = JSON.parse(packageJsonText) as PackageJson;
    const rootExport = packageJson.exports?.['.'] as { browser?: unknown } | undefined;
    const browserExport = packageJson.exports?.['./browser'] as { import?: unknown; types?: unknown } | undefined;

    expect(rootExport).toBeDefined();
    expect(rootExport?.browser).toBe('./dist/esm/browser.js');
    expect(browserExport).toBeDefined();
    expect(browserExport?.import).toBe('./dist/esm/browser.js');
    expect(browserExport?.types).toBe('./dist/types/browser.d.ts');
  });

  it('provides a browser entry source that only exposes browser-safe API', async () => {
    const browserEntry = await readFile(BROWSER_ENTRY_PATH, 'utf8');

    expect(browserEntry).toContain('export function convertMidiToVp(input: Uint8Array');
    expect(browserEntry).toContain('export function tryConvertMidiToVp(input: Uint8Array');
    expect(browserEntry).toContain('export function convertMidiWithDifficulty(');
    expect(browserEntry).toContain('export function convertMidiWithLevel(');
    expect(browserEntry).toContain("export { MIN_VP_MIDI, MAX_VP_MIDI } from './transform.js';");
    expect(browserEntry).toContain("export { getDifficultyPreset } from './presets.js';");
    expect(browserEntry).toContain("export { analyzeVpNotation } from './analyze.js';");
    expect(browserEntry).not.toContain('Buffer');
    expect(browserEntry).not.toContain('convertMidiFileToVp');
    expect(browserEntry).not.toContain('node:fs/promises');
  });
});
