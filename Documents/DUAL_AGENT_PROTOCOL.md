# Dual-Agent Collaboration Protocol

## Purpose
This document defines how two AI roles collaborate on the Little Leap AQL project:
- **Brain Agent** - architecture, planning, decisions, rule capture, review.
- **Execution Agent** - code changes, terminal commands, browser execution, git operations, and documentation updates.

## Default Startup Rule
For every new context window, the agent should:
1. Read `AGENTS.md` first.
2. Read this file (`Documents/DUAL_AGENT_PROTOCOL.md`).
3. Read `Documents/AI_COLLABORATION_PROTOCOL.md` and `Documents/CONTEXT_HANDOFF.md`.
4. Check `PLANS/` for active plans before starting implementation.

## Communication Channel
Since agents cannot communicate directly, the shared medium is the repository itself:
- Code changes
- Plan files
- Documentation updates

## Workflow

### Phase 1: Planning (Brain Agent)
1. User describes the requirement to the Brain Agent.
2. Brain Agent creates a detailed **Implementation Plan** in `PLANS/` using `PLANS/_TEMPLATE.md`.
3. The plan file includes:
   - Context and objective
   - Step-by-step instructions (clear enough for direct execution)
   - File paths to modify
   - Existing code patterns to follow
   - Business rules to enforce
   - Acceptance criteria
   - Required documentation updates
4. After finalizing the plan, Brain Agent must provide a direct handoff prompt with the exact file name:
   - `Execution Agent, read PLANS/<plan-file>.md and execute it end-to-end.`

### Phase 2: Execution (Execution Agent)
1. User instructs the Execution Agent to execute a specific plan file.
2. Execution Agent reads the full plan first and executes each step.
3. After each major step, Execution Agent updates the plan file:
   - Marks step as `[x]` (done) or `[!]` (issue/blocker)
   - Adds notes on what was implemented
   - Flags uncovered decisions with `[?]`
4. Execution Agent updates all required docs listed in the plan.
5. Execution Agent commits and pushes changes.

### Phase 3: Review (Brain Agent)
1. User asks Brain Agent to review execution of a plan file.
2. Brain Agent validates:
   - Step completion
   - Architectural correctness
   - Documentation alignment
   - Need for new/revised rules
3. If needed, Brain Agent creates a correction/follow-up plan.

## Plan File Format

```markdown
# PLAN: [Short Title]
**Status**: DRAFT | IN_PROGRESS | COMPLETED | NEEDS_REVIEW | BLOCKED
**Created**: [date]
**Created By**: Brain Agent
**Executed By**: Execution Agent (pending)

## Objective
[What we want to achieve and why]

## Context
[Relevant background, source docs, current state]

## Pre-Conditions
[What must be true before execution starts]

## Steps

### Step 1: [Title]
- [ ] [Detailed instruction]
- [ ] [Detailed instruction]
**Files**: `path/to/file.js`
**Pattern**: [Reference to existing code pattern]
**Rule**: [Business rule to enforce]

### Step 2: [Title]
...

## Documentation Updates Required
- [ ] Update `Documents/X.md` with [what]
- [ ] Update `Documents/Y.md` with [what]

## Acceptance Criteria
- [ ] [Testable condition]
- [ ] [Testable condition]

## Post-Execution Notes (Execution Agent fills this)
[Notes added during execution]
```

## Rules for Brain Agent
1. Never leave implicit decisions in plans.
2. Reference existing code patterns for implementation steps.
3. Capture business rules in docs before finalizing the plan.
4. Keep plans small enough for one execution session.
5. Always include documentation update instructions.
6. Always create plans from `PLANS/_TEMPLATE.md`.
7. Always end planning output with the execution handoff prompt containing the exact plan filename.

## Rules for Execution Agent
1. Read the entire plan before editing files.
2. Follow plan instructions literally unless they would break production behavior.
3. Mark progress in the plan file continuously.
4. **Mandatory Metadata Update**: Update plan `Status` to `IN_PROGRESS` when starting, and `COMPLETED` (or `BLOCKED`) when finishing. Update `Executed By` with your identity.
5. Avoid undocumented architecture changes; flag ambiguous points with `[?]`.
6. Always complete required documentation updates.
7. Commit by logical chunks with descriptive messages referencing the plan.

## Rules for User
1. Start with Brain Agent to create/adjust the plan.
2. Switch to Execution Agent to execute the plan.
3. Return to Brain Agent for execution review.
4. Share missing business rules early so they are documented before execution.

## Key Documents
| Document | Purpose |
|---|---|
| `AGENTS.md` | Repository startup rules and default mode |
| `Documents/CONTEXT_HANDOFF.md` | Current project state and resume context |
| `Documents/AI_COLLABORATION_PROTOCOL.md` | Sync rules for code/sheets/docs |
| `Documents/RESOURCE_COLUMNS_GUIDE.md` | `APP.Resources` column definitions |
| `Documents/SCHEMA_REFACTORING_GUIDE.md` | Safe schema change workflow |
| `PLANS/*.md` | Active and completed implementation plans |
| `.agents/skills/little-leap-expert/SKILL.md` | Project skill workflow |
