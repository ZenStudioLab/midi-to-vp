import { describe, expect, it } from "vitest";
import { convertMidiToVp } from "../src/index";
import { createRangeStressMidi } from "./helpers/midi-fixture";

describe("range transform", () => {
  it("auto-transposes and folds notes into the supported Roblox piano range while preserving relative relationships", () => {
    const result = convertMidiToVp(createRangeStressMidi());

    expect(
      result.transformedNotes.every(
        (note) => note.midi >= 36 && note.midi <= 96,
      ),
    ).toBe(true);
    expect(Math.abs(result.transposeSemitones % 12)).toBe(0);
  });
});
