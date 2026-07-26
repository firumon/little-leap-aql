---
name: AQL View Content Customization
description: Initialization prompt for creating custom UI overrides (Vue SFC, JS object, JS function) for View content system (ViewRecord, ViewColumn, ViewParent, ViewChild).
---

# Scope Boundary

This document defines initialization parameters for agents creating custom UI overrides for the `View` content system under `src/_ui/[UiName]/components/`.

## Required Pre-Reads
1. **System Specifications**: Read [AQL_VIEW_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_VIEW_SYSTEM.md) for full override path lookups, component contracts, and JS modifier APIs.
2. **Architecture Constraints**: Read [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md).

---

## 1. Candidate Path Conventions

All override filenames use PascalCase in source, matched case-insensitively. These are the **only** paths each resolver checks — there is NO legacy `recordview*`-prefixed fallback; only `view*`-prefixed filenames resolve.

> **Slug normalization**: every `{resourceSlug}` segment below is `toPascalCase(slug).toLowerCase()`, not the raw kebab-case slug — `outlet-visits` → `outletvisits` (matches `useContentResolver.js`'s own normalization). Write override folders using the PascalCase-derived form on disk (resolved case-insensitively), never with hyphens.

- **Record Override**: `ViewRecord.(vue|js)` — exactly these three bases (`.vue` before `.js` at each), resolved for the target resource (`scope`, `resourceSlug`) before the base grid renders:
  - `_ui/{ui}/components/{scope}/{resourceSlug}/viewrecord.(vue|js)`
  - `_ui/{ui}/components/{scope}/viewrecord.(vue|js)`
  - `_ui/{ui}/components/viewrecord.(vue|js)`
  - A **Vue SFC** replaces the whole card and receives `{ record, resolvedFields, resourceName, resourceSlug, scope, uiName, detailsConfig, showCodeLink, skipEmpty, ...attrs }`. A **JS** file is `mod(record, { pageState, resourceConfig, resourceRecord })` (or a plain object) merged into the base-grid props. Applies to the main record, parent cards, and expanded child cards alike (all render through `ViewRecord`).
- **Column Override**: `ViewColumn<Col>.(vue|js)` — exactly these three bases (`.vue` before `.js` at each):
  - `_ui/{ui}/components/{scope}/{resourceSlug}/viewcolumn{col}.(vue|js)`
  - `_ui/{ui}/components/{scope}/viewcolumn{col}.(vue|js)`
  - `_ui/{ui}/components/viewcolumn{col}.(vue|js)`
- **Parent Override**: `ViewParent<ParentName>.(vue|js)` — exactly these two:
  - `_ui/{ui}/components/{currentScope}/{currentResourceSlug}/viewparent{parentName}.(vue|js)`
  - `_ui/{ui}/components/{parentScope}/{parentResourceSlug}/viewparent.(vue|js)`
- **Child Override**: `ViewChild<ChildName>.(vue|js)` — exactly these two:
  - `_ui/{ui}/components/{currentScope}/{currentResourceSlug}/viewchild{childName}.(vue|js)`
  - `_ui/{ui}/components/{childScope}/{childResourceSlug}/viewchild.(vue|js)`

### Child Render Modes (context differs)

`ViewChildren` picks a render mode per child group by displayable column count:

- **Compact (`fields.length <= 5`)** — one grid for the whole group. A `ViewChild<ChildName>` override is **group-level**: Vue SFC receives `{ childResource, childRecords, fields, additionalActions }`; JS is `mod(childResource, childRecords, context)` merged into `ViewChildCompact` props.
- **Expanded (`fields.length > 5`)** — one card **per record**, each delegated to `ViewRecord`. A `ViewChild<ChildName>` override is applied **per record**: Vue SFC receives **individual record context** `{ record: childRecord, childResource, childRecords }`; JS is `mod(childRecord, childResource, context)` merged into that record's `ViewRecord` props.

Because expanded child records render through `ViewRecord`, they automatically inherit column-level `ViewColumn` overrides, column JS modifiers (incl. function-valued `displayValue`/`value`), level-2 object formatting, file previews, and the Code navigation launch icon — no extra wiring needed. Reach for a `ViewChild<ChildName>` override only when you need to replace or augment the whole per-record card.

### `skipEmpty` (empty-row suppression)

`ViewRecord` takes a `skipEmpty` Boolean prop:
- **Main resource record** (the `Details` section): defaults to `false` — every column renders, empty ones as `'-'`.
- **Related records** (parent cards and expanded child cards): `ViewParent` / `ViewChildren` default it to `true`, dropping empty rows so relation cards stay compact.

A field counts as empty when its raw value is `null`/blank, or its resolved display (post override/modifier) is `null`, `''`, or `'-'`. Because the default is set before the `...attrs` spread, a caller/override can force it back on/off by forwarding `skipEmpty` as an attribute.

---

## 2. JS Modifier Function API

JS modifiers (`.js` files) export a default function or object:

```javascript
export default function (value, record, field, { pageState, resourceConfig, resourceRecord }) {
  return {
    displayValue: 'Formatted Text'
  }
}
```

### Function-Valued Properties

A column modifier's returned/exported object may set `displayValue` (or `value`) to a **function**, which `ViewRecord` evaluates lazily per row:

```javascript
export default {
  displayValue: (record, value, field, context) => formatCurrency(record.Subtotal + record.Tax)
}
```

- Invoked as `propVal(record, value, field, context)` with `context = { pageState, resourceConfig, resourceRecord }`.
- Applies to both `displayValue` and `value` keys; a throw falls back to `'-'`.
