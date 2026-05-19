import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

type Check = {
  file: string;
  label: string;
  needle: string | RegExp;
};

const checks: Check[] = [
  {
    file: "AGENTS.md",
    label: "Codex gate section",
    needle: "## Codex Invocation Gate (MANDATORY)",
  },
  {
    file: ".opencode/AGENTS.md",
    label: "Codex gate section",
    needle: "## Codex Invocation Gate (MANDATORY)",
  },
  {
    file: "AGENTS.md",
    label: "canonical Brooks source",
    needle: ".opencode/agent/core/brooks.md",
  },
  {
    file: ".opencode/AGENTS.md",
    label: "canonical Brooks source",
    needle: ".opencode/agent/core/brooks.md",
  },
  {
    file: "AGENTS.md",
    label: "Codex adapter source",
    needle: ".codex/agents/brooks.toml",
  },
  {
    file: ".opencode/AGENTS.md",
    label: "Codex adapter source",
    needle: ".codex/agents/brooks.toml",
  },
  {
    file: "AGENTS.md",
    label: "team-ram-cowork required",
    needle: "team-ram-cowork",
  },
  {
    file: ".opencode/AGENTS.md",
    label: "team-ram-cowork required",
    needle: "team-ram-cowork",
  },
  {
    file: "AGENTS.md",
    label: "allura-memory-skill required",
    needle: "allura-memory-skill",
  },
  {
    file: ".opencode/AGENTS.md",
    label: "allura-memory-skill required",
    needle: "allura-memory-skill",
  },
  {
    file: "AGENTS.md",
    label: "allura-system namespace",
    needle: /group_id\s*=\s*allura-system/,
  },
  {
    file: ".opencode/AGENTS.md",
    label: "allura-system namespace",
    needle: /group_id\s*=\s*allura-system/,
  },
  {
    file: "AGENTS.md",
    label: "Brooks receipt",
    needle: "Brooks active.",
  },
  {
    file: ".opencode/AGENTS.md",
    label: "Brooks receipt",
    needle: "Brooks active.",
  },
  {
    file: "AGENTS.md",
    label: "Scout hydration receipt",
    needle: "Scout hydration:",
  },
  {
    file: ".opencode/AGENTS.md",
    label: "Scout hydration receipt",
    needle: "Scout hydration:",
  },
  {
    file: "AGENTS.md",
    label: "RuVix receipt",
    needle: "RuVix:",
  },
  {
    file: ".opencode/AGENTS.md",
    label: "RuVix receipt",
    needle: "RuVix:",
  },
  {
    file: ".codex/agents/brooks.toml",
    label: "canonical Brooks source in adapter",
    needle: ".opencode/agent/core/brooks.md",
  },
  {
    file: ".codex/agents/brooks.toml",
    label: "team-ram-cowork in adapter",
    needle: "team-ram-cowork",
  },
  {
    file: ".codex/agents/brooks.toml",
    label: "allura-memory-skill in adapter",
    needle: "allura-memory-skill",
  },
  {
    file: ".codex/agents/brooks.toml",
    label: "allura-system namespace in adapter",
    needle: /group_id\s*=\s*allura-system/,
  },
  {
    file: ".codex/agents/brooks.toml",
    label: "runtime honesty in adapter",
    needle: "Never claim Scout, Woz, OpenCode, OpenClaw, Claude, or another runtime/subagent actually ran",
  },
];

const ruvixPrimitives = ["mutate", "attest", "verify", "isolate", "sandbox", "audit"];
for (const primitive of ruvixPrimitives) {
  checks.push(
    {
      file: "AGENTS.md",
      label: `RuVix primitive in AGENTS: ${primitive}`,
      needle: new RegExp(`- ${primitive}:`),
    },
    {
      file: ".opencode/AGENTS.md",
      label: `RuVix primitive in .opencode/AGENTS: ${primitive}`,
      needle: new RegExp(`- ${primitive}:`),
    },
    {
      file: ".codex/agents/brooks.toml",
      label: `RuVix primitive in Brooks adapter: ${primitive}`,
      needle: new RegExp(`- ${primitive}:`),
    },
  );
}

const failures: string[] = [];

for (const check of checks) {
  const filePath = join(root, check.file);
  const content = readFileSync(filePath, "utf8");
  const passed =
    typeof check.needle === "string"
      ? content.includes(check.needle)
      : check.needle.test(content);

  if (!passed) {
    failures.push(`${check.file}: missing ${check.label}`);
  }
}

if (failures.length > 0) {
  console.error("Codex governance gate validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Codex governance gate validation passed.");
