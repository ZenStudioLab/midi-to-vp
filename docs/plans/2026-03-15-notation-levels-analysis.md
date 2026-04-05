# midi-to-vp Enhancement Plan

**Branch**: `feature/comprehensive-enhancement`  
**Base**: `develop`  
**Scope**: Notation mode unification, difficulty presets, dash character support, sheet analysis service, test server UI

---

## 1. Notation Mode Unification

### Current State
- `src/serialize.ts` uses "zen" terminology for compact notation
- Only two modes exist: "zen" (compact) and "extended" (note names with octaves)
- No formal "Standard" 61-key mode
- Historical assumption: dash character (`-`) in extended mode represents empty time slots

Superseded note: the finalized contract is documented in `docs/plans/active/2026-04-03-preserve-pause-vs-sustain-notation.md`. Extended notation now uses adjacent dashes for sustain continuation and space-separated dash groups for rest or pause.

### Target Architecture

**Three Notation Modes**:

1. **Minimal** (36-key, formerly "zen")
   - Format: `a s d [asf]` (single chars)
   - Range: 36 keys mapped to `[a-z][0-9]`
   - Use: Most compact, single-octave melodies
   - **No dash support**

2. **Standard** (61-key)
   - Format: QWERTY keyboard mapping to notes
   - Range: 61 keys (5 octaves, standard piano range)
   - Use: Full piano range with compact notation
   - **No dash support**

3. **Extended** (61-key)
   - Format: Same as Standard + dash character support
   - Range: 61 keys (5 octaves, standard piano range)
   - Use: Standard notation with rhythmic gaps/sustains
   - **Dash behavior**:
   - After note: `a-` extends previous note duration through sustain continuation
   - Standalone: `a - d` creates a real rest or pause between notes

### Implementation Tasks

#### Task 1.1: Rename "zen" → "minimal"yarn
**TDD Steps**:
1. Write test: `describe('notation mode terminology')` expecting "minimal" not "zen"
2. Watch fail: Tests should fail with "zen" references
3. Refactor: Global find/replace "zen" → "minimal" in:
   - `src/types.ts`: `VpNotationMode = 'minimal' | 'standard' | 'extended'`
   - `src/serialize.ts`: Update mode checks and variable names
   - `src/convert.ts`: Update default mode references
   - `README.md`: Update all documentation
4. Verify green: All tests pass with new terminology

**Files to Modify**:
- `src/types.ts`
- `src/serialize.ts`
- `src/convert.ts`
- `README.md`
- All test files referencing "zen"

**Risk**: Breaking existing integrations that pass `notationMode: 'zen'`  
**Mitigation**: No backward compatibility required per user directive. Document breaking change in CHANGELOG.

#### Task 1.2: Implement Standard Mode (61-key)
**TDD Steps**:
1. Write test: `convertMidiToVp` with `notationMode: 'standard'` expects 61-key QWERTY output
2. Watch fail: "standard" mode not recognized
3. Implement:
   - Add 61-key QWERTY keymap in `src/serialize.ts`
   - Extend serialization logic to handle standard mode
   - **No dash emission** in standard mode (dashes reserved for extended)
4. Verify green: Standard mode converts correctly

**Files to Create/Modify**:
- `src/serialize.ts` - add 61-key QWERTY keymap
- `tests/integration/notation-modes.test.ts` - comprehensive mode tests

**Risk**: QWERTY keymap doesn't align with extension parser expectations  
**Mitigation**: Coordinate with extension team on shared keymap constants. Integration test both directions.

#### Task 1.3: Add Dash Character Support in Extended Mode
**TDD Steps**:
1. Write test: Extended mode with timeline gaps expects `-` characters in output
2. Watch fail: No dash characters generated
3. Implement: Update `src/serialize.ts` to emit `-` for empty timeline slots in extended mode
4. Verify green: Dash characters appear correctly

**Files to Modify**:
- `src/serialize.ts` - add dash emission logic for empty slots
- `tests/unit/serialize.test.ts` - test dash character placement

**Dash Character Semantics** (Extended Mode Only):
- **After note**: `a-` extends previous note duration by 0.5 beats
- **Standalone**: `a - d` represents empty beat (rest/gap)
- **Minimal/Standard modes**: No dash character support (parser should warn/ignore)

Superseded wording: this section originally framed all empty slots as dash placeholders. The finalized sustain/rest split now treats adjacent dashes as sustain and spaced dash groups as rests.

**Risk**: Confusion between sustain and empty slot semantics  
**Mitigation**: Clear documentation. Extended mode uses adjacent `-` for sustain continuation and spaced `-` groups for rests.

---

## 2. Difficulty Preset System

### Current State
- Technical options exposed: `notationMode`, `slotsPerQuarter`, `maxChordSize`, etc.
- No player-friendly difficulty levels
- Users must understand MIDI quantization concepts

### Target UX Level System

| Level | Notation | Slots/Quarter | Simplify | Max Chord | Dedupe | Target Audience |
|-------|----------|---------------|----------|-----------|--------|-----------------||
| **Novice** | minimal | 2 | true | 2 | true | First-time players, simple melodies |
| **Apprentice** | minimal | 4 | true | 3 | true | Learning basics, slow practice |
| **Adept** | standard | 4 | true | 4 | true | Comfortable players, moderate pieces |
| **Master** | extended | 8 | false | 5 | true | Advanced players, complex rhythms |
| **Guru** | extended | 8 | false | 6 | false | Expert players, full fidelity |

### Implementation Tasks

#### Task 2.1: Create Preset System
**TDD Steps**:
1. Write test: `getDifficultyPreset('Novice')` returns expected config
2. Watch fail: Function doesn't exist
3. Implement `src/presets.ts`:
   ```typescript
   export type DifficultyLevel = 'Novice' | 'Apprentice' | 'Adept' | 'Master' | 'Guru';
   export interface DifficultyPreset {
     notationMode: VpNotationMode;
     slotsPerQuarter: number;
     simplify: boolean;
     maxChordSize: number;
     dedupe: boolean;
   }
   export const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultyPreset>;
   export function getDifficultyPreset(level: DifficultyLevel): DifficultyPreset;
   ```
4. Verify green: All presets return correct configurations

**Files to Create**:
- `src/presets.ts` - preset definitions and getter
- `tests/unit/presets.test.ts` - verify all 5 presets

**Risk**: Preset values not well-tuned for actual playability  
**Mitigation**: Test with real MIDI files at each level. Iterate based on playback quality.

#### Task 2.2: Integrate Presets into Conversion API
**TDD Steps**:
1. Write test: `convertMidiWithLevel(buffer, { level: 'Adept' })` uses Adept preset
2. Watch fail: Function doesn't exist
3. Implement convenience wrapper:
   ```typescript
   export function convertMidiWithLevel(
     input: Buffer | string,
     options: { level: DifficultyLevel } & Partial<ConversionOptions>
   ): ConversionResult
   ```
4. Verify green: Preset merges with custom overrides correctly

**Files to Modify**:
- `src/convert.ts` - add `convertMidiWithLevel` wrapper
- `src/index.ts` - export new function
- `tests/integration/presets.test.ts` - end-to-end preset conversion

**Risk**: Preset overrides not merging correctly with custom options  
**Mitigation**: Test override precedence. Custom options should override preset values.

---

## 3. Sheet Analysis Service

### Current State
No service exists to analyze Virtual Piano notation and recommend difficulty levels.

### Analysis Algorithm

Calculates 4 metrics, each scored 0-100:

1. **Note Density Score**
   - Notes per second average
   - Peak density in busiest measures
   - Rest proportion (more rests = easier)

2. **Chord Complexity Score**
   - Maximum chord size observed
   - Chord frequency (% of notes in chords)
   - Wide interval jumps between chord notes

3. **Rhythmic Complexity Score**
   - Required quantization resolution (32nd notes = harder)
   - Syncopation patterns
   - Tempo changes/rubato

4. **Range Score**
   - Total octave span used
   - Hand position changes
   - Distance of jumps between notes

5. **Overall Difficulty Mapping**:
   - 0-20: Novice
   - 21-40: Apprentice
   - 41-60: Adept
   - 61-80: Master
   - 81-100: Guru

### Implementation Tasks

#### Task 3.1: Build Analysis Engine
**TDD Steps**:
1. Write test: `analyzeVpNotation(simpleNotation)` returns low density/complexity scores
2. Watch fail: Function doesn't exist
3. Implement `src/analyze.ts`:
   ```typescript
   export interface AnalysisResult {
     noteDensity: number;
     chordComplexity: number;
     rhythmicComplexity: number;
     rangeScore: number;
     overallScore: number;
     recommendedLevel: DifficultyLevel;
     confidence: number;
   }
   export function analyzeVpNotation(notation: string): AnalysisResult;
   ```
4. Verify green: Simple melodies score low, complex pieces score high

**Files to Create**:
- `src/analyze.ts` - analysis implementation
- `tests/unit/analyze.test.ts` - test each metric independently
- `tests/integration/analyze.test.ts` - test with real converted notation

**Test Cases**:
- Silent/empty notation → all scores = 0
- Single note melody → low density, no chords, low range
- Dense arpeggio → high density, low chords, high rhythm
- Chord progression → low density, high chords, low rhythm
- Complex piece → high all metrics

**Risk**: Analysis algorithm too simplistic or inaccurate  
**Mitigation**: Start with simple heuristics. Iterate based on real-world testing. Add confidence score to indicate uncertainty.

#### Task 3.2: Export Analysis API
**TDD Steps**:
1. Write test: Import `analyzeVpNotation` from package succeeds
2. Watch fail: Not exported
3. Add to `src/index.ts` exports
4. Verify green: API is publicly available

**Files to Modify**:
- `src/index.ts` - export analysis function and types
- `README.md` - document analysis API

---

## 4. Test Server UI Enhancements

### Current State
- Basic upload and convert workflow
- Only exposes low-level technical options
- No analysis or preset selection

### Target UX Flow

1. User uploads MIDI file
2. **Analysis runs automatically** → shows metrics + recommended level
3. User selects difficulty level (Novice/Apprentice/Adept/Master/Guru) - **default = recommended**
4. User selects notation mode (Minimal/Standard/Extended) - **default from preset**
5. Advanced options panel available (optional overrides)
6. Convert button uses selected preset + overrides
7. Results show: notation output, analysis breakdown, preset used

### Implementation Tasks

#### Task 4.1: Add Notation Mode Selector
**TDD Steps**:
1. Write Playwright test: Select "Standard" mode, verify it's used in conversion
2. Watch fail: No mode selector exists
3. Implement: Add radio/dropdown with 3 modes (Minimal, Standard, Extended)
4. Verify green: Selected mode applies to conversion

**Files to Modify**:
- `test-server/src/App.tsx` - add mode selector UI
- `test-server/src/components/ConversionOptions.tsx` (if exists)

#### Task 4.2: Add Difficulty Preset Selector
**TDD Steps**:
1. Write Playwright test: Select "Guru" preset, verify high fidelity output
2. Watch fail: No preset selector exists
3. Implement: Add preset selector with all 5 levels + descriptions
4. Verify green: Preset values apply correctly

**Files to Modify**:
- `test-server/src/App.tsx` - add preset selector
- `test-server/src/components/PresetSelector.tsx` (new component)

**UI Requirements**:
- Display preset table (like markdown table above) for user reference
- Show selected preset's parameters in real-time
- Allow overrides in advanced panel

#### Task 4.3: Integrate Analysis Display
**TDD Steps**:
1. Write test: Upload MIDI → analysis panel appears with scores
2. Watch fail: No analysis panel
3. Implement: Call `analyzeVpNotation` on conversion result, display metrics
4. Verify green: Analysis shows before user selects preset

**Files to Modify**:
- `test-server/src/App.tsx` - add analysis workflow
- `test-server/src/components/AnalysisPanel.tsx` (new component)

**UI Requirements**:
- Show 4 metric scores as progress bars (0-100)
- Display overall score and recommended level prominently
- Auto-select recommended preset but allow override
- Show confidence indicator if recommendation uncertain

#### Task 4.4: Update Conversion Result Display
**TDD Steps**:
1. Write test: After conversion, verify notation output + analysis + preset metadata shown
2. Watch fail: Missing metadata display
3. Implement: Enhanced result view with tabs or sections
4. Verify green: All conversion data visible

**Files to Modify**:
- `test-server/src/App.tsx` - update result rendering
- `test-server/src/components/ResultsView.tsx` (refactor)

**Display Sections**:
1. **Notation Output** (copyable text area)
2. **Analysis Breakdown** (metric details)
3. **Conversion Metadata** (preset used, overrides, transpose info)
4. **Download Options** (notation file, JSON result)

---

## 5. Documentation Updates

### Files to Update

**README.md**:
- Document notation mode changes (zen → minimal)
- Add difficulty preset table
- Show API examples for `convertMidiWithLevel` and `analyzeVpNotation`
- Update CLI usage examples

**CHANGELOG.md**:
- Add BREAKING CHANGE note for "zen" → "minimal" rename
- List new features: presets, analysis, standard mode, dash support

**test-server/README.md** (if exists):
- Document new UI workflow
- Show screenshots of preset/analysis panels

---

## 6. Testing Strategy

### Unit Tests
- `tests/unit/presets.test.ts` - all 5 presets return valid configs
- `tests/unit/analyze.test.ts` - each metric calculation isolated
- `tests/unit/serialize.test.ts` - dash character emission in extended mode
- `tests/unit/notation-modes.test.ts` - minimal/standard/extended serialization

### Integration Tests
- `tests/integration/presets.test.ts` - end-to-end conversion with each preset
- `tests/integration/analyze.test.ts` - analysis on real converted notation
- `tests/integration/dash-support.test.ts` - dash characters in extended mode workflow

### E2E Tests (Playwright)
- Upload MIDI → analysis → preset selection → conversion → download
- Switch between notation modes and verify output changes
- Override preset values and verify overrides apply
- Edge cases: empty MIDI, corrupted files, extreme complexity

### Performance Benchmarks
- Analysis must complete < 100ms for typical sheet (500-1000 notes)
- Conversion with analysis overhead should stay < 500ms total

### Coverage Target
- Minimum 80% branch coverage on new code
- 100% coverage on preset logic (critical path)

---

## 7. Risk Analysis

### High Risk

**Risk**: Breaking change (zen → minimal) breaks external integrations  
**Impact**: High - External tools using the package may break  
**Probability**: High - Common parameter name  
**Mitigation**: 
- Document clearly in CHANGELOG with migration guide
- Bump major version (semver MAJOR.minor.patch)
- No backward compatibility shim (per user directive)

**Risk**: Analysis algorithm produces poor recommendations  
**Impact**: Medium - Users lose trust in auto-suggestions  
**Probability**: Medium - Heuristics may not capture all complexity  
**Mitigation**:
- Start conservative (bias toward easier levels)
- Show confidence score so users know when to override
- Collect feedback and iterate algorithm
- Always allow manual override

### Medium Risk

**Risk**: Standard mode keymap doesn't align with extension parser expectations  
**Impact**: Medium - Incompatible notation between midi-to-vp and extension  
**Probability**: Low - Can verify with integration tests  
**Mitigation**:
- Share keymap constants if possible
- Cross-test: midi-to-vp output → extension parser → playback
- Document expected keymap in both repos

**Risk**: Dash character semantics cause confusion  
**Impact**: Medium - Users misunderstand notation behavior  
**Probability**: Medium - Two different meanings for same character  
**Mitigation**:
- Clear documentation separating minimal/standard vs extended dash semantics
- Add examples showing both use cases
- Consider different character for extended mode (future breaking change)

### Low Risk

**Risk**: Test server UI becomes cluttered with too many options  
**Impact**: Low - UX degradation but functional  
**Probability**: Low - Design with progressive disclosure  
**Mitigation**:
- Use collapsible "Advanced Options" panel
- Default to preset selection (simple choice)
- Hide technical options unless needed

**Risk**: Preset values not optimal for all musical genres  
**Impact**: Low - Sub-optimal conversion quality  
**Probability**: Medium - Presets are generalized  
**Mitigation**:
- Presets are starting points, not prescriptive
- Always allow overrides
- Document preset rationale in code comments
- Iterate based on user feedback

---

## 8. Implementation Phases

### Phase 1: Foundation (Days 1-2)
1. Rename zen → minimal (Task 1.1)
2. Add standard mode support (Task 1.2)
3. Create preset system (Task 2.1)
4. Unit tests for above

### Phase 2: Analysis Service (Days 3-4)
5. Build analysis engine (Task 3.1)
6. Integrate into API (Task 3.2)
7. Unit + integration tests

### Phase 3: Dash Support (Day 5)
8. Add dash character emission (Task 1.3)
9. Test extended mode dash behavior

### Phase 4: Test Server (Days 6-7)
10. Add notation mode selector (Task 4.1)
11. Add difficulty preset selector (Task 4.2)
12. Integrate analysis display (Task 4.3)
13. Update results view (Task 4.4)
14. E2E Playwright tests

### Phase 5: Documentation & Polish (Day 8)
15. Update all docs
16. Performance optimization if needed
17. Final testing pass

---

## 9. Success Criteria

✅ **Complete** when:
1. All "zen" references replaced with "minimal"
2. Three notation modes (minimal, standard, extended) working
3. All 5 difficulty presets (Novice → Guru) functional
4. Analysis service returns accurate recommendations (<10% error rate on test corpus)
5. Test server UI shows: mode selector, preset selector, analysis panel
6. Dash characters emit correctly in extended mode
7. All tests pass with ≥80% coverage
8. Documentation complete and accurate
9. Performance: analysis < 100ms, total conversion < 500ms
10. No regressions in existing conversion quality
