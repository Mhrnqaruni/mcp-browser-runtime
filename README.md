# MCP Browser Runtime

A local, Node.js [Model Context Protocol](https://modelcontextprotocol.io/) server
for browser inspection and explicitly approved interaction, built with Playwright.
It combines configurable capture profiles, bounded responses, multi-page/frame
state, and operator-controlled capabilities.

**Status: experimental developer tool.** Suitable for evaluation with synthetic
data, not production accounts or untrusted multi-tenant workloads. Independent
project; not Microsoft's official Playwright MCP implementation.

## Why this project exists

Browser agents need useful page context without unrestricted browser or filesystem
access. This runtime explores that trade-off through explicit network policy,
response budgets, temporary sessions, and confirmation before supported mutations.

- **Context control:** light, balanced, and full capture profiles, with bounded
  structured responses and viewport JPEG screenshots.
- **Browser state:** stable page identifiers, frame-aware inspection, DOM and
  accessibility helpers, and an owned browser lifecycle.
- **Network policy:** exact allowed origins and private-address checks backed by
  a per-browser proxy that connects to the IP it validated.
- **Approval:** interaction is disabled by default; enabling it still requires
  per-action MCP form elicitation through the client.
- **Local boundaries:** temporary Chromium contexts, explicit file roots,
  exclusive new-file writes, and metadata-only observability.
- **Engineering evidence:** real stdio protocol tests, synthetic browser fixtures,
  generated tool documentation, package-content checks, and cross-platform CI.

There are 35 tools enabled by the default configuration. The
[generated reference](docs/TOOLS.md) lists all 71 retained descriptors and their
availability. Disabled legacy entries are not advertised as working features.
No comparative speed, accuracy, or token-saving benchmark is claimed.

## Quickstart

Prerequisites: Git, Node.js **22.13 or later**, and npm. CI targets Node 22 and 24
on Windows and Ubuntu; macOS and individual MCP client versions are not certified.

```sh
git clone https://github.com/Mhrnqaruni/mcp-browser-runtime.git
cd mcp-browser-runtime
npm ci --ignore-scripts
npm run doctor
node node_modules/playwright/cli.js install chromium
```

On Linux, browser system dependencies may also be needed:
`node node_modules/playwright/cli.js install --with-deps chromium`.
Installation downloads packages/browser binaries; no account or API key is needed.

`doctor` starts the real MCP server, initializes the protocol, lists tools, and
calls a capture-profile tool. It does not launch a browser or call an AI model.
Successful output includes `"status": "ok"` and `"liveModelCalls": 0`.

### Connect a client

Configure your MCP client to launch `node` directly with the **absolute path** to
`src/mcp-browser-server.js`. For clients using an `mcpServers` configuration shape:

```json
{
  "mcpServers": {
    "browser-runtime": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-browser-runtime/src/mcp-browser-server.js"],
      "env": {
        "MCP_ALLOWED_ORIGINS": "[\"https://example.com\"]",
        "MCP_ENABLE_MUTATIONS": "false"
      }
    }
  }
}
```

Replace the path; on Windows, use a valid absolute path with forward slashes or
JSON-escaped backslashes. Client configuration formats vary: adapt this example
to your client's documentation. **Do not use `npm start` as the stdio command**:
its banner is not MCP protocol traffic.

The inspection sequence is `browser.launch` → `browser.goto` →
`browser.snapshot` or `browser.screenshot` → `browser.close`. With no configured
origins, network destinations are denied. Cross-origin assets need their own
explicit origin entries; there is no wildcard mode.

### Try the owned demo

```sh
npm run demo:site
```

This starts a synthetic site at `http://127.0.0.1:8000`. Configure
`MCP_LOCAL_TEST_ORIGINS=["http://127.0.0.1:8000"]` in the server environment.
The exception applies only to that literal address and port. See
[demo instructions](examples/README.md) for the form, frame, dialog and tab workflow.
No real account, personal browser profile or external-site submission is required.

## Capabilities and limits

| Capability | Default / requirement |
|---|---|
| Browser inspection and viewport capture | Enabled; navigation requires allowed origins |
| Click, type, fill and other supported mutations | Off; operator flag plus fresh client confirmation |
| Local text reads | Off; explicit existing read root |
| Text/screenshot file creation | Explicit write root and confirmed mutation; no overwrite |
| Cookies and storage state | Off; session flag plus confirmed mutation; private auth directory |
| Page JavaScript evaluation | Off; separate flag, allowed evaluate origins and confirmation |
| PDF extraction | Opt-in and experimental; bounded child process can reject slow inputs |
| External CDP, uploads/download persistence, legacy visual maps | Unavailable |

Clients without MCP form elicitation cannot authorize interaction. Do not work
around this with automatic approval. Cookie values, storage state, local files,
page content and screenshots can be sensitive even when access is authorized.

Read [configuration](docs/CONFIGURATION.md), [tool schemas](docs/TOOLS.md),
[security model](docs/SECURITY-MODEL.md), and [privacy](docs/PRIVACY.md) before
enabling capabilities.

## Architecture

```text
MCP client
  └─ stdio entrypoint
       └─ tool policy → confirmation → serialized dispatch → response budget
            ├─ managed Chromium → validating proxy → allowed origins
            ├─ file tools → explicit read/write roots
            └─ optional PDF worker → bounded child process
```

`src/tools/` separates definitions into eleven domains. `src/server/` composes
shared state and registration; `src/browser/` owns browser helpers and lifecycle;
`src/security/` contains capability, file, navigation, proxy and parser controls.
There is one stateful session per process, not a multi-tenant server.
See [architecture](docs/ARCHITECTURE.md) for the boundaries and remaining refactoring.

## Development and verification

```sh
npm run lint
npm run format:check
npm test
npm run docs:check
npm run pack:check
npm run pack:verify
npm audit --omit=dev
```

Tests use synthetic local fixtures and actual MCP stdio traffic. The browser
workflow checks navigation denial, approval, screenshots, session restore and owned
shutdown. Legacy tests are retained separately; only those documented in
[testing](docs/TESTING.md) are claimed as exercised. The CI badge links to actual
results; its presence is not a claim that every run passes.

`npm run docs:generate` refreshes the tool reference. `pack:verify` installs the
allowlisted artifact outside the checkout and runs its doctor. npm publication
is deliberately blocked with `private: true`; install from source.

## Security and project status

This public successor starts with clean Git history and excludes old personal
artifacts, profiles and runtime data. Historical personal material remains in the
predecessor's history; this repository does not erase earlier copies or caches.

Publication does **not** finish runtime hardening. Known limitations include PDF
cold-start/deadline reliability, residual filesystem/action races, unsupported
legacy capabilities, and incomplete adversarial coverage. See the explicit
[readiness checklist](docs/READINESS.md), not just the README, before relying on it.

The runtime is **not an OS security boundary**. A malicious client can fake approval;
a page can change after confirmation; same-user processes can race files. V8 heap
limits do not bound all native memory. Use an isolated environment and synthetic
data; do not attach production or customer accounts. No exhaustive security audit
or production support commitment is claimed.

## Contributing and license

Use a topic branch and a reviewed pull request; do not commit directly to `main`.
See [contribution guidance](CONTRIBUTING.md), [changelog](CHANGELOG.md), and
[security reporting](SECURITY.md). Never put secrets or private browser state in
issues or CI artifacts.

The inherited [ISC license](LICENSE) is retained, including its original notice.
It permits commercial use. This publication does not introduce a noncommercial
license or change third-party dependency terms.
