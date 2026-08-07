// The test that would have caught TASK-0015, and the reason this directory
// exists at all.
//
// tarrow shipped an app that did not work in a browser while 146 tests passed.
// Every one of them reached the app through `fetch()`, and fetch is not a
// browser: it does not implement referrer policy, so it cannot produce the
// `Origin: null` that React Router rejected, and no assertion over a response
// body could have noticed. The bodies were verified exhaustively; the
// interaction was never verified at all.
//
// So this file does not assert about HTML. It drives a real browser through
// the thing a user actually does -- type an address, press the button, read
// the answer -- and lets the browser apply referrer policy, CSP, caching, and
// form semantics the way a browser does.
//
// It lives in tests/browser/ rather than beside the others because it needs a
// browser in the image. scripts/run-tests.mjs collects only *.test.ts at the
// TOP level of tests/, so the ordinary suite never tries to run this and never
// fails for want of a browser it was not given. The `browser-test` compose
// service runs it, against the `browsertest` image stage.

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import puppeteer, { type Browser } from "puppeteer-core";

const ORIGIN = process.env.TARROW_APP_ORIGIN ?? "http://app:3000";
const CHROMIUM = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";

// A real Summit County address with school premises inside the buffer. The same
// fixture the fetch-based proximity tests use, so a failure here is about the
// browser rather than about the data.
const ADDRESS = "1464 Garman Rd, Akron, OH 44313";

let browser: Browser;

before(async () => {
  browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    // --no-sandbox because this already IS the sandbox: an ephemeral container
    // with no host mount, driving a server on a private compose network.
    //
    // HttpsUpgrades is disabled because Chromium silently rewrites http:// to
    // https:// for any host that is not localhost, and the app here is reached
    // as `app:3000` over the compose network with no TLS. Without this the
    // suite fails with ERR_SSL_PROTOCOL_ERROR and says nothing about tarrow.
    //
    // Worth knowing beyond this file: that upgrade is real browser behaviour,
    // so a SELF-HOSTER serving tarrow over plain HTTP on a LAN hostname hits it
    // too. Recorded for the self-hosting guidance rather than only worked
    // around here.
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-features=HttpsUpgrades,HttpsFirstBalancedMode,HttpsFirstModeV2",
    ],
  });
});

after(async () => {
  await browser?.close();
});

describe("a real browser can actually use tarrow", () => {
  test("submitting the address form returns an answer, not a 400", async () => {
    const page = await browser.newPage();
    try {
      const landing = await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
      assert.equal(landing?.status(), 200, "the landing page must load");

      await page.type("input[type=text]", ADDRESS);

      // The navigation the form causes IS the subject of this test. Under
      // `Referrer-Policy: no-referrer` this response was 400 Bad Request, in
      // every Chromium browser, because the browser serialized the form's
      // origin as `null` and React Router refused it.
      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.click("button[type=submit]"),
      ]);

      assert.equal(
        response?.status(),
        200,
        "The form POST must succeed in a browser. A 400 here means the " +
          "browser sent something the server refused -- check Referrer-Policy " +
          "(no-referrer makes Chromium send `Origin: null`) before assuming " +
          "the failure is in the route.",
      );

      const body = await page.evaluate(() => document.body.innerText);

      // The answer, not merely a page. A 200 that rendered an apology would
      // pass a status check and fail a user.
      assert.match(
        body,
        /within 304\.8 m|inside a buffer/i,
        `Expected a proximity answer for a known-flagged address.\n${body.slice(0, 600)}`,
      );
      // Principle II travels with it, in the document the browser actually got.
      assert.match(body, /not checked|did not look at/i, "manifest must render");
      assert.match(body, /sheriff/i, "sheriff guidance must render");
    } finally {
      await page.close();
    }
  });

  test("the answer arrives with JavaScript disabled", async () => {
    const page = await browser.newPage();
    try {
      // tarrow ships no client script (TASK-0008.01 holds the decision open),
      // so the whole flow must work with scripting off. This is not a
      // degraded mode for this user population -- for someone browsing
      // defensively it is the only mode.
      await page.setJavaScriptEnabled(false);
      await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });
      await page.type("input[type=text]", ADDRESS);

      const [response] = await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.click("button[type=submit]"),
      ]);

      assert.equal(response?.status(), 200, "the form must work without JS");
      const body = await page.evaluate(() => document.body.innerText);
      assert.match(body, /within 304\.8 m|inside a buffer/i);
      assert.match(body, /sheriff/i);
    } finally {
      await page.close();
    }
  });

  test("no request leaves tarrow's own origin, script included", async () => {
    const page = await browser.newPage();
    const offOrigin: string[] = [];
    const scripts: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (!url.startsWith(ORIGIN) && !url.startsWith("data:")) offOrigin.push(url);
      if (req.resourceType() === "script") scripts.push(url);
    });
    try {
      await page.goto(ORIGIN, { waitUntil: "networkidle2" });
      await page.type("input[type=text]", ADDRESS);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2" }),
        page.click("button[type=submit]"),
      ]);

      assert.deepEqual(
        offOrigin,
        [],
        "A browser requested something off-origin. CSP should have blocked it; " +
          "that it was attempted at all is the defect.",
      );
      // Script is permitted now (TASK-0008.01), but only tarrow's own. A
      // bundle served from this origin is auditable from the repository that
      // built it; one fetched from a CDN is a third party watching who reads a
      // page about where they are allowed to live.
      const offOriginScripts = scripts.filter((url) => !url.startsWith(ORIGIN));
      assert.deepEqual(
        offOriginScripts,
        [],
        "a script was loaded from another origin",
      );
    } finally {
      await page.close();
    }
  });
});
