# tarrow

tarrow answers one question for one person: **"Am I allowed to live here?"**

Its users are people on a sex offender registry looking for housing. They are subject to a
patchwork of state statutes and municipal ordinances that no single authority publishes, and
today the only way to get an answer is to call a sheriff's office about one address at a
time.

**tarrow is a helper, not an authority. It is not legal advice.** Its purpose is to turn three
days of guessing into an hour of searching plus one confirming phone call. The strongest
thing it will ever say about an address is *"outside every buffer we checked"* — stated
together with everything it did not check.

Read [`.specify/memory/constitution.md`](.specify/memory/constitution.md) before changing
anything. Principles I, II, and III are non-negotiable.

## What this release does

Enter a Summit County, Ohio address; see which **school premises** fall within the
1,000-foot buffer of ORC 2950.034, measured parcel boundary to parcel boundary — alongside
an explicit statement of what was and was not checked.

It is deliberately **narrow on coverage and complete on honesty**. Only school premises are
loaded. Preschools, licensed child day-care, children's crisis care and residential infant
care are not loaded. No municipal ordinance is loaded. The buffer is applied without the
file-authored, human-verified rule record the constitution requires. **Every answer says all
of that on the page**, which is what makes shipping it safe.

Not promoted to real users at this stage.

## Running it

You need a container runtime and this repository. **Nothing is installed on a host** — not a
database, not a language runtime, not a geospatial library. There is nothing else to install
because there is nothing else (Principle VII).

From a clean clone, in order:

```sh
# 1. Build and start the composition: PostGIS, the migration job, and the server.
#    `up` only reaches a healthy `app` after `migrate` has exited 0.
docker compose up --build -d

# 2. Load the data. This fetches Summit County's address points and tax parcels and the
#    federal school files, then loads them: ~520,000 rows, several minutes. It is a job,
#    not a service, so `docker compose up` never starts it.
docker compose run --rm etl

# 3. Confirm both services are healthy.
docker compose ps

# 4. Use it. Open http://127.0.0.1:3000/ and submit an address, or from a terminal:
curl -sS -X POST http://127.0.0.1:3000/answer \
  --data-urlencode 'address=1464 Garman Rd, Akron, OH 44313'
```

`docker compose run --rm etl --skip-fetch` reloads from the NDJSON already on the volume
without re-fetching. Every load is a full truncate-and-reload; there is no incremental sync
anywhere in the codebase, on purpose (Principle IV).

To start over completely: `docker compose down -v` removes both volumes, and step 1 rebuilds
from empty.

### Running an instance for other people

The steps above build from this source tree, publish the database on loopback for
inspection, and use fixed development credentials that are in this repository — right for a
laptop, wrong for a machine on a network.

For a real deployment there are published images — `ghcr.io/tarrowhq/tarrow-app` and
`ghcr.io/tarrowhq/tarrow-db`, both `linux/amd64` and `linux/arm64`, pinned by immutable tag
and never `:latest` — and a separate composition, `docker-compose.deploy.yml`, that needs no
source checkout and refuses to start on a defaulted credential.

**[`docs/deploy/self-hosting.md`](docs/deploy/self-hosting.md) is the procedure.** Read its
*What your reverse proxy can see* section before exposing anything: tarrow keeps the searched
address out of every log, but anything in front of tarrow that terminates TLS holds that
address in plaintext, and that is the operator's disclosure to make rather than tarrow's.

### It works with JavaScript switched off

tarrow ships **no client-side JavaScript at all**. View source and count the `<script>` tags:
there are none. The form is a real `<form>` that your browser submits itself, and the
address travels in the request body rather than in the URL, so it never reaches your
browser's history, the address bar, a `Referer` header, or any proxy's access log. See
[`app/app/root.tsx`](app/app/root.tsx) for why this is structural rather than incidental.

## Running the tests

```sh
docker compose --profile test run --rm test
```

**That is the only sanctioned way to run the suite.** `docker compose run --rm app npm test`
cannot work: the runtime image deliberately carries no `tests/` and no dev dependencies. It
used to exit 0 having collected zero tests, which reads as "everything passes" — it now
refuses and exits non-zero instead
([`app/scripts/run-tests.mjs`](app/scripts/run-tests.mjs)).

A check run on a host is not a check (Principle VII), so there is no host command here.

## Verifying the privacy claims yourself

tarrow records nothing about what you search — not the address, not your IP address, not the
fact that you searched. You are not asked to believe that.
[`docs/privacy/verification.md`](docs/privacy/verification.md) is the procedure: watch the
network from a browser, submit a search, read every log stream the composition produces, and
find nothing. It also tells you how to **make each check fail**, because a check that cannot
fail is not a check.

## Layout

```
docker-compose.yml            the whole environment: db, migrate, app, and three job profiles
docker/db|app|tools/          pinned, multi-architecture images, built rather than pulled
app/server/                   the query path: HTTP envelope, search, coverage manifest
app/app/                      the web surface: the form, the answer, and the words
app/sql/schema/               migrations, applied in filename order
app/sql/query/                the spatial queries, authored as files so they diff (R4)
app/etl/                      the ingest pipeline (a job, never in the request path)
app/tests/                    the suite; runs only via the `test` compose profile
specs/                        the specifications work is planned from
docs/privacy/verification.md  how an outsider checks tarrow's privacy claims
docs/design/                  runbooks and decision records
spikes/                       frozen investigations and their published evidence
backlog/                      the board; moved only through the `backlog` CLI
```

## Contributing

Work is planned as specs under `specs/` and tracked on a Backlog.md board under `backlog/`.
One task, one branch, one pull request. Every pull request leaves `main` deployable and the
application working, and may narrow coverage but never honesty.
