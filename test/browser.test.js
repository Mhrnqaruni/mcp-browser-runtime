import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { chromium } from "playwright";
import { startClient } from "./stdio-client.js";

test(
  "local MCP browser workflow: navigation, denied destinations, confirmation and owned shutdown",
  { timeout: 90000 },
  async (t) => {
    let submissions = 0;
    let forbiddenRequests = 0;
    const forbidden = http.createServer((_req, res) => {
      forbiddenRequests++;
      res.end("must not load");
    });
    forbidden.listen(0, "127.0.0.1");
    await once(forbidden, "listening");
    t.after(() => {
      forbidden.closeAllConnections();
      return new Promise((resolve) => forbidden.close(resolve));
    });
    const forbiddenOrigin = `http://127.0.0.1:${forbidden.address().port}`;
    const fixture = http.createServer((req, res) => {
      if (req.url === "/frame" || req.url === "/child") {
        res.setHeader("Content-Type", "text/html");
        res.end("<p>Owned child fixture</p>");
        return;
      }
      if (req.url === "/redirect") {
        res.writeHead(302, { location: forbiddenOrigin });
        res.end();
        return;
      }
      if (req.url === "/submit") {
        submissions++;
        res.end("Submitted synthetic form");
        return;
      }
      res.setHeader("Content-Type", "text/html");
      res.end(`<!doctype html><title>Synthetic MCP fixture</title><h1>Owned demo</h1>
      <form action="/submit" method="post"><label>Name <input id="name" name="name"></label><button id="submit">Submit synthetic form</button></form>
      <a id="popup" href="/child" target="_blank">Open tab</a><iframe src="/frame"></iframe>
      <img src="${forbiddenOrigin}/blocked.png">
      <script>console.log('token=fictional-sensitive-value');</script>`);
    });
    fixture.listen(0, "127.0.0.1");
    await once(fixture, "listening");
    t.after(() => {
      fixture.closeAllConnections();
      return new Promise((resolve) => fixture.close(resolve));
    });
    const origin = `http://127.0.0.1:${fixture.address().port}`;
    const authBase = await fs.mkdtemp(
      path.join(os.tmpdir(), "mcp-session-e2e-"),
    );
    const authDir = path.join(authBase, ".mcp-data", "auth");
    await fs.mkdir(authDir, { recursive: true });
    t.after(() => fs.rm(authBase, { recursive: true, force: true }));
    const unrelated = await chromium.launch({
      headless: true,
      chromiumSandbox: true,
    });
    t.after(() => unrelated.close());
    const unrelatedPage = await unrelated.newPage();
    await unrelatedPage.setContent(
      "<title>Unrelated synthetic browser</title>",
    );
    const client = startClient({
      MCP_LOCAL_TEST_ORIGINS: JSON.stringify([origin]),
      MCP_ENABLE_MUTATIONS: "true",
      MCP_ENABLE_SESSION_SECRETS: "true",
      MCP_AUTH_DIR: authDir,
    });
    t.after(() => client.close());
    await client.initialize({ elicitation: { form: {} } });
    const call = async (name, args = {}) => {
      t.diagnostic(`Calling ${name}`);
      const message = await client.call(name, args);
      assert.ok(!message.error, JSON.stringify(message.error));
      return message.result;
    };
    const launched = await call("browser.launch", { headless: true });
    assert.ok(!launched.isError, JSON.stringify(launched));
    assert.ok(!(await call("browser.goto", { url: origin })).isError);
    const snapshot = await call("browser.snapshot");
    assert.ok(!snapshot.isError);
    assert.match(snapshot.content[0].text, /Owned demo/);
    const screenshot = await call("browser.screenshot");
    assert.ok(!screenshot.isError);
    assert.equal(screenshot.content[1].type, "image");
    assert.equal(screenshot.content[1].mimeType, "image/jpeg");
    assert.equal(
      (await call("browser.goto", { url: forbiddenOrigin })).isError,
      true,
    );
    assert.equal(
      (await call("browser.goto", { url: "file:///etc/passwd" })).isError,
      true,
    );
    await call("browser.goto", { url: `${origin}/redirect` });
    assert.equal(forbiddenRequests, 0);
    await call("browser.goto", { url: origin });
    assert.equal(
      (await call("browser.click", { selector: "#submit" })).isError,
      true,
    );
    assert.equal(submissions, 0);
    let approvals = 0;
    client.confirm(() => {
      approvals++;
      return { action: "accept", content: { approve: true } };
    });
    assert.ok(
      !(
        await call("browser.fill", {
          selector: "#name",
          text: "Synthetic Person",
        })
      ).isError,
    );
    assert.ok(!(await call("browser.click", { selector: "#submit" })).isError);
    assert.equal(submissions, 1);
    assert.equal(approvals, 2);
    assert.ok(
      !(
        await call("browser.set_cookies", {
          cookies: [
            { name: "synthetic", value: "fictional-value", url: origin },
          ],
        })
      ).isError,
    );
    const cookieMeta = await call("browser.get_cookies");
    assert.doesNotMatch(cookieMeta.content[0].text, /fictional-value/);
    assert.match(
      (await call("browser.get_cookies", { includeValues: true })).content[0]
        .text,
      /fictional-value/,
    );
    assert.ok(
      !(await call("browser.export_storage_state", { path: "fixture.json" }))
        .isError,
    );
    assert.equal(
      (await call("browser.export_storage_state", { path: "fixture.json" }))
        .isError,
      true,
    );
    assert.ok(!(await call("browser.clear_cookies")).isError);
    assert.ok(
      !(await call("browser.import_storage_state", { path: "fixture.json" }))
        .isError,
    );
    assert.match(
      (await call("browser.get_cookies", { includeValues: true })).content[0]
        .text,
      /fictional-value/,
    );
    await call("browser.new_page");
    const pages = await call("browser.list_pages");
    assert.match(pages.content[0].text, /pageId/);
    assert.ok(!(await call("browser.close")).isError);
    assert.equal(await unrelatedPage.title(), "Unrelated synthetic browser");
    assert.ok(!(await call("browser.launch", { headless: true })).isError);
    await call("browser.close");
    assert.deepEqual(client.violations, []);
  },
);
