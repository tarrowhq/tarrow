// After startup, the request process cannot write to its own output. At all.
//
// WHY THIS IS BLUNT INSTEAD OF CAREFUL
//
// Phase 3 left server/search.ts writing nothing, and Phase 4 audited the rest
// of server/ the same way. That is an argument about somap's code, and somap's
// code was never the problem. The log-capture test drove a probe address at the
// running composition and read it straight back out of `docker logs`, printed
// by dependencies:
//
//   1. React Router's default `handleError`: console.error(error), where the
//      error is `No route matches URL "/search/8675309%20ZZYZX%20..."`.
//   2. Its default root error boundary, which console.error's the same object
//      again while server-rendering the 404 page.
//   3. `@mjackson/node-fetch-server`'s defaultErrorHandler -- reached through
//      `@react-router/node`'s createRequestListener, which does not expose the
//      `onError` option that would replace it.
//
// Each was closed at its source (app/app/entry.server.tsx, the root
// ErrorBoundary, the wrapper in server/http.ts). But three of them existed in
// one 7.x minor of one framework, and a fourth arrives with any dependency
// bump, silently, in a file nobody in this repository wrote. Auditing every
// console call in every transitive dependency on every upgrade is not a
// control anybody will keep performing, and Principle III's whole demand is
// that privacy be verifiable rather than promised.
//
// So the process is sealed instead. Nothing loaded into it -- somap's code, a
// framework, a driver, a future dependency nobody has chosen yet -- can put a
// byte on stdout or stderr, because the functions that do that have been
// replaced. "No searched address appears in any log stream" stops being a
// property that must be re-audited and becomes a property of the process.
//
// WHAT IS GIVEN UP, STATED PLAINLY
//
// A fault in the running server is not diagnosable from its output. That is
// the same trade server/entry.ts makes for uncaught exceptions and
// app/app/entry.server.tsx makes for render errors, and it is made for the
// same reason: an error report that USUALLY omits the address is a control an
// outsider cannot check. What a reader gets instead is honest --
// server/search.ts returns a `search-failed` result carrying the coverage
// manifest, and server/http.ts answers with a fixed body. Both say what
// failed. Neither says what was searched.
//
// The ETL and the migration runner are NOT sealed. They are separate processes
// with separate entrypoints (etl/ingest.ts, server/migrate.ts), they need to
// report row counts and assertion failures, and neither is ever given an
// address somebody typed.
//
// docs/privacy/verification.md §3 shows how to check the seal from outside:
// request a path that does not exist, then read `docker compose logs app` and
// find nothing.

type Chunk = string | Uint8Array;
type WriteCallback = (error?: Error | null) => void;

let sealed = false;
let escapeHatch: ((line: string) => void) | null = null;

/**
 * Write one line to the real stderr, bypassing the seal.
 *
 * Reserved for FIXED CONSTANTS only -- the startup line and the crash line.
 * It takes a whole line rather than a format string precisely so that there is
 * no interpolation point: every caller in this repository passes a literal, and
 * a caller that wanted to pass something else would have to write the
 * concatenation somewhere a reviewer reads.
 */
export function writeSealedLine(line: string): void {
  if (escapeHatch) {
    escapeHatch(line + "\n");
    return;
  }
  // Before the seal is installed, the real stream is still the real stream.
  process.stderr.write(line + "\n");
}

/**
 * Replace this process's output with functions that discard.
 *
 * Idempotent. Call once, after the last startup message and before the server
 * accepts a connection.
 */
export function sealProcessOutput(): void {
  if (sealed) return;
  sealed = true;

  const realStderrWrite = process.stderr.write.bind(process.stderr);
  escapeHatch = (line: string) => {
    realStderrWrite(line);
  };

  // Honour the callback, or a caller awaiting drain hangs forever holding a
  // request open. Report success: a writer told its write failed may retry,
  // escalate, or throw, and none of those is quieter than discarding.
  const discard = (
    _chunk: Chunk,
    encodingOrCallback?: BufferEncoding | WriteCallback,
    callback?: WriteCallback,
  ): boolean => {
    const cb =
      typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
    if (typeof cb === "function") process.nextTick(cb);
    return true;
  };

  process.stdout.write = discard as typeof process.stdout.write;
  process.stderr.write = discard as typeof process.stderr.write;

  // console methods buffer and format independently of the streams above in
  // some Node paths, so they are replaced too rather than assumed to route
  // through them.
  const noop = (): void => undefined;
  for (const method of [
    "log",
    "info",
    "warn",
    "error",
    "debug",
    "trace",
    "dir",
    "table",
    "group",
    "groupEnd",
    "count",
    "time",
    "timeEnd",
    "timeLog",
    "assert",
  ] as const) {
    (console as unknown as Record<string, () => void>)[method] = noop;
  }
}
