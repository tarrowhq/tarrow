// The document shell.
//
// THE SCRIPTS CARRY A NONCE
//
// React Router's hydration bootstrap is three INLINE <script> blocks: the
// scroll-position restore, `window.__reactRouterContext`, and the route
// manifest. Their content varies per response, so no `sha256-` source
// expression can match them; a nonce is the only mechanism that admits them
// without admitting everything else.
//
// This file used to omit <Scripts /> entirely, and the application shipped no
// client-side JavaScript at all. That was never a requirement and was never
// chosen -- it fell out of a CSP string written in the TASK-0002 runbook, which
// that runbook records honestly at its 2026-08-04 checkpoint. Principle III
// forbids third-party scripts, analytics, and request logs; FR-025 and FR-026
// are scoped to third-party ORIGINS. First-party script was never in question.
// See docs/decisions/task-0008-01-nonce.md and server/http.ts.
//
// WHAT STILL HOLDS, AND WHY IT IS WORTH KEEPING
//
// Ruling R1 chose SSR because the form-action model "degrades to working HTML
// with JavaScript disabled, which for this user population is a safety property
// and not an ergonomic one". That is still true and still tested: spec SC-001
// and User Story 4 scenario 4, and app/tests/browser/form.test.ts drives the
// whole flow with scripting switched off. Somebody browsing defensively, or on
// a locked-down library machine, gets the entire answer.
//
// So: hydration is available where it earns its place. It is not a licence to
// put anything load-bearing behind it. The coverage manifest, the distances,
// and the sheriff step are server-rendered and stay that way (spec FR-015).

import type { ReactNode } from "react";
import type { LinksFunction } from "react-router";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import styles from "./styles.css?url";

export const links: LinksFunction = () => [
  // A same-origin stylesheet built into build/client/assets/. Not an inline
  // <style> element, and not a `style=` attribute anywhere in the app either:
  // `style-src 'self'` admits neither, and unlike script-src it carries no
  // nonce, so there is nothing to relax. Anything that needs a computed value
  // in the document -- see the distance scale in result-view.tsx -- uses SVG
  // presentation attributes, which are not CSS and not covered by this policy.
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
      <body>
        {children}
        {/* No nonce prop here. entry.server.tsx reads the value off this
            response's own CSP header and hands it to <ServerRouter>, which
            passes it to every nonce-aware component including these two. That
            is one seam instead of one per call site, and it is the seam where
            the header is actually in scope -- so a tag can never be stamped
            with a value the policy did not admit. */}
        <ScrollRestoration />
        <Scripts />
      </body>
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
 *   - emits an inline <script> (the "Hey developer" console tip) carrying no
 *     nonce, which a browser therefore refuses -- so every error page would
 *     ship dead code a reader inspecting the source cannot account for; and
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
