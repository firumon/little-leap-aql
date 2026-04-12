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

## Implementation Expectations
- Keep docs, code, and sheets aligned only when the task actually changes them.
- For frontend edits, keep pages thin when the task materially affects page structure.
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
