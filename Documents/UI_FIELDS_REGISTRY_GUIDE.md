# The `_fields/` Base Field Subsystem

> Part of **[﻿# AQL Create & Update Content Systems](UI_CREATE_AND_UPDATE_SYSTEM.md)**. Directory pattern, prop contract, type table, resolver API and how to add a field type.

---

## 15. Base Field Subsystem (`src/_fields/`)

The type-driven presentation layer that renders every control in `FormRecord` and every value cell in `ViewRecord`/`ViewChildCompact`. The containers hold **no** type branches — they resolve a component and mount it.

> Component-level reference (full `config` merge order, alias table, "how to add a type"): [`FRONTENT/src/_fields/README.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/README.md). The view-side integration is documented in [UI_VIEW_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_VIEW_SYSTEM.md) §4.

### 15.1 Directory Structure — the "Option A" Pattern

Each field type owns a folder holding **three explicit SFCs**:

```
src/_fields/
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

| File | Mode | Rendered by |
|---|---|---|
| `Add.vue` | `add` | `Create.vue` → `FormRecord` (default `mode`) |
| `Edit.vue` | `edit` | `Update.vue` → `FormRecord` (`mode: 'edit'`), and `FormChild` while re-opening an already-added row |
| `View.vue` | `view` | `ViewRecord`, `ViewChildCompact` |

`Edit.vue` re-exports `Add.vue` whenever edit behaviour is identical — all eleven current types do this. Diverging later means editing that one file; no container changes:

```vue
<!-- _fields/<type>/Edit.vue -->
<template>
  <Add v-model="model" v-bind="$attrs" :record="record" :config="config" :header="header" />
</template>
```

### 15.2 Component Prop Contract

Every `Add.vue` / `Edit.vue` / `View.vue` implements exactly this surface, with `defineOptions({ name: 'Field<Type><Mode>', inheritAttrs: false })`:

| Name | Kind | Description |
|---|---|---|
| `modelValue` | `defineModel()` | The field value. Bi-directional — writing `model.value` emits `update:modelValue`, which `FormRecord` re-emits as `update:field(header, value, { custom })` and the caller routes to `setRecord`/`setControls`. |
| `record` | `Object` prop | The full row record, so a field can read sibling columns (dynamic link construction, cross-column formatting). |
| `config` | `Object` prop | The fully merged control props (§6 merge order), minus resolution metadata. |
| `header` | `String` prop | The exact column header name. |

`View.vue` components additionally take `emptyText` (default `'-'`) and `compact` (default `false`, also honoured as `config.compact`).

### 15.3 Type Table

| Type | Add / Edit | View |
|---|---|---|
| `text` (**fallback**) | outlined `q-input` | plain text, null fallback |
| `link` | `q-input type="url"` + link icon/hint | `<a target="_blank" rel="noopener noreferrer">` + `open_in_new` icon |
| `tel` | `q-input type="tel"` + phone icon | `<a href="tel:…">` + phone icon |
| `file` | `AqlFileUpload` | `AqlFilePreviewCard` (dense chip when compact) |
| `textarea` | `q-input type="textarea"` autogrow | multiline text (`white-space: pre-line`) |
| `status` | `AqlStatusToggle`, or `q-select` when `config.options` exists | coloured `QChip`, map overridable via `config.statusColors` |
| `select` | `q-select` with `use-input` local filtering | resolved option label |
| `date` | `components/app/Date.vue` | `toLocaleDateString('en-GB', …)` |
| `number` | `q-input type="number"` | `toLocaleString` |
| `currency` | `q-input type="number"` prefixed with the dynamic symbol from `useCurrency` | `_C(value)` |
| `toggle` | `q-toggle` | outlined `QChip`, positive when the value matches the column's `true-value` |

`status` picks its control from `config.options`: absent ⇒ classic Active/Inactive column ⇒ `AqlStatusToggle`; present ⇒ `q-select`. This reproduces `mapField`'s two pre-existing status branches without a hardcoded header check in the component.

### 15.4 Resolver API (`useFieldResolver.js`)

The registry is built eagerly from `import.meta.glob('./*/*.vue', { eager: true })`, so resolution is synchronous and a control never flashes empty while a chunk loads.

| Function | Signature | Behaviour |
|---|---|---|
| `resolveFieldComponent` | `(type, mode) => Component` | Maps `add\|edit\|view` → `Add\|Edit\|View.vue` under `_fields/<type>/`. Unknown mode → `View`. Unknown type, or a type folder missing that mode's file → `text/<Mode>.vue`. **Never returns null.** |
| `resolveFieldType` | `(field) => string` | Takes a whole field *definition* and returns its presentation type. Explicit `field.type` wins; else header ending in `Date` → `date`, header `Status` → `status`, else `text`. For callers holding only a raw `APP.Resources.UIFields` entry (the view side). |
| `normalizeFieldType` | `(type) => string` | Collapses schema synonyms: `url\|uri\|website\|hyperlink → link`, `phone\|mobile\|telephone → tel`, `money\|price\|amount → currency`, `dropdown\|enum\|reference → select`, `boolean\|bool\|checkbox → toggle`, `longtext\|multiline\|memo\|notes → textarea`, `datetime → date`, `int\|integer\|decimal\|float → number`, `attachment\|upload\|image → file`. Unknown → `text`. |
| `fieldTypes` | `() => string[]` | Type folders that currently exist. |
| `hasFieldType` | `(type) => boolean` | True when `type` resolves to a real folder rather than the fallback. |
| `useFieldResolver` | `() => { … }` | Composable wrapper returning all of the above. |

### 15.5 `fieldType` vs `type`

`useFormFields.mapField` stamps every returned descriptor with a **`fieldType`** — the normalized presentation type. It is deliberately *not* named `type`, because `type` is already a QInput prop inside the same props bag; overloading it would put `type="date"` on `AppDate` and `type="select"` on `QSelect` in any consumer that spreads the descriptor.

`component` / `componentName` are still emitted for the legacy direct-render consumer `_common/sections/Content/Form.vue`; `FormRecord` no longer reads them.

| Container | Type source | Call |
|---|---|---|
| `FormRecord.vue` | `mapField` output | `resolveFieldComponent(field.fieldType, mode)` |
| `ViewRecord.vue` | raw `UIFields` entries | `resolveFieldComponent(resolveFieldType(field), 'view')` |
| `ViewChildCompact.vue` | raw `UIFields` entries | as above, with `config.compact = true` |

### 15.6 Three-Tier Precedence Chain

| Tier | Source | Notes |
|---|---|---|
| **1** | Per-resource custom `_ui` Vue override — `formfield<header>.vue` (form) / `viewcolumn<header>.vue` (view) | Highest priority; replaces the control/cell outright. Paths in §9.3. |
| **2** | Base type component `_fields/<type>/<Add\|Edit\|View>.vue` | Resolved via `resolveFieldComponent`. |
| **3** | Fallback `_fields/text/<Mode>.vue` | Unknown types and custom (non-schema) headers. |

JS modifiers (`FormField<Header>.js`, `ViewColumn<Header>.js`) sit **outside** this chain — they merge into `config` (§6), so they apply to whichever tier-2/3 component renders.

### 15.7 Adding a New Field Type

1. Create `_fields/<type>/` with `Add.vue`, `Edit.vue`, `View.vue` per §15.2.
2. If the schema spells the type differently, add the alias to `TYPE_ALIASES` in `useFieldResolver.js`.
3. If `mapField` must prepare props for it (options, `accept`, `resourceName`, …), add a branch there setting `fieldType: '<type>'`.

No container edits. No registry edits. `_fields` components carry **no `<style>` block** (ARCHITECTURE RULES §7) — shared classes belong in `src/css/custom.scss`.

---


---

⬑ Back to **[﻿# AQL Create & Update Content Systems](UI_CREATE_AND_UPDATE_SYSTEM.md)**.

---

⬑ Back to **[﻿# AQL Create & Update Content Systems](UI_CREATE_AND_UPDATE_SYSTEM.md)**.
