# Lesson Decision Records

This directory contains lessons learned from mistakes, bugs, and debugging sessions during the development of `@zen/midi-to-vp`.

## Purpose

Lessons are recorded following the [lesson-decision-records skill](https://github.com/skills/lesson-decision-records) format to build institutional memory and prevent recurring issues.

## When to Record a Lesson

### ✅ Record When:
- **Significant Bug**: Required >30 minutes debugging or revealed non-obvious issue
- **Anti-Pattern Discovered**: Code violated best practices in subtle ways
- **Performance Issue**: Non-trivial optimization or scalability problem
- **Security Vulnerability**: Any security-related mistake, regardless of size
- **Race Condition/Async**: Concurrency bugs, timing issues, promise chains
- **Incorrect Assumption**: Wrong understanding of library/framework/API behavior
- **Design Flaw**: Refactor revealed architectural problems
- **Data Loss/Corruption**: Any issue that affected data integrity

### ❌ Do NOT Record When:
- Simple typos or syntax errors
- Trivial fixes (< 5 minutes)
- Standard dependency updates
- Minor style/formatting changes
- Following explicit user instructions (not a mistake)

## Naming Convention

Lessons follow sequential numbering: `NNNN-slug.md`

- **NNNN**: Zero-padded 4-digit sequence (0001, 0002, etc.)
- **slug**: kebab-case descriptive name
- **Extension**: Always `.md`

**Examples**:
- `0001-tonejs-midi-tempo-parsing.md`
- `0002-quantization-floating-point-precision.md`
- `0003-chord-simplification-edge-case.md`

## Lesson Template

Each lesson file contains:

```markdown
---
type: lesson
scope: project
tags: [category1, category2, category3]
date: YYYY-MM-DD
severity: [low|medium|high]
---

# [Descriptive Title]

## 1. Context
Brief summary of the task and initial approach.

## 2. Mistake
What went wrong and how it manifested.

## 3. Root Cause
Technical explanation of WHY the mistake occurred.

## 4. Correction
The solution that resolved the issue.

## 5. Prevention Rule
Actionable rule for future sessions.
```

## Severity Levels

### High Severity
- Data loss or corruption
- Security vulnerabilities
- Breaking changes to public API
- MIDI parsing errors affecting correctness
- Incorrect notation output

### Medium Severity
- Performance degradation (>2x slowdown)
- Incorrect business logic implementation
- API misuse causing errors
- Test failures in critical paths

### Low Severity
- Code style violations with functional impact
- Minor refactoring needs
- Suboptimal but working implementations
- Documentation gaps

## Tag Taxonomy

**General**: `async`, `types`, `error-handling`, `nullability`  
**MIDI**: `midi-parsing`, `tonejs-midi`, `tempo`, `time-signature`  
**Conversion**: `quantization`, `transpose`, `keymap`, `notation`  
**Testing**: `testing`, `vitest`, `test-data`, `edge-cases`  
**Performance**: `performance`, `optimization`, `memory`  
**Build**: `typescript`, `esm`, `cjs`, `build-system`

## Index

Currently, no lessons have been recorded. This section will be updated as lessons are added.

<!-- 
## High Severity

| ID | Title | Tags | Date |
|----|-------|------|------|

## Medium Severity

| ID | Title | Tags | Date |
|----|-------|------|------|

## Low Severity

| ID | Title | Tags | Date |
|----|-------|------|------|
-->

## For AI Sessions

Before implementing changes to the conversion pipeline, review lessons tagged with:
- `quantization` - Time quantization issues
- `midi-parsing` - MIDI parsing gotchas
- `notation` - Notation formatting issues
- `transpose` - Transpose logic problems

Before adding new features, check lessons related to the affected module.
