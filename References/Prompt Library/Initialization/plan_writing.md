# Initialization: Implementation Plan Writing

Use this instruction when the user requests to create or update an implementation plan.

---

## 1. Context Discovery & Codebase Education (No Reading Limit)

Before drafting the implementation plan, you must be fully prepared and educated on the relevant context of the task:
1. **Unrestricted Reading**: You are NOT limited to reading specific files or documents. Read and refer to all source code files, schemas, configs, and documents across the entire repository to gather complete background information.
2. **Context Exploration**: Explore all dependencies, execution flows, and related modules to ensure that the plan is comprehensive, accurate, and minimizes regressions.
3. **Mandatory Reference Check**: 
   - Read [Documents/ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) to ensure the plan strictly follows the repository's frontend and backend structural boundaries.
   - Reference [Documents/RESOURCE_COLUMNS_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md) and related sheet structure files to align planning changes with the sheet data schemas.
   - Read [PLANS/_TEMPLATE.md](file:///f:/LITTLE%20LEAP/AQL/PLANS/_TEMPLATE.md) to ensure the plan structure matches the standard template format.

---

## 2. Strict Architectural & Codebase Standards

All proposed changes in the implementation plan must strictly conform to current AQL repository coding standards and architecture rules:
1. **Frontend Standards (Quasar/Vue 3)**:
   - Adhere to the Vue Reactivity Contract outlined in [Documents/ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md).
   - Pages must remain thin, serving as orchestrators, while business logic resides inside composables and state resides in Pinia stores.
   - No parallel arrays for mapping UI state; use single unified objects/arrays.
2. **Backend Standards (Google Apps Script)**:
   - Adhere to the generic CRUD and batch processing APIs in [Documents/GAS_PATTERNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md).
   - Align backend logic with existing Apps Script patterns (`resourceApi.gs`, post-write action hooks).
   - Do not hardcode sheet or resource names.
   - Do not duplicate resource-specific logic in `resourceApi.gs`; use PostAction hooks.

---

## 3. Step 1: Clarify Executing Agent Capability (Mandatory First Step)

Before drafting the plan, you must ask the user about the capability level of the agent that will execute/implement the plan:
1. **High-Capability/Standard Agent**: The executor is capable of resolving minor naming, design, or layout details independently.
2. **Low-Capability/Dumb Agent**: The executor has low reasoning ability and must be fed literal code snippets and line-by-line instructions.

**Do not begin writing the plan until this clarification is resolved.**

---

## 4. Plan Structure Options

### Option A: Standard Plan (For High-Capability Executors)
Follow the standard structure of `PLANS/_TEMPLATE.md`:
1. **Goal / Context**: Explain the business problem and resolution.
2. **Proposed Changes**: List exact files to create, modify, or delete, including input/output contracts, generic pattern maps (hooks, batch, composite), and component scopes. No code blocks are required.
3. **Verification Plan**: Targeted tests, manual UI checks, and database validation.

### Option B: Deeply Detailed Plan (For Low-Capability Executors)
For each file and step, specify:
1. **Exact Code Snippets**: Provide the complete, drop-in replacement code blocks or precise diffs.
2. **Line-Level Targets**: State the exact line numbers, functions, or blocks to modify.
3. **Step-by-Step Edits**: Give literal instructions (e.g., "Open `GAS/stockMovements.gs`, find function `X`, replace lines 40-52 with the following snippet...").
4. **Zero Reasoning**: The executor must not make any logic, structure, naming, or ordering decisions.

---

## 5. General Planning Principles

1. **Location**: Plan files must be created in the `PLANS/` directory using names starting with the date (e.g., `PLANS/YYYY-MM-DD-feature-name.md`).
2. **Plan Metadata**: Every plan must include the metadata header:
   - `Created By: [AgentName]`
   - `Executed By: [AgentName] | pending`
3. **Architectural Alignment**:
   - Plans must strictly adhere to the Quasar/Vue frontend boundaries in [Documents/ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) (unidirectional data flow, computed aggregates, thin page shells).
   - Plans must adhere to backend boundaries in [Documents/GAS_PATTERNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md) (no hardcoding of resource names, generic CRUD, batch operations).
4. **Data Schemas**: Align all plan changes with [Documents/RESOURCE_COLUMNS_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md) and related structural documents.
5. **Directory Existence**: If the `PLANS/` directory does not exist, create it before saving the plan file.

---

## 6. Guardrails (DOs and DO NOTs)

- **DO NOT** edit production source code files while planning.
- **DO NOT** assume the capability of the executor without asking the user.
- **DO** verify that the plan template matches `PLANS/_TEMPLATE.md`.
- **DO** verify that all referenced file paths are correct, absolute, and clickable using the `file:///` scheme.
