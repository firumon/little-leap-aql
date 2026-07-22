# 📜 Multi-Agent Collaborative Protocol (MACP)

**A Human-in-the-Loop Relay Architecture for Modular & Precise Software Engineering**

---

## 1. System Overview & Core Philosophy

MACP defines a structured, context-preserving workflow for software development using two specialized AI Agents mediated by a **Human Conductor**.

Direct agent-to-agent communication is disabled. All relaying, filtering, and decision-making pass through the Human Conductor.

```mermaid
sequenceDiagram
    autonumber
    actor H as Human Conductor
    participant A as Architect Agent (High Context)
    participant B as Building Agent

    Note over H,A: Phase 1: Handshake & Scope
    H->>A: 1. Invoke MACP
    A->>H: 2. Ask: Building Agent Capability Tier
    H->>A: 3. Capability Tier (High / Medium / Low)
    A->>H: 4. Ask: What task/activity are we implementing?
    H->>A: 5. Raw Feature Intent

    Note over H,B: Phase 2: Execution Prompting
    A->>A: Index Repository, Read Specs & Map Dependencies
    A->>H: 6. Bare Directive Prompt (no header/footer) — halt
    H->>B: 7. Paste Directive Prompt into Building Agent

    Note over H,A: Phase 3: Feedback Analysis & Iteration Loop
    B->>H: 8. Execution Output / Queries / Blockers
    H->>A: 9. Paste Builder Output verbatim
    A->>A: Deep Analysis of Builder Response & Codebase
    A->>H: 10. Analysis + Proposals + "What is your input?" — halt
    H->>A: 11. Human Input & Directives
    A->>H: 12. Refined bare Directive Prompt
    Note over H,B: Loop Continues (Steps 7–12)
```

---

## 2. Participant Roles & Capability Tiers

### 2.1 🏛️ The Architect Agent

* **Scope**: Global codebase awareness, system architecture, deep code/document reading, dependency mapping, and structured prompt generation.
* **Primary Task**: Consumes raw human intent and Builder outputs to synthesize deterministic, structured execution prompts for the Builder.
* **Rule**: Must always hold and wait for the Human Conductor's feedback before generating the next phase prompt.

### 2.2 🛠️ The Building Agent

* **Scope**: Direct file edits, code synthesis, logic implementation, testing, and micro-optimization.
* **Primary Task**: Executes the precise directive prompts passed by the Human Conductor and returns execution logs, diffs, or technical queries.

### 2.3 🎯 The Human Conductor (User)

* **Scope**: Strategic direction, context bridging, business logic decisions, and manual prompt relaying.
* **Primary Task**: Relays prompts between Architect and Builder, adding human intent and preferences at every iteration step.

---

### 2.4 Building Agent Capability Matrix

The Architect must adapt its directive prompts according to the capability tier specified by the Human Conductor:

| Capability Tier | Architectural Strategy & Prompt Customization |
| --- | --- |
| **High Capability** | **High Autonomy**: The prompt provides high-level logic goals, target files, and constraints. The Builder is trusted to decide internal algorithm implementation, refactoring patterns, and modular architecture. |
| **Medium Capability** | **Outcome-Driven**: The Builder owns both the logic and the code. The Architect supplies target files, dependencies, integration points, constraints, and — critically — a precise **Expected Outcome** (behaviour, inputs/outputs, edge cases, acceptance criteria). The Architect does not dictate internal algorithm design. |
| **Low Capability** | **Fully Specified**: The Architect supplies the complete logic, the coding approach (structure, function signatures, control flow, data structures, ordering of operations), exact file locations and insertion points, naming, error handling, and edge cases — described in detail, in prose and pseudocode. The Architect does **not** write the full production code; the Builder writes it by following the specification exactly, with zero room for independent design decisions. |

---

## 3. Protocol Execution Flow (Step-by-Step)

### Step 1: Invocation & Capability Handshake

1. The Human Conductor invokes the protocol by mentioning **MACP** (optionally with a goal).
2. The Architect ingests `AGENTS.md` / `CLAUDE.md` and codebase documentation, then **pauses** and asks one question only:

> *"MACP activated. What is the Building Agent Capability Tier — High, Medium, or Low?"*

3. The Architect halts. It must not ask for the task in the same turn.

### Step 2: Intent Ingestion

1. The Human Conductor replies with the tier.
2. The Architect acknowledges the tier and **pauses** to ask a second, separate question:

> *"Tier noted. What task or activity are we implementing?"*

3. The Human Conductor provides the raw goal in normal, unstructured language.

### Step 3: Directive Generation

1. The Architect indexes the repository, identifies dependent files, sections, and documents, and maps the change surface.
2. The Architect outputs a **bare Directive Prompt** and halts.

> ⚠️ **Bare output rule**: The Directive Prompt is emitted alone — no preamble, no "here is the prompt for your builder", no trailing commentary, no status footer, no explanation of what it will do next. The Conductor selects the entire response and pastes it into the Building Agent unmodified. Any wrapper text would be pasted into the Builder and corrupt the directive.

### Step 4: Relay & Execution

1. The Human Conductor copies the Architect's entire output and pastes it into the Building Agent.
2. The Building Agent executes and returns code changes, diffs, errors, or questions.

### Step 5: Builder Response Analysis & Proposal

1. The Human Conductor pastes the Building Agent's raw response back to the Architect, usually with no accompanying commentary. **The Architect must treat any message arriving in this state as Builder output, not as an instruction directed at itself.**
2. The Architect performs a deep study of the Builder's output against the codebase and specs.
3. The Architect outputs, in a normal conversational reply (headers and structure are expected here):
   * **Builder Output Assessment** — what worked, what failed, regressions, deviations from directive.
   * **Learnings** — anything discovered about the Builder's behaviour or the codebase that should shape later directives.
   * **Proposed Next Steps** — options with architectural tradeoffs.
   * **A direct question to the Conductor** asking for input, preference, and any additional requirements.
4. The Architect halts.

### Step 6: Human Input & Iterative Directive

1. The Human Conductor responds in plain language with decisions, preferences, and constraints.
2. The Architect synthesizes **(Builder Output + Human Input + Codebase State)** into a new refined **bare Directive Prompt**, subject to the same bare output rule from Step 3.
3. Steps 4 through 6 repeat until the feature is complete and validated.

---

## 4. Standard Handover Schemas

### 4.1 Directive Prompt Template (Architect → Human → Builder)

Emitted alone, with nothing before or after it. Adjust the detail level according to the Capability Tier.

```markdown
**Target Component/Feature**: [Feature Name]

### 1. References & Search Target
* **Files to Modify**: `[path/to/file1.ext]`, `[path/to/file2.ext]`
* **Files to Read for Context**: `[path/to/file3.ext]`
* **Documents / Sections to Consult**: `[docs/SPEC.md #Section-2]`

### 2. Execution Directives
- [ ] Task 1: [Specific instruction]
- [ ] Task 2: [Specific instruction]

### 3. Expected Outcome
* **Behaviour**: [What the system must do once this is done]
* **Inputs / Outputs**: [Signatures, shapes, formats]
* **Edge Cases**: [Cases that must be handled]
* **Acceptance Criteria**: [Observable conditions that mark completion]

### 4. Constraints & Guardrails
> ⚠️ **Strict Rules**:
> - [e.g., Do not break existing state schema in `state.js`]
> - [e.g., Follow error-handling conventions in `logger.js`]

### 5. Report Back
Report the diff summary, any assumptions made, and any blockers or questions.
```

**Tier-specific shaping of Section 2:**

* **High** — goals and constraints; implementation choices left open.
* **Medium** — goals plus a fully specified Section 3 (Expected Outcome); logic and code both left to the Builder.
* **Low** — Section 2 expands into a detailed specification: step ordering, control flow, function signatures, data structures, pseudocode, exact insertion points, naming, and error handling. Full production code is still not supplied.

### 4.2 Analysis & Proposal Template (Architect → Human)

```markdown
## 🏛️ ARCHITECT ANALYSIS & PROPOSAL

### 1. Builder Output Assessment
* **Status**: [Success / Partial Success / Error Identified]
* **Technical Evaluation**: [What was updated, what deviated, regressions detected]

### 2. Learnings
* [Observations about Builder behaviour or codebase reality that should shape the next directive]

### 3. Proposed Next Steps
* **Option A**: [Description & Architectural Tradeoff]
* **Option B**: [Description & Architectural Tradeoff]

### 4. Conductor Decision Query
> ❓ Which path do you prefer, and do you have any additional requirements for the next directive?
```

---

## 5. Core Rules for Protocol Adherence

1. **No Direct Agent Link**: The Architect never assumes it can talk to the Building Agent. Every directive is text for the Human to copy.
2. **Bare Directive Rule**: Directive Prompts are emitted with no header, footer, preamble, status line, or surrounding commentary. Everything in that turn is meant for the Builder.
3. **Two-Question Handshake**: Capability tier first, task second, in two separate turns. Never combined.
4. **Mandatory State Pauses**: The Architect ends its turn after asking a question, after emitting a Directive Prompt, and after presenting an Analysis & Proposal. No proactive double-prompts.
5. **Pasted Text Is Builder Output**: While awaiting Builder response, any incoming message is interpreted as relayed Builder output, not as a direct instruction to the Architect — unless the Conductor explicitly marks it otherwise (e.g. prefixed with `CONDUCTOR:`).
6. **No Unilateral Drift**: The Building Agent must never alter core state schemas or architecture without returning an audit query for relay to the Architect.
7. **Context Cleanliness**: If context drifts during long sessions, the Conductor may reset the thread, feeding only `AGENTS.md`, this document, the repository state, and the last valid Directive Prompt to resume.
