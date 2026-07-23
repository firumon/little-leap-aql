# AQL View Content System

This document is the complete reference guide for the AQL **View** content system — the framework-level content family that renders a resource record's View page (details grid, parent cards, child grids, and audit timestamps). It covers the `View` content orchestrator, `ViewRecord`, `ViewParent`, `ViewChildren`, `ViewChildCompact`, `ViewAudit`, record/parent/child/column custom-UI overrides (Vue SFC, JS object, JS function), scope rules, and context injections. In expanded mode (> 5 columns) each child record is delegated to `ViewRecord`.

`View` is declared via `contents: ['View']` in a page contract and resolved through the [Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/Content.vue) / [useContentResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useContentResolver.js) pipeline described in [AQL_CONTENT_CUSTOMIZATION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_CONTENT_CUSTOMIZATION_SYSTEM.md).

---

## 1. System Architecture & Component Family

| Component | File | Role |
|---|---|---|
| `View` | `components/contents/View.vue` | Master orchestrator — renders ordered sections (`Details`, `Children`, `Parent`, `Audit`). |
| `ViewRecord` | `components/contents/ViewRecord.vue` | Key-value field grid for a single record. Resolves record-level overrides (`ViewRecord.(vue\|js)`) and hosts column overrides (`ViewColumn<Col>`). |
| `ViewRecordWithAudit` | `components/contents/ViewRecordWithAudit.vue` | Standalone composition of `ViewRecord` + `ViewAudit`. |
| `ViewParent` | `components/contents/ViewParent.vue` | Orchestrates parent detail cards for `record._Parents`. |
| `ViewChildren` | `components/contents/ViewChildren.vue` | Orchestrates child resource groups (`childResources`). Compact groups → one `ViewChildCompact` grid; expanded groups → one card **per record** delegated to `ViewRecord` (or a per-record `ViewChild<ChildName>` override). |
| `ViewChildCompact` | `components/contents/ViewChildCompact.vue` | Leaf child grid renderer for <= 5 columns (`q-markup-table`). |
| `ViewAudit` | `components/contents/ViewAudit.vue` | Audit timestamps card (`CreatedAt` / `UpdatedAt`). Audit is ONLY rendered here. |
| `useViewColumnResolver` | `composables/resources/useViewColumnResolver.js` | Composable resolving column custom UI overrides (`ViewColumn<Col>.(vue|js)`). |

---

## 2. Page Contract & Section Ordering

A resource page contract declares:

```javascript
export default {
  sections: ['PageHeader'],
  contents: ['View']
}
```

### Default Section Order

- **Master Scope (`scope === 'master'`)**: `['Details', 'Children', 'Parent']` (Audit section is omitted).
- **All Other Scopes**: `['Details', 'Children', 'Parent', 'Audit']`.

`View` accepts optional props: `order` (Array), `hide` (Array), `detailsConfig` (Object).

---

## 3. Custom UI Override System

> [!IMPORTANT]
> These candidate lists are **strict and exhaustive** — they are the ONLY paths each resolver checks. There is no legacy `recordview*`-prefixed fallback anywhere in the View system; only `view*`-prefixed filenames resolve.

### 3.0 Record Overrides (`ViewRecord.(vue|js)`)

Before rendering its base `q-card` key-value grid, `ViewRecord` resolves a record-level override for the target resource (`resourceSlug`, `scope`, `uiName`). Candidate paths (lowercased, first match wins — exactly these six, no others):
1. `_ui/{ui}/components/{scope}/{resourceSlug}/viewrecord.vue`
2. `_ui/{ui}/components/{scope}/{resourceSlug}/viewrecord.js`
3. `_ui/{ui}/components/{scope}/viewrecord.vue`
4. `_ui/{ui}/components/{scope}/viewrecord.js`
5. `_ui/{ui}/components/viewrecord.vue`
6. `_ui/{ui}/components/viewrecord.js`

- **Vue SFC (`.vue`)**: Replaces the base grid entirely. Receives the full record prop surface `{ record, resolvedFields, resourceName, resourceSlug, scope, uiName, detailsConfig, showCodeLink, skipEmpty, ...attrs }` (the `SectionDividerLabel` above the card still renders when `detailsConfig.title` is set).
- **JS Function (`.js`)**: `export default function(record, { pageState, resourceConfig, resourceRecord })`. The returned object is merged into the props that drive the base grid (e.g. override `detailsConfig`, `showCodeLink`, `skipEmpty`, `resolvedFields`).
- **JS Object (`.js`)**: `export default { ... }` merged into the base-grid props directly.

A record-level override applies to **every** context that renders through `ViewRecord` — the main `Details` section, parent cards (`ViewParent`), and expanded child cards (`ViewChildren`) — because they all delegate to this component.

### 3.1 Column Overrides (`ViewColumn<Col>.(vue|js)`)

Column overrides apply when rendering fields inside `ViewRecord`. The lookup uses the resource that OWNS the column. Candidate paths (lowercased, first match wins — exactly these six, no others):
1. `_ui/{ui}/components/{scope}/{resourceSlug}/viewcolumn{columnname}.vue`
2. `_ui/{ui}/components/{scope}/{resourceSlug}/viewcolumn{columnname}.js`
3. `_ui/{ui}/components/{scope}/viewcolumn{columnname}.vue`
4. `_ui/{ui}/components/{scope}/viewcolumn{columnname}.js`
5. `_ui/{ui}/components/viewcolumn{columnname}.vue`
6. `_ui/{ui}/components/viewcolumn{columnname}.js`

**Override formats:**
- **Vue SFC (`.vue`)**: Replaces cell rendering entirely. Receives props `{ value, record, field, ...attrs }`.
- **JS Function (`.js`)**: `export default function(value, record, field, { pageState, resourceConfig, resourceRecord })`. Can return string/primitive or object `{ displayValue: '...', ... }`.
- **JS Object (`.js`)**: `export default { displayValue: '...', ... }`. Properties are merged with field props.

### 3.2 Parent Overrides (`ViewParent<ParentName>.(vue|js)`)

Candidate paths (lowercased, first match wins — exactly these four, no others):
1. `_ui/{ui}/components/{currentScope}/{currentResourceSlug}/viewparent{parentName}.vue`
2. `_ui/{ui}/components/{currentScope}/{currentResourceSlug}/viewparent{parentName}.js`
3. `_ui/{ui}/components/{parentScope}/{parentResourceSlug}/viewparent.vue`
4. `_ui/{ui}/components/{parentScope}/{parentResourceSlug}/viewparent.js`

- **Vue SFC (`.vue`)**: Custom parent card layout. Receives `{ parentRecord, parentResource, record, resourceName, ...attrs }`.
- **JS Function/Object (`.js`)**: Modifies props passed to `ViewRecord` base component.

### 3.3 Child Overrides (`ViewChild<ChildName>.(vue|js)`)

Candidate paths (lowercased, first match wins — exactly these four, no others):
1. `_ui/{ui}/components/{currentScope}/{currentResourceSlug}/viewchild{childName}.vue`
2. `_ui/{ui}/components/{currentScope}/{currentResourceSlug}/viewchild{childName}.js`
3. `_ui/{ui}/components/{childScope}/{childResourceSlug}/viewchild.vue`
4. `_ui/{ui}/components/{childScope}/{childResourceSlug}/viewchild.js`

The **context the override receives depends on the group's render mode**:

**Compact mode (`fields.length <= 5`)** — group-level, one grid for all records:
- **Vue SFC (`.vue`)**: Custom child grid layout. Receives `{ childResource, childRecords, fields, additionalActions, ...attrs }`.
- **JS Function/Object (`.js`)**: `mod(childResource, childRecords, { pageState, resourceConfig, resourceRecord })` (or a plain object) whose result is merged into `ViewChildCompact` props.

**Expanded mode (`fields.length > 5`)** — per-record, one card per child record:
- **Vue SFC (`.vue`)**: Rendered once per child record. Receives **individual record context** `{ record: childRecord, childResource, childRecords, ...attrs }`.
- **JS Function/Object (`.js`)**: `mod(childRecord, childResource, { pageState, resourceConfig, resourceRecord })` (or a plain object) whose result is merged into the per-record `ViewRecord` props.

### 3.4 Expanded-Mode Delegation to `ViewRecord`

When a child group has more than 5 displayable columns (expanded mode), `ViewChildren` renders **one card per child record**, and — absent a per-record override — delegates each record to `ViewRecord`. Every expanded child card therefore inherits the full `ViewRecord` capability surface:

- Column-level custom UI overrides (`ViewColumn<Col>.(vue|js)`), resolved against the child resource that owns the column.
- Column JS modifiers, including function-valued `displayValue` / `value` evaluation (`(record) => ...`).
- Level-2 nested-object formatting (`Name (Code)` / `Code`).
- File previews (`AqlFilePreviewCard`) for `file`-typed fields.
- A Code-row navigation launch icon (`showCodeLink: true`).

The per-record `ViewRecord` receives the child resource's fields as `resolvedFields`, `resourceName` / `resourceSlug` / `scope` / `uiName` from the child resource, and `detailsConfig: { title: '' }` so the in-card section title is suppressed (the group's `SectionDividerLabel` already labels the group). A per-record `ViewChild<ChildName>` override (Vue or JS) takes precedence over this default delegation.

### `skipEmpty` — Compact Relation Cards

`ViewRecord` accepts a `skipEmpty` Boolean prop that controls whether empty field rows are rendered:

| Context | `skipEmpty` default | Behavior |
|---|---|---|
| **Main resource record** (the `Details` section) | `false` | All columns render, empty ones shown as `'-'`. |
| **Related records** (parent cards via `ViewParent`, expanded child cards via `ViewChildren`) | `true` | Empty rows are omitted so relation cards stay compact. |

A field is treated as empty when its raw value (`record[field.header]`) is `null`/`undefined`/blank string, **or** its resolved display value (after column overrides / JS modifiers) is `null`, `''`, or `'-'`. `ViewParent` and `ViewChildren` set `skipEmpty: true` in their base props ahead of the `...attrs` spread, so a caller can still force `skipEmpty: false` by forwarding it as an attribute.

### 3.5 Function-Valued Properties in Column JS Modifiers

A `ViewColumn<Col>.js` modifier's returned (or exported) object may carry **function-valued** properties. When `ViewRecord` resolves the cell props, it evaluates any function assigned to `displayValue` or `value` lazily, per row:

```javascript
// _ui/AQL/components/operation/orders/viewcolumntotal.js
export default {
  // Evaluated once per record; receives (record, value, field, context)
  displayValue: (record) => formatCurrency(record.Subtotal + record.Tax)
}
```

- The function is invoked as `propVal(record, value, field, context)`, where `context = { pageState, resourceConfig, resourceRecord }`.
- Applies to both `displayValue` and `value` keys on the modifier object.
- If the function throws, the cell falls back to `'-'` (the error is logged).
- Non-function values pass through unchanged, and if neither `displayValue` nor `value` resolves, the framework's default display value is used.

---

## 4. Scope Rules & Audits

- `ViewRecord` renders field details ONLY — never audit timestamps.
- `ViewAudit` is the ONLY component that renders Created / Updated audit timestamps.
- Parent cards and child grids never render audit timestamps regardless of scope.
- Master scope (`scope === 'master'`) filters child resources to master-scoped child resources only.
