export function packagePathAllowed(name) {
  if (
    typeof name !== "string" ||
    name.includes("\\") ||
    name.split("/").includes("..")
  )
    return false;
  return (
    /^(?:package\.json|README\.md|SECURITY\.md|CONTRIBUTING\.md|CHANGELOG\.md|LICENSE)$/.test(
      name,
    ) ||
    /^src\/[a-z0-9-]+\.js$/.test(name) ||
    /^src\/(?:browser|security|server|tools)\/[a-z0-9-]+\.js$/.test(name) ||
    /^docs\/[A-Z][A-Z-]*\.md$/.test(name)
  );
}

export function validatePackageEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0)
    throw new Error("Empty package manifest");
  const names = entries.map((entry) => entry.path);
  if (
    new Set(names).size !== names.length ||
    names.some((name) => !packagePathAllowed(name))
  ) {
    throw new Error(
      "Package contains unexpected paths; inspect locally without publishing raw data",
    );
  }
  for (const required of [
    "package.json",
    "README.md",
    "LICENSE",
    "src/mcp-browser-server.js",
  ]) {
    if (!names.includes(required))
      throw new Error("Package missing required runtime or documentation file");
  }
  return names.length;
}
