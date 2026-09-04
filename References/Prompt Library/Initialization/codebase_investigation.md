# AQL Codebase Investigation

> **Scope boundary**: This document covers codebase investigation only — tracing data flow, understanding architecture, finding implementations. It tells you which canonical docs to READ by path for each domain — do NOT load other init prompts for investigation context.

Use this document to initialize an AI agent session when the user asks an investigatory question about the AQL system — how a feature works, where something is implemented, tracing data flow, or understanding architecture.

---

## 1. Investigation Strategy

Before answering any AQL-specific question, follow this systematic discovery approach:
1. **Consult CODEBASE_INDEX.md**: Read [CODEBASE_INDEX.md](file:///f:/LITTLE%20LEAP/AQL/References/CODEBASE_INDEX.md) to locate the exact tags, features, pages, or files matching the query. This is your primary search index and is highly token-efficient.
2. **Identify the Domain**: Determine which surface(s) the question touches:
   - **Frontend**: Pages, composables, components, stores under `FRONTENT/src/`
   - **Backend**: GAS scripts under `GAS/`
   - **Sheet Schema**: Setup scripts, metadata config in `GAS/syncAppResources.gs`
   - **Sheet Formulas**: Views under `Sheet Formulas/Views/`, Reports under `Sheet Formulas/Reports/`
   - **Documentation**: Canonical docs under `Documents/`
3. **Use CORE_DOC_ROUTING.md as your compass**: Read [CORE_DOC_ROUTING.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_DOC_ROUTING.md) to identify which canonical documents cover the topic area if not fully mapped by the tag index.
4. **Read only target files**: Instead of doing broad searches or reading entire directories, read only the specific files highlighted in the index.
5. **Trace the full data flow**: For any feature, trace the complete path: Frontend trigger → API action → GAS handler → Sheet operation → PostAction hooks → Response → Frontend state update.

---

## 2. Mandatory Pre-Reads (Based on Question Domain)

Read only the docs relevant to the user's question. Use this lookup:

| Question Domain | Read These Files |
|---|---|
| Frontend pages, components, or composables | [CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md), [CORE_OVERVIEW.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_OVERVIEW.md) |
| Backend API actions or GAS logic | [GAS_API_CAPABILITIES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_API_CAPABILITIES.md), [GAS_PATTERNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md) |
| Resource schema, columns, or metadata | [SCHEMA_RESOURCE_COLUMNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SCHEMA_RESOURCE_COLUMNS.md), relevant sheet structure doc |
| Module workflows (Reports, Bulk Upload, etc.) | Relevant section of [WORKFLOW_OUTLET_OPERATIONS.md / WORKFLOW_PROCUREMENT.md](file:///f:/LITTLE%20LEAP/AQL/Documents/WORKFLOW_OUTLET_OPERATIONS.md / WORKFLOW_PROCUREMENT.md) |
| Dashboard widgets or layout | [FEATURE_DASHBOARD_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_GUIDE.md) |
| Menu structure or permissions | [SHEET_TOOLBAR_MENU_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SHEET_TOOLBAR_MENU_GUIDE.md) |
| Tax or currency calculations | [FEATURE_TAX_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_TAX_SYSTEM.md) |
| Login, auth, or user payload | [API_LOGIN_RESPONSE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/API_LOGIN_RESPONSE.md) |
| Sheet views or report formulas | [Sheet Formulas/Views/INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/INDEX.md) or [Sheet Formulas/Reports/INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/INDEX.md) |

---

## 3. Response Standards

1. **Cite specific files and line ranges**: Every claim about how a feature works must reference the actual source file using `file:///` links with line numbers.
2. **Trace the full pipeline**: For workflow questions, document the complete chain: Frontend composable → API call → GAS handler → Sheet read/write → PostAction hook → Response handling → State update.
3. **Use code evidence**: Include relevant code snippets from the actual codebase, not fabricated examples.
4. **Acknowledge gaps**: If a feature is not documented or you cannot locate the implementation, state that explicitly rather than guessing.

---

## 4. Guardrails (DOs and DO NOTs)

- **DO NOT** fabricate code paths or file locations. If you cannot find the implementation, say so.
- **DO NOT** modify any files during investigation. This is a read-only task.
- **DO NOT** read the entire codebase upfront. Read only files relevant to the question.
- **DO** use [CODEBASE_INDEX.md](file:///f:/LITTLE%20LEAP/AQL/References/CODEBASE_INDEX.md) to locate the relevant files/functions first before doing broad searches.
- **DO** cross-reference documentation against actual code to verify accuracy.
- **DO** present findings in a structured format: architecture overview → data flow → key files → implementation details.
