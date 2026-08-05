---
id: TASK-0019
title: Finish the rename in the file git treated as binary
status: Done
assignee: []
created_date: '2026-08-05 22:01'
updated_date: '2026-08-05 22:01'
labels:
  - 'kind:debt'
dependencies: []
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-0018 renamed 603 references across 70 files and missed one. app/scripts/scan-external-origins.mjs still said somap's shipped assets. The cause is the interesting part: the rename's file list came from git grep -lI, and -I skips files git considers binary, which it decides by finding a NUL byte in the first 8000. That script carried a literal 0x00 written directly into source as the delimiter of a composite Set key, so it was excluded from every substitution silently. Nothing failed, and git diff reported Binary files differ rather than showing the line, so review could not have caught it either. Fixed both the stale reference and its cause: the raw NUL became the escape sequence, which is behaviourally identical - the string still holds one NUL, so the key still cannot collide with a path containing the separator - while making the file text, so it is greppable and its diffs are reviewable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No reference to the old project name remains outside migration 014 and the upgrade section of the self-hosting document
- [x] #2 The file is text to git: git grep -lI matches it where it previously did not
- [x] #3 The composite key still uses a NUL separator, so behaviour is unchanged
- [x] #4 node --check passes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Renamed the one reference TASK-0018 missed and removed the cause. The file carried a literal NUL byte, so git classified it binary and git grep -lI silently excluded it from the rename; the NUL is now the escape sequence, which keeps the separator semantics and makes the file text. Verified: git grep -lI now matches the file where it previously did not, node --check passes, and no old-name reference remains outside migration 014 and the self-hosting upgrade section, both of which name it deliberately. Landed as PR #14.
<!-- SECTION:FINAL_SUMMARY:END -->
