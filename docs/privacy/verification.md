# Verifying tarrow's privacy claims yourself

**You are not asked to believe any of this.** This document tells you how to check it.

tarrow's users are people on a sex offender registry looking for somewhere they are allowed
to live. The thing they type into it — **the address they are trying to move to** — exists
nowhere else in the world. It is not in the registry, it is not in a court record, it is not
in a county file. It exists only because somebody typed it, and the only way it becomes a
record anybody can subpoena, steal, or leak is if tarrow writes it down.

tarrow's position (Constitution Principle III) is that the control is **not holding the
data** — not encrypting it, not anonymising it, not promising to delete it later. And that
the claim has to be *checkable*, because a population that has been failed by systems
claiming to help it has no reason to extend faith to another privacy policy.

This page is the procedure. It assumes you have a container runtime and this repository,
that you have never read tarrow's source, and that you do not trust the people who wrote it.

Everything here runs against **the composition** — `docker compose`. That is the only
supported way to run tarrow (Principle VII), so it is also the only thing worth checking.

---

## What is being claimed

| # | Claim | Spec |
|---|---|---|
| 1 | The searched address is recorded in no log stream — application, HTTP server, PostgreSQL, or container output. | FR-023 |
| 2 | Your IP address is recorded in no log stream either. | FR-023 |
| 3 | An error says what failed. It never says what was searched. | FR-027 |
| 4 | Every response carries a Content-Security-Policy that permits only tarrow's own origin. | FR-025 |
| 5 | Nothing in the page loads from a third-party origin. No fonts, no scripts, no analytics, no beacons. | FR-026 |
| 6 | The query path makes no outbound network call. | FR-024 |

And one claim this document makes about itself: **§3 and §7 tell you how to make each check
fail.** A check that cannot fail is not a check, and you should not accept one from us.

### What these claims are about, and what they are not about

Every claim above is a claim about **the composition** — the containers `docker compose`
starts, and those only. Each check below reads them from outside, which is what makes the
answers trustworthy, and it is also what bounds them.

They are not claims about anything you put in front of the composition. If you reach tarrow
through a reverse proxy, a tunnel, or a CDN, that thing is in the request path and this
document has said nothing whatever about it.

That distinction is easy to under-read, so here it is at its sharpest. tarrow sends the
searched address in the **request body** rather than the URL, deliberately, so that it never
reaches browser history, the address bar, a `Referer`, or a proxy's access log — access logs
record request lines, and tarrow's request line says only `POST /answer`. What that defeats is
*logging*. What it does not defeat, and never could, is *interception*: **any proxy that
terminates TLS holds the decrypted body, and can therefore read the searched address itself.**

So if you are auditing somebody's hosted instance rather than one you started yourself, the
checks below are necessary and not sufficient. They tell you the instance is not recording
what was searched. They tell you nothing about how many parties held the plaintext on its way
in, which is a question only the operator can answer, and which
[`docs/deploy/self-hosting.md`](../deploy/self-hosting.md) requires them to answer in public.
That document also records what the maintainers' own instance does, so that we are held to
the same standard.

The strongest position remains the one Principle VII describes: run it yourself, on your own
machine, and there is no path and no operator to take anyone's word about.

---

## 0. Stand it up

```
docker compose up --build -d
docker compose run --rm etl          # fetches the county and federal source data
```

Wait for `docker compose ps` to show `db` and `app` healthy. `app` publishes on
`127.0.0.1:3000`.

Throughout, `<p>` is your compose project name — the directory name, usually `tarrow`. Run
`docker compose ps` to see it in the container names.

---

## 1. Read the composition before you run anything

Everything below is declared in two files you can read in five minutes:

- **`docker-compose.yml`** — the whole environment. Four services, two of which are jobs
  behind profiles. Read the `db` service's `command:` block especially.
- **`docker/app/Dockerfile`**, **`docker/db/Dockerfile`** — both built from pinned official
  base images, not pulled from an account you would have to trust.

There is no other environment. Nothing is installed on a host, so there is nowhere else for
a control to hide or for one to be missing.

---

## 2. Watch the network from a browser (claims 4, 5)

1. Open `http://127.0.0.1:3000/` with devtools open, on the **Network** tab, filter set to
   *All*, and **Disable cache** ticked.
2. Reload.

**What you should see.** Every request is to `127.0.0.1:3000`: the document, one stylesheet,
and a handful of `.js` files, all under `/assets/`. There is **no third-party host** in the
list — no `fonts.googleapis.com`, no `fonts.gstatic.com`, no CDN, no analytics endpoint. What
matters for claim 5 is not that the list is short; it is that every entry points back here.

3. Click the document request and read the **Response Headers**. You are looking for:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<random>';
  style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none';
  form-action 'self'; frame-ancestors 'none'
Referrer-Policy: same-origin
Cache-Control: no-store, no-cache, must-revalidate, private
Permissions-Policy: geolocation=(), camera=(), ...
```

(That policy is one line on the wire; it is wrapped here to fit.)

**Read what each clause buys you.** `default-src 'self'` and `connect-src 'self'` mean the
page cannot fetch, XHR, WebSocket, or beacon anywhere but back to tarrow. `script-src 'self'`
plus a nonce means a script runs only if it came from this origin or carries the random value
this response committed to — and **not** `'unsafe-inline'`, which would admit any inline
script at all, including one injected into the page.
`form-action 'self'` means the address you type cannot be submitted to another host.
`base-uri 'none'` means an injected `<base>` tag cannot silently re-point every relative URL
somewhere else. `Referrer-Policy: same-origin` means that if tarrow ever links you to a county
website, that county is **not** told which tarrow page you were reading — a referrer is sent
only back to tarrow itself, and it carries no address, because what you type travels in the
body of the form and never appears in a URL. (It reads `same-origin` rather than the stricter
`no-referrer` for a specific reason: under `no-referrer`, Chromium reports the origin of the
form submission as `null`, which React Router rejects — the address form answered
`400 Bad Request` in every Chromium browser until this was fixed. Nothing about what leaves
your machine changed; see TASK-0015.) `Cache-Control: no-store`
means your result page is not written to your browser's disk cache, which matters on a shared
or library computer.

4. **Fetch the page twice and compare the nonce.**

```
curl -sS -D - http://127.0.0.1:3000/ -o /dev/null | grep -i content-security-policy
curl -sS -D - http://127.0.0.1:3000/ -o /dev/null | grep -i content-security-policy
```

The `'nonce-...'` value is **different every time**, and it is 128 bits of randomness from the
operating system's CSPRNG. That is the property the whole clause rests on: a script injected
into this page cannot guess the value, and a script carrying a previous response's value does
not run. If the nonce is ever the same twice, the policy is decoration and this check has
failed — say so.

5. **View source and check every script against it.** `Ctrl-U`, or:

```
curl -sS http://127.0.0.1:3000/ | grep -o '<script[^>]*'
```

Every tag either has a `src=` that is a **relative path** — `/assets/…`, never a URL with a
host in it — or carries a `nonce=` matching the header from that same response. Anything else
is a script the browser refuses to run.

> **This check changed, and it is worth saying why.** tarrow used to ship no client-side
> JavaScript at all, and this step used to read "count the `<script>` tags: there are none."
> That was a cheaper check and we are sorry to lose it. It was also never a decision — it fell
> out of a CSP string written during an early build, and defending it meant ruling out
> interface work that helps the people this is for. The replacement is still something you can
> run in a terminal in ten seconds without reading any JavaScript.
>
> What has **not** changed: every byte of script comes from this origin, there is no third
> party anywhere in the page, and the reasoning is recorded in
> `docs/decisions/task-0008-01-nonce.md` rather than left as a config state to be discovered.

6. Turn JavaScript off entirely and use the site. **Everything still works** — you get the
   full answer, the coverage manifest, and the sheriff step. That is spec SC-001, it is
   tested (`app/tests/browser/form.test.ts` drives the whole flow with scripting disabled),
   and it is deliberate: for somebody browsing defensively, that is not a degraded mode, it
   is the only mode.

### The equivalent without a browser

```
curl -sS -D - http://127.0.0.1:3000/ -o /dev/null
```

### And on responses nobody wrote a route for

The claim is *every* response, so check the ugly ones:

```
curl -sS -D - -o /dev/null http://127.0.0.1:3000/does-not-exist        # 404
curl -sS -D - -o /dev/null -X POST http://127.0.0.1:3000/ -d x=1       # 405
printf 'GET / HTTP/9.9\r\n\r\n' | nc 127.0.0.1 3000                    # 400, malformed
```

All three carry the same policy. The last one is worth doing: it is malformed enough that
Node rejects it before tarrow's code runs at all, and Node's own default answer carries no
headers whatsoever. tarrow replaces that handler (`app/server/entry.ts`) so that even this
response is covered.

---

## 3. Search an address, then read every log stream (claims 1, 2, 3)

This is the central check. **Use an address that is unmistakable**, so that finding it later
is not a judgement call. Anything works; the point is that it is yours and it is weird.

```
ADDR='8675309 ZZYZX SENTINEL PRIVACY WAY, AKRON, OH 44309'
```

Submit it through the form at `http://127.0.0.1:3000/`, and — because a leak is most likely
on an error path — also throw it at paths that do not exist:

```
# The real submit path: this is how an address actually arrives, and it runs
# the whole query against PostgreSQL.
curl -sS -o /dev/null -X POST http://127.0.0.1:3000/answer --data-urlencode "address=$ADDR"

# And the ugly ways, because a leak is most likely on a path nobody designed.
curl -sS -o /dev/null "http://127.0.0.1:3000/?address=$(printf %s "$ADDR" | jq -sRr @uri)"
curl -sS -o /dev/null "http://127.0.0.1:3000/search/$(printf %s "$ADDR" | jq -sRr @uri)"
curl -sS -o /dev/null -X POST http://127.0.0.1:3000/ --data-urlencode "address=$ADDR"
curl -sS -o /dev/null http://127.0.0.1:3000/ -H "User-Agent: probe $ADDR"
```

Now read **everything the composition wrote**:

```
docker compose logs --no-log-prefix         > /tmp/tarrow-logs.txt
docker logs <p>-app-1                      >> /tmp/tarrow-logs.txt 2>&1
docker logs <p>-db-1                       >> /tmp/tarrow-logs.txt 2>&1

grep -ic 'ZZYZX'   /tmp/tarrow-logs.txt
grep -ic '8675309' /tmp/tarrow-logs.txt
grep -ic 'SENTINEL' /tmp/tarrow-logs.txt
```

**What you should see: `0`, three times.**

Then look for yourself:

```
grep -c . /tmp/tarrow-logs.txt        # how much was written at all
docker logs <p>-app-1
```

The application container's entire output, from the moment it started to now, is **one
line**:

```
tarrow app listening on :3000
```

That is not an accident of quiet traffic. After that line prints, the process **seals its own
output**: `process.stdout.write`, `process.stderr.write`, and every `console` method are
replaced with functions that discard (`app/server/silence.ts`). Nothing loaded into that
process — tarrow's code, React Router, the PostgreSQL driver, or a dependency nobody has
chosen yet — can put a byte on those streams.

That is deliberately blunt, and it is blunt because careful was not enough. See §7.

### Your IP address

Do not look for one specific address — look for **any**:

```
grep -oE '\b([0-9]{1,3}\.){3}[0-9]{1,3}\b' /tmp/tarrow-logs.txt | sort -u
```

Nothing, or at most the loopback/bind address in a startup banner. There is no access log,
so there is no line for a client address to appear on. The two places one otherwise would:
PostgreSQL's `log_connections` (off — §4) and its `log_line_prefix` (contains no `%h` or
`%r` — §4).

### The error path (claim 3)

```
curl -sS "http://127.0.0.1:3000/search/8675309-ZZYZX-SENTINEL"
```

Read the page you get back. It says tarrow could not answer and that nothing was checked. It
does **not** echo the path you asked for, and it does not show an error message, a status
detail, or a stack trace. Then re-run the greps above: still zero.

This costs tarrow something real and it is worth knowing what: **a fault in the running server
is not diagnosable from its output.** An error report that *usually* omits the address is a
control you could not check, so there is no error report. Faults are reproduced against
fixture addresses instead.

---

## 4. Check the database, which is where this is usually got wrong (claim 1)

The address you type travels to PostgreSQL as a query parameter. A database that logs
statements or parameters defeats every other control on this page, and PostgreSQL's defaults
are **not** safe for this: `log_min_error_statement` defaults to `error`, which logs the full
text of any statement that fails, and `log_parameter_max_length` defaults to `-1`, meaning
bind parameters are logged in full wherever a statement is logged at all.

### Check it from outside the container

The settings are **command-line arguments to the postgres process**, not a config file, so
you can read them without a database client and without trusting a file inside a volume:

```
docker inspect <p>-db-1 --format '{{json .Args}}' | tr ',' '\n' | grep -E 'log_|logging_'
```

You should see, among others:

```
log_statement=none
log_connections=off
log_disconnections=off
log_min_error_statement=panic
log_parameter_max_length=0
log_parameter_max_length_on_error=0
logging_collector=off
log_line_prefix=%m [%p]
```

`log_line_prefix` matters and is easy to miss: `%h` or `%r` in it would put the client's IP
address on every line the database emits, whatever `log_connections` says. It contains
neither.

`logging_collector=off` matters too: with a collector **on**, PostgreSQL writes log *files*
inside the data volume, and everything you read in §3 would have been looking in the wrong
place. Off means stderr only, which is the container stream you already captured.

### Check it from inside

```
docker compose exec db psql -U tarrow -d tarrow -c \
  "SELECT name, setting, source FROM pg_settings WHERE name LIKE 'log%' ORDER BY name;"
```

Note the **`source` column reads `command line`** for each of them. That is the strong form.
Try to change one:

```
docker compose exec db psql -U tarrow -d tarrow \
  -c "ALTER SYSTEM SET log_statement='all';" -c "SELECT pg_reload_conf();" -c "SHOW log_statement;"
```

It still reads `none`. A command-line argument cannot be overridden by `ALTER SYSTEM`, which
means a compromised database superuser cannot quietly turn statement logging on. (Reset it
afterwards: `ALTER SYSTEM RESET log_statement;`.)

### Confirm no extension is keeping query text elsewhere

```
docker compose exec db psql -U tarrow -d tarrow -c "SELECT extname FROM pg_extension ORDER BY 1;"
```

`pg_stat_statements`, `pgaudit`, and `auto_explain` all retain query text somewhere the
logging settings above do not reach. None of them is installed. You should see only
`plpgsql`, `postgis`, and their dependencies.

---

## 5. Confirm the built assets reference nobody (claim 5)

CSP is the runtime enforcement. Behind it is a scan of the built output, which runs as a step
in the image build — so a third-party origin reaching the shipped assets fails
`docker compose build`, before an image exists.

```
docker compose --profile test run --rm --entrypoint sh test -c "npm run scan:external-origins"
```

Read `app/scripts/scan-external-origins.mjs`. Its rule is deliberately blunt: **every**
absolute URL in the built output must appear in a reviewed allowlist with a written reason,
or the build fails. The current allowlist holds four entries, all of them inert — XML
namespace identifiers, and documentation links inside thrown error messages. A font, an icon
set, a CDN, or a beacon does not qualify, and the script also carries a hard-deny list that a
widened allowlist cannot get past.

You can prove the scan is not a no-op:

```
docker compose --profile test run --rm --entrypoint sh test -c \
  "echo 'https://fonts.googleapis.com/css2' > build/probe.js; npm run scan:external-origins"
```

It fails, names the file, and exits non-zero.

### Fonts specifically

`app/app/styles.css` is tarrow's only stylesheet. It contains no `@font-face`, no `@import`,
and no `url()`. It names a **system font stack** — fonts already on your own device.

This is the single most likely accidental violation of claim 5, and it is worse than it
looks: a webfont request tells whoever serves it your IP address and the page you were
reading, on every page view, with no script involved and nothing to consent to. For somebody
on a public registry that is a record, held by a third party, of who read a page about where
they are allowed to live.

---

## 6. The query path makes no outbound call (claim 6)

Three independent things, all readable:

1. **No caller.** No module in the request path (`app/server/**`, `app/app/**`) names a
   network client API — no `fetch(`, no `http.request`, no `node:https`, no `node:dns`, no
   HTTP client library. `app/tests/no-outbound.test.ts` asserts this file by file and fails
   if a new one appears.
2. **No dependency that could.** The production dependency set is six packages
   (`react-router`, `@react-router/node`, `react`, `react-dom`, `pg`, `isbot`) and the same
   test pins the list, so adding a seventh is a decision somebody has to make in a diff.
3. **No client half.** `connect-src 'self'` in the CSP: the page cannot fetch, XHR, WebSocket,
   or beacon anywhere but back to this origin, so no amount of client script could carry an
   address off the machine even if some were added.

The **ETL** — the pipeline that downloads Summit County's parcels and the federal school
files — does make outbound calls. That is its whole job. It is a separate job service
(`docker compose run --rm etl`), it never serves a request, and `docker compose up` does not
start it.

### A limit we could not close, stated rather than omitted

The strongest possible form of this claim would be a docker network declared
`internal: true`: no gateway, no NAT, no route off the host at all — not "no code calls out"
but "there is nowhere to call". **It was implemented and reverted.** The engine will not
publish a port for a container on an internal network: it accepts the binding, then binds
nothing (`HostConfig.PortBindings` populated, `NetworkSettings.Ports` empty, connection
refused from the host). `app` cannot be both isolated that way and reachable by your browser.

You can reproduce that in a minute if you want to check we are telling the truth about why.
The reasoning also sits in `docker-compose.yml` beside the `app` service, where somebody
reading the composition and wondering why the obvious control is missing will actually find
it.

If you self-host tarrow behind your own reverse proxy, you *can* have this: put `app` on an
internal network with no published port and let the proxy be the only thing that reaches it.
That is a stronger deployment than ours and we would rather you ran it.

---

## 7. Make the checks fail

None of the above is worth much if it would pass regardless. Each one can be broken on
purpose, and the failure is loud.

### Break the database check

Write a compose override:

```yaml
# /tmp/leak-proof.yml
services:
  db:
    command: ["postgres", "-c", "log_statement=all"]
```

```
docker compose -f docker-compose.yml -f /tmp/leak-proof.yml up -d --force-recreate db app
# ... submit a search ...
docker compose logs db --no-log-prefix | grep -i 'Parameters:'
```

You will see the address in the database log, in as many words:

```
DETAIL:  Parameters: $1 = '1464 Garman Rd, Akron, OH 44313'
```

Then run the suite (§8) against that composition: **11 tests fail**, including
`"ZZYZX" appears in no container's output` and `log_statement = none`. Remove the override
and they pass again. That is what makes the passing run mean something.

### Break the CSP check

Add `'unsafe-inline'` to `script-src` in `app/server/http.ts` and rebuild. Two tests fail:
the one comparing the served header against the policy transcribed from the signed runbook
(rather than against the string the server built it from), and the one that asserts
`'unsafe-inline'` never appears — because a nonce that sits beside `'unsafe-inline'` admits
everything and is worth nothing.

Or make the nonce fixed: return a constant from `nonce()` instead of `randomBytes`. The test
that fetches a hundred nonces and asserts they never repeat fails. A predictable nonce is a
guessable one.

### Break the scan

`echo 'https://fonts.googleapis.com/x' > app/build/probe.js`, then rebuild. The **image
build** fails, not just the suite.

### Break the capture itself

The log-capture test refuses to conclude anything from an empty capture. It asserts, before
it greps for a single address, that PostgreSQL's own startup banner and the app's own listen
line are present in what it captured — so a capture that silently read nothing fails instead
of passing. It also asserts that the search it ran actually resolved and flagged a real
premises, because the absence of an address that never reached the database proves nothing.

---

## 8. Run the suite

```
docker compose --profile test run --rm test
```

**146 tests, 0 failures.** The `test` compose profile is the only sanctioned way to run it.

`docker compose run --rm app npm test` cannot work, because the runtime image deliberately
carries no `tests/`. It used to exit 0 having collected **zero** tests, so a wrong invocation
read as "everything passes". It now refuses:

```
tarrow: REFUSING TO REPORT A PASS.

  There is no tests directory at /app/tests, so nothing could be collected.
  A run that collects nothing is not a run that passed.
```

`app/scripts/run-tests.mjs` also fails if fewer test files are present than the suite has, or
if `node --test` reports fewer tests than it should — so a partial collection is a failure
rather than a smaller green number.

The tests that back this page:

| File | Claims |
|---|---|
| `app/tests/no-logging.test.ts` | 1, 2 — the end-to-end capture, plus every PostgreSQL setting and the running process's argv |
| `app/tests/http-headers.test.ts` | 3, 4, 5 — the policy on 200/404/405/400/500 and on assets, the error body, every script matched against the nonce its own response committed to, no off-origin reference |
| `app/tests/no-outbound.test.ts` | 5, 6 — the source scan, the pinned dependency set, the build-output scan and a proof it bites |
| `app/tests/copy.test.ts` | 5 — nothing load-bearing behind script, and no off-origin `src`/`href`, on any of the ten served shapes; and that no searched address reaches a link, a form action, the page title, or the hydration payload |

`app/tests/no-logging.test.ts` reads container logs through the Docker engine API, which is
why the `test` service mounts `/var/run/docker.sock`. Container output only exists *outside*
the container that produced it, so a suite that cannot reach the engine could only re-assert
that tarrow does not log — the claim, not the evidence. The mount is on the `test` profile
alone; `docker compose up` never starts that service.

**One stream is excluded from the capture, and this is the whole of it:** the `test`
service's own containers. The harness prints the probe address by name in every assertion
message and every test title; it is the apparatus doing the looking. Nothing else is
filtered.

---

## What this page does not claim

Being straight about the edges is part of the point.

- **This covers the composition, not a deployment.** If you put tarrow behind a reverse proxy,
  a load balancer, or a CDN, *that* thing's access log is a record of who asked for what, and
  nothing here reaches it. tarrow is not currently deployed publicly for exactly this reason:
  no provider is chosen and no edge logging posture has been reviewed
  (`docs/design/task-0002-walking-skeleton-runbook.md`, ruling R3).
- **This is about data at rest and in logs, not about traffic analysis.** Somebody who can
  watch your network sees that you contacted tarrow. Nothing on this page changes that. Use
  Tor if that matters to you.
- **Rule content is not yet verified data.** Separate from privacy, and stated on every
  result tarrow returns: the 1,000-foot buffer is applied without the file-authored,
  human-verified rule record the constitution requires. That work is TASK-0003.
- **The strongest version of all of this is not trusting us at all.** Constitution Principle
  VII: tarrow must remain deployable in full by somebody who has never spoken to us, from
  publicly available inputs. Run your own instance and we never see anything, and none of the
  checks above have to be repeated.

---

## If a check fails

Open an issue with the command you ran and its output. A failure here is a defect of the
same severity as a wrong distance — please report it as one.
