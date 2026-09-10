# Public-readiness status

**Owner-authorized clean-history public successor; experimental, not production-ready.**
Public repository creation was approved on 2026-09-10. This permits sharing the
reviewed source and documentation, not claiming the full original hardening plan
is complete. Do not infer production readiness from a professional README.

## Implemented candidate work

- Current-tree personal artifacts and unrelated automation removed; unsafe
  installer, launchers and personal-answer profiles retired.
- Exact direct dependency upgrades and compatible transitive remediation.
- Protocol-only stdout, generic error messages and actual stdio handshake tests.
- Small entrypoint plus extracted registration, policy and managed lifecycle.
- Explicit tool policy with annotations and generated input-schema documentation.
- Origin/private-address checks plus per-browser proxy connecting to validated IPs.
- Temporary sandboxed Chromium context, no arbitrary executable/profile/args,
  blocked service workers/downloads, and owned shutdown.
- Operator capability plus per-action client confirmation; frame/URL fingerprints
  reject changes during confirmation. No approval bypass for unsupported clients.
- Explicit read/write roots, relative paths, link/hard-link rejection, bounded
  reads and exclusive new writes.
- Metadata-only observability; raw headers/bodies/console content not captured.
- Opt-in confirmed cookie/storage handling, exclusive auth export/import, bounded
  child PDF parsing, and budgeted viewport image capture with optional safe output.
- Local browser, protocol, policy, capture-budget, and publication checks.
- Private package flag, allowlist inspection, pinned tooling, formatting/lint,
  generated-doc drift checks, Dependabot and proposed Windows/Linux CI.
- Accurate README, configuration/security/privacy/testing/architecture guidance.

## Still required

| Gate | Remaining work |
|---|---|
| History/privacy | Successor starts with an exported reviewed tree and fresh history; old repository/caches are unchanged and remain a separate privacy issue |
| Feature scope | Owner choice: complete privileged legacy features or defer them in a smaller first release; currently unavailable, not implemented safely |
| Privileged features | Safe CDP, full visual maps, uploads/download persistence and combined event-actions need dedicated implementations/evidence before enabling; session/PDF edge cases still need broader coverage |
| Adversarial evidence | Broader TLS/proxy edge cases, concurrent filesystem changes, action races, lifecycle faults and every supported tool |
| Architecture | Tool handlers are split into eleven domains; simplify remaining shared state and remove or replace unavailable legacy implementations |
| CI | Observe exact-SHA Windows/Linux checks; resolve failures and configure owner-approved branch protection |
| Distribution | Fresh clone and packed-artifact install/handshake evidence at final SHA; release SBOM/notices and version decision |
| Public presentation | Owned demo recording and reproducible benchmark only if making numeric claims; verified client examples |
| Ownership/license | Confirm provenance and copyright holder; existing ISC unchanged |
| Approval | Initial clean-history publication authorized; future merges, changes to the predecessor, and release/npm publication remain separate decisions |

Application guardrails are not an OS isolation guarantee. The security model
documents residual races and trust assumptions. Unavailable legacy tools remain
absent from registration even when requested by name. Supported privileged tools
require the configuration and confirmation gates described in CONFIGURATION.md.

## Branch and publication boundary

The predecessor's public `master` is unchanged. This successor uses `main` with
fresh history, without copying its predecessor's `.git` directory. Future changes
use topic branches and reviewed PRs. Backups stay confidential and outside this
repository. Do not force-push, alter the predecessor, publish an npm package, tag
a release, or rewrite old refs without separate owner approval.

References: [MCP stdio](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#stdio),
[npm package boundaries](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/),
[Playwright routing](https://playwright.dev/docs/api/class-browsercontext#browser-context-route).
