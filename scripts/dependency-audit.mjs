import { spawnSync } from "node:child_process";

const APPROVED = new Map([
  ["braces", {
    ghsa: "GHSA-vfj7-8cjw-p6xm",
    url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
    expires: "2026-11-15T00:00:00Z",
    rationale: "Build/test tooling only; no patched upstream release exists."
  }],
  ["node-forge", {
    ghsa: "GHSA-86w9-cpqp-85rv",
    url: "https://github.com/advisories/GHSA-86w9-cpqp-85rv",
    expires: "2026-11-15T00:00:00Z",
    rationale: "Expo CLI/code-signing tooling only; no patched upstream npm release exists."
  }]
]);

const result = spawnSync("npm", ["audit", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32"
});

let audit;
try {
  audit = JSON.parse(result.stdout || "{}");
} catch {
  console.error("DEPENDENCY_AUDIT_FAIL invalid npm audit JSON");
  process.exit(1);
}

const vulnerabilities = audit.vulnerabilities ?? {};
const blockers = [];
const approvedFindings = [];

for (const [name, finding] of Object.entries(vulnerabilities)) {
  const severity = String(finding.severity ?? "").toLowerCase();
  if (severity !== "high" && severity !== "critical") continue;

  const advisories = Array.isArray(finding.via)
    ? finding.via.filter((item) => item && typeof item === "object")
    : [];
  const urls = advisories.map((item) => String(item.url ?? "")).filter(Boolean);
  const exception = APPROVED.get(name);

  if (severity === "critical") {
    blockers.push({ name, severity, urls, reason: "critical findings are never excepted" });
    continue;
  }

  if (!exception || !urls.includes(exception.url)) {
    blockers.push({ name, severity, urls, reason: "not an approved temporary tooling-only advisory" });
    continue;
  }

  if (Date.now() >= Date.parse(exception.expires)) {
    blockers.push({ name, severity, urls, reason: "temporary exception expired" });
    continue;
  }

  approvedFindings.push({ name, severity, ghsa: exception.ghsa, expires: exception.expires });
}

if (blockers.length) {
  console.error("DEPENDENCY_AUDIT_FAIL");
  console.error(JSON.stringify(blockers, null, 2));
  process.exit(1);
}

for (const finding of approvedFindings) {
  console.warn(
    `DEPENDENCY_AUDIT_TEMP_EXCEPTION package=${finding.name} advisory=${finding.ghsa} expires=${finding.expires}`
  );
}

console.log(
  `DEPENDENCY_AUDIT_PASS high_or_critical_unapproved=0 temporary_tooling_exceptions=${approvedFindings.length}`
);
