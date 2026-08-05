// React Router's server entry, ejected (`react-router reveal`) for ONE reason:
// its default logs the request URL.
//
// THE LEAK THIS FILE CLOSES
//
// React Router's built-in error handler is, in effect:
//
//     (error, { request }) => { if (!request.signal.aborted) console.error(error); }
//
// and the errors it is handed carry the URL inside their message. A request to
// a path that matches no route produces, on the server's stderr:
//
//     Error: No route matches URL "/search/8675309%20ZZYZX%20..."
//
// That is the searched address, in the container log, written by the framework
// rather than by any line of tarrow's code -- which is exactly why the
// no-logging test captures container streams instead of auditing source. It
// was found that way: app/tests/no-logging.test.ts drove a probe address at a
// nonexistent path and read it straight back out of `docker logs`.
//
// Spec FR-023 and FR-027. Constitution Principle III: the uniquely dangerous
// datum is where somebody is TRYING to move, and tarrow does not create it as a
// record -- including a record made on its behalf by a dependency.
//
// Everything else in this file is React Router 7.18.2's default entry,
// unmodified, so that a reviewer can diff it against `react-router reveal` and
// see that the only changes are the two places an error is printed.

import { PassThrough } from "node:stream";

import type { AppLoadContext, EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";

export const streamTimeout = 5_000;

/**
 * CHANGE 1 of 2. React Router calls this for every error it handles on the
 * server, and its default prints the error -- message, URL, and stack -- to
 * stderr.
 *
 * This replacement takes no arguments and reads nothing. It does not accept
 * the error and then decline to print it, because a parameter that exists is a
 * parameter somebody later adds a log line for. There is nothing here to print
 * because nothing is here.
 *
 * The cost is accepted and is the same trade server/entry.ts makes for
 * uncaught exceptions: a fault in this process is not diagnosable from its
 * output. An error report that "usually" omits the address is a control an
 * outsider cannot check, and Principle III's whole point is that the control
 * is not holding the data. Reproduce faults against fixture addresses instead
 * -- docs/privacy/verification.md says so in the same words.
 *
 * The user is not left in the dark: server/search.ts returns a `search-failed`
 * result carrying the coverage manifest, and this layer's own failure path is
 * server/http.ts's fixed body. Both say what failed. Neither says what was
 * searched.
 */
export function handleError(): void {
  // Intentionally empty. See above.
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }

  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");

    // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
    // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
    let readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode
        ? "onAllReady"
        : "onShellReady";

    // Abort the rendering stream after the `streamTimeout` so it has time to
    // flush down the rejected boundaries
    let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
      () => abort(),
      streamTimeout + 1000,
    );

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              // Clear the timeout to prevent retaining the closure and memory leak
              clearTimeout(timeoutId);
              timeoutId = undefined;
              callback();
            },
          });
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          pipe(body);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(_error: unknown) {
          // CHANGE 2 of 2. The default body is
          // `if (shellRendered) { console.error(error); }` -- a streaming
          // render error printed to stderr. A React render error carries
          // component props, and on a result page the props are the address.
          // Same reasoning as handleError above; the status still changes.
          responseStatusCode = 500;
        },
      },
    );
  });
}
