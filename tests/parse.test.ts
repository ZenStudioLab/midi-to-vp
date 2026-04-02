import { describe, expect, it, vi } from "vitest";

const { midiCtorSpy } = vi.hoisted(() => ({
  midiCtorSpy: vi.fn()
}));

vi.mock("@tonejs/midi", () => ({
  Midi: midiCtorSpy
}));

import { parseMidiBuffer } from "../src/parse.js";

describe("parseMidiBuffer", () => {
  it("returns the first time signature from the MIDI header", () => {
    midiCtorSpy.mockImplementation(() => ({
      header: {
        tempos: [{ ticks: 0, bpm: 90, time: 0 }],
        timeSignatures: [{ ticks: 0, timeSignature: [6, 8] }]
      },
      tracks: [{ notes: [] }]
    }));

    const { parsed } = parseMidiBuffer(new Uint8Array([1, 2, 3]));

    expect(parsed.tempoBpm).toBe(90);
    expect(parsed.timeSignature).toBe("6/8");
    expect(parsed.trackCount).toBe(1);
  });
});
