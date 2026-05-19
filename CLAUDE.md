# AQL - Claude Startup

## Purpose
This is the startup file for Claude sessions in this repo. Keep it lean and use canonical docs for detail.

## Default Role
- Default to `Guide Agent` unless the user explicitly asks for another role.
- Follow the role boundaries in `Documents/MULTI_AGENT_PROTOCOL.md`.

## Startup Sequence
1. Read this file.
2. Read `Documents/MULTI_AGENT_PROTOCOL.md`.
3. Identify the active role.
4. Use `Documents/DOC_ROUTING.md` to decide what else to read.

## Reading Rule
- Do not treat `PLANS/`, `Documents/CONTEXT_HANDOFF.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, `Documents/GAS_API_CAPABILITIES.md`, or `Documents/GAS_PATTERNS.md` as universal startup reads.
- Read only the docs required for the requested task.
- For large docs, read only the relevant section whenever possible.

## Operating Notes
- `Guide Agent` never edits files and never writes plans.
- `Brain Agent` writes only in `PLANS/`.
- `Build Agent` executes the assigned plan and updates required docs.
- `Solo Agent` edits directly by default and writes a plan only when explicitly requested.

## Task Routing
- Use `Documents/DOC_ROUTING.md` as the canonical router for task-based reading.
- Use `Documents/AI_COLLABORATION_PROTOCOL.md` only for planning/building/change tasks.
- Use `Documents/CONTEXT_HANDOFF.md` only for continuation or current-state tasks.

## Repo-Local Skills
- Skills are task adapters, not policy sources.
- `aql-expert` remains relevant for AQL domain work across frontend, GAS, sheet metadata, resources, permissions, and workflows.
- `aql-frontend-design` remains relevant for AQL-specific Quasar UI design, prototypes, and frontend visual refinement.
- These skills must defer to this file, `Documents/MULTI_AGENT_PROTOCOL.md`, and `Documents/DOC_ROUTING.md` for role boundaries, required reads, and implementation rules.
- If a skill conflicts with canonical docs, follow the canonical docs and update the skill.

## Implementation Expectations
- Keep docs, code, and sheets aligned only when the task actually changes them.
- For frontend edits, keep pages thin when the task materially affects page structure.
- **Before touching any file under `FRONTENT/`, read `Documents/ARCHITECTURE RULES.md` without exception — including small fixes, one-liners, and style tweaks. Layer violations most often enter through minor edits.**
- For backend edits, prefer existing GAS files and patterns first. Create a new GAS file only when the current structure cannot support the task cleanly.

## Verification
- Do not run broad verification by default.
- Prefer targeted checks.
- Run a full frontend build only for major or cross-cutting frontend changes, typically around 10 or more touched files or equivalent risk.

## Key References
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/DOC_ROUTING.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `Documents/CONTEXT_HANDOFF.md`

## Maintenance Rule
Update this file when startup behavior, default reading expectations, role invocation, or canonical startup references change.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **little-leap-aql** (6519 symbols, 11820 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/little-leap-aql/context` | Codebase overview, check index freshness |
| `gitnexus://repo/little-leap-aql/clusters` | All functional areas |
| `gitnexus://repo/little-leap-aql/processes` | All execution flows |
| `gitnexus://repo/little-leap-aql/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
