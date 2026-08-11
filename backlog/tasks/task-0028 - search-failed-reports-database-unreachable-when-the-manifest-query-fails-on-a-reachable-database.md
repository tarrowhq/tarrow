---
id: TASK-0028
title: >-
  search-failed reports database-unreachable when the manifest query fails on a
  reachable database
status: To Do
assignee: []
created_date: '2026-08-11 19:02'
labels:
  - 'area:api'
  - 'kind:debt'
dependencies: []
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
app/server/search.ts returns reason 'database-unreachable' from two different branches: when pool.connect() fails (line ~213) and when readManifest() throws for any reason other than a missing rule disclosure (line ~234). The second case fires on a perfectly reachable database whose manifest QUERY failed -- a missing column, a permissions problem, a malformed row.

That is what happened on demo.tarrow.org during TASK-0027: coverage_gaps.label did not exist, the manifest query errored, and the page reported 'database-unreachable' while the database was up and answering everything else. The infra agent investigating it had to rule out connectivity before finding a schema problem, and the reason string is what pointed them the wrong way.

The user-facing copy is fine and should not change -- 'The coverage record could not be read. Nothing was checked.' is accurate and appropriately non-technical. It is the machine-readable reason, which exists for whoever is debugging the instance, that names the wrong cause.

SearchFailureReason is a closed union in result.ts ('database-unreachable' | 'query-failed'). A third variant such as 'manifest-unreadable' would distinguish the cases; note that 'query-failed' is already taken by the missing-rule-disclosure branch, so reusing it would collapse a different distinction. Check app/tests/result-type.test.ts and the copy gates before widening the union -- the result type is a compile-time gate and adding a variant is deliberately not free.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A failure to read the manifest on a reachable database is distinguishable, in the machine-readable reason, from a failure to reach the database
- [ ] #2 The user-facing copy for both cases is unchanged, or changed only with the copy gates still passing
- [ ] #3 The result-type gate still rejects any variant that reads as permission, and the closed union is still exhaustively checked
<!-- AC:END -->
