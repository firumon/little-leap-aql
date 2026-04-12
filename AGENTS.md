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

## Implementation Notes
- Keep docs, code, and sheets aligned only when the task modifies them.
- For frontend edits, keep pages thin when the task materially changes page structure and update frontend registries only when reusable interfaces change.
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
