# Security model and residual risk

The MCP client/operator is trusted. Page content, tool arguments, local file
contents, and network destinations are not authority to widen server permissions.
This project is not an OS sandbox or a production security certification.

## Implemented boundaries

- Registration uses an explicit supported-tool policy; unknown tools fail closed.
  Sensitive legacy tools are not registered and cannot be invoked by name.
- Supported mutations require operator capability plus a fresh MCP form-elicitation
  acceptance. The complete arguments are shown (oversized requests are rejected).
  Frame content/URL fingerprints reject changes while confirmation is pending.
  Tool calls are serialized within one process.
- Navigation uses exact origins. Ordinary hosts must resolve entirely to allowed
  public address ranges. Local fixtures need an explicit literal origin/port.
- Each managed browser receives a private loopback proxy. Each upstream connection
  uses the IP from its validation lookup; redirects receive new destination checks.
  HTTP content is streamed; HTTPS tunnels retain browser certificate validation.
  Context routing adds checks; service workers, WebSockets, QUIC and nonproxied
  WebRTC UDP are restricted. No model-selected browser arguments are accepted.
- File tools have separate explicit roots, reject traversal, alternate streams,
  linked parents and hard links, bound reads, and create new files exclusively.
  Client-visible file paths are relative. POSIX writes request mode 0600.
- Protocol stdout contains MCP messages only. Handler errors and startup failures
  omit raw exception details. Observability does not retain bodies, headers, raw
  console text, or exception text; URL query values are redacted.
- Shutdown closes only the runtime-created browser and its proxy. There is no
  broad Chrome process-kill command or primary-profile access path.

## What these controls do not establish

A malicious MCP client can automatically approve elicitation. Confirmation is
therefore meaningful only with a trustworthy client/user interaction. GET requests
and page scripts can have side effects, and inspection is not a promise of a
read-only website session. Authorization to inspect an origin is not permission
to submit forms or change an account.

Before/after DOM fingerprints are not atomic action binding: a page can change
after the last check or alter non-DOM application state. Arbitrary evaluate can
have irreversible side effects; timeout does not undo them. Same-user malicious
processes can race filesystem parents; Node path checks are not a substitute for
an isolated OS account/filesystem. Windows permissions are inherited, not a full
ACL provisioning mechanism. Failed writes can leave a partial newly created file.

The proxy is an application guardrail, not proof of all browser/OS egress denial.
DNS resolution itself reaches the configured resolver. Browser compromise,
extensions outside this launch path, malicious same-user processes, native parser
memory, and operating-system behavior require separate containment. Use a
disposable environment for untrusted targets, not real accounts or secrets.

Tests establish specific synthetic cases, not exhaustive security. Session and
PDF operations are opt-in; CDP, upload/download persistence and several legacy
features remain unavailable. PDF execution is a bounded child with a V8 heap
setting, not a complete native-memory or OS-access sandbox.
Full history cleanup, broader adversarial evidence, and owner release approval
remain separate requirements.
