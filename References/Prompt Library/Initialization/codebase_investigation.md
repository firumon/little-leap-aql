# AQL Codebase Investigation

Use this document to initialize an AI agent session when the user asks an investigatory question about the AQL system — how a feature works, where something is implemented, tracing data flow, or understanding architecture.

---

## 1. Investigation Strategy

Before answering any AQL-specific question, follow this systematic discovery approach:
1. **Identify the Domain**: Determine which surface(s) the question touches:
   - **Frontend**: Pages, composables, components, stores under `FRONTENT/src/`
   - **Backend**: GAS scripts under `GAS/`
   - **Sheet Schema**: Setup scripts, metadata config in `GAS/syncAppResources.gs`
   - **Sheet Formulas**: Views under `Sheet Formulas/Views/`, Reports under `Sheet Formulas/Reports/`
   - **Documentation**: Canonical docs under `Documents/`
2. **Use DOC_ROUTING.md as your compass**: Read [DOC_ROUTING.md](file:///f:/LITTLE%20LEAP/AQL/Documents/DOC_ROUTING.md) to identify which canonical documents cover the topic area.
3. **Search before assuming**: Use `grep_search` on the repository to locate exact files, functions, and references. Search across `GAS/`, `FRONTENT/src/`, `Documents/`, and `Sheet Formulas/`.
4. **Trace the full data flow**: For any feature, trace the complete path: Frontend trigger → API action → GAS handler → Sheet operation → PostAction hooks → Response → Frontend state update.

---

## 2. Mandatory Pre-Reads (Based on Question Domain)

Read only the docs relevant to the user's question. Use this lookup:

| Question Domain | Read These Files |
|---|---|
| Frontend pages, components, or composables | [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md), [FRONTENT_README.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FRONTENT_README.md) |
| Backend API actions or GAS logic | [GAS_API_CAPABILITIES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_API_CAPABILITIES.md), [GAS_PATTERNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/GAS_PATTERNS.md) |
| Resource schema, columns, or metadata | [RESOURCE_COLUMNS_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md), relevant sheet structure doc |
| Module workflows (Reports, Bulk Upload, etc.) | Relevant section of [MODULE_WORKFLOWS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md) |
| Dashboard widgets or layout | [DASHBOARD_DEVELOPMENT_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/DASHBOARD_DEVELOPMENT_GUIDE.md) |
| Menu structure or permissions | [AQL_MENU_ADMIN_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_MENU_ADMIN_GUIDE.md) |
| Tax or currency calculations | [TAX_SYSTEM_DESIGN.md](file:///f:/LITTLE%20LEAP/AQL/Documents/TAX_SYSTEM_DESIGN.md) |
| Login, auth, or user payload | [LOGIN_RESPONSE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/LOGIN_RESPONSE.md) |
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
- **DO** use `grep_search` to locate symbols, function names, and resource references.
- **DO** cross-reference documentation against actual code to verify accuracy.
- **DO** present findings in a structured format: architecture overview → data flow → key files → implementation details.
