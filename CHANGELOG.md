# Changelog

## Unreleased

### Changed

- Extended notation now emits adjacent dashes for sustain continuation and space-separated dash groups for rest/pause. Consumers that strip whitespace before parsing extended notation strings must update their parsers.
- `ConversionResult.timeline` is documented as explicit onset, sustain, and rest slots via `slotType` and `activeNoteCount`.
