# Initialization: Prompt & Instruction Creation

> **Scope boundary**: This document covers creating new initialization prompts only. Its discovery steps require exhaustive codebase reading — read source files directly by path. Do NOT load other init prompts for context; you are creating one.

Use this instruction when the user asks to create an initialization prompt, workflow instruction, or checklist for a specific task or feature area in AQL.

---

## 1. Phase 1: Exhaustive Codebase & Document Discovery (Do Not Skip)

Before writing any instruction or checklist, you must perform a comprehensive inspection of the entire repository to gather every piece of context. Do not rely on memory or partial scans.

### Step 1: Document Scan
1. Read `Documents/README.md` and `Documents/DOC_ROUTING.md` to identify related documentation.
2. Read the full text of all documents that mention the target task or feature area.
3. If the task touches:
   - **Masters or Operations UI**: Read `Documents/CUSTOM_PAGE_AND_PAGE_SECTIONS_CUSTOMIZATIONS.md`.
   - **Workflows**: Read the relevant workflow section in `Documents/MODULE_WORKFLOWS.md`.
   - **Sheet Schemas**: Read the relevant structure file (e.g., `Documents/OPERATION_SHEET_STRUCTURE.md`) and `Documents/RESOURCE_COLUMNS_GUIDE.md`.
   - **Tax/Currency**: Read `Documents/TAX_SYSTEM_DESIGN.md` and check `FRONTENT/src/composables/useCurrency.js`.

### Step 2: Codebase Scan
Search the codebase using ripgrep (`grep_search`) for symbols, resource names, or keywords related to the task:
1. **GAS Backend**:
   - Locate related files in `GAS/` (e.g., `GAS/outletMovements.gs`, `GAS/stockMovements.gs`, `GAS/procurement.gs`).
   - Identify any post-write hooks (`PostAction` mappings) and `AdditionalActions` configured for the resource.
   - Scan `GAS/syncAppResources.gs` config settings for the resource's headers and default values.
2. **Frontend Pages & Composables**:
   - Locate the custom pages in `FRONTENT/src/pages/` (e.g., `Operations/Rfqs/`, `Masters/PriceLists/`).
   - Locate the composables in `FRONTENT/src/composables/` (e.g., `operations/`, `masters/`).
   - Locate any related widgets in `FRONTENT/src/dashboard/`.
3. **Frontend Registries**:
   - Check `FRONTENT/src/components/REGISTRY.md` and `FRONTENT/src/composables/REGISTRY.md` for reusable files that should be reused or updated.

---

## 2. Phase 2: Structuring the Generated Prompt / Instruction

The generated prompt must be written as a markdown file. It must be structured into the following mandatory sections to ensure the receiving agent is fully equipped:

### A. Title & Scope
Clear description of what task/workflow this prompt governs.

### B. Mandatory Pre-Reads (With Line-Level Links)
List every file the agent must read before writing code.
- Format: `[filename](file:///absolute/path/to/file#LStart-LEnd)`
- Example: Read the `compositeSave` handler in [resourceApi.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceApi.gs#L450-L520).

### C. Data Flow & Schema Matrix
Identify exactly how data is structured and how it moves:
- **Sheet name and key columns**: List source columns, required headers, and validation requirements.
- **API Action & Transport**: Specify if it uses `get`, `create`, `update`, `bulk`, `compositeSave`, `executeAction`, or `batch`.
- **Frontend Storage & State**: Note where the data is stored (Pinia `useDataStore`, IndexedDB table) and how it hydrates.

### D. Step-by-Step Implementation Checklist
A sequential, itemized list of steps the agent must follow. Group them logically:
1. **Backend adjustments** (clasp sync, sheet header refactoring, hooks).
2. **State & Orchestration** (composables, stores, batch payload builders).
3. **UI & Components** (Quasar pages, mobile-friendly cards, permission gates).

### E. Explicit Guardrails (DOs and DO NOTs)
List strict repository rules that apply to this specific task:
- **DO NOT** use `QTable` for mobile layouts.
- **DO NOT** write business logic inside page files (must live in composables).
- **DO NOT** trigger redundant `get` requests after saves if write deltas are returned.
- **DO** use `useResourceNav` for routing.
- **DO** wrap multi-resource edits in a single `batch` payload using `$ref` objects for dependencies.

### F. Targeted Verification Plan
Specify exactly how the agent must verify the changes:
- Commands to run (e.g., `npm run gas:push`, `npm --prefix FRONTENT run build`).
- Steps to test the UI flow manually.
- Database checks (e.g., verify that the stock movement updates `WarehouseStorages` through hooks).

---

## 3. Phase 3: Review and Refine

Before saving the generated prompt:
1. Cross-reference the draft against `Documents/ARCHITECTURE RULES.md` to ensure zero layer violations are introduced.
2. Confirm all file paths are correct, absolute, and clickable using the `file:///` scheme.
