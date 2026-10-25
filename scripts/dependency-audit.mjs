import { spawnSync } from "node:child_process";

const APPROVED = new Map([
  ["GHSA-vfj7-8cjw-p6xm", {
    packageName: "braces",
    url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
    expires: "2026-11-15T00:00:00Z"
  }],
  ["GHSA-86w9-cpqp-85rv", {
    packageName: "node-forge",
    url: "https://github.com/advisories/GHSA-86w9-cpqp-85rv",
    expires: "2026-11-15T00:00:00Z"
  }],
  // Instalado: zod@3.25.76 (via eslint-config-expo/@expo/cli, transitivo,
  // sem uso direto neste app). O advisory expressa o range afetado como
  // "<4.6.6" sem limite inferior, então o npm audit casa com qualquer
  // 3.x por acidente. A correção real (colinhacks/zod#6475) é uma flag
  // opt-in `abortEarly`, exclusiva do código v4
  // (packages/zod/src/v4/core/schemas.ts); zod v3 não compartilha esse
  // caminho de código, então não está exposto ao DoS de memória descrito.
  // Reavaliar antes de expirar: confirmar se @expo/cli migrou para
  // zod v4 (nesse caso reavaliar exposição real) ou se a advisory foi
  // corrigida/reclassificada upstream.
  ["GHSA-mrhx-c7xc-m3w5", {
    packageName: "zod",
    url: "https://github.com/advisories/GHSA-mrhx-c7xc-m3w5",
    expires: "2026-11-15T00:00:00Z"
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

function rootAdvisories(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const finding = vulnerabilities[name];
  if (!finding || !Array.isArray(finding.via)) return [];

  const roots = [];
  for (const via of finding.via) {
    if (typeof via === "string") {
      roots.push(...rootAdvisories(via, seen));
      continue;
    }
    if (via && typeof via === "object") {
      roots.push({
        sourcePackage: name,
        severity: String(via.severity ?? finding.severity ?? "").toLowerCase(),
        url: String(via.url ?? ""),
        title: String(via.title ?? "")
      });
    }
  }
  return roots;
}

const blockers = [];
const approvedRoots = new Map();

for (const [name, finding] of Object.entries(vulnerabilities)) {
  const severity = String(finding.severity ?? "").toLowerCase();
  if (severity !== "high" && severity !== "critical") continue;

  const roots = rootAdvisories(name);
  if (!roots.length) {
    blockers.push({ name, severity, reason: "high/critical dependency has no resolvable advisory root" });
    continue;
  }

  for (const root of roots) {
    if (root.severity !== "high" && root.severity !== "critical") continue;
    if (root.severity === "critical") {
      blockers.push({ name, severity, root, reason: "critical findings are never excepted" });
      continue;
    }

    const approved = [...APPROVED.entries()].find(([, rule]) => rule.url === root.url);
    if (!approved) {
      blockers.push({ name, severity, root, reason: "root advisory is not approved" });
      continue;
    }

    const [ghsa, rule] = approved;
    if (Date.now() >= Date.parse(rule.expires)) {
      blockers.push({ name, severity, root, reason: "temporary exception expired" });
      continue;
    }

    approvedRoots.set(ghsa, {
      packageName: rule.packageName,
      expires: rule.expires,
      url: rule.url
    });
  }
}

if (blockers.length) {
  console.error("DEPENDENCY_AUDIT_FAIL");
  console.error(JSON.stringify(blockers, null, 2));
  process.exit(1);
}

for (const [ghsa, rule] of approvedRoots) {
  console.warn(
    `DEPENDENCY_AUDIT_TEMP_EXCEPTION package=${rule.packageName} advisory=${ghsa} expires=${rule.expires}`
  );
}

console.log(
  `DEPENDENCY_AUDIT_PASS high_or_critical_unapproved=0 temporary_tooling_exception_roots=${approvedRoots.size}`
);
