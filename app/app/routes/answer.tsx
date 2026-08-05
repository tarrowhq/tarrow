// The answer page. One POST in, one server-rendered document out.
//
// THE ROUTE DOES NOT COMPUTE ANYTHING. Phase 3's handoff note is explicit:
// "Do not compute anything in the route. A renderer that derives 'no flags
// means fine' is the failure the type gate exists to prevent; it cannot
// construct a clearance, but it can still write one as a sentence." So this
// file hands the typed string to server/search.ts and hands whatever comes
// back to app/result-view.tsx. There is no branch here on whether anything was
// found, no count, no threshold, and nothing that could become one.
//
// `search()` never throws (Phase 3): a failure is a variant of the result,
// carrying the coverage manifest, because a thrown error rendered as a blank
// page after somebody typed an address reads like a clean answer.
//
// THE ADDRESS IS IN THE BODY. This route answers POST, never GET, so the
// address never reaches a URL -- not the address bar, not browser history, not
// a `Referer` header, not a future proxy's access log. Nothing here writes it
// anywhere else either: no log line, no error report, no cookie, no session.
// The response carries `Cache-Control: no-store` (app/server/http.ts) so this
// page is not written to disk by a browser on a shared computer.
//
// There is also no `loader`. A loader on this route would re-run after the
// action on a document POST, and a loader that redirected home would throw the
// answer away. A plain GET to /answer therefore renders the component with no
// action data at all, which is a real state -- somebody following a bookmark
// -- and is answered honestly below rather than with an empty result shape.

import { useActionData } from "react-router";

import type { SearchResult } from "../../server/result.ts";
import { search } from "../../server/search.ts";
import {
  Masthead,
  PrivacyFootnote,
  ResultPage,
  SheriffNextStep,
} from "../result-view.tsx";

interface AnswerData {
  readonly result: SearchResult;
}

export function meta() {
  // Static. A title carrying the searched address would put it in the browser
  // tab, in the window title, and in the history entry -- the three places
  // this route exists to keep it out of.
  return [{ title: "somap — what was checked, and what was not" }];
}

export async function action({
  request,
}: {
  request: Request;
}): Promise<AnswerData> {
  const form = await request.formData();
  const typed = form.get("address");
  return { result: await search(typeof typed === "string" ? typed : "") };
}

/** A GET to this route: nothing was submitted, so nothing was checked. */
function NothingWasSubmitted() {
  return (
    <main className="page">
      <Masthead />
      <div className="answer answer--broken">
        <p className="answer__label">No result — nothing was submitted</p>
        <h1 className="answer__headline">
          No address reached somap, so nothing was checked.
        </h1>
        <div className="prose">
          <p>
            You have arrived at the answer page without an address — usually a
            bookmark, a refresh, or a back button. somap has measured nothing
            and is saying nothing about any address.
          </p>
          <p>
            <a href="/">Start a search</a>.
          </p>
        </div>
      </div>
      <SheriffNextStep />
      <PrivacyFootnote />
    </main>
  );
}

export default function Answer() {
  const data = useActionData<AnswerData>();
  if (data === undefined) return <NothingWasSubmitted />;
  return <ResultPage result={data.result} />;
}
