// THE TEST THAT PROVES IT.
//
// Run real searches through this composition, drive real HTTP traffic at the
// running server, make the database fail on a query carrying a typed address,
// then read EVERY log stream every container in the project has produced --
// application, HTTP server, PostgreSQL, container stdout and stderr -- and
// prove that neither the searched address nor this client's IP address appears
// in any of them.
//
// Spec FR-023, FR-027, and User Story 4 scenario 1. Constitution Principle III:
// the uniquely dangerous datum is where somebody is TRYING to move; it exists
// nowhere else in the world, and tarrow does not create it as a record.
//
// TWO WAYS THIS TEST COULD LIE TO US, AND WHAT IS DONE ABOUT EACH
//
//   1. It could capture nothing and pass. A grep over an empty string finds no
//      address. So the capture is asserted live first: the database's own
//      startup banner and the app's own listen line must be present in what
//      was captured, or the test fails before it greps for anything. (This is
//      the same hazard the orchestrator found in the suite invocation itself --
//      a run that collects zero tests reads as "everything passes".)
//
//   2. It could search for something that was never there. So the searches
//      really run: the county fixture must come back as a real flagged result,
//      and the deliberate database error must really raise. If the address
//      never reached PostgreSQL, its absence from PostgreSQL's log proves
//      nothing.

import assert from "node:assert/strict";
import net from "node:net";
import { after, before, describe, test } from "node:test";

import { pool } from "../server/db.ts";
import { search } from "../server/search.ts";
import {
  captureLogs,
  inspectContainer,
  ownAddresses,
  projectContainers,
  type CapturedStream,
} from "./docker.ts";
import { NEAR_A_SCHOOL } from "./fixtures.ts";

const ORIGIN = process.env.TARROW_APP_ORIGIN ?? "http://app:3000";

/**
 * A canary address, chosen to be unmistakable.
 *
 * "ZZYZX" and "8675309" do not occur in PostgreSQL's log vocabulary, in
 * Node's, in a stack trace, in a container id, or in Summit County's address
 * layer. If either string turns up in a log stream, it came from this test's
 * request and nothing else -- there is no coincidence to argue about.
 */
const CANARY = "8675309 ZZYZX SENTINEL PRIVACY WAY, AKRON, OH 44309";

/** The real one. A search that actually resolves, measures, and flags. */
const REAL = NEAR_A_SCHOOL.typed;

/**
 * The strings a log stream must not contain. Whole typed addresses, and the
 * distinctive tokens inside them -- because a leak that truncated or
 * re-cased the address would still be a leak.
 *
 * Short numeric fragments are deliberately NOT here: "1464" would match a
 * process id or a byte count and turn this test into a coin flip.
 */
const FORBIDDEN_SUBSTRINGS: readonly string[] = [
  CANARY,
  "ZZYZX",
  "SENTINEL PRIVACY",
  "8675309",
  REAL,
  "GARMAN",
  "1464 GARMAN",
];

let streams: CapturedStream[] = [];
let clientAddresses: string[] = [];

/** Drive traffic at the server through every surface that could log it. */
async function driveHttpTraffic(): Promise<void> {
  const encoded = encodeURIComponent(CANARY);

  // THE REAL SUBMIT PATH. Phase 5's form POSTs the address to /answer, which
  // runs the whole query path and renders a full result document. This is how
  // an address actually arrives, so it is the request that matters most here.
  await fetch(`${ORIGIN}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `address=${encoded}`,
  }).catch(() => undefined);

  // The same body posted to `/`, which has no action and answers 405 -- an
  // error path, which is where a framework is most likely to log.
  await fetch(`${ORIGIN}/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `address=${encoded}`,
  }).catch(() => undefined);

  // The address in a query string, in a path segment, and in headers. None of
  // these is how tarrow submits a search -- they are here because they are how
  // an access log, a 404 handler, or a proxy would capture one.
  await fetch(`${ORIGIN}/?address=${encoded}`).catch(() => undefined);
  await fetch(`${ORIGIN}/search/${encoded}`).catch(() => undefined);
  await fetch(`${ORIGIN}/`, {
    headers: {
      "User-Agent": `tarrow-privacy-probe ${CANARY}`,
      Referer: `${ORIGIN}/?address=${encoded}`,
      "X-Probe-Address": CANARY,
    },
  }).catch(() => undefined);

  // A request malformed at the protocol level, which Node rejects before a
  // response object exists. Its default handler is the one place in a node
  // server that might print something about a connection.
  await new Promise<void>((resolve) => {
    const url = new URL(ORIGIN);
    const socket = net.connect(
      { host: url.hostname, port: Number(url.port || 80) },
      () => {
        socket.write(`GET /${encoded} HTTP/9.9\r\n\r\n`);
      },
    );
    socket.on("data", () => undefined);
    const done = () => {
      socket.destroy();
      resolve();
    };
    socket.on("close", done);
    socket.on("error", done);
    setTimeout(done, 2000);
  });
}

before(async () => {
  clientAddresses = ownAddresses();

  // 1. A real, complete search: resolve, match a parcel, measure against
  //    school premises, and flag. The address reaches PostgreSQL as a bind
  //    parameter, exactly as it does in production.
  const real = await search(REAL);
  assert.equal(
    real.kind,
    "premises-within-buffer",
    "the log-capture test must run a REAL search; if this fixture stopped " +
      "resolving, the absence of its address from the logs proves nothing",
  );

  // 2. A search that finds nothing, so the canary travels the resolution path
  //    too. It still reaches the database as a parameter.
  const canary = await search(CANARY);
  assert.equal(canary.kind, "could-not-locate");

  // 3. A database error carrying the address as a bind parameter. This is the
  //    case `log_min_error_statement` exists for: PostgreSQL's default logs
  //    the full text of any failing statement, and `log_parameter_max_length`
  //    defaults to logging bind parameters in full wherever a statement is
  //    logged at all.
  const client = await pool.connect();
  try {
    await assert.rejects(
      client.query("SELECT 1 FROM tarrow_no_such_table_privacy_probe WHERE x = $1", [
        CANARY,
      ]),
      "the deliberate database error must actually raise, or the log it would " +
        "have produced was never provoked",
    );
  } finally {
    client.release();
  }

  // 4. Real HTTP traffic at the running server.
  await driveHttpTraffic();

  // Let the engine flush what the containers wrote.
  await new Promise((resolve) => setTimeout(resolve, 2500));

  streams = await captureLogs();
});

after(async () => {
  await pool.end();
});

describe("the capture is real before anything is concluded from it", () => {
  test("every container in the composition was captured", () => {
    const names = streams.map((s) => s.container).sort();
    assert.ok(
      names.some((n) => n.includes("-db-")),
      `the database container's logs must be in the capture; got ${names.join(", ")}`,
    );
    assert.ok(
      names.some((n) => n.includes("-app-")),
      `the application container's logs must be in the capture; got ${names.join(", ")}`,
    );
  });

  test("the captured streams are not empty", () => {
    const all = streams.map((s) => s.text).join("");
    assert.ok(
      all.length > 200,
      `captured only ${all.length} characters across ${streams.length} containers. ` +
        "A grep over nothing finds nothing; that is not a pass.",
    );
  });

  test("PostgreSQL's own output is present, so its stream is genuinely being read", () => {
    const db = streams.find((s) => s.container.includes("-db-"));
    assert.ok(db);
    assert.match(
      db.text,
      /database system is ready to accept connections/,
      "the database's startup banner must appear in the capture. If it does " +
        "not, this test is not reading PostgreSQL's log and cannot say " +
        "anything about what is in it.",
    );
  });

  test("the application's own output is present, so its stream is genuinely being read", () => {
    const app = streams.find((s) => s.container.includes("-app-"));
    assert.ok(app);
    assert.match(
      app.text,
      /tarrow app listening on :\d+/,
      "the server's startup line must appear in the capture",
    );
  });

  test("this client has an address to look for", () => {
    assert.ok(
      clientAddresses.length > 0,
      "no non-loopback address on this container, so the client-IP assertion " +
        "below would be searching for nothing",
    );
  });
});

describe("no searched address appears in any log stream", () => {
  for (const forbidden of FORBIDDEN_SUBSTRINGS) {
    test(`"${forbidden}" appears in no container's output`, () => {
      for (const stream of streams) {
        const haystacks: [string, string][] = [
          ["decoded", stream.text.toUpperCase()],
          // The undecoded bytes too: a leak must not be able to hide in the
          // stream framing or in a partial multi-byte sequence.
          ["raw", stream.raw.toUpperCase()],
        ];
        for (const [which, hay] of haystacks) {
          assert.equal(
            hay.includes(forbidden.toUpperCase()),
            false,
            `${stream.container} (${which}) recorded a searched address. ` +
              "Constitution Principle III: tarrow does not create a record of " +
              "where somebody is trying to move.",
          );
        }
      }
    });
  }
});

describe("no client IP appears in any log stream", () => {
  test("this container's addresses appear in no container's output", () => {
    for (const address of clientAddresses) {
      for (const stream of streams) {
        assert.equal(
          stream.text.includes(address),
          false,
          `${stream.container} recorded the client IP ${address}. An IP address ` +
            "is personally identifying data and Principle III forbids storing " +
            "it, including in a log line nobody meant to keep.",
        );
        assert.equal(stream.raw.includes(address), false);
      }
    }
  });
});

describe("PostgreSQL is configured not to log what was asked", () => {
  const EXPECTED: ReadonlyArray<readonly [string, string, string]> = [
    ["log_statement", "none", "the box: no statement text, ever"],
    ["log_connections", "off", "the box: a connection line carries the client address"],
    ["log_disconnections", "off", "the box: so does a disconnection line"],
    [
      "log_min_error_statement",
      "panic",
      "NOT the default (`error`): the default logs the full text of any " +
        "statement that fails",
    ],
    [
      "log_parameter_max_length",
      "0",
      "NOT the default (-1 = log bind parameters in full). The searched " +
        "address travels as a bind parameter.",
    ],
    ["log_parameter_max_length_on_error", "0", "same, on the error path"],
    ["log_min_duration_statement", "-1", "slow-query logging prints the statement"],
    ["log_duration", "off", "timing per statement is a per-request record"],
    ["log_replication_commands", "off", "another statement-logging path"],
    ["log_hostname", "off", "reverse DNS of the client is client identity"],
    [
      "log_destination",
      "stderr",
      "everything the database says must go to the stream this test captures",
    ],
    [
      "logging_collector",
      "off",
      "with a collector on, logs become files inside the volume -- somewhere " +
        "this capture does not look",
    ],
  ];

  for (const [name, expected, why] of EXPECTED) {
    test(`${name} = ${expected}`, async () => {
      const { rows } = await pool.query<{ setting: string }>(
        "SELECT setting FROM pg_settings WHERE name = $1",
        [name],
      );
      assert.equal(rows[0]?.setting, expected, why);
    });
  }

  test("log_line_prefix carries no client host or port", async () => {
    const { rows } = await pool.query<{ setting: string }>(
      "SELECT setting FROM pg_settings WHERE name = 'log_line_prefix'",
    );
    const prefix = rows[0]?.setting ?? "";
    for (const escape of ["%h", "%r"]) {
      assert.equal(
        prefix.includes(escape),
        false,
        `log_line_prefix contains ${escape}, which puts the client's address on ` +
          "every log line the database emits, whatever log_connections says",
      );
    }
  });

  test("the running process was STARTED with these flags, not merely asked for them", async () => {
    // `SHOW log_statement` reports what the server currently believes. A
    // command-line flag is what it was started with, cannot be changed by
    // `ALTER SYSTEM`, and is readable from outside the container -- which is
    // the difference between a setting and a control.
    const containers = await projectContainers();
    const db = containers.find((c) => c.Labels["com.docker.compose.service"] === "db");
    assert.ok(db, "no `db` container in this compose project");
    const inspected = await inspectContainer(db.Id);
    const argv = [inspected.Path, ...inspected.Args].join(" ");

    for (const flag of [
      "log_statement=none",
      "log_connections=off",
      "log_disconnections=off",
      "log_min_error_statement=panic",
      "log_parameter_max_length=0",
      "logging_collector=off",
    ]) {
      assert.ok(
        argv.includes(flag),
        `the database process was not started with ${flag}. Its argv was:\n${argv}`,
      );
    }
  });

  test("no statement-recording extension is installed", async () => {
    const { rows } = await pool.query<{ extname: string }>(
      "SELECT extname FROM pg_extension ORDER BY extname",
    );
    const installed = rows.map((r) => r.extname);
    for (const forbidden of ["pg_stat_statements", "auto_explain", "pgaudit"]) {
      assert.equal(
        installed.includes(forbidden),
        false,
        `${forbidden} keeps query text outside the log, where none of the log ` +
          "settings above reach it",
      );
    }
  });
});
