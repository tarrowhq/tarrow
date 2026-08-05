// The page that lets the other two pages be short (TASK-0017).
//
// Before this route existed, everything below was crammed onto the form and
// the answer: four explanatory paragraphs and a bulleted callout above the
// address field, and six full-length sections under every result. It was all
// true, and a reader under a thirty-day order to move read none of it. This is
// the same content, in one place a reader chooses to open, written to be read
// rather than to be defensible.
//
// WHAT THIS PAGE IS NOT ALLOWED TO BECOME. It is not where the coverage
// manifest went. Constitution Principle II binds every RESULT -- "every result
// states what was checked and what was not" -- and a link is not a statement.
// So what somap did not check is still rendered on every answer, from the
// coverage-gap ledger, in the served HTML (app/result-view.tsx). This page
// repeats it in general terms; it does not carry it on the answer's behalf,
// and moving that obligation here would be a Principle II violation dressed as
// an information-architecture improvement.
//
// It reads no database. Like the form, it loads when the database is down --
// which is when a reader is most likely to be looking for an explanation.
//
// The vocabulary rule applies here as it does everywhere else: this page is
// scanned by app/tests/copy.test.ts for the permission words the constitution
// forbids, because a reader arriving here from an answer reads it as part of
// the answer.

export function meta() {
  return [
    { title: "somap: what it checks, what it misses, what it keeps" },
    {
      name: "description",
      content:
        "What somap measures, what it does not look at, how to read an " +
        "answer, and what happens to the address you type.",
    },
  ];
}

export default function Faq() {
  return (
    <main className="page">
      <header className="masthead">
        <p className="masthead__name">
          <a href="/">somap</a>
        </p>
        <p className="masthead__where">
          School-premises distances for Summit County, Ohio. A helper, not an
          authority.
        </p>
      </header>

      <h1 className="ask__question">What somap is</h1>

      <section className="section">
        <h2 className="section__title">What it measures</h2>
        <div className="prose">
          <p>
            One thing: how far a Summit County, Ohio address is from the school
            premises somap holds a boundary for. The measurement runs from the
            edge of one parcel of land to the edge of the other, against the
            1,000-foot buffer in Ohio Revised Code 2950.034.
          </p>
          <p>
            Ohio&rsquo;s rule is written about the <em>premises</em>, meaning
            the parcel, rather than the building. A school that owns several
            parcels will therefore appear several times in one answer. Repeated
            names are not a mistake.
          </p>
          <p>
            It exists to turn days of guessing into an hour of searching plus
            one phone call. It does not replace the phone call.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">What it is not</h2>
        <div className="prose">
          <p>
            <strong>somap does not decide anything.</strong> It measures
            distances, and it tells you what it did not measure. It is not a
            court, a sheriff&rsquo;s office, or a lawyer, and nothing it says is
            advice about the law.
          </p>
          <p>
            The strongest sentence it will ever produce is{" "}
            <em>outside every buffer we checked</em>. That is a statement about
            somap&rsquo;s own searching, not about an address.
          </p>
          <p>
            <strong>
              If the sheriff&rsquo;s office where you register and somap
              disagree, that office is right and somap is wrong.
            </strong>{" "}
            That office enforces the distance rule, and it knows the local rules
            somap has not loaded. somap exists to make the call shorter.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">What it does not check</h2>
        <div className="prose">
          <p>
            This release is deliberately narrow. Every answer lists these by
            name, read from somap&rsquo;s own record of its gaps rather than
            from a paragraph somebody remembered to update.
          </p>
          <ul>
            <li>
              Ohio also protects preschools, licensed child day-care centres,
              children&rsquo;s crisis care facilities and residential infant
              care facilities. None of them are loaded.
            </li>
            <li>
              The municipalities of Summit County impose their own residency
              ordinances on top of the state&rsquo;s. Not one of them is loaded.
            </li>
            <li>
              No data is loaded for any county but Summit, so an address outside
              it cannot be answered at all.
            </li>
            <li>
              The buffer somap applies comes from somap reading the statute. It
              does not come from a rule record carrying a citation, an effective
              date and a person&rsquo;s name, which is what the constitution
              requires and what has not been built yet. No court has been asked
              whether the way somap measures is the way the state measures.
            </li>
            <li>
              somap is missing schools it has never heard of. It names the ones
              it knows about, and it does not know all of them.
            </li>
          </ul>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">How to read an answer</h2>
        <div className="prose">
          <p>There are three kinds, and they are drawn differently on purpose.</p>
          <ul>
            <li>
              <em>Inside a buffer somap checked.</em> At least one school
              premises came out within the buffer. The answer names each one and
              the distance measured to it. That is the list to take to the phone
              call.
            </li>
            <li>
              <em>Outside every buffer we checked.</em> The strongest thing
              somap says, and it is smaller than it sounds. Nothing somap holds
              a boundary for was within the buffer. It is a measurement, not a
              finding that an address is available to you, and everything in the
              list above went unchecked.
            </li>
            <li>
              <em>somap stopped, or could not find the address.</em> Not an
              answer either way. It is not &ldquo;nothing nearby&rdquo;, because
              somap measured no distances at all. These pages have a broken
              border so they cannot be mistaken for a result at a glance.
            </li>
          </ul>
          <p>
            Distances carry <strong>slack</strong>, which is a margin for how
            precisely somap knows where a boundary sits. It is always{" "}
            <em>subtracted</em> from a measured distance before the comparison,
            never added, so it makes a flag more likely rather than less. That
            is the direction the constitution requires: a school somap flags
            that turns out not to count costs you a house you could have had,
            and a school it misses could cost you your liberty.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">What happens to the address you type</h2>
        <div className="prose">
          <p>
            <strong>somap does not write it down.</strong> Not the address, not
            your IP address, not the fact that you searched. There are no
            analytics, no third-party scripts, no cookies, and no request log
            tying a person to a place.
          </p>
          <p>
            What you type is sent inside the form rather than in the web
            address, so it does not appear in your browser&rsquo;s history, in
            the address bar, or in anything that logs web addresses along the
            way. Answer pages are marked never to be stored by your browser or
            by anything between you and somap, which matters on a shared or
            library computer.
          </p>
          <p>
            <strong>You are not asked to believe any of that.</strong>{" "}
            <code>docs/privacy/verification.md</code> in the source is the
            procedure for checking every part of it yourself, and somap runs
            entirely on a machine of your own if you would rather involve nobody
            at all.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">How old the data is</h2>
        <div className="prose">
          <p>
            Every answer carries the date this copy of somap last fetched its
            data, layer by layer, and the date each layer was last checked by a
            person. At present that second column reads{" "}
            <span className="never">never human-verified</span> for every layer.
          </p>
          <p>
            If you are looking at somebody else&rsquo;s copy of somap, those
            dates are how you tell whether it has been left to go stale. Nobody
            can update another person&rsquo;s deployment, so somap is built so
            that one cannot hide its age.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Telling somap it is wrong</h2>
        <div className="prose">
          <p>
            There is no way to report a mistake yet, and that is on purpose. A
            report has to be built so that it carries nothing about what you
            searched, and that has not been built. Until it is, the
            sheriff&rsquo;s office is the only way to correct somap, and it is
            the one that counts anyway.
          </p>
        </div>
      </section>

      <footer className="footnote">
        <p>
          <a href="/">Check an address</a>
        </p>
      </footer>
    </main>
  );
}
