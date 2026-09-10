const sensitive =
  /authorization|cookie|api[-_]?key|token|password|secret|credential/i;

export function redactText(value, secrets = []) {
  let text = String(value ?? "");
  for (const secret of secrets)
    if (secret) text = text.split(secret).join("[REDACTED]");
  return text
    .replace(/(Bearer\s+)\S+/gi, "$1[REDACTED]")
    .replace(
      /((?:password|token|api[-_]?key|secret|authorization|cookie)\s*[:=]\s*)[^\s,;&]+/gi,
      "$1[REDACTED]",
    );
}

export function redactUrl(raw, secrets = []) {
  try {
    const url = new URL(raw);
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      url.searchParams.set(key, "[REDACTED]");
    }
    return redactText(url.href, secrets);
  } catch {
    return "[invalid URL]";
  }
}

export function redact(value, secrets = [], seen = new WeakSet(), depth = 0) {
  if (depth > 12) return "[TRUNCATED]";
  if (typeof value === "string") return redactText(value, secrets);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  const result = Array.isArray(value) ? [] : {};
  for (const [key, item] of Object.entries(value).slice(0, 1000)) {
    Object.defineProperty(result, key, {
      enumerable: true,
      configurable: true,
      writable: true,
      value: sensitive.test(key)
        ? "[REDACTED]"
        : redact(item, secrets, seen, depth + 1),
    });
  }
  return result;
}
