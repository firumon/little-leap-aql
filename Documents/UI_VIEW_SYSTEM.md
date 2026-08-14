# AQL View Content System

This document is the complete reference guide for the AQL **View** content system — the framework-level content family that renders a resource record's View page (details grid, parent cards, child grids, and audit timestamps). It covers the `View` content orchestrator, `ViewRecord`, `ViewParent`, `ViewChildren`, `ViewChildCompact`, `ViewAudit`, record/parent/child/column custom-UI overrides (Vue SFC, JS object, JS function), scope rules, and context injections. In expanded mode (> 5 columns) each child record is delegated to `ViewRecord`.

`View` is declared via `contents: ['View']` in a page contract and resolved through the [Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/Content.vue) / [useContentResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useContentResolver.js) pipeline described in [UI_CONTENT_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CONTENT_SYSTEM.md).

---

## 1. System Architecture & Component Family

| Component | File | Role |
|---|---|---|
| `View` | `components/contents/View.vue` | Master orchestrator — renders ordered sections (`Details`, `Children`, `Parent`, `Audit`). |
| `ViewRecord` | `components/contents/ViewRecord.vue` | Key-value field grid for a single record. Resolves record-level overrides (`ViewRecord.(vue\|js)`) and hosts column overrides (`ViewColumn<Col>`). |
| `ViewRecordWithAudit` | `components/contents/ViewRecordWithAudit.vue` | Standalone composition of `ViewRecord` + `ViewAudit`. |
| `ViewParent` | `components/contents/ViewParent.vue` | Orchestrates parent detail cards for `record._Parents`. |
| `ViewChildren` | `components/contents/ViewChildren.vue` | Orchestrates child resource groups (`childResources`). Compact groups → one `ViewChildCompact` grid; expanded groups → one card **per record** delegated to `ViewRecord` (or a per-record `ViewChild<ChildName>` override). |
| `ViewChildCompact` | `components/contents/ViewChildCompact.vue` | Leaf child grid renderer for <= 5 columns (`q-markup-table`). Each cell renders through `_fields/<type>/View.vue` in **compact mode**; resolves no per-column `_ui` overrides. |
| `ViewAudit` | `components/contents/ViewAudit.vue` | Audit timestamps card (`CreatedAt` / `UpdatedAt`). Audit is ONLY rendered here. |
| `useViewColumnResolver` | `composables/resources/useViewColumnResolver.js` | Composable resolving column custom UI overrides (`ViewColumn<Col>.(vue\|js)`). |
| `useFieldResolver` | `components/_fields/useFieldResolver.js` | Resolves the base field component for a `(type, mode)` pair. See §4. |

> **Cell rendering is not hardcoded.** Neither `ViewRecord` nor `ViewChildCompact` contains a `field.type === '...'` branch. Every value cell is delegated to a base type component under `src/components/_fields/` — see [§4 Base Field Subsystem](#4-base-field-subsystem-srccomponents_fields).

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
- **Vue SFC (`.vue`)**: Replaces cell rendering entirely — this is **tier 1**, it wins over the base type component. Receives props `{ value, record, field, resourceName, columnName, options, displayValue, ...attrs }`.
- **JS Function (`.js`)**: `export default function(value, record, field, { pageState, resourceConfig, resourceRecord })`. Can return string/primitive or object `{ displayValue: '...', ... }`.
- **JS Object (`.js`)**: `export default { displayValue: '...', ... }`. Properties are merged with field props.

> A JS modifier is **not** a separate tier. Its output merges into the `config` object handed to whichever `_fields/<type>/View.vue` component renders the cell, so `displayValue` keeps working unchanged against every field type.

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

Both the fields **rendered** and the column count that **routes** the group come
from `filterDisplayableFields` (in `appHelpers`), which drops columns that
identify or stamp a row rather than describe it: the primary key `Code`, the
parent reference (`ParentCode` / `<ParentResource>Code`), any `*Code` relation
reference, `AUDIT_HEADERS`, and action stamps suffixed `By` / `At`. The filter
applies to an explicit `ui.fields` list too — `ui.fields` remains the source of
column order, labels, types, and options, but it cannot reintroduce a code or
stamp column into a child view. `resolveChildFields` already returns filtered
fields; `ViewChildren` re-applies the filter so a JS override that injects its
own `fields` is held to the same contract.

Neither mode renders a `Code` column: `ViewChildCompact` has no Code cell (the
whole row is clickable and navigates by `record.Code`), and in expanded mode
`ViewRecord` emits its own Code row from `showCodeLink` + `record.Code`,
independent of `resolvedFields`. `FormChild` is deliberately exempt — it uses
`resolveChildEntryFields`, which keeps relation code columns so an added row can
still label itself.

**Compact mode (<= 5 displayable columns)** — group-level, one grid for all records:
- **Vue SFC (`.vue`)**: Custom child grid layout. Receives `{ childResource, childRecords, fields, additionalActions, ...attrs }`.
- **JS Function/Object (`.js`)**: `mod(childResource, childRecords, { pageState, resourceConfig, resourceRecord })` (or a plain object) whose result is merged into `ViewChildCompact` props.

Inside the compact grid, each cell is rendered by the same `_fields/<type>/View.vue`
base component as the detail grid (§4), with `config.compact = true` so chips shrink,
file cells collapse to a chip, and multiline text stays on one ellipsized line. The
grid resolves **no** per-column `ViewColumn<Col>` overrides — customize a compact
group through its `ViewChild<ChildName>` override, or switch the group to expanded
mode (> 5 columns), where per-record `ViewRecord` delegation restores the full column
override surface. Cells with a `link`/`tel` anchor swallow the row-navigation click so
opening the link does not also navigate away.

**Expanded mode (> 5 displayable columns)** — per-record, one card per child record:
- **Vue SFC (`.vue`)**: Rendered once per child record. Receives **individual record context** `{ record: childRecord, childResource, childRecords, ...attrs }`.
- **JS Function/Object (`.js`)**: `mod(childRecord, childResource, { pageState, resourceConfig, resourceRecord })` (or a plain object) whose result is merged into the per-record `ViewRecord` props.

### 3.4 Expanded-Mode Delegation to `ViewRecord`

When a child group has more than 5 displayable columns (expanded mode), `ViewChildren` renders **one card per child record**, and — absent a per-record override — delegates each record to `ViewRecord`. Every expanded child card therefore inherits the full `ViewRecord` capability surface:

- Column-level custom UI overrides (`ViewColumn<Col>.(vue|js)`), resolved against the child resource that owns the column.
- Column JS modifiers, including function-valued `displayValue` / `value` evaluation (`(record) => ...`).
- Level-2 nested-object formatting (`Name (Code)` / `Code`, via `resolveDisplayValue` in `appHelpers`).
- Type-driven cell rendering through `_fields/<type>/View.vue` — file previews (`AqlFilePreviewCard`), status chips, formatted dates/numbers/currency, clickable links and phone numbers.
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

## 4. Base Field Subsystem (`src/components/_fields/`)

The type-driven presentation layer shared by the View system and the Create/Update
form system. `ViewRecord` and `ViewChildCompact` resolve a component and mount it;
all per-type presentation lives in `_fields/`.

> Component-level reference (interface contract, `config` merge order, full alias
> table, "how to add a type"): [`FRONTENT/src/components/_fields/README.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/_fields/README.md).
> The form-side integration is documented in [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md) §Base Field Subsystem.

### 4.1 Directory Structure — the "Option A" Pattern

Each field type owns a folder holding **three explicit SFCs**:

```
src/components/_fields/
├── README.md
├── index.js                  # re-exports the resolver API
├── useFieldResolver.js       # central dynamic resolver
├── currency/{Add,Edit,View}.vue
├── date/{Add,Edit,View}.vue
├── file/{Add,Edit,View}.vue
├── link/{Add,Edit,View}.vue
├── number/{Add,Edit,View}.vue
├── select/{Add,Edit,View}.vue
├── status/{Add,Edit,View}.vue
├── tel/{Add,Edit,View}.vue
├── text/{Add,Edit,View}.vue    ← FALLBACK TYPE, must always exist
├── textarea/{Add,Edit,View}.vue
└── toggle/{Add,Edit,View}.vue
```

| File | Mode | Purpose |
|---|---|---|
| `Add.vue` | `add` | Record-creation control |
| `Edit.vue` | `edit` | Record-editing control |
| `View.vue` | `view` | Read-only display |

`Edit.vue` is a thin re-export of `Add.vue` whenever edit behaviour is identical —
all eleven current types do this. Diverging later means editing that one file; no
container changes.

```vue
<!-- _fields/<type>/Edit.vue -->
<template>
  <Add v-model="model" v-bind="$attrs" :record="record" :config="config" :header="header" />
</template>
```

### 4.2 Component Prop Contract

Every `Add.vue` / `Edit.vue` / `View.vue` implements exactly this surface, with
`defineOptions({ name: 'Field<Type><Mode>', inheritAttrs: false })`:

| Name | Kind | Description |
|---|---|---|
| `modelValue` | `defineModel()` | The field value. Bi-directional; writing `model.value` emits `update:modelValue`. |
| `record` | `Object` prop | The full row record, so a field can read sibling columns (dynamic link construction, conditional formatting). |
| `config` | `Object` prop | Fully resolved column metadata + control props. |
| `header` | `String` prop | The exact column header name. |

**`config` in view mode** is the container's resolved cell props:

| Source | Keys |
|---|---|
| `ViewRecord.getColProps(field)` | `$attrs`, `value`, `record`, `field`, `resourceName`, `columnName`, `options`, `displayValue` (default display, or a `ViewColumn<Col>.js` modifier's output) |
| `ViewChildCompact.cellConfig(record, field)` | the same keys, plus `compact: true`; resolves no per-column `_ui` overrides |

`View.vue` components prefer `config.displayValue` for the **label** and the raw
`modelValue` for anything machine-facing (an `href`, a file uuid).

**Extra `View.vue` props**

| Prop | Default | Meaning |
|---|---|---|
| `emptyText` | `'-'` | Null/blank fallback. |
| `compact` | `false` | Host is a dense single-line container. Also honoured as `config.compact`. |

`compact` changes only what would otherwise break a table row's line height:
`file` → dense `attach_file` chip instead of `AqlFilePreviewCard`; `status`/`toggle`
→ `size="sm"` with the outer chip margin dropped; `textarea` → one ellipsized line
instead of `white-space: pre-line`. Types rendering a plain span or inline anchor
ignore it.

### 4.3 Type Table

| Type | Add / Edit | View |
|---|---|---|
| `text` (**fallback**) | outlined `q-input` | plain text, null fallback |
| `link` | `q-input type="url"` + link icon/hint | `<a target="_blank" rel="noopener noreferrer">` + `open_in_new` icon; bare hosts get an `https://` prefix |
| `tel` | `q-input type="tel"` + phone icon | `<a href="tel:…">` + phone icon (non-dialable characters stripped) |
| `file` | `AqlFileUpload` | `AqlFilePreviewCard` (or a dense chip when compact) |
| `textarea` | `q-input type="textarea"` autogrow | multiline text (`white-space: pre-line`) |
| `status` | `AqlStatusToggle`, or `q-select` when `config.options` exists | coloured `QChip`; map overridable via `config.statusColors` |
| `select` | `q-select` with `use-input` local filtering | resolved option label |
| `date` | `components/app/Date.vue` | `toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })` |
| `number` | `q-input type="number"` | `toLocaleString` |
| `currency` | `q-input type="number"` prefixed with the dynamic symbol from `useCurrency` | `_C(value)` |
| `toggle` | `q-toggle` | outlined `QChip`, positive when the value matches the column's `true-value` |

### 4.4 Resolver API (`useFieldResolver.js`)

The registry is built eagerly from `import.meta.glob('./*/*.vue', { eager: true })`,
so resolution is synchronous and cells never flash empty.

| Function | Signature | Behaviour |
|---|---|---|
| `resolveFieldComponent` | `(type, mode) => Component` | Maps `add\|edit\|view` → `Add\|Edit\|View.vue` under `_fields/<type>/`. Unknown mode → `View`. Unknown type, or a type folder missing that mode's file → `text/<Mode>.vue`. **Never returns null.** |
| `resolveFieldType` | `(field) => string` | Takes a whole field *definition* and returns its presentation type. Explicit `field.type` wins; otherwise a header ending in `Date` → `date`, a header of `Status` → `status`, else `text`. Use this wherever only a raw `APP.Resources.UIFields` entry is available. |
| `normalizeFieldType` | `(type) => string` | Collapses schema synonyms onto a folder name: `url\|uri\|website\|hyperlink → link`, `phone\|mobile\|telephone → tel`, `money\|price\|amount → currency`, `dropdown\|enum\|reference → select`, `boolean\|bool\|checkbox → toggle`, `longtext\|multiline\|memo\|notes → textarea`, `datetime → date`, `int\|integer\|decimal\|float → number`, `attachment\|upload\|image → file`. Unknown → `text`. |
| `fieldTypes` | `() => string[]` | Type folders that currently exist. |
| `hasFieldType` | `(type) => boolean` | True when `type` resolves to a real folder rather than the fallback. |
| `useFieldResolver` | `() => { … }` | Composable wrapper returning all of the above. |

Where each container gets its type from:

| Container | Type source | Call |
|---|---|---|
| `ViewRecord.vue` | raw `UIFields` entries (`resolvedFields`) | `resolveFieldComponent(resolveFieldType(field), 'view')` |
| `ViewChildCompact.vue` | raw `UIFields` entries (`fields` prop) | `resolveFieldComponent(resolveFieldType(field), 'view')`, `config.compact = true` |
| `FormRecord.vue` | `useFormFields.mapField` output | `resolveFieldComponent(field.fieldType, mode)` |

`mapField` emits `fieldType` rather than `type` because `type` is already a QInput
prop inside the same props bag; containers strip it before binding the rest onto a
control.

### 4.5 Three-Tier Precedence Chain

| Tier | Source | Notes |
|---|---|---|
| **1** | Per-resource custom `_ui` Vue override — `viewcolumn<header>.vue` (view) / `formfield<header>.vue` (form) | Highest priority; replaces cell/control rendering outright. Resolution paths in §3.1. |
| **2** | Base type component `_fields/<type>/<Mode>.vue` | Resolved via `resolveFieldComponent`. |
| **3** | Fallback `_fields/text/<Mode>.vue` | Used for unknown types and non-schema custom headers. |

JS modifiers (`ViewColumn<Header>.js`, `FormField<Header>.js`) sit **outside** this
chain — they merge into `config`, so they apply to whichever tier-2/3 component
renders.

### 4.6 Adding a New Field Type

1. Create `_fields/<type>/` with `Add.vue`, `Edit.vue`, `View.vue` per §4.2.
2. If the schema spells the type differently, add the alias to `TYPE_ALIASES` in `useFieldResolver.js`.
3. If `useFormFields.mapField` must prepare props for it (options, `accept`, `resourceName`, …), add a branch there setting `fieldType: '<type>'`.

No container edits. No registry edits. `_fields` components carry **no `<style>` block** (ARCHITECTURE RULES §7) — shared classes belong in `src/css/custom.scss`.

---

## 5. Scope Rules & Audits

- `ViewRecord` renders field details ONLY — never audit timestamps.
- `ViewAudit` is the ONLY component that renders Created / Updated audit timestamps.
- Parent cards and child grids never render audit timestamps regardless of scope.
- Master scope (`scope === 'master'`) filters child resources to master-scoped child resources only.
