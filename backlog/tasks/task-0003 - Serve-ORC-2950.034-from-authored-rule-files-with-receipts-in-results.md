---
id: TASK-0003
title: 'Serve ORC 2950.034 from authored rule files, with receipts in results'
status: To Do
assignee: []
created_date: '2026-08-04 15:59'
labels:
  - 'area:legal'
  - 'kind:feature'
  - 'x:safety'
milestone: m-1
dependencies:
  - TASK-0002
references:
  - 'https://codes.ohio.gov/ohio-revised-code/section-2950.034'
  - 'https://caselaw.findlaw.com/court/oh-supreme-court/1158112.html'
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move rule content out of code and into authored files compiled to Postgres, and show the user which rule flagged their address, as of when, verified by whom.

Ships as one PR because the intermediate states are not honestly shippable. A schema and ETL with nothing consuming them is dead code; rules half in files and half in code is the half-migrated state the deployability rule forbids. The user-visible outcome is single and coherent: results now carry receipts.

Current statute text (effective 2023-10-03, HB 33) prohibits establishing residence within 1,000 feet of school premises, preschool or child care center premises, children's crisis care facility premises, or residential infant care center premises. Prior amendments: 2007-07-01 (SB 10), 2022-06-13 (HB 265).

Two features of the statute must be captured as rule data rather than as UI copy. It conditions protection on premises having proper signage and complying with local zoning — not determinable from any dataset, so per Principle I we resolve toward restriction and disclose. And enforcement includes a private right of action: any owner or lessee within 1,000 feet may seek injunctive relief without showing irreparable harm, so the risk is not only from police.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Rule content lives in authored files under version control and is compiled to Postgres on deploy
- [ ] #2 Deploy truncates and fully reloads rule tables; no incremental sync path exists
- [ ] #3 A rule row hand-edited in the database is replaced by the next deploy, verified by test
- [ ] #4 Build fails on schema violation, unresolvable citation, or verification past the staleness threshold
- [ ] #5 ORC 2950.034 expressed as human-verified records covering all four protected facility classes
- [ ] #6 Signage/zoning qualification and private right of action recorded as rule data, not hardcoded copy
- [ ] #7 Results show the flagging rule with citation, working source link, effective date, and verified-on date
- [ ] #8 Application behavior is unchanged from the user perspective except that answers now carry receipts
<!-- AC:END -->
