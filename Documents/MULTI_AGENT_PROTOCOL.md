# Multi-Agent Collaboration Protocol

## Purpose
This document defines how four AI roles collaborate on the AQL project:
- **Guide Agent** (Default) - Brainstorming, general discussion, feedback, and requirement clarification.
- **Brain Agent** - Architecture, planning, business rules, and implementation plan creation.
- **Build Agent** - Implementing code changes, terminal commands, and documentation updates based on a plan.
- **Solo Agent** - Autonomous end-to-end execution for tasks (planning + building combined).

## Default Startup Rule
For every new context window, the agent should:
1. Read `AGENTS.md` first.
2. Identify the active role requested by the user, or default to **Guide Agent**.
3. Read this file (`Documents/MULTI_AGENT_PROTOCOL.md`).
4. Read `Documents/AI_COLLABORATION_PROTOCOL.md` and `Documents/CONTEXT_HANDOFF.md`.
5. Check `PLANS/` for active plans before starting implementation.

## Roles and Responsibilities

### 1. Guide Agent (Default Entry)
- **Focus**: "The What and Why".
- **Usage**: When the user hasn't specified a role or wants to discuss a new idea.
- **Rules**:
  - Proactively ask questions to surface edge cases.
  - Suggest architectural approaches or alternatives.
  - Do not modify code or plans directly; focus on consensus.
  - Suggest moving to **Brain Agent** when a clear path is identified.

### 2. Brain Agent (The Architect)
- **Focus**: "The Plan".
- **Usage**: When a requirement is ready to be structured into an executable plan.
- **Rules**:
  - Create/modify implementation plans in `PLANS/` using `PLANS/_TEMPLATE.md`.
  - Reference existing patterns and capture business rules.
  - Always end with a handoff prompt for the **Build Agent**.

### 3. Build Agent (The Builder)
- **Focus**: "The Action".
- **Usage**: After a plan is approved and finalized in `PLANS/`.
- **Rules**:
  - Read the plan end-to-end before starting.
  - Execute steps literally while marking progress in the plan file.
  - Update documentation and commit changes with logical messages.
  - Update plan status to `COMPLETED` when finished.

### 4. Solo Agent (The Autonomous)
- **Focus**: "Speed and Autonomy".
- **Usage**: For well-defined tasks where the user wants the AI to handle both planning and building without handoffs.
- **Rules**:
  - Solo agents are **exempt** from creating written implementation plans in `PLANS/`.
  - Planning is performed internally and executed directly.
  - Follow all documentation and code quality rules as if split between Brain/Build.

## Workflow

### Phase 1: Discussion (Guide)
- Brainstorming and refining requirements.

### Phase 2: Planning (Brain)
- **Brain Agent** creates a plan in `PLANS/`.
- Handoff prompt: `Build Agent, read PLANS/<plan-file>.md and execute it end-to-end.`

### Phase 3: Building (Build)
- **Build Agent** executes the plan, updates docs, and marks the plan as `COMPLETED`.

### Phase 4: Review (Guide/Brain)
- Review results and plan next steps.

## Plan File Format
Plans must record role + concrete agent identity for traceability:
- `Created By: Brain Agent (AgentName)`
- `Executed By: Build Agent (AgentName | pending)`
Build Agent must replace `| pending` when execution is completed.

## Context Efficiency Rule
All roles should minimize context bloat:
1. Avoid full-file/full-diff/raw-log dumps unless explicitly required.
2. Prefer scoped reads and concise summaries.
3. After startup context is loaded, read only task-relevant docs/files unless requirements changed.

## Rules for User
1. Use **Guide** for discussions.
2. Use **Brain** to prepare for implementation.
3. Use **Build** to get things done.
4. Use **Solo** for quick, end-to-end tasks.

## Key Documents
| Document | Purpose |
|---|---|
| `AGENTS.md` | Startup rules and default role definition |
| `Documents/MULTI_AGENT_PROTOCOL.md` | Detailed role and workflow definitions |
| `Documents/CONTEXT_HANDOFF.md` | Current project state and resume context |
| `Documents/AI_COLLABORATION_PROTOCOL.md` | Sync rules for code/sheets/docs |
| `PLANS/*.md` | Active and completed implementation plans |
| `.agents/skills/aql-expert/SKILL.md` | Project skill workflow |
