# Changelog

## Unreleased — repository cleanup

Runtime candidate work additionally upgrades SDK/Playwright/Zod/PDF dependencies,
fixes protocol stdout, extracts registration/managed-browser policies, adds exact
origins and a validating proxy, gates interactions through client confirmation,
replaces legacy file roots, and makes observability metadata-only. Adds real
stdio/local-browser tests, generated tool reference, doctor, and proposed CI.
Adds eleven domain tool modules, opt-in confirmed session persistence, bounded
child-process PDF extraction, viewport JPEG responses, and packed-install checks.
Other privileged legacy features remain disabled and the complete plan is unfinished.

- Remove personal artifacts, unrelated social automation, unsafe batch launchers,
  and job-specific client profiles from the candidate tree.
- Add explicit npm publication blocking, a package allowlist, and focused checks.
- Replace unsupported readiness/performance/privacy claims with accurate status.
- Correct lockfile root version metadata without changing dependency versions.

Breaking migration: old installer/launcher/profile paths are no longer supported.
Historical privacy cleanup and remaining runtime/CI gates are pending. Dependency
remediation is implemented locally. No release has been published for these changes.
