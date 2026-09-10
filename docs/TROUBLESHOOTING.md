# Troubleshooting

| Symptom | Safe next step |
|---|---|
| Startup rejected | Validate JSON arrays and exact origins; remove obsolete client/profile/stealth variables |
| Browser binary missing | Run the documented explicit Playwright Chromium acquisition command |
| Tool missing | Check the capability table; sensitive legacy tools are unavailable, not hidden behind an undocumented bypass |
| Navigation denied | Check exact scheme/host/port and destination class; local tests require literal fixture origins |
| Mutation rejected | Use a client that supports form elicitation and approve the exact action; retry if the page changed |
| File access denied | Configure one existing root, use relative forward-slash paths and existing parents, avoid links/hard links and overwrite |
| Proxy or browser fails | Close the owned server/browser, inspect a synthetic reproduction, and restart; never kill unrelated Chrome processes |

Use `node src/mcp-browser-server.js` for MCP stdio, not `npm start` with its banner.
Diagnostics are intentionally generic. Do not weaken policy or paste private
content into public issues to debug a failure.
