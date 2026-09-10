# Architecture

```text
MCP client (trusted approval UI)
  → stdio entrypoint
  → registration + capability policy + per-process serialized dispatch
  → managed browser / frame-aware inspection helpers
  → exact-origin context checks + per-browser validating proxy
  → approved synthetic or public destinations

Optional relative-path text tools → separate explicit read/write roots
```

`src/mcp-browser-server.js` is now a small protocol entrypoint. It catches startup
failures without printing raw paths. `src/server/create-server.js` composes the
shared runtime state and explicitly injects helpers into eleven `src/tools/`
modules: capture, lifecycle, navigation, events, session, interaction,
observability, forms, files, jobs and search. Each module registers its own tool
schemas and callbacks. This separates tool domains without duplicating state;
the remaining shared helper layer still needs further simplification.

`src/server/tool-registry.js` centralizes registration metadata, capabilities,
confirmation, serialized calls, managed-handler dispatch, response budgets and
structured failures. `tools/tool-reference.mjs` uses those same descriptors to
generate documentation and detect drift.

`src/browser/managed-session.js` owns the supported temporary browser lifecycle.
`src/security/proxy.js` owns per-browser proxy sockets and upstream IP validation.
Policy modules cover configuration, exact origins, permissions, confirmation,
file roots, and redaction. Existing `src/browser` helpers provide page IDs, DOM
versions, accessibility capture, forms, events, and payload budgeting.

There is one stateful session per server process. The factory module is not a
multi-tenant HTTP server; do not reuse its state across independent clients.
Legacy sensitive handlers remain in source but are unregistered. Their presence
does not imply support, and they must not be re-enabled without their own review.
