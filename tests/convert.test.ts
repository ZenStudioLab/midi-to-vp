import { Midi } from "@tonejs/midi";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import { createDefaultVpKeymap } from "../src/keymap";
import {
  convertMidiToVp,
  scoreConversionQuality,
  tryConvertMidiToVp,
} from "../src/index";
import {
  createDenseChordMidi,
  createMidiFixture,
} from "./helpers/midi-fixture";

const MUSESCORE_FIXTURES = {
  erhu: join(
    __dirname,
    "../test-server/midi/musecore/erhu/intermediate/my-heart-will-go-on-erhu.mid",
  ),
  harp: join(
    __dirname,
    "../test-server/midi/musecore/harp/beginner/my-heart-will-go-on-orchestra-harp.mid",
  ),
  piano: join(
    __dirname,
    "../test-server/midi/musecore/piano/advanced/my-heart-will-go-on-celine-dion-incredible-piano-cover.mid",
  ),
} as const;

function createEmptyMidi(): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(120);
  midi.addTrack();
  return new Uint8Array(midi.toArray());
}

function createPercussionOnlyMidi(): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(120);

  const track = midi.addTrack();
  track.channel = 9;
  track.addNote({ midi: 36, time: 0, duration: 0.25, velocity: 0.8 });

  return new Uint8Array(midi.toArray());
}

function createHumanizedGridMidi(): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(120);

  const track = midi.addTrack();
  track.channel = 0;
  track.addNote({ midi: 60, time: 0.01, duration: 0.125, velocity: 0.8 });
  track.addNote({ midi: 64, time: 0.135, duration: 0.125, velocity: 0.76 });

  return new Uint8Array(midi.toArray());
}

describe("tryConvertMidiToVp", () => {
  it("returns structured quality signals for a deterministic fixture", () => {
    const result = tryConvertMidiToVp(createMidiFixture(), {
      notationMode: "extended",
      includePercussion: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected successful conversion");
    }

    expect(result.metadata.qualitySignals).toMatchObject({
      totalRawNotes: 4,
      inRangeNotes: 4,
      averageChordSize: 4 / 3,
      peakChordSize: 2,
      avgNotesPerSecond: 6.4,
    });
    expect(result.metadata.qualitySignals).not.toHaveProperty("notesPerSecond");
    expect(result.metadata.qualitySignals.p95ChordSize).toBeGreaterThanOrEqual(
      result.metadata.qualitySignals.averageChordSize,
    );
    expect(result.metadata.qualitySignals.p95ChordSize).toBeLessThanOrEqual(
      result.metadata.qualitySignals.peakChordSize,
    );
    expect(
      result.metadata.qualitySignals.p95NotesPerSecond,
    ).toBeLessThanOrEqual(result.metadata.qualitySignals.maxNotesPerSecond);
    expect(result.metadata.qualitySignals.p95NotesPerSecond).toBeGreaterThan(0);
    expect(
      result.metadata.qualitySignals.gridConfidence,
    ).toBeGreaterThanOrEqual(0);
    expect(result.metadata.qualitySignals.gridConfidence).toBeLessThanOrEqual(
      1,
    );
  });

  it("keeps raw note counts distinct from simplified chord metrics", () => {
    const result = tryConvertMidiToVp(createDenseChordMidi(), {
      notationMode: "extended",
      includePercussion: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected successful conversion");
    }

    expect(result.metadata.qualitySignals.totalRawNotes).toBe(6);
    expect(result.metadata.qualitySignals.inRangeNotes).toBe(6);
    expect(result.metadata.qualitySignals.averageChordSize).toBe(6);
    expect(result.metadata.qualitySignals.peakChordSize).toBe(6);
    expect(result.metadata.qualitySignals.avgNotesPerSecond).toBe(24);
    expect(result.metadata.qualitySignals.p95ChordSize).toBe(6);
    expect(result.metadata.qualitySignals.hardChordRate).toBe(1);
  });

  it("computes timing jitter from pre-snap timing offsets", () => {
    const result = tryConvertMidiToVp(createHumanizedGridMidi(), {
      notationMode: "extended",
      includePercussion: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected successful conversion");
    }

    expect(result.metadata.qualitySignals.totalRawNotes).toBe(2);
    expect(result.metadata.qualitySignals.timingJitter).toBeGreaterThan(0);
    expect(
      result.metadata.qualitySignals.gridConfidence,
    ).toBeGreaterThanOrEqual(0);
    expect(result.metadata.qualitySignals.gridConfidence).toBeLessThanOrEqual(
      1,
    );
  });

  it("returns corrupted_midi for invalid bytes", () => {
    const result = tryConvertMidiToVp(Uint8Array.from([1, 2, 3, 4]));

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected conversion failure");
    }

    expect(result.reason).toBe("corrupted_midi");
    expect(result.details).toEqual(
      expect.objectContaining({
        message: expect.any(String),
      }),
    );
  });

  it("rejects percussion-only MIDI when includePercussion is false", () => {
    const result = tryConvertMidiToVp(createPercussionOnlyMidi());

    expect(result).toEqual({
      ok: false,
      reason: "percussion_only",
    });
  });

  it("allows percussion-only MIDI when includePercussion is true", () => {
    const result = tryConvertMidiToVp(createPercussionOnlyMidi(), {
      includePercussion: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected successful conversion");
    }

    expect(result.metadata.qualitySignals.outputTotalNotes).toBe(1);
    expect(result.metadata.qualitySignals.outputInRangeNotes).toBe(1);

    const assessment = scoreConversionQuality(result.metadata.qualitySignals);
    expect(assessment.stats.totalNotes).toBe(1);
    expect(assessment.stats.inRangeNotes).toBe(1);
    expect(assessment.score).toBeGreaterThan(0);
  });

  it("still treats a truly empty MIDI as empty when includePercussion is true", () => {
    const result = tryConvertMidiToVp(createEmptyMidi(), {
      includePercussion: true,
    });

    expect(result).toEqual({
      ok: false,
      reason: "empty_midi",
    });
  });

  it("preserves the legacy throwing contract for convertMidiToVp", () => {
    expect(() => convertMidiToVp(Uint8Array.from([1, 2, 3, 4]))).toThrow();
  });

  it("reports the effective clamped VP range when a custom keymap exceeds supported bounds", () => {
    const baseKeymap = createDefaultVpKeymap();
    const result = convertMidiToVp(createMidiFixture(), {
      keymap: {
        ...baseKeymap,
        minMidi: 30,
        maxMidi: 100,
      },
    });

    expect(result.metadata.vpRange).toEqual({
      minMidi: 36,
      maxMidi: 96,
    });
  });
});

describe("tryConvertMidiToVp classification", () => {
  afterEach(() => {
    vi.doUnmock("../src/parse.js");
    vi.resetModules();
  });

  it("classifies ParseMidiError by code before considering message text", async () => {
    vi.resetModules();
    vi.doMock("../src/parse.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/parse.js")>();

      class MockParseMidiError extends Error {
        code: string;

        constructor(code: string, message: string) {
          super(message);
          this.code = code;
        }
      }

      return {
        ...actual,
        ParseMidiError: MockParseMidiError,
        parseMidiBuffer: () => {
          throw new MockParseMidiError(
            "INVALID_MIDI_FILE",
            "mock parse failure",
          );
        },
      };
    });

    const { tryConvertMidiToVp: mockedTryConvertMidiToVp } =
      await import("../src/convert.js");
    const result = mockedTryConvertMidiToVp(Uint8Array.from([1]));

    expect(result).toEqual({
      ok: false,
      reason: "corrupted_midi",
      details: {
        code: "INVALID_MIDI_FILE",
        message: "mock parse failure",
        source: "parse_error_code",
      },
    });
  });

  it("falls back to parser message matching for unwrapped upstream errors", async () => {
    vi.resetModules();
    vi.doMock("../src/parse.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/parse.js")>();

      return {
        ...actual,
        parseMidiBuffer: () => {
          throw new Error("Bad MIDI file. Expected MThd header");
        },
      };
    });

    const { tryConvertMidiToVp: mockedTryConvertMidiToVp } =
      await import("../src/convert.js");
    const result = mockedTryConvertMidiToVp(Uint8Array.from([1]));

    expect(result).toEqual({
      ok: false,
      reason: "corrupted_midi",
      details: {
        code: "INVALID_MIDI_FILE",
        message: "Bad MIDI file. Expected MThd header",
        source: "parse_error_message",
      },
    });
  });

  it("returns internal_error for unexpected runtime faults", async () => {
    vi.resetModules();
    vi.doMock("../src/parse.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/parse.js")>();

      return {
        ...actual,
        parseMidiBuffer: () => {
          throw new TypeError(
            "Cannot read properties of undefined (reading 'tracks')",
          );
        },
      };
    });

    const { tryConvertMidiToVp: mockedTryConvertMidiToVp } =
      await import("../src/convert.js");
    const result = mockedTryConvertMidiToVp(Uint8Array.from([1]));

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        reason: "internal_error",
        details: expect.objectContaining({
          code: "TypeError",
          message: "Cannot read properties of undefined (reading 'tracks')",
          source: "runtime_error",
        }),
      }),
    );
  });

  it("parses successful conversions only once", async () => {
    vi.resetModules();
    const parseMidiBufferMock = vi.fn(() => ({
      midi: {
        header: {},
        tracks: [
          {
            channel: 0,
            notes: [{ midi: 60, time: 0, duration: 0.25, velocity: 0.8 }],
          },
        ],
      },
      parsed: {
        tempoSegments: [],
        tempoBpm: 120,
        trackCount: 1,
      },
    }));

    vi.doMock("../src/parse.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../src/parse.js")>();

      return {
        ...actual,
        parseMidiBuffer: parseMidiBufferMock,
      };
    });

    const { tryConvertMidiToVp: mockedTryConvertMidiToVp } =
      await import("../src/convert.js");
    const result = mockedTryConvertMidiToVp(new Uint8Array([1]));

    expect(result.ok).toBe(true);
    expect(parseMidiBufferMock).toHaveBeenCalledTimes(1);
  });
});

describe("MuseScore corpus regression tests (T121 RED baseline)", () => {
  const redBaselineCases = [
    {
      name: "erhu/intermediate",
      fixture: MUSESCORE_FIXTURES.erhu,
      expectFATAL: "FATAL_PEAK_CHORD_SIZE",
      expectTiming: "FATAL_TIMING_CONSISTENCY",
    },
    {
      name: "harp/beginner",
      fixture: MUSESCORE_FIXTURES.harp,
      expectFATAL: "FATAL_MAX_NOTE_DENSITY",
      expectTiming: "LOW_TIMING_CONSISTENCY",
    },
    {
      name: "piano/advanced",
      fixture: MUSESCORE_FIXTURES.piano,
      expectFATAL: "HIGH_LOCAL_NOTE_DENSITY",
      expectTiming: "FATAL_TIMING_CONSISTENCY",
    },
  ] as const;

  it.each(redBaselineCases)(
    "baseline: $name fixture fails with score=0 due to genuine quality issues",
    ({ fixture, expectFATAL, expectTiming }) => {
      const midiBuffer = readFileSync(fixture);
      const result = tryConvertMidiToVp(new Uint8Array(midiBuffer));

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error("expected successful conversion");
      }

      const assessment = scoreConversionQuality(result.metadata.qualitySignals);

      expect(assessment.score).toBe(0);
      expect(assessment.reasons).toContain(expectFATAL);
      expect(assessment.reasons).toContain(expectTiming);
    },
  );
});
