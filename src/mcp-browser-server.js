// Protocol-only stdio entrypoint. Import failures are redacted too.
try {
  const { main } = await import("./server/create-server.js");
  await main();
} catch {
  console.error(
    "Server startup failed. Check documented configuration and dependencies.",
  );
  process.exitCode = 1;
}
