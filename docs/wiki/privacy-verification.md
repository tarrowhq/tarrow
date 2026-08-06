---
name: privacy-verification
description: The published procedure for checking tarrow's privacy claims from outside the containers, including how to make each check fail and what the checks deliberately do not cover.
kind: concept
sources:
  - docs/privacy/verification.md
verified_against: b5b247a6cb390ba505c674f0c77af551dd547949
---

# Privacy verification

`docs/privacy/verification.md` opens by saying the reader is not asked to believe anything.
Principle III holds that privacy must be checkable, because a population failed by systems
claiming to help it has no reason to extend faith to another privacy policy. This document is
the procedure, written for somebody who has a container runtime and this repository, has never
read the source, and does not trust the people who wrote it.

## How it works

Six claims are enumerated with their spec references: the searched address appears in no log
stream (FR-023), nor does the client IP (FR-023), an error says what failed but never what was
searched (FR-027), every response carries a CSP permitting only tarrow's origin (FR-025),
nothing in the page loads from a third-party origin (FR-026), and the query path makes no
outbound call (FR-024).

A seventh claim is about the document itself: **§3 and §7 tell you how to make each check
fail.** A check that cannot fail is not a check, and the document says you should not accept
one. So each procedure is paired with an instruction for breaking the control and watching the
check go red — turning off a PostgreSQL logging flag, removing the seal.

Every check runs against **the composition**, from outside the containers, which is what makes
the answers trustworthy and also what bounds them. The document is unusually direct about that
bound. tarrow sends the address in the request body rather than the URL so it never reaches
browser history, the address bar, a `Referer`, or a proxy's access log — an access log records
request lines, and tarrow's says only `POST /answer`. What that defeats is *logging*. What it
cannot defeat is *interception*: any proxy terminating TLS holds the decrypted body and can
read the searched address. Auditing somebody else's hosted instance, these checks are
necessary and not sufficient — they show the instance records nothing, and say nothing about
how many parties held the plaintext on the way in. That is a question only the operator can
answer, and `docs/deploy/self-hosting.md` requires them to answer it in public.

The strongest position remains the one Principle VII describes: run it yourself, and there is
no path and no operator to take anyone's word about.

## Connections

- [[process-output-seal]] §3 is the seal check; [[database-logging-posture]] is step 4.
- [[http-envelope]] sets the headers checks 4 and 5 read.
- [[test-suite]] is the same evidence as an automated suite.
- [[self-hosting]] carries the operator-side disclosure this document defers to.

## Operational notes

§6 records the network-isolation control that was attempted and could not be had — an
`internal: true` network cannot have a published port — as a known limit rather than leaving a
reader wondering why the obvious control is absent. The document also states that faults
should be reproduced against fixture data, since the running server is deliberately not
diagnosable from its output.
