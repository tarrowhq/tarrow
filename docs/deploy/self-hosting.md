# Running a tarrow instance of your own

`docs/privacy/verification.md` tells you how to check tarrow's claims on your own laptop.
This document is about the other thing Principle VII asks for: **an instance you run, that
we never see, serving somebody other than you.**

It is written for someone who has never spoken to us. You need a container runtime, a
machine, and a hostname. You do not need this repository — the whole point of what follows
is that the artifact is the images, not the source.

There is a section in the middle of this document called *What your reverse proxy can see*.
It is the most important section here, it is not reassuring, and it is placed where you will
read it before you expose anything. Please do not skip it.

---

## What you are standing up

Two images, published on every change to `main`:

| Image | What it is |
|---|---|
| `ghcr.io/tarrowhq/tarrow-app` | The React Router server that answers requests, the migration runner, and the ETL pipeline. One image, three entrypoints. |
| `ghcr.io/tarrowhq/tarrow-db` | PostgreSQL 17 with PostGIS, built on the official `postgres` image rather than pulled from `postgis/postgis`, which publishes amd64 only. |

Both are `linux/amd64` and `linux/arm64`, so an ARM VPS or a Raspberry Pi is a supported
target rather than an aspiration.

Both are **pinned by tag and never floating.** Every build publishes an immutable
`sha-<short>` tag, and `docker-compose.deploy.yml` refuses to start unless you name one.
There is deliberately no `:latest` to drift onto: two instances silently running different
versions of the component that computes distances is precisely the failure Principle VII's
pinning rule exists to prevent.

## Standing it up

You need two files from this repository and nothing else — `docker-compose.deploy.yml` and
`.env.deploy.example`. Download them next to each other.

```sh
cp .env.deploy.example .env
```

Then edit `.env`. Three values are required and none of them has a default, because each has
a published value somewhere in this repository and silently inheriting one is the failure
this arrangement exists to prevent:

- `TARROW_IMAGE_TAG` — the immutable tag to run, e.g. `sha-1a2b3c4`.
- `POSTGRES_PASSWORD` — the database owner. The development composition's is the literal
  string `tarrow`, in public version control.
- `PGAPPPASSWORD` — the read-only runtime role. `app/sql/schema/010_grants.sql` creates that
  role with the literal password `tarrow_app`, also in public version control. The migration
  job re-sets it from this variable on every run, so changing it here and redeploying
  rotates it.

Generate the two passwords rather than choosing them:

```sh
openssl rand -base64 32
```

Then:

```sh
# 1. Pull and start: database, migrations, application.
docker compose -f docker-compose.deploy.yml up -d

# 2. Load the data. This fetches Summit County's address points and tax parcels and the
#    federal school files, then loads them: ~520,000 rows, several minutes. It is a job,
#    not a service, which is why `up` never starts it.
docker compose -f docker-compose.deploy.yml --profile etl run --rm etl

# 3. Confirm.
docker compose -f docker-compose.deploy.yml ps
curl -sS -X POST http://127.0.0.1:3000/answer \
  --data-urlencode 'address=1464 Garman Rd, Akron, OH 44313'
```

**Do not expose an instance before step 2 has finished.** An instance with no data loaded is
an instance that has checked nothing, and Principle II's whole argument — that a narrow build
is safe *because every answer says what it did not check* — assumes the answer is about
loaded data. Nothing enforces this ordering for you.

The application binds `127.0.0.1:3000` by default. That is the safe direction to be wrong in:
an operator who has not finished configuring a proxy gets an unreachable instance rather than
an accidentally public one.

### If the packages are private

tarrow's repository is private, and a package created by GitHub's registry inherits the
repository's visibility. If `docker compose ... up` fails with `denied` or
`unauthorized`, the packages have not been made public yet and you will need a pull
credential, or the operator of that registry needs to flip the packages to public in their
GitHub package settings. This is a one-time switch per package, not a per-release step.

If you would rather not depend on our registry at all — which Principle VII expects of you —
build the images yourself from a source checkout and push them wherever you like, then set
`TARROW_REGISTRY` to point at your own:

```sh
docker buildx build --platform linux/amd64,linux/arm64 \
  -f docker/app/Dockerfile --target runtime -t <your-registry>/tarrow-app:<tag> --push ./app
docker buildx build --platform linux/amd64,linux/arm64 \
  -f docker/db/Dockerfile -t <your-registry>/tarrow-db:<tag> --push ./docker/db
```

---

## What your reverse proxy can see

**This is the section that matters.** Everything tarrow claims about not recording what was
searched is a claim about tarrow. The moment you put something in front of it, that something
is in the path, and tarrow has no way to make claims on its behalf.

### The thing tarrow does, and the thing it does not do

tarrow sends the searched address in the **request body**, not the URL. That is deliberate and
structural (`app/app/root.tsx`): an address in a query string ends up in browser history, in
the address bar, in a `Referer` header on any subsequent navigation, and in the access log of
every proxy between the user and the server, because access logs record request lines.

That decision defeats **logging**. A proxy writing an ordinary access line records
`POST /answer` and learns nothing about where somebody wants to live.

It does not defeat **interception**, and it was never able to. Any proxy that terminates TLS
holds the decrypted request — headers and body together. A TLS-terminating proxy can read the
searched address. Not the IP alone; the address itself, the one datum this project exists
around, the one that "exists nowhere else in the world."

So the question for your deployment is not *does tarrow log the address* — it does not — but
**how many parties hold the plaintext on its way in, and who are they.**

### What each arrangement costs

Roughly in order of what tarrow's users would prefer, if they were asked:

**TLS terminated on the machine tarrow runs on.** Your reverse proxy holds the plaintext, and
it is your machine. Nobody else is in the path. This is the arrangement tarrow's privacy
documentation actually describes, and it is the one worth the extra effort.

**A reverse proxy or tunnel on infrastructure you rent.** A VPS terminating TLS and forwarding
to your home network — a Pangolin or `frp` tunnel, an nginx box, a Tailscale funnel. The
plaintext exists in memory on hardware you do not physically control, subject to your
provider's legal process rather than yours. Better than a CDN, and a real step down from the
first option.

**A CDN in front (Cloudflare, Fastly, and friends).** The CDN terminates TLS, so it holds the
decrypted body containing the address. Most do not log bodies by default. They can. Their
configuration is not something your users can audit, their retention is not something you
control, and their legal-process posture is not yours. If you use one, you must say so —
see below.

A **provider tunnel** — Cloudflare Tunnel, and its equivalents — belongs in this third
category rather than the second, even though it feels more like a private link. The provider
still terminates TLS and still holds the plaintext; what you gain over a proxied DNS record is
operational, not privacy. It is a genuine gain, though: no inbound port, no listening socket,
no reverse proxy of your own to keep configured, and the connector can be given reachability
to exactly one container. If you are going to have a third party in the path anyway, this is
the tidier way to have one.

Whatever you pick, do these:

- **Turn off request-body logging** wherever it is available. It is usually off; confirm it
  rather than assume it.
- **Check what your access log format actually captures.** A default format records the
  client IP. Principle III names IP addresses as data tarrow does not store — and your proxy
  is not tarrow, so if it stores them, they are stored.
- **Shorten or disable retention** for tarrow's route specifically, if your proxy allows
  per-route configuration. If it feeds something else — a fail2ban, an analytics pipeline —
  work out what that means before deciding it is fine.
- **Say what you did.** A user cannot audit your proxy. The only thing that makes your
  instance honest is you telling them what is in front of it. This is the same reasoning as
  Principle II: absence of a disclosure is not evidence of absence.

### tarrow must have its own origin

Do not mount tarrow on a path of an existing site — `example.org/tarrow`. Give it a hostname
of its own.

Cookies are scoped by host and **not** by port or path in the way you would want. RFC 6265
provides no port isolation, by design. A site that shares a hostname with tarrow sends tarrow
its cookies, including session tokens, on every request. tarrow sets no cookies, wants none,
and has no mechanism to decline them: cookie prefixes constrain how a cookie may be *set*,
not which are *sent*, and `Clear-Site-Data` would purge the whole host's jar and sign your
users out of everything else on it.

An instance on its own origin receives only its own cookies, of which there are none.

---

## Rotating the two passwords, which behave differently

This asymmetry is worth knowing before it surprises you, because one half of it fails loudly
and the other fails silently.

**`PGAPPPASSWORD` rotates cleanly.** The migration job runs `ALTER ROLE` on every start, so
changing it in `.env` and running `docker compose -f docker-compose.deploy.yml up -d` is all
there is to it. That is the entire reason it is done in the migration runner rather than in
`010_grants.sql` — a migration is applied once and recorded, so a change there would be a
no-op on every database that already exists.

**`POSTGRES_PASSWORD` does not rotate at all.** `POSTGRES_PASSWORD` is read by the postgres
image's entrypoint *only when it initialises an empty data directory*. On an existing volume
it is ignored completely. Change it in `.env`, redeploy, and the database keeps the old
password while everything that connects starts using the new one — the containers come up and
then fail authentication with `FATAL: password authentication failed`, which reads like a
typo rather than what it is.

To actually change the owner's password, change it in the database and then in `.env`:

```sh
docker compose -f docker-compose.deploy.yml exec db \
  psql -U tarrow -d tarrow -c "ALTER ROLE tarrow PASSWORD 'the-new-one'"
# then update POSTGRES_PASSWORD in .env to match, and redeploy
```

The same trap catches a first deployment onto a volume left over from an earlier run — the
initial `POSTGRES_PASSWORD` is ignored because the directory is not empty. If you are
standing up a genuinely fresh instance and see that authentication failure, check for an old
volume before you doubt your `.env`:

```sh
docker volume ls | grep tarrow
```

## Upgrading from a release named `somap`

The project shipped its first images under the placeholder name `somap`. That string reads as
"SO" + "map", which is precisely the inference this tool exists to avoid inviting about the
people using it — in a container name, a connection string, or a browser tab someone else can
see. It is gone. If you deployed before the rename, three things move.

**The images are published under new names.** `ghcr.io/evanstern/somap-app` and
`ghcr.io/evanstern/somap-db` receive no further tags. Pull `ghcr.io/tarrowhq/tarrow-app`
and `ghcr.io/tarrowhq/tarrow-db` instead, and rename `SOMAP_IMAGE_TAG` and
`SOMAP_REGISTRY` to `TARROW_IMAGE_TAG` and `TARROW_REGISTRY` in your `.env`. The old tags
keep working for as long as the registry holds them; nothing is deleted out from under a
running instance.

**The database objects rename themselves.** Migration `014_rename_to_tarrow.sql` renames the
application role `somap_app` to `tarrow_app` and renames the four authored SQL functions. It
runs as part of the ordinary migration job, and it is a no-op on a database created after the
rename. You run no SQL by hand. `PGAPPPASSWORD` continues to work unchanged: the migration
runner re-sets the role's password after the migrations have applied, by which point the role
already carries its new name.

**The database name and the owner role do not rename, and cannot.** Postgres reads
`POSTGRES_DB` and `POSTGRES_USER` only when it initialises an empty data directory, so an
existing volume keeps the database named `somap` owned by `somap` no matter what your `.env`
says. This is cosmetic — the name is internal to the container and nothing outside reads it —
so keeping it is a legitimate choice. If you take it, leave `POSTGRES_DB` and `POSTGRES_USER`
set to `somap` in your `.env`, or the containers will come up and fail to authenticate
against a database that is not there.

To adopt the new names completely, recreate the volume and reload. The database is a derived,
disposable projection (Principle IV), so this costs an ETL run and nothing else:

```sh
docker compose -f docker-compose.deploy.yml down -v
docker compose -f docker-compose.deploy.yml up -d
docker compose -f docker-compose.deploy.yml --profile etl run --rm etl
```

## Upgrading from the `evanstern` org

The repository moved from `evanstern/tarrow` to `tarrowhq/tarrow`. If you deployed before
the move, two things follow.

**The images are published under a new owner.** `ghcr.io/evanstern/tarrow-app` and
`ghcr.io/evanstern/tarrow-db` receive no further tags. Pull `ghcr.io/tarrowhq/tarrow-app`
and `ghcr.io/tarrowhq/tarrow-db` instead — accept the new default, or set
`TARROW_REGISTRY` in your `.env` if you had it set explicitly, then pick a tag published
under the new owner. An instance pinned to an `evanstern` tag keeps working; the old images
are not deleted, so this is not urgent.

**The new images start private.** `ghcr.io/evanstern/tarrow-*` were made public
deliberately, verified with an anonymous pull token (TASK-0016), because a self-hoster who
has never spoken to us must be able to pull them. That property does not travel with the
org move: `ghcr.io/tarrowhq/tarrow-*` are new packages, and a package inherits its
repository's visibility. `tarrowhq/tarrow` is private, so the new images start private too,
until an operator flips them public in GitHub's package settings — see *If the packages are
private* above. If `docker compose ... up` fails with `denied` or `unauthorized` against
the new registry, this is almost certainly why.

## Keeping it honest over time

An instance running six-month-old data is a Principle I hazard unless it announces itself as
one. tarrow carries the build date of its data and the verification dates of its rules and
surfaces them per Principles II and V — we cannot update your deployment, but we can make it
incapable of hiding its age.

Re-run the ETL on whatever cadence you can sustain, and read what your own instance says
about staleness rather than assuming it is current:

```sh
docker compose -f docker-compose.deploy.yml --profile etl run --rm etl
```

To move to a newer build, change `TARROW_IMAGE_TAG` in `.env` and:

```sh
docker compose -f docker-compose.deploy.yml up -d
```

Migrations run automatically before the application starts; that ordering is structural, not
a convention you have to remember.

### Ask your instance what it is running

```sh
curl -s https://your-instance.example/version
{"version":"0.1.0","revision":"0a24287…"}
```

`version` is the release the image was built from, and `revision` the commit. An instance
built locally, or from an unstamped image, honestly answers `unknown` rather than claiming a
version it cannot prove.

**Do not use a health check to answer this question.** It is worth being blunt about why,
because this project got it wrong: `demo.tarrow.org` served five-day-old code from
2026-08-06 to 2026-08-11, missing an entire redesign and a CSP change, while returning 200
to every request and passing its container healthcheck on every interval. Nothing was down.
A stale instance is a *working* instance, which is exactly what makes it hard to notice. The
only check that catches it is one that compares what is running against what should be.

To check it the way CI does, including waiting out a deploy in progress:

```sh
node scripts/verify-deployed-version.mjs --expect 0.1.0 \
  --origin https://your-instance.example --timeout 600
```

### Updating automatically, if you want to

`scripts/tarrow-deploy-agent.sh` runs **on your host** and reconciles it to the newest
released version: it asks the registry, and if you are behind, pins `TARROW_IMAGE_TAG` and
restarts. If the new version does not come up healthy it puts the previous one back — every
published tag is immutable, so rolling back is just pinning the old version again, and the
database is a derived projection that a version change does not touch.

```sh
install -m 0755 scripts/tarrow-deploy-agent.sh /opt/tarrow/tarrow-deploy-agent.sh
/opt/tarrow/tarrow-deploy-agent.sh --dry-run     # say what it would do
```

```cron
*/5 * * * * /opt/tarrow/tarrow-deploy-agent.sh >> /var/log/tarrow-deploy.log 2>&1
```

It only ever deploys a full release (`0.1.0`), never `latest` and never a build from `main` —
there is no `latest` to deploy, by design, and a moving tag is how two instances end up
computing statutory distances from different code while claiming the same version.

**The direction of this matters more than the convenience.** Your host reaches out to the
registry; nothing reaches in. There is no inbound port to open, no key held by anyone else,
and no CI system with the ability to execute on your machine. That is the same reasoning
behind everything in *What your reverse proxy can see* above, applied to the deploy path
instead of the request path — see `docs/decisions/task-0025-pull-based-cd.md` for the full
argument and the credential inventory.

---

## What this document does not cover

- **The threat model.** What tarrow defends against and what it does not, named adversary by
  adversary, is TASK-0010's artifact and is not written yet. This document covers one
  specific gap in one specific place.
- **TLS certificates.** Get them from your proxy of choice; tarrow has no opinion and no
  involvement.
- **Backups.** There is nothing to back up. The database is a derived, disposable projection
  rebuilt in full from files and public sources (Principle IV). If you lose it, re-run the
  ETL. This is a design property, not an omission — a system holding nothing about its users
  has nothing whose loss would matter to them.

## The instance we run

For completeness, and because Principle III says a claim you cannot check is not a claim:
the maintainers run an instance at `demo.tarrow.org`.

Its request path is a **Cloudflare Tunnel** — the Cloudflare edge terminates TLS, and a
`cloudflared` connector sitting in the same Docker network as the application carries the
request the rest of the way over plain HTTP. That is the third arrangement in the list above:
one third party holds the plaintext on the way in, and no other party does.

**That instance is a demo**, run for the maintainers and a small number of invited people. It
is not a service anyone has been referred to, and the trade above was made knowingly on that
basis. If it ever stops being a demo, the trade has to be made again rather than inherited.

The subdomain says so deliberately. The apex `tarrow.org` serves nothing and is held back for
a release that has been verified in the ways this one has not — no human has signed off the
statutory reading the buffer is applied from, and the measurement method is this project's own
over-restrictive interpretation. Serving that from the bare domain would imply a finished
product at the name a finished product should own.

Worth recording, because it is the useful part for anyone building the same thing: that path
used to be longer. It ran through a self-hosted tunnel server on a rented VPS and then a
reverse proxy whose access log recorded client IPs — three parties in front of the application
instead of one. Collapsing it to a single tunnel removed two of them, and removed the inbound
port and a hand-maintained routing file at the same time. If you are putting tarrow behind
something, fewer hops is available and is usually also less work.

**How it updates.** A `v*` tag publishes the images; the host's own copy of
`scripts/tarrow-deploy-agent.sh` notices the new release and reconciles to it. A merge to
`main` publishes an image and deploys nothing — only a release reaches the demo, because
cutting a tag is a person deciding this should be in front of readers, and a merge is not
that decision.

Nothing pushes to this host. GitHub Actions holds no key to it and there is no port to
receive one on, which is the same property the request path was shortened to get; the release
workflow confirms the deploy by polling the public origin, exactly as any stranger would.
The reasoning and the full credential inventory are in
`docs/decisions/task-0025-pull-based-cd.md`.

For five days in August 2026 this instance served pre-redesign code while healthy and
answering — the images were published, and nothing carried them the last hop. That is why
there is an agent and a `/version` endpoint at all, and why the release workflow now fails
visibly when the demo has not taken a release.

It is written down here rather than omitted because a project whose whole argument is
*check us, do not trust us* does not get to describe the good arrangement and quietly run a
different one.
