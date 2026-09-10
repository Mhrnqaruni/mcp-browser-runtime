# Testing and evidence

From a clean source checkout:

```text
npm ci --ignore-scripts
node node_modules/playwright/cli.js install chromium
npm run lint
npm run format:check
npm test
npm run docs:check
npm run pack:check
npm run pack:verify
npm audit --omit=dev
```

Dependency/browser installation uses the network. Tests use owned local HTTP
fixtures, temporary filesystem roots and the actual stdio server. No real account,
primary browser profile, or public Google/Indeed/LinkedIn workflow is used.

## Scope

- Protocol: initialize, list, successful call, invalid schema, structured failure,
  unavailable tool, client lacking confirmation, and protocol-only stdout.
- Browser: launch/navigation, direct and redirected destination denial, blocked
  subresources, snapshot, rejected submission, per-action approved fill/click,
  multiple pages, relaunch, and leaving an unrelated browser running on close.
- Policies: invalid/legacy config, capabilities, exact local ports, private IPv4/
  IPv6, repeated DNS checks, root/link/hard-link rejection, bounded read, no
  overwrite, and redaction.
- Payloads: retained capture/budget assertions plus circular/BigInt rejection and
  nested/binary/Unicode budgeting. Unsupported serialization fails, not false success.
- Packaging: explicit file paths, no local state/test shipping, and private flag.
- Sensitive features: cookie metadata/value distinction, exclusive auth export,
  real local-browser storage roundtrip, and PDF subprocess success/failure/timeout.

The packed-artifact check creates a temporary tarball, installs it outside the
checkout, runs the real MCP doctor, audits the resulting dependencies and removes
the temporary installation. It uses the package registry but publishes nothing.

Inherited standalone scripts are quarantined under `test/legacy`. Only the two
capture/payload scripts are currently called by the new suite; do not count the
remaining inherited scripts as passing. Remote scripts with misleading skip/pass
behavior were removed, not silently counted as successes.

The local environment is Windows, Node 24.13.0, npm 11.15.0. CI targets Node 22
and 24 on Windows/Ubuntu, but a configured matrix is not evidence of passing CI.
No macOS validation or client compatibility certification is claimed.

The adopted ESLint rules check selected correctness errors; they are not a full
type system or comprehensive static audit. Prettier checks formatting. Full tool
behavior, every failure/race, TLS/proxy edge cases, state privacy, and disabled
features require more evidence. Secret scans do not clear historical PII.
