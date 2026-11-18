# Pinned picomatch source — IRON FIT
Source is copied verbatim from the already-certified FM Command vendor tree,
following micromatch/picomatch PR #254, upstream commit
`c63a5bf4e61dbdb81bc41e97dc2616c30acce337`.
MIT license is included. The private package name and version
`@fmtech/picomatch-backport@4.0.8-iron.0` do NOT claim an official npm release.

CVE-2026-112366 / GHSA-fc5q-39xc-vjpf: repeated extglob ReDoS.
The top-level devDependency plus npm override must resolve all picomatch
consumers to the same local audited source. Runtime/Metro/Jest/Expo
compatibility must be demonstrated by full CI, browser exports, and security
regression with hostile inputs. Do not waive the high-severity dependency
audit. Replace the backport with a verified upstream release when available.
