/**
 * Test Perspective Table:
 * | Case ID | Input / Precondition | Perspective (Equivalence / Boundary) | Expected Result | Notes |
 * |---------|----------------------|--------------------------------------|-----------------|-------|
 * | TC-B-01 | Click convert without file | Boundary - empty | Error message is shown | Validation path |
 * | TC-N-01 | Upload valid MIDI file | Equivalence - normal | Analysis panel appears with recommendation | Auto-analysis |
 * | TC-N-02 | Change level to Guru | Equivalence - normal | Mode/slots/chord controls reflect preset | Profile mapping |
 * | TC-N-03 | Change notation mode to standard | Equivalence - normal | Standard mode becomes selected | 3-mode support |
 */

import { expect, test } from '@playwright/test';

const MIDI_FIXTURE_BASE64 =
  'TVRoZAAAAAYAAQACAeBNVHJrAAAADwD/AwAA/1EDB6EgAP8vAE1UcmsAAAAbAP8DAADAAACQPGV4gDwAAJA+ZXiAPgAA/y8A';

test.describe('test-server difficulty workflow', () => {
  test('TC-B-01: shows validation error when convert is clicked without selecting file', async ({ page }) => {
    // Given: converter page is open with no uploaded file
    await page.goto('/');

    // When: user starts conversion
    await page.getByTestId('convert-button').click();

    // Then: validation error is shown
    await expect(page.getByTestId('conversion-error')).toContainText('Please select a MIDI file first');
  });

  test('TC-N-01: uploading midi file shows analysis recommendation panel', async ({ page }) => {
    // Given: converter page is open and a valid MIDI file is uploaded
    await page.goto('/');
    await page.getByTestId('midi-file-input').setInputFiles({
      name: 'fixture.mid',
      mimeType: 'audio/midi',
      buffer: Buffer.from(MIDI_FIXTURE_BASE64, 'base64'),
    });

    // Then: analysis panel with recommendation is rendered automatically
    await expect(page.getByTestId('analysis-panel')).toBeVisible();
    await expect(page.getByTestId('analysis-recommended-level')).not.toBeEmpty();
  });

  test('TC-N-02: selecting Guru level updates advanced controls before convert', async ({ page }) => {
    // Given: converter page is open
    await page.goto('/');

    // When: user selects Guru difficulty profile
    await page.getByTestId('difficulty-level-select').click();
    await page.getByRole('option', { name: 'Guru' }).click();

    // Then: controls mirror Guru preset values
    await expect(page.getByTestId('notation-mode-select')).toContainText('Extended');
    await expect(page.getByTestId('slots-per-quarter-input')).toHaveValue('8');
    await expect(page.getByTestId('max-chord-size-input')).toHaveValue('6');
    await expect(page.getByTestId('dedupe-switch')).not.toHaveClass(/Mui-checked/);
  });

  test('TC-N-03: selecting standard notation mode updates selection', async ({ page }) => {
    // Given: converter page is open
    await page.goto('/');

    // When: user selects standard notation mode
    await page.getByTestId('notation-mode-select').click();
    await page.getByRole('option', { name: 'Standard' }).click();

    // Then: selected notation mode reflects standard
    await expect(page.getByTestId('notation-mode-select')).toContainText('Standard');
  });

  test('TC-N-04: conversion results include analysis summary and selected profile metadata', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('midi-file-input').setInputFiles({
      name: 'fixture.mid',
      mimeType: 'audio/midi',
      buffer: Buffer.from(MIDI_FIXTURE_BASE64, 'base64'),
    });

    await page.getByTestId('convert-button').click();

    await expect(page.getByTestId('conversion-results')).toBeVisible();
    await expect(page.getByTestId('analysis-overall-score')).toBeVisible();
    await expect(page.getByTestId('result-profile-level')).toContainText(/Novice|Apprentice|Adept|Master|Guru/);
  });
});
