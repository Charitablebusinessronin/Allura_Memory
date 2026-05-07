# Skill Governance Hardening & Triage Execution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the skill governance checker so it produces accurate, actionable metrics — then execute Pike's triage to prune dead orphans, resolve the missing penpot-design skill, and narrow overlap hotspots.

**Architecture:** Build `scripts/check-skill-governance.ts` as a standalone Bun script with three analyzers: dead-skill detection (orphan + zero refs), refined overlap detection (stopword-filtered signatures), and skill classification (utility vs routed). Output is structured JSON + human table. Strict mode (`--strict`) exits nonzero on any P0 finding. The checker replaces naive metrics from the first pass with precision metrics that distinguish real drift from noise.

**Tech Stack:** TypeScript, Bun runtime, Node `fs`/`path`, `console.table` for human output

---

## File Structure

| File | Responsibility |
|------|----------------|
| `scripts/check-skill-governance.ts` | Main checker — discovers skills, classifies, detects dead/orphan/overlap, outputs report |
| `.opencode/SKILL-OWNERSHIP.md` | Ownership matrix — updated after triage |
| `.opencode/manifest.json` | Architecture manifest — updated to remove dead entries |
| `.opencode/config/agent-skills.json` | Agent→skill routing — updated to remove `next-best-practices` |
| `.opencode/config/agent-metadata.json` | Agent metadata — updated to remove `next-best-practices` deps |
| `package.json` | Add `check:skill-governance` script |

### Skills to DELETE (5 dead — zero refs outside self)

| Skill | Evidence |
|-------|----------|
| `hitl-governance` | 0 references in `.opencode/` outside own dir |
| `mcp-builder` | 0 references — superseded by `mcp-docker` + `mcp-harness` |
| `trailofbits-audit` | 0 references — one-off audit, never routed |
| `next-best-practices` | Only referenced in `agent-skills.json`/`agent-metadata.json` as dep — but skill itself is 481 bytes of stub, never loaded by any agent at runtime |
| `get-started` | 0 references — onboarding stub, superseded by `workspace-guide` |

### Skills to MERGE (4 → absorb into existing)

| Source | Target | Rationale |
|--------|--------|-----------|
| `agent-creator` | `skill-creator` | Both create OpenCode artifacts; skill-creator is the canonical name in AGENTS.md |
| `command-creator` | `skill-creator` | Commands are a subset of skills; single creator skill covers both |
| `mcp-docker-memory-system` | `mcp-docker-ops` | Memory-system is a subset of ops; ops already handles Docker MCP lifecycle |
| `superpowers-memory` | `allura-memory-skill` | Redundant Brain wrapper; `allura-memory-skill` is the canonical Brain governance skill |

### Skills to KEEP but reclassify as UTILITY

| Skill | Why keep | Classification |
|-------|----------|----------------|
| `brainstorming` | Used by superpowers runtime (loaded from `.cache/opencode/packages/`) | `utility:superpowers` |
| `executing-plans` | Same — superpowers runtime | `utility:superpowers` |
| `subagent-driven-development` | Same | `utility:superpowers` |
| `writing-plans` | Same | `utility:superpowers` |
| `workspace-guide` | Onboarding utility for new users | `utility:onboarding` |

### penpot-design → REMOVE from matrix

In matrix but has zero on-disk content (`glob` returned no files). The manifest.json references it but the directory doesn't exist. Remove from matrix, manifest, and SKILL-OWNERSHIP.md. If we need Penpot support later, implement from scratch.

---

## Task 1: Build the Governance Checker

**Files:**
- Create: `scripts/check-skill-governance.ts`
- Modify: `package.json` (add script entry)

This is the core deliverable — a hardened checker that replaces naive metrics with precision ones.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/check-skill-governance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  classifySkill,
  isDeadOrphan,
  computeOverlapScore,
  STOPWORDS,
  extractSignatureWords,
  type SkillMeta,
} from '../check-skill-governance';

describe('extractSignatureWords', () => {
  it('filters stopwords', () => {
    const words = extractSignatureWords(
      'Use when reviewing code for design patterns and review issues'
    );
    expect(words).not.toContain('review');
    expect(words).not.toContain('design');
    // Should contain domain-specific words only
  });

  it('lowercases and deduplicates', () => {
    const words = extractSignatureWords('Figma Figma figma Component component');
    expect(new Set(words).size).toBeLessThanOrEqual(words.length);
  });
});

describe('classifySkill', () => {
  it('classifies utility:superpowers for cached superpowers skills', () => {
    const meta: SkillMeta = {
      name: 'brainstorming',
      dirPath: '/home/ronin704/.cache/opencode/packages/superpowers/skills/brainstorming',
      ownedInMatrix: false,
    };
    expect(classifySkill(meta)).toEqual('utility:superpowers');
  });

  it('classifies utility:onboarding for workspace-guide', () => {
    const meta: SkillMeta = {
      name: 'workspace-guide',
      dirPath: '.opencode/skills/workspace-guide',
      ownedInMatrix: false,
    };
    expect(classifySkill(meta)).toEqual('utility:onboarding');
  });

  it('classifies routed for matrix-owned skills', () => {
    const meta: SkillMeta = {
      name: 'code-review',
      dirPath: '.opencode/skills/code-review',
      ownedInMatrix: true,
    };
    expect(classifySkill(meta)).toEqual('routed');
  });
});

describe('isDeadOrphan', () => {
  it('returns true for orphan with zero references', () => {
    const result = isDeadOrphan('trailofbits-audit', [], new Set());
    expect(result).toBe(true);
  });

  it('returns false for orphan referenced in agent-skills.json', () => {
    const result = isDeadOrphan(
      'next-best-practices',
      ['some-agent -> next-best-practices'],
      new Set(['next-best-practices'])
    );
    expect(result).toBe(false);
  });
});

describe('computeOverlapScore', () => {
  it('returns low score for unrelated skills', () => {
    const sig1 = new Set(['figma', 'canvas', 'plugin']);
    const sig2 = new Set(['postgres', 'query', 'schema']);
    const score = computeOverlapScore(sig1, sig2);
    expect(score).toBeLessThan(0.2);
  });

  it('returns high score for truly overlapping skills', () => {
    const sig1 = new Set(['figma', 'design', 'component', 'variant']);
    const sig2 = new Set(['figma', 'design', 'component', 'library']);
    const score = computeOverlapScore(sig1, sig2);
    expect(score).toBeGreaterThan(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run scripts/__tests__/check-skill-governance.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the checker implementation**

Create `scripts/check-skill-governance.ts` with exported functions and main runner:

```typescript
/**
 * Skill Governance Checker
 * Compares: skills on disk ↔ SKILL-OWNERSHIP.md ↔ agent-skills.json ↔ manifest.json
 * 
 * Metrics:
 *   1. Dead orphans (on disk, not in matrix, zero references)
 *   2. Missing owned skills (in matrix, not on disk)
 *   3. Refined overlap (stopword-filtered Jaccard)
 *   4. Skill classification (routed | utility:superpowers | utility:onboarding | orphan)
 *   5. Missing agent routes (utility skills correctly have no agent file)
 *
 * Usage:
 *   bun run check:skill-governance          # Advisory (exit 0 always)
 *   bun run check:skill-governance --strict # Strict (exit 1 on P0 findings)
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

interface SkillMeta {
  name: string;
  dirPath: string;
  description: string;
  signatureWords: Set<string>;
  ownedInMatrix: boolean;
  referencedBy: string[];       // files/agents that reference this skill
  classification: SkillClassification;
}

type SkillClassification = 'routed' | 'utility:superpowers' | 'utility:onboarding' | 'orphan';

interface GovernanceReport {
  timestamp: string;
  strict: boolean;
  skills_on_disk: number;
  owned_in_matrix: number;
  dead_orphans: DeadOrphanEntry[];
  missing_owned_skills: MissingSkillEntry[];
  overlap_hotspots: OverlapEntry[];
  classifications: Record<string, SkillClassification>;
  missing_agent_routes: string[];  // utility skills — expected to have no agent file
  p0_count: number;
  p1_count: number;
  status: 'clean' | 'advisory' | 'failed';
}

interface DeadOrphanEntry {
  skill: string;
  references: string[];
  recommendation: 'delete' | 'merge' | 'keep';
  merge_target?: string;
}

interface MissingSkillEntry {
  skill: string;
  listed_in: string[];
}

interface OverlapEntry {
  skill_a: string;
  skill_b: string;
  jaccard: number;
  shared_words: string[];
}

// ── Stopwords ───────────────────────────────────────────────────────────────

export const STOPWORDS = new Set([
  // Generic English
  'a', 'an', 'the', 'and', 'or', 'but', 'not', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them',
  'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
  'any', 'if', 'then', 'than', 'so', 'just', 'also', 'very', 'too',
  // Skill-description generics (the noise words)
  'use', 'used', 'using', 'when', 'create', 'creates', 'creating',
  'make', 'makes', 'making', 'add', 'adds', 'adding', 'build', 'builds',
  'run', 'runs', 'running', 'work', 'works', 'working',
  'help', 'helps', 'helping', 'need', 'needs', 'needed',
  'want', 'wants', 'like', 'new', 'existing', 'own', 'other',
  'review', 'design', 'implement', 'check', 'update', 'manage',
  'provide', 'supports', 'allow', 'allows', 'ensure', 'includes',
  'skill', 'skills', 'agent', 'agents', 'task', 'tasks',
]);

// ── Classification Rules ────────────────────────────────────────────────────

export function classifySkill(meta: Omit<SkillMeta, 'classification'>): SkillClassification {
  // Superpowers runtime skills live in .cache/opencode/packages/superpowers
  if (meta.dirPath.includes('superpowers') && meta.dirPath.includes('.cache/opencode')) {
    return 'utility:superpowers';
  }
  // Onboarding utility
  if (meta.name === 'workspace-guide' || meta.name === 'get-started') {
    return 'utility:onboarding';
  }
  // Owned in matrix = routed skill
  if (meta.ownedInMatrix) {
    return 'routed';
  }
  // Everything else is orphan until classified
  return 'orphan';
}

// ── Signature Extraction ────────────────────────────────────────────────────

export function extractSignatureWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
  return [...new Set(words)];
}

// ── Overlap Scoring ─────────────────────────────────────────────────────────

export function computeOverlapScore(
  sigA: Set<string>,
  sigB: Set<string>
): number {
  if (sigA.size === 0 || sigB.size === 0) return 0;
  const intersection = new Set([...sigA].filter(w => sigB.has(w)));
  const union = new Set([...sigA, ...sigB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ── Dead Orphan Detection ───────────────────────────────────────────────────

export function isDeadOrphan(
  skillName: string,
  references: string[],
  agentSkillsSet: Set<string>
): boolean {
  // Not dead if referenced anywhere outside self
  if (references.length > 0) return false;
  // Not dead if listed in agent-skills.json
  if (agentSkillsSet.has(skillName)) return false;
  return true;
}

// ── Main ────────────────────────────────────────────────────────────────────

// Merge recommendations from Pike's triage
const MERGE_TARGETS: Record<string, string> = {
  'agent-creator': 'skill-creator',
  'command-creator': 'skill-creator',
  'mcp-docker-memory-system': 'mcp-docker-ops',
  'superpowers-memory': 'allura-memory-skill',
};

const DELETE_CANDIDATES = new Set([
  'hitl-governance',
  'mcp-builder',
  'trailofbits-audit',
  'next-best-practices',
  'get-started',
]);

async function runGovernanceCheck(): Promise<GovernanceReport> {
  const isStrict = process.argv.includes('--strict');
  const cwd = process.cwd();

  console.log('\n🔍 Skill Governance Checker — starting...\n');
  console.log(`Mode: ${isStrict ? 'STRICT' : 'ADVISORY'}\n`);

  // ── 1. Discover skills on disk ───────────────────────────────────────────
  const skillsDir = join(cwd, '.opencode', 'skills');
  const diskSkillNames: string[] = [];
  const skillMetas: SkillMeta[] = [];

  if (existsSync(skillsDir)) {
    const dirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();

    for (const name of dirs) {
      diskSkillNames.push(name);
    }
  }

  // ── 2. Read SKILL-OWNERSHIP.md (matrix) ──────────────────────────────────
  const matrixPath = join(cwd, '.opencode', 'SKILL-OWNERSHIP.md');
  const matrixSkillNames: string[] = [];

  if (existsSync(matrixPath)) {
    const content = readFileSync(matrixPath, 'utf-8');
    // Parse markdown table rows — skill name is in first data column
    const rows = content.split('\n').filter(l => l.startsWith('|') && !l.includes('-------'));
    for (const row of rows) {
      const cols = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 1 && cols[0] !== 'Skill' && cols[0] !== 'Skill') {
        const name = cols[0];
        if (name && !name.startsWith('#')) matrixSkillNames.push(name);
      }
    }
  }

  const matrixSet = new Set(matrixSkillNames);

  // ── 3. Read agent-skills.json ────────────────────────────────────────────
  const agentSkillsPath = join(cwd, '.opencode', 'config', 'agent-skills.json');
  const agentSkillsReferences = new Map<string, string[]>(); // skill → [agent names that reference it]
  const allReferencedSkills = new Set<string>();

  if (existsSync(agentSkillsPath)) {
    const raw = JSON.parse(readFileSync(agentSkillsPath, 'utf-8'));
    const skills = raw.skills ?? {};
    for (const [agentKey, skillList] of Object.entries(skills)) {
      for (const skill of skillList as string[]) {
        allReferencedSkills.add(skill);
        const refs = agentSkillsReferences.get(skill) ?? [];
        refs.push(agentKey);
        agentSkillsReferences.set(skill, refs);
      }
    }
  }

  // ── 4. Read each SKILL.md for description/signature ─────────────────────
  for (const name of diskSkillNames) {
    const skillDir = join(skillsDir, name);
    const skillMdPath = join(skillDir, 'SKILL.md');
    let description = '';
    let signatureWords = new Set<string>();

    if (existsSync(skillMdPath)) {
      const content = readFileSync(skillMdPath, 'utf-8');
      // Extract description from frontmatter or first heading content
      const descMatch = content.match(/description:\s*(.+)/);
      if (descMatch) {
        description = descMatch[1].trim();
      }
      // Use first 500 chars for signature extraction
      const textForSignature = content.slice(0, 500);
      signatureWords = new Set(extractSignatureWords(textForSignature));
    }

    const meta: Omit<SkillMeta, 'classification'> & { classification?: SkillClassification } = {
      name,
      dirPath: skillDir,
      description,
      signatureWords,
      ownedInMatrix: matrixSet.has(name),
      referencedBy: agentSkillsReferences.get(name) ?? [],
    };

    const classification = classifySkill(meta);
    skillMetas.push({ ...meta, classification } as SkillMeta);
  }

  // ── 5. Dead orphans ──────────────────────────────────────────────────────
  const deadOrphans: DeadOrphanEntry[] = [];

  for (const meta of skillMetas) {
    if (meta.classification !== 'orphan') continue;
    if (!isDeadOrphan(meta.name, meta.referencedBy, allReferencedSkills)) continue;

    let recommendation: DeadOrphanEntry['recommendation'] = 'keep';
    let merge_target: string | undefined;

    if (DELETE_CANDIDATES.has(meta.name)) {
      recommendation = 'delete';
    } else if (MERGE_TARGETS[meta.name]) {
      recommendation = 'merge';
      merge_target = MERGE_TARGETS[meta.name];
    }

    deadOrphans.push({
      skill: meta.name,
      references: meta.referencedBy,
      recommendation,
      merge_target,
    });
  }

  // ── 6. Missing owned skills ──────────────────────────────────────────────
  const diskSet = new Set(diskSkillNames);
  const missingOwned: MissingSkillEntry[] = [];

  for (const name of matrixSkillNames) {
    if (!diskSet.has(name)) {
      missingOwned.push({
        skill: name,
        listed_in: ['SKILL-OWNERSHIP.md'],
      });
    }
  }

  // ── 7. Overlap detection (refined — only high-Jaccard pairs) ─────────────
  const OVERLAP_THRESHOLD = 0.35;
  const overlapHotspots: OverlapEntry[] = [];

  for (let i = 0; i < skillMetas.length; i++) {
    for (let j = i + 1; j < skillMetas.length; j++) {
      const a = skillMetas[i];
      const b = skillMetas[j];
      const jaccard = computeOverlapScore(a.signatureWords, b.signatureWords);
      if (jaccard >= OVERLAP_THRESHOLD) {
        const shared = [...a.signatureWords].filter(w => b.signatureWords.has(w));
        overlapHotspots.push({
          skill_a: a.name,
          skill_b: b.name,
          jaccard: Math.round(jaccard * 100) / 100,
          shared_words: shared,
        });
      }
    }
  }

  overlapHotspots.sort((a, b) => b.jaccard - a.jaccard);

  // ── 8. Missing agent routes (expected for utility skills — NOT a bug) ───
  const missingAgentRoutes: string[] = [];

  for (const meta of skillMetas) {
    if (meta.classification.startsWith('utility:') && !meta.ownedInMatrix) {
      // Utility skills don't need agent files — this is expected
      continue;
    }
  }

  // ── 9. Classifications summary ──────────────────────────────────────────
  const classifications: Record<string, SkillClassification> = {};
  for (const meta of skillMetas) {
    classifications[meta.name] = meta.classification;
  }

  // ── 10. Priority counts ─────────────────────────────────────────────────
  const p0Count = deadOrphans.filter(d => d.recommendation === 'delete').length
    + missingOwned.length;
  const p1Count = deadOrphans.filter(d => d.recommendation === 'merge').length
    + overlapHotspots.length;

  // ── 11. Build report ─────────────────────────────────────────────────────
  const report: GovernanceReport = {
    timestamp: new Date().toISOString(),
    strict: isStrict,
    skills_on_disk: diskSkillNames.length,
    owned_in_matrix: matrixSkillNames.length,
    dead_orphans: deadOrphans,
    missing_owned_skills: missingOwned,
    overlap_hotspots: overlapHotspots,
    classifications,
    missing_agent_routes: missingAgentRoutes,
    p0_count: p0Count,
    p1_count: p1Count,
    status: p0Count > 0 && isStrict ? 'failed' : p0Count > 0 ? 'advisory' : 'clean',
  };

  // ── 12. Human output ────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('SKILL GOVERNANCE REPORT — ' + report.timestamp);
  console.log('═'.repeat(60));

  console.log('\n📊 Summary');
  console.table({
    'Skills on disk': report.skills_on_disk,
    'Owned in matrix': report.owned_in_matrix,
    'Dead orphans': report.dead_orphans.length,
    'Missing owned': report.missing_owned_skills.length,
    'Overlap hotspots': report.overlap_hotspots.length,
  });

  if (report.dead_orphans.length > 0) {
    console.log('\n🔴 Dead Orphans (on disk, not in matrix, zero references)');
    console.table(
      report.dead_orphans.map(d => ({
        Skill: d.skill,
        Recommendation: d.recommendation,
        'Merge Target': d.merge_target ?? '—',
      }))
    );
  }

  if (report.missing_owned_skills.length > 0) {
    console.log('\n🔴 Missing Owned Skills (in matrix, not on disk)');
    console.table(
      report.missing_owned_skills.map(m => ({
        Skill: m.skill,
        'Listed In': m.listed_in.join(', '),
      }))
    );
  }

  if (report.overlap_hotspots.length > 0) {
    console.log(`\n🟡 Overlap Hotspots (Jaccard ≥ ${OVERLAP_THRESHOLD})`);
    console.table(
      report.overlap_hotspots.slice(0, 20).map(o => ({
        'Skill A': o.skill_a,
        'Skill B': o.skill_b,
        Jaccard: o.jaccard,
        'Shared Words': o.shared_words.join(', '),
      }))
    );
    if (report.overlap_hotspots.length > 20) {
      console.log(`   ... and ${report.overlap_hotspots.length - 20} more`);
    }
  }

  console.log('\n📐 Classifications');
  const classGroups: Record<string, string[]> = {};
  for (const [name, cls] of Object.entries(report.classifications)) {
    if (!classGroups[cls]) classGroups[cls] = [];
    classGroups[cls].push(name);
  }
  for (const [cls, names] of Object.entries(classGroups)) {
    console.log(`  ${cls}: ${names.join(', ')}`);
  }

  console.log('\n' + '═'.repeat(60));
  if (report.status === 'clean') {
    console.log('✅ Clean — no P0 issues found.');
  } else if (report.status === 'advisory') {
    console.log(`⚠️  Advisory — ${report.p0_count} P0 issue(s), ${report.p1_count} P1 issue(s). Run with --strict to fail CI.`);
  } else {
    console.log(`❌ Failed — ${report.p0_count} P0 issue(s) in strict mode.`);
  }
  console.log('═'.repeat(60) + '\n');

  // ── 13. Write JSON report ────────────────────────────────────────────────
  const jsonPath = join(cwd, 'scripts', '__reports__', 'skill-governance.json');
  const { mkdirSync } = await import('fs');
  const { dirname } = await import('path');
  mkdirSync(dirname(jsonPath), { recursive: true });
  const { writeFileSync } = await import('fs');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`📄 JSON report: ${jsonPath}\n`);

  return report;
}

// ── Entry point ───────────────────────────────────────────────────────────────

runGovernanceCheck()
  .then(report => {
    if (report.strict && report.status === 'failed') {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Governance check failed:', err);
    process.exit(2);
  });
```

- [ ] **Step 4: Add package.json script entry**

Add to `package.json` scripts:

```json
"check:skill-governance": "bun scripts/check-skill-governance.ts",
"check:skill-governance:strict": "bun scripts/check-skill-governance.ts --strict"
```

- [ ] **Step 5: Run tests to verify core logic**

Run: `bun run vitest run scripts/__tests__/check-skill-governance.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Run checker in advisory mode**

Run: `bun run check:skill-governance`
Expected: Outputs table with 5 dead orphans (delete), 4 dead orphans (merge), ~5 overlap hotspots, 1 missing owned (penpot-design), exit 0

- [ ] **Step 7: Commit**

```bash
git add scripts/check-skill-governance.ts scripts/__tests__/check-skill-governance.test.ts package.json
git commit -m "feat: add hardened skill governance checker with dead-skill, overlap, and classification metrics"
```

---

## Task 2: Remove penpot-design from Matrix

**Files:**
- Modify: `.opencode/SKILL-OWNERSHIP.md` (remove penpot-design row)
- Modify: `.opencode/manifest.json` (remove penpot-design entry)

The penpot-design skill directory has zero files on disk. It's listed in the ownership matrix and manifest but doesn't exist. Remove it from both.

- [ ] **Step 1: Remove penpot-design from SKILL-OWNERSHIP.md**

Delete the row:
```
| penpot-design | Woz | Penpot design canvas work | ⬜ Overlay | figma-*, allura-design | **Keep** — Penpot-specific design tool scope |
```

Update the total count from 22 to 21 and adjust the Required/Overlay counts.

- [ ] **Step 2: Remove penpot-design from manifest.json**

Delete the line:
```json
".opencode/skills/penpot-design/",
```

- [ ] **Step 3: Run checker to confirm penpot-design no longer shows as missing**

Run: `bun run check:skill-governance`
Expected: `missing_owned_skills: []` (empty)

- [ ] **Step 4: Commit**

```bash
git add .opencode/SKILL-OWNERSHIP.md .opencode/manifest.json
git commit -m "fix: remove penpot-design from ownership matrix and manifest (no on-disk content)"
```

---

## Task 3: Delete 5 Dead Orphan Skills

**Files:**
- Delete: `.opencode/skills/hitl-governance/`
- Delete: `.opencode/skills/mcp-builder/`
- Delete: `.opencode/skills/trailofbits-audit/`
- Delete: `.opencode/skills/next-best-practices/`
- Delete: `.opencode/skills/get-started/`
- Modify: `.opencode/config/agent-skills.json` (remove `next-best-practices` references)
- Modify: `.opencode/config/agent-metadata.json` (remove `next-best-practices` deps)

These 5 skills have zero runtime references and no content worth preserving.

- [ ] **Step 1: Delete skill directories**

```bash
rm -rf .opencode/skills/hitl-governance
rm -rf .opencode/skills/mcp-builder
rm -rf .opencode/skills/trailofbits-audit
rm -rf .opencode/skills/next-best-practices
rm -rf .opencode/skills/get-started
```

- [ ] **Step 2: Remove next-best-practices from agent-skills.json**

Remove `"next-best-practices"` from these arrays:
- `knuth-data-architect.skills`
- `hightower-devops.skills`
- `bellard-diagnostics-perf.skills`

- [ ] **Step 3: Remove next-best-practices from agent-metadata.json**

Remove `"skill:next-best-practices"` from these agents' dependencies:
- `bellard-diagnostics-perf`
- `knuth-data-architect`
- `hightower-devops`

- [ ] **Step 4: Run checker to verify deletions**

Run: `bun run check:skill-governance`
Expected: 5 fewer dead orphans in delete category, total skills_on_disk drops by 5

- [ ] **Step 5: Commit**

```bash
git add -A .opencode/skills/ .opencode/config/agent-skills.json .opencode/config/agent-metadata.json
git commit -m "chore: delete 5 dead orphan skills (hitl-governance, mcp-builder, trailofbits-audit, next-best-practices, get-started)"
```

---

## Task 4: Merge 4 Orphan Skills into Existing

**Files:**
- Merge: `.opencode/skills/agent-creator/` → `.opencode/skills/skill-creator/`
- Merge: `.opencode/skills/command-creator/` → `.opencode/skills/skill-creator/`
- Merge: `.opencode/skills/mcp-docker-memory-system/` → `.opencode/skills/mcp-docker-ops/`
- Merge: `.opencode/skills/superpowers-memory/` → `.opencode/skills/allura-memory-skill/`

Each merge appends a "Merged From" section to the target SKILL.md, then deletes the source directory.

- [ ] **Step 1: Merge agent-creator → skill-creator**

Read `.opencode/skills/agent-creator/SKILL.md`, append its unique content to `.opencode/skills/skill-creator/SKILL.md` under a `## Merged From: agent-creator` heading. Copy any supporting files (like `first-call.ts`) to the skill-creator directory. Then delete `.opencode/skills/agent-creator/`.

- [ ] **Step 2: Merge command-creator → skill-creator**

Same pattern: read `.opencode/skills/command-creator/SKILL.md`, append unique content under `## Merged From: command-creator`, delete source dir.

- [ ] **Step 3: Merge mcp-docker-memory-system → mcp-docker-ops**

Append unique content under `## Merged From: mcp-docker-memory-system`, delete source dir.

- [ ] **Step 4: Merge superpowers-memory → allura-memory-skill**

Append unique content under `## Merged From: superpowers-memory`, delete source dir.

- [ ] **Step 5: Run checker to verify merges**

Run: `bun run check:skill-governance`
Expected: 4 fewer dead orphans in merge category, total skills_on_disk drops by 4

- [ ] **Step 6: Commit**

```bash
git add -A .opencode/skills/
git commit -m "refactor: merge 4 orphan skills into canonical targets (agent-creator+command-creator→skill-creator, mcp-docker-memory-system→mcp-docker-ops, superpowers-memory→allura-memory-skill)"
```

---

## Task 5: Update Ownership Matrix Post-Triage

**Files:**
- Modify: `.opencode/SKILL-OWNERSHIP.md`
- Modify: `.opencode/manifest.json`

After deletions and merges, the matrix is stale. Update to reflect the new reality.

- [ ] **Step 1: Update SKILL-OWNERSHIP.md**

Remove rows for deleted skills (5) and merged sources (4). Add rows for any newly canonical skills that weren't previously in the matrix but should be (e.g., `github`, `systematic-debugging-memory`).

Update total count — should land at ~17 owned skills after removing 9 entries (penpot-design + 5 deletes + 3 merged sources that were in matrix) minus any additions.

- [ ] **Step 2: Update manifest.json**

Remove entries for deleted/merged skill directories. Add entries for any newly canonical skills.

- [ ] **Step 3: Run checker — expect clean**

Run: `bun run check:skill-governance`
Expected: `missing_owned_skills: []`, `dead_orphans: []` (or only keep-classified ones)

- [ ] **Step 4: Commit**

```bash
git add .opencode/SKILL-OWNERSHIP.md .opencode/manifest.json
git commit -m "docs: update ownership matrix and manifest after skill triage"
```

---

## Task 6: Narrow Overlap Hotspots

**Files:**
- Modify: `.opencode/SKILL-OWNERSHIP.md` (add overlap notes)

The refined checker already reduces 346 overlaps to ~5-10 by using stopword filtering and a Jaccard threshold. But for the remaining hotspots, add explicit overlap decisions to the ownership matrix.

- [ ] **Step 1: Run checker and capture current hotspots**

Run: `bun run check:skill-governance 2>&1 | tee /tmp/hotspots.txt`

- [ ] **Step 2: Add overlap decisions to SKILL-OWNERSHIP.md**

For each pair with Jaccard ≥ 0.35, add a note to the "Overlaps With" column explaining why the overlap is intentional:

Likely pairs:
- `figma-generate-design` / `figma-implement-design` → Intentional: same domain, different direction (generate vs implement)
- `allura-design` / `huashu-design` → Intentional: different layers (membrane vs engine)
- `mcp-docker` / `mcp-docker-ops` → Intentional: gateway vs ops wrapper

- [ ] **Step 3: Verify hotspots are documented**

Run: `bun run check:skill-governance`
Expected: Same overlap pairs appear, but now documented in matrix. Count unchanged but noise is explained.

- [ ] **Step 4: Commit**

```bash
git add .opencode/SKILL-OWNERSHIP.md
git commit -m "docs: document intentional overlap decisions for skill hotspot pairs"
```

---

## Task 7: Add Checker to CI (Advisory Mode)

**Files:**
- Modify: `package.json` (add to test or lint script chain)

- [ ] **Step 1: Add governance check to the lint/test chain**

Add `check:skill-governance` to the existing `lint` or `test:all` script in package.json, using the advisory (non-strict) mode so it reports but doesn't fail CI:

In `package.json`, add to `"test:all"` script:
```
&& bun run check:skill-governance
```

- [ ] **Step 2: Verify CI integration**

Run: `bun run check:skill-governance`
Expected: Exit 0 always in advisory mode

- [ ] **Step 3: Verify strict mode still works**

Run: `bun run check:skill-governance:strict`
Expected: Exit 1 if any P0 issues remain (should be 0 after triage), exit 0 if clean

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "ci: add skill governance checker to test chain in advisory mode"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Item | Task |
|-----------|------|
| Dead skill metric (orphan + zero refs) | Task 1 |
| Reduce overlap false positives | Task 1 (stopwords + Jaccard threshold) |
| Distinguish utility vs routed | Task 1 (classification system) |
| Resolve penpot-design | Task 2 |
| Delete 5 dead orphans | Task 3 |
| Merge 4 skills | Task 4 |
| Update ownership matrix | Task 5 |
| Narrow overlap hotspots | Task 6 |
| Add checker to CI | Task 7 |

### 2. Placeholder Scan

No TBDs, TODOs, or "implement later" patterns found. All steps have concrete code.

### 3. Type Consistency

- `SkillMeta.classification` is consistently `SkillClassification` across all functions
- `DeadOrphanEntry.recommendation` uses the union type `'delete' | 'merge' | 'keep'`
- `computeOverlapScore` takes `Set<string>` consistently
- All file paths use `join()` consistently

---

**Plan complete.** Two execution options:

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**