---
name: process-output-seal
description: After startup the request process replaces stdout, stderr, and every console method with discards, so no dependency can log a searched address — a property of the process rather than an audit of the code.
kind: pattern
sources:
  - app/server/silence.ts
  - app/server/entry.ts
  - app/app/entry.server.tsx
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Process output seal

`app/server/silence.ts` makes the request process incapable of writing to its own output
after the server starts listening. This is deliberately blunt rather than careful, and the
file explains why: auditing tarrow's own code was never the problem.

## How it works

The log-capture test drove a probe address at the running composition and read it back out
of `docker logs`, printed by dependencies — React Router's default `handleError`
(`console.error` of an error reading `No route matches URL "/search/<address>"`), its default
root error boundary re-printing the same object during SSR, and
`@mjackson/node-fetch-server`'s `defaultErrorHandler`, reached through a
`createRequestListener` that does not expose the `onError` option that would replace it.

Each was closed at its source, but three existed in one 7.x minor of one framework and a
fourth arrives with any dependency bump, in a file nobody here wrote. So the process is
sealed instead.

`sealProcessOutput()` is idempotent, called once from `entry.ts` inside the `listen`
callback after the startup line. It replaces `process.stdout.write` and
`process.stderr.write` with a `discard` function, and overwrites fifteen `console` methods
with a no-op — console is replaced separately because it buffers and formats independently
of the streams in some Node paths. `discard` honours the write callback (a caller awaiting
drain would otherwise hang holding a request open) and reports success, because a writer told
its write failed may retry, escalate, or throw, none of which is quieter than discarding.

`writeSealedLine(line)` is the escape hatch, reserved for fixed constants — the startup line
and the crash line. It takes a whole line rather than a format string specifically so there
is no interpolation point: a caller wanting to pass something else would have to write the
concatenation where a reviewer reads it.

The ETL and migration runner are **not** sealed. They are separate processes with separate
entrypoints, they need to report row counts and assertion failures, and neither is ever
given an address somebody typed.

## Connections

- [[http-envelope]] holds the crash line and the failure bodies this seal leaves as the only
  output.
- [[search-orchestration]] returns a `search-failed` result carrying the manifest, which is
  what a reader gets instead of a log line.
- [[privacy-verification]] §3 is the outside check; [[test-suite]] contains the log-capture
  test that found the three framework sites.
- [[database-logging-posture]] is the same posture applied to PostgreSQL.

## Operational notes

The cost is stated plainly in the file: a fault in the running server is not diagnosable
from its output. That is the same trade `entry.ts` makes for uncaught exceptions and
`app/app/entry.server.tsx` makes for render errors, for the same reason — an error report
that *usually* omits the address is a control an outsider cannot check.
