# Contributing during hardening

Create and verify a confidential offline backup before cleanup. Never commit it.
Use a topic worktree based on the reviewed `main` base;
do not commit directly to `main`. Preserve unrelated changes. Owner approval
is required for each merge, history rewrite, visibility change, or release.

For repository/package changes, run `npm run test:publication`,
`npm run pack:check`, and `git diff --check`. These are narrowly scoped checks;
do not report them as a complete green runtime suite. Runtime changes require
new behavioral, protocol, and security evidence proportional to their risk.
The current candidate sequence is `npm ci --ignore-scripts`, install packaged
Chromium as described in the README, then `npm run lint`, `npm run format:check`,
`npm test`, `npm run doctor`, `npm run docs:check`, `npm run pack:check`,
`npm run pack:verify`, and `npm audit --omit=dev`. Repeat in a clean clone at
the exact review SHA. Record failures and platform limits; do not equate a local
Windows pass with the proposed Linux/Windows CI matrix passing.

Use synthetic local fixtures. Do not run the inherited remote-site scripts or
launchers against personal accounts. Never publish cookies, storage state,
downloads, personal documents, browser profiles, raw diagnostics, or scan findings.

Describe base/candidate commits, changes, exact checks, limitations, dependency
impact, and rollback in each review. Do not weaken a check to obtain a pass.
Historical cleanup and final publication are separate owner decisions.
