// The document shell -- and the place tarrow decides it ships no client-side
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
//      forbids outright -- and a policy that admits tarrow's own inline script
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
 * PHASE 5 WROTE THE WORDS. It carries the sheriff-confirmation guidance every
 * result carries (spec FR-013), it withdraws every coverage claim explicitly
 * rather than leaving a silence a reader could take for reassurance, and it
 * still takes nothing whatsoever from the error.
 *
 * It cannot render a coverage manifest read from data, because the reason it
 * is rendering at all may be that the data could not be read -- and reaching
 * for the database here would turn one failure into two. So it says the only
 * true thing available, in the same words server/manifest.ts uses when the
 * ledger cannot be read: nothing was checked, and tarrow cannot even tell you
 * what it would have checked.
 */
export function ErrorBoundary() {
  return (
    <main className="page">
      <header className="masthead">
        <p className="masthead__name">
          <a href="/">tarrow</a>
        </p>
        <p className="masthead__where">
          School-premises distances for Summit County, Ohio. A helper, not an
          authority.
        </p>
      </header>

      <div className="answer answer--broken">
        <p className="answer__label">No result: tarrow could not answer</p>
        <h1 className="answer__headline">
          tarrow could not answer, and nothing was checked.
        </h1>
        <div className="prose">
          <p>
            Either something went wrong inside this copy of tarrow, or the page
            you asked for does not exist. Either way no address was measured
            against anything, and tarrow is making no statement about any
            address.
          </p>
        </div>
      </div>

      <section className="section">
        <h2 className="section__title">
          tarrow cannot tell you what it checked, because it checked nothing
        </h2>
        <div className="prose">
          <p>
            Every working tarrow answer carries a list of which data layers were
            searched, which kinds of place were not searched at all, and how old
            each layer is. This page carries none of that. Do not read the
            absence of a warning here as the absence of a problem. Read it as
            tarrow being unable to speak.{" "}
            <a href="/">Search again</a>.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">
          Your next step: the sheriff&rsquo;s office where you register
        </h2>
        <div className="prose">
          <p>
            Call or visit the sheriff&rsquo;s office where you register and ask
            about the address you were checking. That office enforces the
            distance rule and knows the local rules tarrow does not load, so it
            can answer even when tarrow is broken.{" "}
            <a href="/faq">What tarrow is, and what it is not</a>.
          </p>
        </div>
      </section>

      <footer className="footnote">
        <p>
          tarrow records nothing about what was requested: not the address, not
          your IP address, not this failure. That is why there is no error
          detail on this page. There is none to show, and none was written down
          anywhere for anyone to read later.
        </p>
      </footer>
    </main>
  );
}
