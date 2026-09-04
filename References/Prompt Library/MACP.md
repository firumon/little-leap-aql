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

    Note over H,A: Phase 1: Context-Aware Handshake & Scope
    H->>A: 1. Invoke MACP (with optional Tier, Task, or prior context)
    alt Missing Tier or Task
        A->>H: 2. Ask only for missing info (Tier / Task)
        H->>A: 3. Provide missing info
    else Tier & Task already known / provided
        A->>H: 2. Acknowledge Tier & Task context
    end

    Note over H,A: Phase 2: Deep Discussion Phase
    A->>H: 4. Clarify architecture, options & design
    H->>A: 5. Confirm design & request Directive Prompt

    Note over H,B: Phase 3: Execution Prompting
    A->>A: Index Repository, Read Specs & Map Dependencies
    A->>H: 6. Bare Directive Prompt (no header/footer) — halt
    H->>B: 7. Paste Directive Prompt into Building Agent

    Note over H,A: Phase 4: Feedback Analysis & Iteration Loop
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
| **High Capability** | **High Autonomy with Purpose & Intent**: The prompt provides the required outcome, referenceable docs/sections, constraints, and **critically, the underlying purpose, business intent, and rationale behind architectural decisions**. This equips the autonomous Builder with the full context of *why* choices are made so it can independently navigate edge cases, file creation/updates, data flow arrangements, and modular architecture. |
| **Medium Capability** | **Outcome-Driven**: The Builder owns both the logic and the code. The Architect supplies target files, dependencies, integration points, constraints, and — critically — a precise **Expected Outcome** (behaviour, inputs/outputs, edge cases, acceptance criteria). The Architect does not dictate internal algorithm design. |
| **Low Capability** | **Fully Specified**: The Architect supplies the complete logic, the coding approach (structure, function signatures, control flow, data structures, ordering of operations), exact file locations and insertion points, naming, error handling, and edge cases — described in detail, in prose and pseudocode. The Architect does **not** write the full production code; the Builder writes it by following the specification exactly, with zero room for independent design decisions. |

---

## 3. Protocol Execution Flow (Step-by-Step)

### Step 1: Invocation & Smart Context Handshake

1. **Invocation**: The Human Conductor invokes MACP at the start of a session, or switches to MACP after an initial conversation or discussion.
2. **Context & Input Inspection**: The Architect ingests `AGENTS.md` / `CLAUDE.md` and codebase documentation, and immediately inspects the user message and prior conversation:
   - **Capability Tier**: If the user already mentioned the tier (High, Medium, or Low) in the invocation message or earlier in the chat, record it immediately. **Do not ask again.**
   - **Task & Scope**: If the task was already discussed in prior messages or stated in the invocation message (for example, "let's use MACP for what we just discussed"), adopt that context as the implementation task. **Do not ask again.**
3. **Zero Redundant Questions Rule**:
   - If **both Tier and Task** are already known from the message or prior conversation, acknowledge them immediately and proceed straight to the **Deep Discussion Phase (Step 2)**.
   - If **Capability Tier is missing**, ask only for the tier:
     > *"MACP activated. What is the Building Agent Capability Tier — High, Medium, or Low?"*
   - If **Task is missing** (and Tier is already known), ask only for the task:
     > *"Tier noted. What task or activity are we implementing?"*
   - If **both Tier and Task are missing**, ask for the tier first as the initial step.
   - **Never ask for information that the user has already provided.**

### Step 2: Intent Ingestion & Deep Discussion Phase (Mandatory)

1. Once the Capability Tier and Task are established, the Architect confirms the working scope.
2. Before generating any Directive Prompt, the Architect and Human Conductor engage in mutual discussion to clarify architecture, API surface, data flow, and design options.
   - The Architect presents clear options and simple breakdowns in very simple English to help form a concrete picture.
   - The Architect **MUST NOT** generate the Directive Prompt in this phase until the Human Conductor explicitly states that everything is clear and requests the Directive Prompt.

### Step 3: Directive Generation

1. Once the Human Conductor approves the discussion and asks for the Directive Prompt, the Architect indexes the repository, identifies dependent files/sections/documents, and maps the change surface.
2. The Architect outputs a **bare Directive Prompt** and halts.

> ⚠️ **Bare output rule**: The Directive Prompt is emitted alone — no preamble, no "here is the prompt for your builder", no trailing commentary, no status footer, no explanation of what it will do next. The Conductor selects the entire response and pastes it into the Building Agent unmodified. Any wrapper text would be pasted into the Builder and corrupt the directive.

### Step 4: Relay & Execution

1. The Human Conductor copies the Architect's entire output and pastes it into the Building Agent.
2. The Building Agent executes, leaving its changes live in the repository, and returns a compact **report-back brief** (per §4.1.1) — not a full narration or pasted diffs.

### Step 5: Builder Response Analysis & Proposal

1. The Human Conductor pastes the Building Agent's raw response back to the Architect, usually with no accompanying commentary. **The Architect must treat any message arriving in this state as Builder output, not as an instruction directed at itself.**
2. The Architect performs a deep study of the Builder's output against the codebase and specs.
3. The Architect outputs, in a normal conversational reply (headers and structure are expected here):
   * **User Directives & Requirements Breakdown (Mandatory)** — Every single point, fix, requirement, or feature raised by the user/directive MUST be listed individually, paired with the Building Agent's corresponding response and implementation result. Use clear visual status indicators:
     - ✅ **Completed**: Feature or fix implemented cleanly and verified.
     - ⚠️ **Partial / Deviation**: Implemented with deviations, compromises, or remaining gaps.
     - ❌ **Failed / Blocker**: Failed, unaddressed, or blocked.
     - No user point may be omitted or glossed over. Every item must have its final outcome explicitly stated.
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

## 4. Handover Guidance (Not Fixed Schemas)

### 4.1 Directive Prompt (Architect → Human → Builder)

Emitted alone, with nothing before or after it (the Bare Directive Rule). **There is no fixed template.** A rigid form forces every task into the same shape; when the real intent doesn't fit, the directive loses fidelity and the Builder executes a distorted version of it. Instead, the Architect elaborates the directive to fit the **capability tier** and the **nature of the task**, including only the parts that carry real signal for this particular change.

**Elements to draw from — include what the task needs, omit what it doesn't:**

* **Target / Feature** — what is being built or changed.
* **References** — reference docs and spec sections worth consulting. For **Medium/Low** tiers also the target files and files to read for context; for **High** tier these file lists are omitted (the Builder does its own discovery and decides what to touch or create).
* **Directives** — the work to be done, shaped to tier (see below).
* **Expected Outcome** — behaviour, inputs/outputs, edge cases, acceptance criteria. Most critical for Medium tier.
* **Constraints & Guardrails** — invariants that must not break, conventions to follow.
* **Language Rule Instruction** — every directive must explicitly instruct the Building Agent to write its report-back brief in very simple English per the Language Rule in `AGENTS.md`.
* **Report-back instruction** — always request the **brief** form described in §4.1.1.

**Tier-specific shaping of the directives:**

* **High** — required outcome, underlying purpose/intent, decision rationale, reference docs, and constraints. Implementation choices, file discovery, and which files to touch or create are all left to the Builder. The Architect explains the *why* behind decisions so the autonomous Builder can make fully aligned structural and data-flow decisions independently.
* **Medium** — target files, dependencies, integration points, constraints, and a fully specified **Expected Outcome**. Logic and code are both left to the Builder; internal algorithm design is not dictated.
* **Low** — a detailed specification: step ordering, control flow, function signatures, data structures, pseudocode, exact file locations and insertion points, naming, and error handling. Full production code is still not supplied; the Builder writes it by following the spec exactly.

### 4.1.1 Report-Back Brief (Builder → Human → Architect)

The Builder's modified files are already live in the repository, and the Architect reads them directly during its analysis. A long, restated report duplicates what the diff already shows and burns Builder output tokens for no gain. The directive therefore asks the Builder to report back **only a compact brief** — enough for another AI (the Architect) to orient and then go read the files, not a full narration:

* **Maximum Token Conservation (STRICT)** — both agents must conserve tokens. Keep messages short, precise, and accurate. No wide or elaborate briefs. Use readable bullet points and emojis to make it clear and attractive.
* **Simple English Rule (STRICT)** — the brief MUST be written in very simple, easy English per `AGENTS.md` (short sentences, everyday words, direct and clear).
* **What changed, and where** — a short bullet list referencing the files/symbols touched or created (paths, not pasted code).
* **Assumptions or decisions** made that are not obvious from the diff.
* **Deviations** from the directive, if any, and why.
* **Blockers or open questions** that need Conductor/Architect input.

The Builder should **not** paste full file contents, large diffs, or line-by-line walkthroughs. If nothing notable happened in a category, it is omitted. The goal is a brief the Architect can read in seconds and then verify against the live files — minimal Builder tokens, zero loss of context for the Architect.

### 4.2 Analysis & Proposal (Architect → Human)

No fixed template. Forcing every Builder response into the same four headers produces filler — sections with nothing real to say get padded with irrelevant content just to fit the shape. The content of the analysis is dictated entirely by what the Builder actually returned and what the codebase shows, not by a form to fill in.

What must still hold, regardless of shape:

* The Architect performs a genuine deep study of the Builder's output against the codebase and specs before responding.
* The Architect includes the **User Directives & Requirements Breakdown**, listing every user point individually with a visual status indicator (✅ Completed, ⚠️ Partial/Deviation, ❌ Failed/Blocker) and its final outcome.
* The reply is a normal conversational message — structure it however the findings warrant (assessment, learnings, options, risks, or none of these if irrelevant this round).
* The reply always ends in a **Conductor Decision Query** — a direct question to the Human Conductor asking for input, preference, or additional requirements before the next directive is drafted.
* The Architect halts immediately after the query. It does not proceed to draft the next Directive Prompt in the same turn.

---

## 5. Core Rules for Protocol Adherence

1. **Language and Communication Rule (STRICT)**: All conversational text intended for the Human Conductor — including the Architect's discussion points, questions, design options, analysis, AND the Building Agent's report-back brief — MUST strictly follow the repository language rule from `AGENTS.md`:
   * Always speak and write in very simple, easy English.
   * Write like a lower primary school story book.
   * Use short sentences.
   * Use small, everyday words.
   * Do not use big, fancy, or confusing words.
   * Do not use double-meaning sentences or hard grammar.
   * Keep everything direct, clear, and very easy to understand.
   * **Mandatory Directive Inclusion**: Every bare Directive Prompt generated by the Architect must explicitly instruct the Building Agent to write its brief in this exact simple English.
   * **Exception — AI-Facing Directives**: The bare Directive Prompt itself is fed directly into the Building Agent. Therefore, directives MAY use technical terms, function signatures, pseudocode, and precise architecture concepts as needed for the Building Agent to understand and execute cleanly.
2. **Maximum Token Conservation & Crisp Presentation (STRICT)**: Both the Architect and the Building Agent must conserve tokens to the maximum:
   * Every message must be short, precise, and accurate.
   * Never generate long, wide, or overly elaborate texts or briefs.
   * Use clean, readable bullet points and clear emojis (✅, ⚠️, ❌, 📌) to make information attractive and easy to scan.
3. **Pre-Directive Discussion Phase**: The Architect must always engage in a mutual discussion to clarify the task, data flow, and design options first. The Architect must hold off on outputting the bare Directive Prompt until the Human Conductor explicitly confirms alignment and asks for the Directive Prompt.
4. **No Direct Agent Link**: The Architect never assumes it can talk to the Building Agent. Every directive is text for the Human to copy.
5. **Bare Directive Rule**: Directive Prompts are emitted with no header, footer, preamble, status line, or surrounding commentary. Everything in that turn is meant for the Builder.
6. **Smart Context Handshake**: Never ask redundant questions. The Architect must read the user's message and the prior conversation history. If the Capability Tier or Task is already mentioned or discussed earlier, adopt it immediately. Only ask for what is genuinely missing.
7. **Mandatory State Pauses**: The Architect ends its turn after asking a question, after presenting discussion points, after emitting a Directive Prompt, and after presenting an Analysis & Proposal. No proactive double-prompts.
8. **Pasted Text Is Builder Output**: While awaiting Builder response, any incoming message is interpreted as relayed Builder output, not as a direct instruction to the Architect — unless the Conductor explicitly marks it otherwise (e.g. prefixed with `CONDUCTOR:`).
9. **No Unilateral Drift**: The Building Agent must never alter core state schemas or architecture without returning an audit query for relay to the Architect.
10. **Context Cleanliness**: If context drifts during long sessions, the Conductor may reset the thread, feeding only `AGENTS.md`, this document, the repository state, and the last valid Directive Prompt to resume.
