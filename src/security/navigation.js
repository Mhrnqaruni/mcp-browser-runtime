import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function isPublicAddress(address) {
  const value = address.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(value) === 4) {
    const [a, b] = value.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && [18, 19, 51].includes(b)) ||
      (a === 203 && b === 0)
    );
  }
  // Conservative IPv6: globally routed unicast only, excluding transition/docs.
  return (
    isIP(value) === 6 &&
    /^[23]/.test(value) &&
    !value.startsWith("2001:") &&
    !value.startsWith("2002:") &&
    !value.startsWith("3fff:")
  );
}

export async function resolveNavigation(raw, policy, resolve = lookup) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Navigation denied");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Navigation denied");
  if (policy.localOrigins.includes(url.origin))
    return { url, address: url.hostname.replace(/^\[|\]$/g, "") };
  if (!policy.origins.includes(url.origin))
    throw new Error("Navigation origin denied");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const results = isIP(hostname)
    ? [{ address: hostname }]
    : await resolve(hostname, { all: true });
  if (!results.length || results.some((item) => !isPublicAddress(item.address)))
    throw new Error("Nonpublic network destination denied");
  return { url, address: results[0].address };
}

export async function assertNavigation(raw, policy, resolve = lookup) {
  return (await resolveNavigation(raw, policy, resolve)).url;
}

export async function installNavigationPolicy(context, policy) {
  // Context routing covers popups and redirected HTTP requests. Service workers
  // must be blocked on context creation. This is not a DNS-pinning firewall.
  await context.route("**/*", async (route) => {
    try {
      await assertNavigation(route.request().url(), policy);
      await route.continue();
    } catch {
      await route.abort("blockedbyclient").catch(() => {});
    }
  });
  await context.routeWebSocket("**/*", (socket) => socket.close());
}
