---
name: AQL Content & Page Customization Agent
description: Specialized initialization prompt for creating, inspecting, or modifying content components (List and other `contents:` entries), per-active-view overrides, form layouts, details cards, and collapsible form sections under Content.
---

# Scope Boundary

This document defines initialization parameters for agents tasked with resource-level Content overrides, `List` customization, or JS layout modifications.

## Required Pre-Reads
Before creating or modifying any local Content components:
1. **System Specifications**: Read [AQL_CONTENT_CUSTOMIZATION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_CONTENT_CUSTOMIZATION_SYSTEM.md) to review the `contents:` page contract, the `Content.vue` / `useContentResolver.js` resolution chain, the built-in `List` content component, `useListStrategy.js` defaults, and per-active-view override rules.
2. **Architecture Constraints**: Read [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) for strict formatting rules (e.g. no `<style>` blocks in local components).

---

## 1. Context Tracing Protocol

To custom-tailor content layouts:
1. **Locate Metadata**: Read the target resource schema file under `src/metadata/schemas/` or fetch headers in `src/pages/resource/` page context.
2. **Confirm the page contract**: Check `src/pages/[scope]/[page].js` for `contents: [...]` (e.g. `contents: ['List']`) to know which content name(s) render on that page.
3. **Find Target Override Paths**: Check if overrides already exist under `src/_ui/[UiName]/components/[scope]/[ResourceName]/[page]/`.
4. **Analyze Overriding Strategy**:
   - Prefer **JS Logic Modifiers** (`[Content].js` under custom UI, e.g. `list.js`) for simple adjustments (column/layout overrides, chip/meta tweaks, custom labels).
   - Use **Vue Template SFC Overrides** (`[Content].vue` under custom UI) ONLY if the page requires complex non-standard UI elements, custom slots, or specialized inputs.
   - Use a **per-active-view override** (`List<ViewName>.vue`/`.js`, e.g. `ListApproved.js`) ONLY when the customization should apply while one specific list view/filter chip is selected, not to the resource's default list rendering.

---

## 2. Implementation Rules

### 2.1 Writing JS Logic Modifiers for `List`
- Create the target component (e.g. `src/_ui/[UiName]/components/[scope]/[resource]/index/list.js`) exporting a default function.
- The function receives the resolved `List` props object (post-`useListStrategy` baseline, post-explicit-prop merge) and returns the adjusted props. Any `AqlList`-surface prop (`layout`, `content`, `label`, `caption`, `metaLayout`, `chipColor`, etc.) can be overridden:
  ```javascript
  // src/_ui/AQL/components/master/products/index/listInactive.js
  export default function (props) {
    return {
      ...props,
      layout: ['label', 'caption'],
      content: ['Name', 'SkuCode']
    }
  }
  ```
- For other content sections (Details, Form) the same pattern applies — the function receives `preparedProps` and returns the modified object.

### 2.2 Writing Vue Template Overrides
- Vue overrides must contain a `<template>` block. Components without a template block are **never allowed**.
- Bind all values using the page-provided state injection tokens (`resourceConfig`, `resourceRecord`, `pageState`) — these are passed to JS modifier functions as the second argument, and available via `inject()` in Vue overrides.
- Props flow through unmodified to a Vue override, so read values via `$attrs` / declared props rather than assuming a fixed shape.
- **NEVER** use inline style blocks. Use Quasar utility classes (e.g. `q-pa-md`, `row`, `col`, `q-gutter-sm`) for spacing, grids, and alignments.

### 2.3 Per-Active-View Overrides
- To customize the list only while a named view (e.g. "Approved") is active, create `List<ViewName>.vue` or `.js` (PascalCased view name) at the same lookup paths as any other content override — see `AQL_CONTENT_CUSTOMIZATION_SYSTEM.md` §4 for the full candidate order.
- Do not create a `List<ViewName>` file if the intent is to change the *default* rendering — that belongs in a plain `list.js`/`.vue` override instead.

### 2.4 Overriding Content-Resolver Identity from a Manual Usage
- `List.vue` accepts optional `page`, `scope`, `resource`, `uiName` props that take priority over the ambient `resourceConfig` context. Use these only when embedding a `<List>` manually outside its normal page-contract slot (e.g. showing another resource's list inside a custom section) — do not set them when relying on the default page-driven resolution.

### 2.5 Verification & Safety
- Run target checks or verify paths to confirm no compilation issues before ending your turn.
- Make sure to document custom modifications in the project's walkthrough.md.
