// The address form. A real <form>, submitted by the browser itself.
//
// WHY POST AND NOT GET. The address goes in the request BODY, never in the
// URL. A URL reaches the browser's history and its address bar, the `Referer`
// header of anything the page links to, and the access log of any proxy or CDN
// a future deployment sits behind -- none of which tarrow's controls reach
// (Constitution Principle III; app/server/http.ts). This is not a preference
// about REST; it is the reason the form works the way it does, and it should
// not be "improved" into a query string.
//
// WHY THIS PAGE NEEDS NO JAVASCRIPT. React Router's <Form> renders a plain
// <form method="post" action="/answer"> and the browser submits it natively,
// so this page works with scripting switched off entirely -- which spec User
// Story 4 scenario 4 requires and which, for this population, is a safety
// property rather than an ergonomic one. The page does hydrate
// (app/root.tsx); it just does not need to.
//
// WHY THIS PAGE IS A QUESTION, A BOX, AND TWO FOOTNOTES (TASK-0017)
//
// It used to open with four paragraphs and a four-bullet callout, all of it
// true and all of it load-bearing, sitting between the reader and the field.
// The reader is frequently under a deadline to move. Disclosure they scroll
// past is disclosure that was not delivered, so those words did not survive
// here by being defensible -- they had to earn the space above the field, and
// only two sentences did. The rest moved to /faq, which is a real page, is
// linked from here and from every answer, and needs no JavaScript.
//
// What did NOT move is the constitutional obligation. Principle II binds every
// RESULT -- "every result states what was checked and what was not" -- and
// that lives on the answer page in full (app/result-view.tsx). This page is
// not a result and says nothing about any address.
//
// This route reads no database. If the database is down, this page still
// loads, and the failure surfaces on the answer page as an explicit failure
// rather than as a blank form nobody can explain.

import { Form } from "react-router";

export function meta() {
  return [
    { title: "tarrow: school distances for Summit County, Ohio" },
    {
      name: "description",
      content:
        "Measure how far a Summit County, Ohio address is from school " +
        "premises. A helper, not an authority.",
    },
  ];
}

export default function Index() {
  return (
    <main className="deck">
      <section className="card">
        <div className="card__body">
          <h1 className="ask__title">How far is an address from a school?</h1>
          <p className="ask__sub">
            Summit County, Ohio. School premises only. A helper, not an
            authority.
          </p>

          <Form method="post" action="/answer">
            <label className="field">
              {/* Visually hidden rather than absent: the question above reads
                  as a label to somebody who can see it, and a screen reader
                  needs one attached to the input itself. A placeholder is not
                  a label. */}
              <span className="field__label visually-hidden">
                A street address in Summit County, Ohio
              </span>
              <input
                className="field__input"
                type="text"
                name="address"
                required
                // The address must not be kept by the browser for the next
                // person at this machine. Library and shared computers are a
                // real setting for this application, and an autofill
                // suggestion is a record of where somebody was trying to move,
                // sitting on a screen.
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
              />
            </label>
            <button className="button" type="submit">
              Check this address
            </button>
          </Form>

          {/* The one thing a reader has to know BEFORE typing, and the only
              thing on this screen drawn to be unmissable. It is not
              decoration: tarrow answers about the address it matched or it
              answers about nothing, and a reader who assumes it will helpfully
              find the nearest thing is a reader who can be answered about the
              wrong building. */}
          <div className="notice">
            <p>
              <strong>
                tarrow does not correct spelling, and it does not guess.
              </strong>{" "}
              Type the address as it appears on a bill. If tarrow cannot find
              exactly what you typed, it says so rather than answering about the
              wrong building.
            </p>
            <p className="notice__example">
              For example <code>1464 Garman Rd, Akron, OH 44313</code>
            </p>
          </div>

          <p className="ask__blurb">
            tarrow measures distances and decides nothing.{" "}
            <a href="/faq">
              What tarrow checks, what it misses, and what happens to what you
              type
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
