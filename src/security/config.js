export function jsonList(env, key) {
  if (!env[key]) return [];
  let value;
  try {
    value = JSON.parse(env[key]);
  } catch {
    throw new Error(`${key} must be a JSON string array`);
  }
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || !item.trim())
  ) {
    throw new Error(`${key} must be a JSON string array`);
  }
  return value;
}

export function exactOrigin(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid allowed origin");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Expected an exact HTTP(S) origin");
  return url.origin;
}

export function loadPolicy(env = process.env) {
  const flag = (key) => {
    if (env[key] === undefined || env[key] === "false") return false;
    if (env[key] === "true") return true;
    throw new Error(`${key} must be true or false`);
  };
  const origins = jsonList(env, "MCP_ALLOWED_ORIGINS").map(exactOrigin);
  const localOrigins = jsonList(env, "MCP_LOCAL_TEST_ORIGINS").map(exactOrigin);
  for (const raw of localOrigins) {
    const host = new URL(raw).hostname;
    if (!["127.0.0.1", "[::1]"].includes(host))
      throw new Error("Local fixtures require a literal loopback origin");
  }
  const evaluateOrigins = jsonList(env, "MCP_EVALUATE_ALLOW_ORIGINS").map(
    exactOrigin,
  );
  const evaluate = flag("MCP_ALLOW_EVALUATE");
  if (
    evaluate &&
    (!evaluateOrigins.length ||
      evaluateOrigins.some(
        (origin) => !origins.includes(origin) && !localOrigins.includes(origin),
      ))
  ) {
    throw new Error(
      "Evaluate requires explicit origins also permitted for navigation",
    );
  }
  // Removed escape hatches fail rather than silently inheriting old authority.
  for (const key of [
    "MCP_ARGS",
    "MCP_STEALTH",
    "MCP_EXECUTABLE_PATH",
    "MCP_USER_DATA_DIR",
    "MCP_PROFILE",
    "MCP_CDP_ENDPOINT",
    "MCP_CHROME_PATH",
    "MCP_FORCE_CDP",
    "MCP_REQUIRE_PROFILE",
  ]) {
    if (env[key])
      throw new Error(`Legacy launch setting ${key} is unsupported`);
  }
  if (
    Object.keys(env).some(
      (key) => key.startsWith("GEMINI_CLI_MCP_") && env[key],
    )
  ) {
    throw new Error("Legacy client-specific launch settings are unsupported");
  }
  return Object.freeze({
    origins,
    localOrigins,
    evaluateOrigins,
    evaluate,
    mutations: flag("MCP_ENABLE_MUTATIONS"),
    sessionSecrets: flag("MCP_ENABLE_SESSION_SECRETS"),
    pdf: flag("MCP_ENABLE_PDF"),
    authDir: env.MCP_AUTH_DIR || null,
    readRoots: jsonList(env, "MCP_READ_ROOTS"),
    writeRoots: jsonList(env, "MCP_WRITE_ROOTS"),
    secrets: jsonList(env, "MCP_REDACT_VALUES"),
  });
}
