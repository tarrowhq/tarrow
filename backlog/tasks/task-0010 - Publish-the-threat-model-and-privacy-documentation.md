---
id: TASK-0010
title: Publish the threat model and privacy documentation
status: To Do
assignee: []
created_date: '2026-08-04 16:00'
updated_date: '2026-08-05 17:14'
labels:
  - 'area:docs'
  - 'kind:feature'
  - 'x:privacy'
milestone: m-4
dependencies:
  - TASK-0002
priority: high
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write down what somap holds, what it does not, who the adversaries are, and how an outsider can check our claims.

Principle III assumes users need to KNOW their data is private rather than be told it is, which makes this a verification document rather than a privacy policy. Name the adversaries plainly: subpoena, hostile landlords, harassment campaigns, and our own compromise. State honestly what each control does and does not defend against, including that encryption at rest defends against a stolen disk and nothing else.

This is also the artifact an advocacy organization reads before deciding whether to send anyone here. Write for that reader.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Threat model names adversaries and states what is and is not defended against
- [ ] #2 A plain-language page lists exactly what is stored, where, and for how long
- [ ] #3 Verification steps documented so a technical reader can independently confirm the claims
- [ ] #4 Known residual risks stated rather than omitted
- [ ] #5 Reviewed by someone outside the project before publication
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Threat-model item raised by TASK-0014 (2026-08-05): somap cannot refuse inbound cookies, and on a shared origin it will receive another application's. Cookies are scoped by host and not by port (RFC 6265 provides no port isolation by design), so a self-hoster who mounts somap on a path of an existing site -- example.org/somap -- causes that site's cookies, including session tokens, to be sent to somap on every request. somap sets no cookies and wants none, but it has no mechanism to decline them: cookie prefixes constrain how a cookie may be set rather than which are sent, and Clear-Site-Data would purge the whole host's jar and sign the operator out of everything else on it. The published threat model should state this rather than omit it, and the self-hosting guidance should require somap have its own origin. Found on localhost, where every dev server shares one hostname, which is the same defect in its loudest form.

Threat-model item raised by TASK-0016 (2026-08-05): the six claims in docs/privacy/verification.md are claims about the composition, and a reader can easily take them as claims about somap. They are proven by tests that enumerate this compose project's containers and read their streams; nothing in this repository can see, or says anything about, a reverse proxy in front of it.

The gap is sharper than "we did not test the proxy". somap sends the searched address in the request body rather than the URL, deliberately, so it stays out of browser history, the address bar, a Referer, and every intermediary access log -- access logs record request lines, and somap's says only `POST /answer`. That defeats logging. It does not defeat interception: any proxy terminating TLS holds the decrypted body, so it can read the searched address itself, not merely the client IP. The datum the threat model is most concerned with -- where someone is trying to move, which "exists nowhere else in the world" -- is in plaintext at every TLS-terminating hop.

The published threat model should therefore name the hosted-instance operator, and the operator's chosen intermediaries, as parties in the trust model, and should state that somap's controls do not extend to them. It should also state the corollary the constitution already implies: Principle VII's "run it yourself" is not merely a nice-to-have for this adversary class, it is the only configuration in which the claims hold end to end.

TASK-0016 wrote the deployment-side half (docs/deploy/self-hosting.md, "What your reverse proxy can see") and added a scope statement to verification.md, including a public record of what the maintainers' own instance at soma.infinitynode.media puts in its path -- Cloudflare, a Pangolin tunnel on a rented VPS, and a Traefik whose access log records client IPs. That instance is deliberately not the strongest arrangement available; the threat model should treat it as an example to be honest about rather than a recommendation.

Also still open from TASK-0014: somap cannot refuse inbound cookies, and on a shared origin it will receive another application's. TASK-0016's self-hosting document now requires somap have its own origin and explains why, which is the guidance half; the threat-model half is still this card's.
<!-- SECTION:NOTES:END -->
