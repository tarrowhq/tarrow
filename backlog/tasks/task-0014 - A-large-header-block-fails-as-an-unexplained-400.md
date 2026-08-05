---
id: TASK-0014
title: A large header block fails as an unexplained 400
status: To Do
assignee: []
created_date: '2026-08-05 13:20'
labels:
  - 'area:web'
  - 'kind:bug'
  - 'x:safety'
dependencies: []
priority: medium
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A request whose header block exceeds Node's 16 KB default is rejected by the HTTP parser before a ServerResponse exists, reaching server/entry.ts's clientError handler, which answers every clientError with a flat 400 and the generic failure body. The user sees "somap failed while handling this request" with no cause and no way to recover.

Reproduced 2026-08-05 against the running composition:

  15000 bytes of Cookie header -> 200
  16000 -> 200
  16300 -> 200
  16400 -> 400

The practical trigger is cookie pollution on localhost. Cookies are scoped by host and not by port (RFC 6265 provides no port isolation, deliberately), so every dev server ever run on localhost deposits cookies that the browser then sends to somap on :3000. curl sends none, which is exactly why curl succeeds and a browser fails on the same URL.

Rejected approaches, recorded so they are not re-proposed:

- Cookie prefixes (__Host-, __Secure-) do not apply. They constrain how a cookie may be SET, not which cookies are SENT, and neither creates port scoping. somap also sets no cookies at all, so there is nothing of ours to prefix. The problem is entirely inbound.
- Clear-Site-Data: "cookies" would genuinely purge the jar, but on localhost it clears for the whole host, silently signing the developer out of every other local application. Hostile, and equally hostile to a self-hoster.

Fix:

1. Raise the app process's --max-http-header-size. somap reads no headers of consequence and the cost is negligible.
2. Branch the clientError handler on err.code === 'HPE_HEADER_OVERFLOW'. The handler currently discards the error argument entirely, which is why every malformed request and every oversized one produce the same opaque answer.
3. On overflow specifically, say what happened and how to recover: the browser is sending more cookie data for this host than the server will accept, somap uses no cookies, try a private window or clear cookies for this host. The message must name no address, because in this failure mode somap has not parsed one -- it does not have one to leak.

Note this is largely a localhost artifact. On its own origin somap receives only its own cookies, of which there are none. The shared-origin case is TASK-0010's to document.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A request with a header block over the limit receives a response naming the cause and a recovery step
- [ ] #2 The clientError handler distinguishes header overflow from a genuinely malformed request
- [ ] #3 The overflow response names no address, because none has been parsed in that failure mode
- [ ] #4 A test asserts a 20KB header block produces the explanatory response rather than the generic failure body
<!-- AC:END -->
