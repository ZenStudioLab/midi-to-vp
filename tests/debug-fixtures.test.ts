import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { tryConvertMidiToVp, scoreConversionQuality } from "../src/index";

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

describe("debug fixture signals", () => {
  it("inspect all fixtures", () => {
    for (const [name, path] of Object.entries(MUSESCORE_FIXTURES)) {
      const midiBuffer = readFileSync(path);
      const result = tryConvertMidiToVp(new Uint8Array(midiBuffer));
      if (result.ok) {
        const s = result.metadata.qualitySignals;
        const densityRatio =
          s.maxNotesPerSecond / Math.max(s.p95NotesPerSecond, 1);
        const chordRatio = s.peakChordSize / Math.max(s.p95ChordSize, 1);
        console.log(name + ":");
        console.log(
          "  maxNotesPerSecond:",
          s.maxNotesPerSecond,
          "p95NotesPerSecond:",
          s.p95NotesPerSecond,
          "densityRatio:",
          densityRatio.toFixed(3),
        );
        console.log(
          "  peakChordSize:",
          s.peakChordSize,
          "p95ChordSize:",
          s.p95ChordSize,
          "chordRatio:",
          chordRatio.toFixed(3),
        );

        const assessment = scoreConversionQuality(s);
        console.log(
          "  score:",
          assessment.score,
          "reasons:",
          assessment.reasons,
        );
        console.log("  artifactCapped:", assessment.stats.artifactCapped);
      }
    }
    expect(true).toBe(true);
  });
});
