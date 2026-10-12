# Temporary tooling-only dependency exceptions — 2026-10-12

Status: **TEMPORARY / NOT A RUNTIME VULNERABILITY ACCEPTANCE**

The IRON app dependency gate has two upstream advisories with no patched npm release as of 2026-10-12:

- `braces` — GHSA-vfj7-8cjw-p6xm
- `node-forge` — GHSA-86w9-cpqp-85rv

These exceptions are narrow, expire automatically on **2026-11-15**, and do not permit any other HIGH or CRITICAL advisory.

## Scope evidence

- `braces` is reached through Jest/Metro-style build/test glob tooling.
- `node-forge` is reached through Expo CLI / Expo code-signing tooling.
- The Web runtime image contains only the static `dist-web` export and `scripts/serve-web.mjs`; it does not copy `node_modules`.
- Android/iOS/Web production exports must pass explicit marker checks proving these tooling packages are absent from shipped bundles.

If either marker appears in a production artifact, CI fails.

## Removal condition

Remove each exception immediately when:
1. an upstream patched release becomes available; or
2. the dependency path can be removed without breaking supported Expo SDK 57 behavior.

No production release may rely on an expired exception.
