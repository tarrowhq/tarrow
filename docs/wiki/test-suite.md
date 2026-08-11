---
name: test-suite
description: What the suite proves, why it runs only inside a container, why a passing run with zero collected tests is treated as a failure, and why the log-capture test is given the Docker socket.
kind: component
sources:
  - app/scripts/run-tests.mjs
  - app/tests/no-logging.test.ts
  - app/tests/no-outbound.test.ts
  - app/tests/copy.test.ts
  - app/tests/explain.test.ts
  - app/tests/docker.ts
  - app/tests/fixtures.ts
  - app/tests/version.test.ts
  - app/tests/migration-drift.test.ts
  - app/tests/browser/form.test.ts
verified_against: 8ddb0b25621edf6b9072e9f354b9842271fbb32b
---

# Test suite

The only sanctioned way to run the suite is
`docker compose --profile test run --rm test`. A check run on a host is not a check, and
there is no host here to run one on.

## How it works

The suite exists mostly to hold gates that other files declare. `no-logging.test.ts` drives a
probe address at the running composition and reads every log stream back — this is the test
that found three framework log sites and produced [[process-output-seal]].
`no-outbound.test.ts` asserts no module in the request path names a network client API and
that the production dependency set is fixed. It also holds an **allowlist of the files that
may name `node:http` at all** — `entry.ts`, which creates the server, and `http.ts`,
`static.ts` and `version.ts`, which import its types to describe the response they write.
Anything else naming it is a caller rather than a listener, so adding a file to the request
path fails this test until the addition is stated and justified. That is the intended
friction: `version.ts` (TASK-0025) had to be added deliberately rather than passing unnoticed. `copy.test.ts` scans the raw response body of
every result shape for permission vocabulary. `explain.test.ts` asserts the proximity query
plan contains no `::geography` cast and does use the spatial index.

Two assertions changed shape when TASK-0008.01 admitted first-party script, and the new form
is the more useful one. `copy.test.ts` no longer asserts that no shape contains a `<script>`
element; it asserts **position** — everything inside `<body>` that the reader must see closes
`</main>` before the first `<script>` — so the answer, manifest, and sheriff step cannot come
to depend on script having run (FR-015, SC-001). Its `<details>` stripper also strips
`<script>` first, because the hydration payload serializes gap-ledger strings that the
collapse assertion would otherwise misread as markup. The browser suite's script assertion
likewise narrowed from "no script is loaded" to "no script is loaded *from another origin*".
`http-headers.test.ts` holds the CSP line directly: `'unsafe-inline'` never appears, a nonce is
at least 128 bits of CSPRNG output and never repeats across a hundred draws, and every script
tag in a served document is matched against the nonce its own response committed to.
`http-headers.test.ts`, `manifest.test.ts`, `no-fallback.test.ts`, `normalize.test.ts`,
`proximity.test.ts`, and `result-type.test.ts` cover the rest; `tests/types/` holds the
compile-failure fixture proving a clearance-shaped variant does not type-check.

`app/scripts/run-tests.mjs` exists because of a failure mode that reads as success.
`docker compose run --rm app npm test` cannot work — the runtime image deliberately carries
no `tests/` and no dev dependencies — and it used to exit 0 having collected zero tests, which
is indistinguishable from "everything passes" the moment it reaches CI, a README, or a release
checklist. Principle VII makes the container the only environment, so the wrong container is
the mistake most available to make. The script therefore enforces floors
(`MINIMUM_TEST_FILES`, `MINIMUM_TESTS`) and exits non-zero rather than reporting an empty
green run, parsing pass counts from either the spec or tap reporter.

The `test` service is built from the Dockerfile's `build` stage, the only stage carrying dev
dependencies — `tsc` in particular, which the compile-failure fixture needs. It connects as
`tarrow_app`, the same read-only role the request path uses.

**The Docker socket** is mounted read-only into the `test` profile alone. `no-logging.test.ts`
must read every log stream the composition produces — app, HTTP server, PostgreSQL, container
stdout/stderr — and container output only exists *outside* the container. A test that cannot
reach the engine API could only assert that the application does not log, which is the
assertion, not the evidence. The test never writes through the socket: it lists containers in
this project and reads their logs. `docker compose up` starts db and app, and neither can see
it.

**The browser suite** is a separate service and image stage. TASK-0015 shipped an app that did
not work in a browser while 146 tests passed, because every one reached it through `fetch()`,
which does not implement referrer policy and so could not produce the `Origin: null` that
broke the form. A suite with no browser in it cannot express a bug only a browser can produce.
It is separate because Chromium costs an apt install nobody should pay for who is not running
it.

That suite carries its own lesson about asserting on a mechanism rather than an outcome. Its
form test waited on `waitForNavigation()`, correct while the app shipped no client script;
once hydration was restored, `<Form>` began submitting by `fetch` to a `.data` endpoint and
navigating on the client, so there was no document navigation to wait for and the assertion
compared `undefined` against `200` on every run. It now captures the POST off the network
instead, which covers the hydrated path and the scripting-off path with one assertion —
because what matters is the request the address rides in, not how the page changed
afterwards.

**One suite deliberately does not run against a freshly-built database**, and it is the only
one that could have caught what it catches. `migration-drift.test.ts` builds a database at an
older revision, brings it forward with the real runner, and compares it column-for-column
against a fresh one. Every other test here runs against a database built in one pass from the
current schema directory — which is the one shape in which an edited-in-place migration is
invisible, because a fresh database applies the edited file whole. The deployed instance does
not, and a missing `coverage_gaps.label` refused every search there for three days while the
suite stayed green ([[database-schema]]). It also asserts the runner now *fails* on a
checksum mismatch rather than skipping silently.

**The floors move deliberately, in both directions.** `MINIMUM_TESTS` went 146 → 216 when
TASK-0017 repaired copy gates that had been registering zero tests, and 216 → 208 when
TASK-0022 moved the layer registry and the staleness statement off the answer deck onto
`/faq`: six per-shape assertions became two on the page that now carries them, and the
gap-visibility gate narrowed to the three shapes that produce a finding. A floor that only
ever rises stops being a floor and becomes a ratchet nobody can honestly satisfy; the rule is
that lowering it is a diff somebody reviews, with the argument in the comment beside it.

## Connections

- [[process-output-seal]], [[http-envelope]], [[result-type-gate]], and [[answer-rendering]]
  are the gates these tests hold.
- [[container-composition]] defines both test services and the socket mount.
- [[privacy-verification]] is the same evidence, written as a procedure an outsider runs.

## Operational notes

`docker compose --profile test run --rm browser-test` runs the browser suite separately;
`docker compose up --build` never builds that stage. `TARROW_APP_ORIGIN` points the suites at
the running app — `http://app:3000` over the internal network for the main suite,
`http://localhost:3000` for the browser one via a shared network namespace.
