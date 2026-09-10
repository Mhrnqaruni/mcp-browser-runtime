# Configuration

Configuration is operator-owned environment, read before tool registration.
An agent cannot enable a capability through tool arguments. Restart the server
to change capabilities. Invalid configured JSON, booleans, or origins fail startup.

| Variable | Default | Meaning |
|---|---|---|
| `MCP_ALLOWED_ORIGINS` | `[]` | JSON array of exact public HTTP(S) origins; no wildcards, paths, credentials, query, or fragments |
| `MCP_LOCAL_TEST_ORIGINS` | `[]` | Exact literal `127.0.0.1` or `[::1]` origins and ports for owned fixtures only |
| `MCP_ENABLE_MUTATIONS` | `false` | Registers supported interaction tools; each still requires client form elicitation confirmation |
| `MCP_READ_ROOTS` | `[]` | Zero or one existing absolute directory; enables relative-path text reads |
| `MCP_WRITE_ROOTS` | `[]` | Zero or one existing absolute directory; enables exclusive text creation when mutations are enabled |
| `MCP_ENABLE_SESSION_SECRETS` | `false` | Enables cookie/storage tools only alongside mutations and per-call confirmation |
| `MCP_AUTH_DIR` | unset | Existing absolute `.mcp-data/auth` directory for exclusive storage export/import |
| `MCP_ENABLE_PDF` | `false` | Enables bounded child-process PDF reads under the read root |
| `MCP_ALLOW_EVALUATE` | `false` | Registers arbitrary page code only with mutation capability and nonempty evaluate origins |
| `MCP_EVALUATE_ALLOW_ORIGINS` | `[]` | Exact origins also allowed for navigation; no wildcard |
| `MCP_CAPTURE_PROFILE` | `light` | Existing light/balanced/full capture defaults |
| `MCP_MAX_RESPONSE_BYTES` | `280000` | Existing envelope budget, clamped to 32,768–2,000,000 bytes |

Legacy client-specific variables and browser-path/profile/stealth/argument
overrides are rejected. The supported launch path uses packaged Playwright
Chromium, a temporary context, blocked service workers/downloads, the Chromium
sandbox, a per-instance loopback proxy, and no primary-profile attachment.

Roots cannot be symlink/junction paths. Tool file paths are forward-slash relative
paths inside the selected root. Parent directories must already exist. New writes
use exclusive creation; overwrite and automatic directory creation are unavailable.
Use a dedicated private directory with no concurrently untrusted writers.

## Generic stdio integration

Configure your MCP client to run `node` with the absolute path to
`src/mcp-browser-server.js` as its single argument. Set the environment separately
using that client's documented format. Do not run through `npm start` in stdio
configuration: npm's banner is not MCP protocol traffic.

This is a transport specification, not a claim that every client accepts the same
configuration file schema. No current client-specific configuration has been
certified. Clients without MCP form elicitation can use inspection/navigation but
cannot authorize interaction tools. Never bypass that check to make a client work.

## Unavailable features

External/managed CDP attachment, file uploads,
download saving, legacy visual snapshots, raw network bodies,
and combined event-after-action tools remain unregistered. Old environment
variables do not restore these. Their implementations require further hardening
before reintroduction. The generated tool reference shows their disabled status.

## Sensitive operations

Cookie listing returns metadata unless `includeValues: true` is explicitly supplied.
Both forms require session capability and client confirmation. Cookie writes require
an allowed exact URL, not broad domain overrides. Storage files must be simple JSON
filenames in the configured `.mcp-data/auth` directory. Inline export and overwrite
are rejected. Import creates a fresh protected context, checks origins/domains, and
closes the previous context.

`browser.screenshot` returns a viewport JPEG as MCP image content, bounded by the
response budget. Optional relative file output also needs a write root, mutations,
and confirmation; it is exclusively created. Full-page/legacy visual map output is
not yet available. Lower JPEG quality if the response budget is exceeded.

PDF reads require a `.pdf` extension and signature, at most 1 MiB input, at most
50 pages, a 10-second child deadline, 128 MiB V8 old-space setting, and 20,000
characters of returned text. The heap setting is not a total native/RSS memory
limit or an OS sandbox. Unsupported/encrypted/malformed input fails closed.
