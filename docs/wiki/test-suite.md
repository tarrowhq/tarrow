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
  - app/tests/browser/form.test.ts
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
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
that the production dependency set is fixed. `copy.test.ts` scans the raw response body of
every result shape for permission vocabulary. `explain.test.ts` asserts the proximity query
plan contains no `::geography` cast and does use the spatial index.
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
