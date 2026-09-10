# Privacy and retention

| Data | Current handling |
|---|---|
| Managed browser profile | Temporary Playwright context; no primary profile or external CDP attachment |
| Cookies/storage | Off by default; confirmed capability can reveal requested values or export/import protected auth files; no inline state export |
| Page text/DOM/forms | Explicit inspection can return sensitive page content to the client/model |
| Screenshots/download persistence | Bounded viewport image returned to client; optional confirmed exclusive file creation; downloads disabled |
| Network observations | Bounded metadata rings; no headers/request bodies; query values redacted |
| Console/exceptions | Type/time metadata only; message content not captured |
| Local text files | Separate operator roots; bounded reads, relative paths, exclusive new writes; no automatic retention/deletion |
| PDF files | Opt-in bounded reads and child-process parsing; normalized text returned to client/model |
| Confirmation | Complete action arguments shown to trusted client; no host confirmation log is written |
| Errors | Generic protocol/startup messages, no raw exception/path details |

In-memory observation rings clear when their page closes. Normal managed shutdown
closes browser/context and proxy sockets. Crashes, OS/browser caches, client
transcripts and provider retention are outside a universal deletion guarantee.
No secure deletion claim is made. POSIX new files request mode 0600; Windows
inherits directory ACLs. Use dedicated private roots with no untrusted writers.

Ignore rules cover expected runtime directories, not all possible sensitive files.
They are not access controls, do not prevent force-add, and cannot scrub history.
Package path allowlists do not prove source content is free of PII or secrets.

Historical personal artifacts remain in the old public history. Tip cleanup is
not historical remediation. Do not upload backups or raw scanner reports. Any
discovered exposed credential must be rotated independently of Git cleanup.

Use synthetic data while release work continues. Review the MCP client's and
model provider's data handling before granting any access to real content.
