// The document shell -- and the place somap decides it ships no client-side
// JavaScript at all.
//
// WHY <Scripts /> AND <ScrollRestoration /> ARE NOT HERE
//
// The Content-Security-Policy this application serves is the one the runbook
// specifies, and its `script-src 'self'` clause carries no `'unsafe-inline'`
// and no nonce. React Router's hydration bootstrap is three INLINE <script>
// blocks (the scroll-position restore, `window.__reactRouterContext`, and the
// route manifest). Under that policy a browser refuses to execute them.
//
// There were three ways out and only one that does not weaken a gate:
//
//   1. Add 'unsafe-inline' or a per-request nonce to script-src. That is the
//      operator-specified policy softened by an implementer, which the runbook
//      forbids outright -- and a policy that admits somap's own inline script
//      admits every other one, which is the hole an analytics snippet walks
//      through.
//   2. Leave <Scripts /> in and let the browser block it. The page would still
//      work, because it is server-rendered HTML, but it would work by accident
//      while emitting policy violations, and "hydration is broken on purpose"
//      is not a property anybody could verify.
//   3. Ship no client-side JavaScript. `script-src 'self'` then describes
//      something true and trivially checkable: view source, and there is no
//      script to reason about.
//
// This file takes (3), and it costs this application nothing it wanted.
// Ruling R1 chose React Router 7 in SSR mode precisely because its form-action
// model "degrades to working HTML with JavaScript disabled, which for this
// user population is a safety property and not an ergonomic one" -- and every
// acceptance criterion in Phase 5 requires the surface to work with JavaScript
// off. What was optional is now structural.
//
// PHASE 5, READ THIS: you may not add a component that requires hydration.
// There is no client runtime to hydrate it. Forms are plain <Form method="post">
// (which React Router renders as a real <form> and the browser submits
// natively), progressive disclosure is <details>/<summary> and CSS, and
// anything that genuinely needs script is an operator checkpoint -- a CSP
// amendment, not a component choice.

import type { ReactNode } from "react";
import type { LinksFunction } from "react-router";
import { Links, Meta, Outlet } from "react-router";

import styles from "./styles.css?url";

export const links: LinksFunction = () => [
  // A same-origin stylesheet built into build/client/assets/. Not an inline
  // <style> element: `style-src 'self'` blocks those for the same reason
  // `script-src 'self'` blocks inline script.
  { rel: "stylesheet", href: styles },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* No <link rel="preconnect">, no <link rel="dns-prefetch">, and no
            favicon from anywhere but this origin. A preconnect to a third
            party contacts it before the page has rendered a single pixel and
            is not covered by anything a reader would think to check. */}
        <Meta />
        <Links />
      </head>
      <body>{children}</body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}

/**
 * A root error boundary, present for two reasons that are both about this
 * phase rather than about the copy.
 *
 * Without one, React Router server-renders its OWN default boundary, and that
 * default:
 *
 *   - emits an inline <script> (the "Hey developer" console tip). Under
 *     `script-src 'self'` a browser refuses it, so every error page would ship
 *     dead code that a reader inspecting the source cannot account for; and
 *   - console.error's the error while rendering, which on a 404 means printing
 *     `No route matches URL "/search/<the address somebody typed>"` to the
 *     container log. That is one of the three framework log sites
 *     server/silence.ts documents, and it was found by the log-capture test.
 *
 * It also takes NOTHING from the error. Not the message, not the status text,
 * not the URL. `useRouteError()` is deliberately not called: an error object
 * here carries the request that produced it, and rendering any part of it puts
 * the searched address on the screen of a shared computer and into a browser's
 * back-button cache (spec FR-027).
 *
 * PHASE 5 OWNS THE WORDS. This is the minimum that is safe, not the finished
 * copy: the real one needs the sheriff-confirmation guidance every result
 * carries, and it must keep saying nothing about permission.
 */
export function ErrorBoundary() {
  return (
    <main>
      <h1>somap could not answer</h1>
      <p>
        Something went wrong inside this somap instance, or the page you asked
        for does not exist. Nothing was checked, and somap is not saying
        anything about any address.
      </p>
      <p>
        somap deliberately records nothing about what was requested, so there is
        no detail to show you here and none was written down anywhere.
      </p>
      <p>
        If you were searching an address, treat this as no answer at all and
        confirm the address with the registering sheriff&rsquo;s office.
      </p>
    </main>
  );
}
