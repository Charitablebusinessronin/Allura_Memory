/**
 * @allura/sdk — Version bumper
 *
 * Updates the version field in packages/sdk/package.json.
 * Usage: bun run bump-version <version>
 *
 * Copyright (c) Allura Memory Team. MIT License.
 */

const version = process.argv[2];

if (!version) {
  console.error("Usage: bun run bump-version <version>");
  console.error("Example: bun run bump-version 0.2.0");
  process.exit(1);
}

// Validate semver-ish format (major.minor.patch with optional pre-release)
const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
if (!semverRegex.test(version)) {
  console.error(`Invalid version format: "${version}"`);
  console.error("Expected semver format: major.minor.patch[-prerelease]");
  process.exit(1);
}

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pkgPath = join(import.meta.dir, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const oldVersion = pkg.version;
pkg.version = version;

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log(`Updated @allura/sdk version: ${oldVersion} → ${version}`);