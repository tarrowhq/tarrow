// The address form. A real <form>, submitted by the browser itself.
//
// WHY POST AND NOT GET. The address goes in the request BODY, never in the
// URL. A URL reaches the browser's history and its address bar, the `Referer`
// header of anything the page links to, and the access log of any proxy or CDN
// a future deployment sits behind -- none of which somap's controls reach
// (Constitution Principle III; app/server/http.ts). This is not a preference
// about REST; it is the reason the form works the way it does, and it should
// not be "improved" into a query string.
//
// WHY THERE IS NO JAVASCRIPT HERE. There is none anywhere (app/root.tsx).
// React Router's <Form> renders a plain <form method="post" action="/answer">
// and the browser submits it natively, so this page works with scripting
// switched off entirely -- which spec User Story 4 scenario 4 requires and
// which, for this population, is a safety property rather than an ergonomic
// one.
//
// This route reads no database. If the database is down, this page still
// loads, still says what somap does not know, and still tells the reader to
// call the sheriff's office -- and the failure surfaces on the answer page as
// an explicit failure rather than as a blank form nobody can explain.

import { Form } from "react-router";

import { Masthead, PrivacyFootnote, SheriffNextStep } from "../result-view.tsx";

export function meta() {
  return [
    { title: "somap — school-premises distances for Summit County, Ohio" },
    {
      name: "description",
      content:
        "Check how far a Summit County, Ohio address is from school premises, " +
        "alongside a statement of everything that was not checked.",
    },
  ];
}

export default function Index() {
  return (
    <main className="page">
      <Masthead />

      <div className="prose">
        <p>
          somap checks <strong>one thing</strong>: how far a Summit County, Ohio
          address is from the school premises it holds, measured from the edge
          of one parcel of land to the edge of the other, against the
          1,000-foot buffer in Ohio Revised Code 2950.034.
        </p>
        <p>
          It exists to turn days of guessing into an hour of searching plus one
          phone call. It does not replace the phone call.
        </p>
      </div>

      <div className="callout prose">
        <p className="callout__title">Read this before you type an address</p>
        <ul>
          <li>
            <strong>somap does not decide anything.</strong> It measures
            distances and it tells you what it did not measure. It is not a
            court, a sheriff&rsquo;s office, or a lawyer, and nothing it says is
            advice about the law.
          </li>
          <li>
            <strong>This release checks school premises only.</strong> Ohio
            protects several other kinds of place — preschools, day-care
            centres, children&rsquo;s crisis care and residential infant care —
            and the cities and villages of Summit County have their own
            residency rules on top of the state&rsquo;s. None of those are
            loaded. Every answer lists them by name.
          </li>
          <li>
            <strong>Nobody has checked somap&rsquo;s reading of the rule.</strong>{" "}
            The buffer it applies comes from somap reading the statute, not from
            a rule record a person has signed off. Every answer says so.
          </li>
          <li>
            <strong>somap does not write down what you type.</strong> Not the
            address, not your IP address, not the fact that you searched. You
            are not asked to believe that — the procedure for checking it
            yourself is <code>docs/privacy/verification.md</code> in the source.
          </li>
        </ul>
      </div>

      <Form method="post" action="/answer">
        <label className="field">
          <span className="field__label">
            A street address in Summit County, Ohio
          </span>
          <span className="field__hint">
            For example: <code>1464 Garman Rd, Akron, OH 44313</code>. somap
            does not correct spelling and does not guess at a nearby street — if
            it cannot find exactly what you typed, it says so rather than
            answering about the wrong building.
          </span>
          <input
            className="field__input"
            type="text"
            name="address"
            required
            // The address must not be kept by the browser for the next person
            // at this machine. Library and shared computers are a real setting
            // for this application, and an autofill suggestion is a record of
            // where somebody was trying to move, sitting on a screen.
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />
        </label>
        <button className="button" type="submit">
          Check this address
        </button>
      </Form>

      <div className="prose mt-4">
        <p>
          <small>
            What you type is sent inside the form, never in the web address, so
            it does not appear in your browser&rsquo;s history, in the address
            bar, or in anything that logs web addresses along the way.
          </small>
        </p>
      </div>

      <SheriffNextStep />
      <PrivacyFootnote onHomePage />
    </main>
  );
}
