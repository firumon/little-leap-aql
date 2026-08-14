# AQL Report UI & Feature Development

> **Scope boundary**: This document covers the frontend user interface, composables, components, and Google Apps Script menu/dialog orchestration for the reports system. It includes `ResourceReports.vue`, `ReportInputDialog.vue`, `useReports.js` composable, `reportManager.html` Dialog, and `appMenu.gs` functions.
> 
> **CRITICAL RULE**: When performing Report UI or Feature Development, do **NOT** modify sheet formulas directly unless instructed. For formula logic and layout constraints, refer to [report_formula_generation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/report_formula_generation.md).

Use this document to initialize an AI agent session when the task involves developing new report frontend features, customizing report buttons/cards, adding options/fields to the report input dialog, modifying the Reports composable, or adjusting the Sheets "Manage Reports" menu action.

---

## 1. System Architecture & Coordination

The AQL report UI system coordinates data from `APP.Resources.Reports` configs to render buttons and collect parameters for backend PDF generation.

*   **Registry Configs**: Report rules are stored in `APP.Resources` in the `Reports` column. The registry controls sheet mapping, location rules (`isRecordLevel`), parameter definitions (`inputs`), and layout overrides (`pdfOptions`).
*   **Menu Configurations**: The sheet menu action **AQL 🚀 > Manage Reports** renders `GAS/reportManager.html`. Saving inside this dialog writes directly to the `Reports` column and clears all config caches.
*   **Web Frontend**:
    *   [actions/ResourceReports.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/actions/ResourceReports.vue) — **preferred**. Report downloads as a page action: resolved via `useActionResolver`, mounted automatically by `PageAction` on non-form pages, by `FormActions` via `actions: [… 'reports' …]`, or directly as `<Action action="ResourceReports" mode="toolbar" />`. Overridable at all 10 `_ui/` tiers as `resourcereports.(vue|js)`. Modes: `fab` / `toolbar` / `card` / `inline`. Record context comes from the injected `resourceRecord`. Spec: [UI_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_ACTION_SYSTEM.md) §3.5; customization routing: [action_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/action_customization.md).
    *   [Reports/ResourceReports.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/Reports/ResourceReports.vue) — **legacy**, direct-import path (auto-detects active resource context, displays record-level or toolbar-level report buttons). Retained unchanged for existing custom views/pages; do not add new call sites.
    *   [useReports.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/reports/useReports.js) (Filters reports, preloads dynamic sources, parses inputs into cells, and triggers generation).
    *   [ReportInputDialog.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/app/ReportInputDialog.vue) (Prompts for user inputs, handles select dropdown lists, date picking, toggles).

**Key File Coordinates**:
*   Detailed Guide: [FEATURE_REPORTS_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_REPORTS_SYSTEM.md)
*   Frontend Components: [ResourceReports.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/Reports/ResourceReports.vue) and [ReportInputDialog.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/app/ReportInputDialog.vue)
*   Frontend Composable: [useReports.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/reports/useReports.js)
*   GAS Dialog & Save: [reportManager.html](file:///f:/LITTLE%20LEAP/AQL/GAS/reportManager.html) and [appMenu.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/appMenu.gs)

---

## 2. Frontend Reactivity & Component Guidelines

When modifying Quasar report UI components:
1.  **Architecture Layer Boundaries**:
    *   Keep components visual. Place all loading states, file generation, dialog state toggling, and input mappings inside the `useReports` composable.
    *   Do not query `resourceIoStore` or trigger backend Calls directly from `ResourceReports.vue` or `ReportInputDialog.vue`.
2.  **Resource Resolvers**:
    *   Auto-derive resource names and codes using `useResourceConfig()`. If a component handles explicit rows (e.g. details dialog), pass the record as a prop to `ResourceReports`.
    *   In the **action** component, resolve context from the injected `resourceConfig` / `resourceRecord` — never from a store. Type every customizable prop as `[Type, Function]` and evaluate it via `evaluateProp` (ARCHITECTURE RULES §8), and carry no `<style>` block: report action styling is `.aql-report-action-*` in `src/css/custom.scss` (§7).
    *   The action is **self-dispatching** — a download never touches `pageState`, so it calls `useReports` directly instead of emitting intent to `PageAction.handleAction()`. Do not add report logic to that dispatcher.
3.  **Dynamic Select Input Preloading**:
    *   If a report input uses a dynamic resource lookup (`type: "select"` with `source: { resource, field }`), the composable **MUST** call `dataStore.loadResource(resource)` on report initiation to seed the list in state before the dialog opens.
    *   Use the `getSelectOptions` helper in `ReportInputDialog.vue` to map unique sorted options:
        ```javascript
        const records = dataStore.getRecords(resourceName) || []
        const uniqueValues = [...new Set(records.map(rec => rec[fieldName]))].filter(Boolean).sort()
        ```

---

## 3. Backend GAS Sheet Menu Guidelines

When modifying the Sheet Menu Report Manager:
1.  **App Menu API Data**:
    *   `app_getReportManagerData()` fetches both the resources headers schemas and the available template sheet names in the REPORTS spreadsheet file.
2.  **Report Configuration Structure**:
    *   Configure inputs following the types: `text`, `number`, `date`, `boolean`, `select` (static or dynamic lookup), and `static`.
    *   Ensure all new fields are mapped to a matching property in `reportsJson` within `app_saveResourceReports`.
3.  **Cache Invalidation**:
    *   Whenever report metadata is saved via `app_saveResourceReports(resourceName, reportsJson)`, you **MUST** invoke `clearResourceConfigCache()` to invalidate Tier 1 (in-memory), Tier 2 (CacheService), and Tier 3 (APP.Metadata) caches.

---

## 4. Guardrails (DOs and DO NOTs)

*   **DO NOT** write business/trigger logic directly inside Vue template click handlers. Use the methods returned by `useReports`.
*   **DO NOT** duplicate loading spinners. Quasar's `$q.notify` with `group: 'report-progress'` and spinner flags are centrally managed in `useReports.js`.
*   **DO** ensure that any new report input mapping correctly designates whether it uses a record `field` context or a user-facing `label` + `type`.
*   **DO** run `npm run gas:push` from the project root after changing Apps Script backend files.

---

## 5. Targeted Verification Plan

### A. Frontend Verification
1.  Verify that report buttons render correctly in both toolbar and row inline configurations.
2.  Test that standard and dynamic dropdown fields populate correctly in the `ReportInputDialog`.
3.  Verify the download trigger parses the Base64 stream correctly and handles browser blocking notifications gracefully.

### B. Backend Verification
1.  Open the Sheet Menu Report Manager dialog and verify all resource definitions load.
2.  Add/Edit a report mapping, save, and verify the changes write correctly to the `APP.Resources` registry.
3.  Confirm that modifying a report configuration immediately busts the cache, making the new button/field visible on the frontend after a page reload.

