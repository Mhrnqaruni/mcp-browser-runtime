# Owned local workflows

Run `npm run demo:site` in a source checkout. The server binds only to
`127.0.0.1:8000`; set `MCP_DEMO_PORT` if that port is occupied. It does not store
submitted values, use accounts, or load external assets. Stop it with Ctrl+C.

Configure `MCP_LOCAL_TEST_ORIGINS=["http://127.0.0.1:8000"]` on the MCP server.
Change the port in both places if necessary. This is a deliberate local-fixture
exception, not a generic localhost bypass.

## Inspection

Launch the managed browser, navigate to the fixture, take a snapshot, inspect
frames and pages, and capture a viewport screenshot. Compare capture profiles
using the same page; do not turn one observation into a benchmark claim.

## Debugging

Use network/console inspection to examine bounded metadata. Raw headers, bodies,
and console messages are deliberately not captured. It is normal for the output
to omit content; this is not a reason to enable raw logging.

## Confirmed form workflow

With mutations enabled and a client that supports MCP form elicitation, inspect
the form and fill fictional values after confirming the specific action. Stop
before final submission to review the form. Submitting is a separate confirmed
action. Never replace the demo with a real account or client form during validation.

The automated integration test covers a related temporary fixture through the
real MCP entrypoint. A user-facing demo recording and specific client UI acceptance
remain pending; these instructions are not evidence that every client works.
