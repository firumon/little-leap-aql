## Purpose
- This is the startup file for repository-aware agents in AQL.
- Keep this file lean. Use canonical docs for detailed policy.

## Default Operating Mode
- Default collaboration model is multi-agent.
- Default role is `Guide Agent` unless the user explicitly asks for another role.
- Follow `Documents/MULTI_AGENT_PROTOCOL.md` for exact role boundaries.

## Startup Sequence
- Read this file.
- Read `Documents/MULTI_AGENT_PROTOCOL.md`.
- Identify the active role.
- Use `Documents/DOC_ROUTING.md` to decide what else to read.

## Reading Rule
- Do not treat `PLANS/`, `Documents/CONTEXT_HANDOFF.md`, `Documents/AI_COLLABORATION_PROTOCOL.md`, `Documents/GAS_API_CAPABILITIES.md`, or `Documents/GAS_PATTERNS.md` as universal startup reads.
- Read only the docs needed for the requested task.
- Read only the relevant section of large docs whenever possible.

## Role and Plan Rules
- `Guide Agent` discusses only. It never edits files and never writes plans.
- `Brain Agent` writes or updates files in `PLANS/` only.
- `Build Agent` reads the assigned plan and executes it.
- `Solo Agent` edits directly by default and creates a plan only when explicitly requested.
- Do not read all files in `PLANS/`. Read only the named or clearly relevant plan.

## Task Routing
- `Documents/DOC_ROUTING.md` is the canonical task-to-doc router.
- `Documents/AI_COLLABORATION_PROTOCOL.md` is optional and should be read only for planning/building/change tasks.
- `Documents/CONTEXT_HANDOFF.md` should be read only for continuation or current-state work.

## Repo-Local Skills
- Skills are task adapters, not policy sources.
- `aql-expert` remains relevant for AQL domain work across frontend, GAS, sheet metadata, resources, permissions, and workflows.
- `aql-frontend-design` remains relevant for AQL-specific Quasar UI design, prototypes, and frontend visual refinement.
- These skills must defer to this file, `Documents/MULTI_AGENT_PROTOCOL.md`, and `Documents/DOC_ROUTING.md` for role boundaries, required reads, and implementation rules.
- If a skill conflicts with canonical docs, follow the canonical docs and update the skill.

## Implementation Notes
- Keep docs, code, and sheets aligned only when the task modifies them.
- For frontend edits, keep pages thin when the task materially changes page structure and update frontend registries only when reusable interfaces change.
- **Before touching any file under `FRONTENT/`, read `Documents/ARCHITECTURE RULES.md` without exception — this includes small fixes, one-liners, and style tweaks. Layer violations most often enter through minor edits.**
- For backend edits, prefer existing GAS files and patterns first. Create a new GAS file only when the current structure cannot support the task cleanly.
- If GAS files change, run `npm run gas:push` from the repo root or `cd GAS && clasp push`.
- Ask the user for Web App redeployment only when the API contract changed.

## Verification
- Do not run broad verification by default.
- Prefer targeted checks.
- Run `npm run build` for frontend only when the change is major or cross-cutting, typically around 10 or more touched files or equivalent risk.

## Key References
- `Documents/MULTI_AGENT_PROTOCOL.md`
- `Documents/DOC_ROUTING.md`
- `Documents/AI_COLLABORATION_PROTOCOL.md`
- `Documents/CONTEXT_HANDOFF.md`
- `PLANS/_TEMPLATE.md`

## Maintenance Rule
- Update this file when startup behavior, role invocation, plan-reading expectations, deployment expectations, or canonical startup references change.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **little-leap-aql** (6517 symbols, 11820 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
