import { Midi } from "@tonejs/midi";
import { describe, expect, it } from "vitest";
import { convertMidiToVp, serializeVpTimeline } from "../src/index";
import { createDefaultVpKeymap } from "../src/keymap";
import { buildTimeline, quantizeNotes } from "../src/quantize";
import {
  createDenseChordMidi,
  createMidiFixture,
  createSustainMidi,
} from "./helpers/midi-fixture";

type SerializedTimeline = Parameters<typeof serializeVpTimeline>[0];

const EXTENDED_SERIALIZATION_SCENARIOS: Array<{
  label: string;
  timeline: SerializedTimeline;
  expected: string;
}> = [
  {
    label: "single note held 3 extra slots",
    timeline: [
      createTimelineSlot(0, "onset", ["C"]),
      createTimelineSlot(1, "sustain"),
      createTimelineSlot(2, "sustain"),
      createTimelineSlot(3, "sustain"),
    ] as SerializedTimeline,
    expected: "C---",
  },
  {
    label: "note, two-slot rest, note",
    timeline: [
      createTimelineSlot(0, "onset", ["C"]),
      createTimelineSlot(1, "rest", [], 0),
      createTimelineSlot(2, "rest", [], 0),
      createTimelineSlot(3, "onset", ["D"]),
    ] as SerializedTimeline,
    expected: "C - - D",
  },
  {
    label: "chord held then rest",
    timeline: [
      createTimelineSlot(0, "onset", ["C", "E", "G"], 3),
      createTimelineSlot(1, "sustain", [], 3),
      createTimelineSlot(2, "sustain", [], 3),
      createTimelineSlot(3, "rest", [], 0),
    ] as SerializedTimeline,
    expected: "[CEG]-- -",
  },
  {
    label: "leading two-slot rest then note",
    timeline: [
      createTimelineSlot(0, "rest", [], 0),
      createTimelineSlot(1, "rest", [], 0),
      createTimelineSlot(2, "onset", ["C"]),
    ] as SerializedTimeline,
    expected: "- - C",
  },
  {
    label: "leading two-slot rest then sustained chord",
    timeline: [
      createTimelineSlot(0, "rest", [], 0),
      createTimelineSlot(1, "rest", [], 0),
      createTimelineSlot(2, "onset", ["C", "E", "G"], 3),
      createTimelineSlot(3, "sustain", [], 3),
      createTimelineSlot(4, "sustain", [], 3),
    ] as SerializedTimeline,
    expected: "- - [CEG]--",
  },
  {
    label: "final held note to timeline end",
    timeline: [
      createTimelineSlot(0, "onset", ["D"]),
      createTimelineSlot(1, "sustain"),
      createTimelineSlot(2, "sustain"),
      createTimelineSlot(3, "sustain"),
      createTimelineSlot(4, "sustain"),
    ] as SerializedTimeline,
    expected: "D----",
  },
  {
    label: "held note ending immediately into new onset, no gap",
    timeline: [
      createTimelineSlot(0, "onset", ["C"]),
      createTimelineSlot(1, "sustain"),
      createTimelineSlot(2, "sustain"),
      createTimelineSlot(3, "sustain"),
      createTimelineSlot(4, "onset", ["D"]),
    ] as SerializedTimeline,
    expected: "C---D",
  },
];

function createHeldNoteMidi(): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(120);

  const track = midi.addTrack();
  track.channel = 0;
  track.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.8 });

  return new Uint8Array(midi.toArray());
}

function createTimelineNote(
  vpKey: string,
): SerializedTimeline[number]["notes"][number] {
  return {
    vpKey,
  } as SerializedTimeline[number]["notes"][number];
}

function createTimelineSlot(
  slot: number,
  slotType: "onset" | "sustain" | "rest",
  notes: string[] = [],
  activeNoteCount = slotType === "rest" ? 0 : 1,
): SerializedTimeline[number] {
  return {
    slot,
    slotType,
    activeNoteCount,
    notes: notes.map(createTimelineNote),
  } as unknown as SerializedTimeline[number];
}

describe("quantize + serialize", () => {
  it("materializes sustain tails and preserves slot semantics through the last active slot", () => {
    const result = convertMidiToVp(createHeldNoteMidi(), {
      notationMode: "extended",
      quantization: { slotsPerQuarter: 4 },
    });

    const timeline = result.timeline as Array<{
      slot: number;
      slotType?: string;
      activeNoteCount?: number;
      notes: Array<{ vpKey: string }>;
    }>;

    expect(timeline).toHaveLength(4);
    expect(timeline.map((slot) => slot.slot)).toEqual([0, 1, 2, 3]);
    expect(timeline.map((slot) => slot.slotType)).toEqual([
      "onset",
      "sustain",
      "sustain",
      "sustain",
    ]);
    expect(timeline.map((slot) => slot.activeNoteCount)).toEqual([1, 1, 1, 1]);
    expect(timeline[0]?.notes).toHaveLength(1);
    expect(timeline.slice(1).every((slot) => slot.notes.length === 0)).toBe(
      true,
    );
    expect(result.notation.extended).toBe("t---");
  });

  it("quantizes timeline deterministically and serializes chords + waits in extended mode", () => {
    const result = convertMidiToVp(createMidiFixture(), {
      notationMode: "extended",
      quantization: { slotsPerQuarter: 4 },
    });

    expect(result.metadata.stepSec).toBeCloseTo(0.125, 6);
    expect(result.notation.extended).toContain("[tu]");
    expect(result.notation.extended).toBe("[tu]y - - d");
  });

  it("serializes sustain adjacency and spaced rests distinctly in extended mode", () => {
    EXTENDED_SERIALIZATION_SCENARIOS.forEach(
      ({ label, timeline, expected }) => {
        expect(serializeVpTimeline(timeline, { mode: "extended" }), label).toBe(
          expected,
        );
      },
    );
  });

  it("keeps ConversionResult.quantizedNotes sourced from raw quantized events", () => {
    const keymap = createDefaultVpKeymap();
    const result = convertMidiToVp(createDenseChordMidi(), {
      quantization: { slotsPerQuarter: 4 },
    });

    const rawQuantized = quantizeNotes(
      result.transformedNotes,
      result.metadata.stepSec,
      keymap,
    );
    const slotZero = result.timeline.find((slot) => slot.slot === 0);

    expect(result.quantizedNotes).toEqual(rawQuantized);
    expect(slotZero).toBeDefined();
    expect(result.quantizedNotes.length).toBeGreaterThan(
      slotZero!.notes.length,
    );
  });

  it("serializes compact mode without dash or rest placeholders", () => {
    const result = convertMidiToVp(createSustainMidi(), {
      notationMode: "standard",
      quantization: { slotsPerQuarter: 4 },
    });

    expect(result.notation.standard).not.toContain("-");
    expect(result.notation.standard).not.toContain("|");
    expect(result.notation.standard).toBe("ty");
  });

  it("keeps standard-mode output byte-for-byte stable for existing fixtures", () => {
    const fixtures = [
      {
        label: "mixed melody fixture",
        midi: createMidiFixture(),
        expected: "[tu]yd",
      },
      {
        label: "sustain fixture",
        midi: createSustainMidi(),
        expected: "ty",
      },
    ];

    fixtures.forEach(({ label, midi, expected }) => {
      const result = convertMidiToVp(midi, {
        notationMode: "standard",
        quantization: { slotsPerQuarter: 4 },
      });

      expect(result.notation.standard, label).toBe(expected);
    });
  });

  it("simplifies overly dense chords while keeping bass and melody anchors", () => {
    const result = convertMidiToVp(createDenseChordMidi(), {
      quantization: { slotsPerQuarter: 4 },
    });

    const slotZero = result.timeline.find((slot) => slot.slot === 0);
    expect(slotZero).toBeDefined();
    expect(slotZero!.notes.length).toBeLessThanOrEqual(3);

    const pitches = slotZero!.notes
      .map((note) => note.midi)
      .sort((a, b) => a - b);
    expect(pitches[0]).toBe(60);
    expect(pitches[pitches.length - 1]).toBe(77);
  });

  it("merges near-simultaneous duplicate notes into a single quantized event", () => {
    const keymap = createDefaultVpKeymap();
    const quantized = quantizeNotes(
      [
        {
          midi: 60,
          startSec: 0,
          durationSec: 0.24,
          endSec: 0.24,
          velocity: 0.8,
          track: 0,
          channel: 0,
        },
        {
          midi: 60,
          startSec: 0.12,
          durationSec: 0.23,
          endSec: 0.35,
          velocity: 0.9,
          track: 0,
          channel: 0,
        },
      ],
      0.25,
      keymap,
    );

    expect(quantized).toHaveLength(1);
    expect(quantized[0]).toMatchObject({
      startSlot: 0,
      durSlots: 1,
      vpKey: "t",
      velocity: 0.9,
    });
  });

  it("skips notes with non-positive duration during quantization", () => {
    const keymap = createDefaultVpKeymap();
    const quantized = quantizeNotes(
      [
        {
          midi: 60,
          startSec: 0,
          durationSec: 0,
          endSec: 0,
          velocity: 0.8,
          track: 0,
          channel: 0,
        },
        {
          midi: 62,
          startSec: 0.25,
          durationSec: -0.1,
          endSec: 0.15,
          velocity: 0.7,
          track: 0,
          channel: 0,
        },
      ],
      0.25,
      keymap,
    );

    expect(quantized).toEqual([]);
  });

  it("returns an empty timeline when no quantized notes remain", () => {
    expect(
      buildTimeline([], {
        simplifyChords: true,
        maxChordSize: 3,
      }),
    ).toEqual([]);
  });

  it("keeps long sustain tails bounded and predictable", () => {
    const midi = new Midi();
    midi.header.setTempo(120);

    const track = midi.addTrack();
    track.channel = 0;
    track.addNote({ midi: 60, time: 0, duration: 8, velocity: 0.8 });

    const result = convertMidiToVp(new Uint8Array(midi.toArray()), {
      notationMode: "extended",
      quantization: { slotsPerQuarter: 4 },
    });

    expect(result.timeline).toHaveLength(64);
    expect(result.notation.extended).toHaveLength(64);
    expect(result.notation.standard).toBe("t");
  });

  it("never emits more than three notes in a public conversion chord even when chord simplification is disabled", () => {
    const result = convertMidiToVp(createDenseChordMidi(), {
      simplifyChords: false,
      quantization: { slotsPerQuarter: 4 },
    });

    const slotZero = result.timeline.find((slot) => slot.slot === 0);
    expect(slotZero).toBeDefined();
    expect(slotZero!.notes.length).toBeLessThanOrEqual(3);
  });

  it("Guru preset (simplifyChords=false, maxChordSize=6) allows up to 6 notes per chord", () => {
    const result = convertMidiToVp(createDenseChordMidi(), {
      simplifyChords: false,
      maxChordSize: 6,
      quantization: { slotsPerQuarter: 4 },
    });

    const slotZero = result.timeline.find((slot) => slot.slot === 0);
    expect(slotZero).toBeDefined();
    expect(slotZero!.notes.length).toBeGreaterThan(3);
    expect(slotZero!.notes.length).toBeLessThanOrEqual(6);
  });

  it("Master preset (simplifyChords=false, maxChordSize=5) allows up to 5 notes per chord", () => {
    const result = convertMidiToVp(createDenseChordMidi(), {
      simplifyChords: false,
      maxChordSize: 5,
      quantization: { slotsPerQuarter: 4 },
    });

    const slotZero = result.timeline.find((slot) => slot.slot === 0);
    expect(slotZero).toBeDefined();
    expect(slotZero!.notes.length).toBeGreaterThan(3);
    expect(slotZero!.notes.length).toBeLessThanOrEqual(5);
  });

  it("Adept preset (simplifyChords=true, maxChordSize=4) allows up to 4 notes per chord", () => {
    const result = convertMidiToVp(createDenseChordMidi(), {
      simplifyChords: true,
      maxChordSize: 4,
      quantization: { slotsPerQuarter: 4 },
    });

    const slotZero = result.timeline.find((slot) => slot.slot === 0);
    expect(slotZero).toBeDefined();
    expect(slotZero!.notes.length).toBeGreaterThan(3);
    expect(slotZero!.notes.length).toBeLessThanOrEqual(4);
  });

  describe("formatting boundary logic", () => {
    it("inserts space at groupSlots boundary in extended mode", () => {
      const timeline = [
        createTimelineSlot(0, "onset", ["C"]),
        createTimelineSlot(1, "sustain"),
        createTimelineSlot(2, "onset", ["D"]),
        createTimelineSlot(3, "sustain"),
      ] as SerializedTimeline;

      const result = serializeVpTimeline(timeline, {
        mode: "extended",
        format: { groupSlots: 2 },
      });

      expect(result).toBe("C- D-");
    });

    it("inserts newline at lineBreakEveryGroups boundary in extended mode", () => {
      const timeline = [
        createTimelineSlot(0, "onset", ["C"]),
        createTimelineSlot(1, "sustain"),
        createTimelineSlot(2, "onset", ["D"]),
        createTimelineSlot(3, "sustain"),
        createTimelineSlot(4, "onset", ["E"]),
        createTimelineSlot(5, "sustain"),
      ] as SerializedTimeline;

      const result = serializeVpTimeline(timeline, {
        mode: "extended",
        format: { groupSlots: 2, lineBreakEveryGroups: 2 },
      });

      expect(result).toBe("C- D-\nE-");
    });

    it("preserves space before onset after rest with grouping enabled", () => {
      const timeline = [
        createTimelineSlot(0, "onset", ["C"]),
        createTimelineSlot(1, "rest", [], 0),
        createTimelineSlot(2, "onset", ["D"]),
      ] as SerializedTimeline;

      const result = serializeVpTimeline(timeline, {
        mode: "extended",
        format: { groupSlots: 1 },
      });

      expect(result).toBe("C - D");
    });

    it("returns unformatted output when format is null", () => {
      const timeline = [
        createTimelineSlot(0, "onset", ["C"]),
        createTimelineSlot(1, "sustain"),
        createTimelineSlot(2, "sustain"),
        createTimelineSlot(3, "onset", ["D"]),
      ] as SerializedTimeline;

      const result = serializeVpTimeline(timeline, {
        mode: "extended",
        format: null,
      });

      expect(result).toBe("C--D");
    });
  });
});
