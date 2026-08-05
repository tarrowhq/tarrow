import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Three routes, and the split between the first two is a privacy decision
// rather than a structural one.
//
// `/`        the form. Reads no database, so it loads even when the database
//            is down, and answers GET only.
// `/answer`  the result. Answers POST only, because the typed address travels
//            in the request BODY -- a GET would put it in the URL, and a URL
//            reaches browser history, the address bar, the `Referer` header,
//            and any future proxy's access log (Constitution Principle III).
// `/faq`     what somap checks, what it misses, how to read an answer, and
//            what happens to what you type. Reads no database either. It
//            exists so the other two pages can be short (TASK-0017); it does
//            NOT carry any obligation on their behalf -- Principle II's
//            statement of what was and was not checked stays on every result.
//
// Keeping the action off `/` also keeps `POST /` a 405, which is one of the
// responses app/tests/http-headers.test.ts asserts still carries the full
// security envelope.
export default [
  index("routes/_index.tsx"),
  route("answer", "routes/answer.tsx"),
  route("faq", "routes/faq.tsx"),
] satisfies RouteConfig;
