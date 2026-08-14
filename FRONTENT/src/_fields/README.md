# `_fields/` — Modular Base Field System

Type-driven presentation layer for every field rendered by the content containers
(`components/contents/FormRecord.vue`, `components/contents/ViewRecord.vue`, and
therefore `Create.vue` / `Update.vue` / `FormChild.vue` / `View.vue`).

The containers contain **zero** type-based branching. They resolve a component
and mount it. All per-type presentation lives here.

---

## 1. Directory layout

```
src/_fields/
├── README.md
├── index.js                 # re-exports the resolver API
├── useFieldResolver.js      # central dynamic resolver + type normalization
├── currency/{Add,Edit,View}.vue
├── date/{Add,Edit,View}.vue
├── datetime/{Add,Edit,View}.vue
├── file/{Add,Edit,View}.vue
├── link/{Add,Edit,View}.vue
├── number/{Add,Edit,View}.vue
├── select/{Add,Edit,View}.vue
├── status/{Add,Edit,View}.vue
├── tel/{Add,Edit,View}.vue
├── text/{Add,Edit,View}.vue   ← FALLBACK TYPE, must always exist
├── textarea/{Add,Edit,View}.vue
└── toggle/{Add,Edit,View}.vue
```

Every type folder holds **three explicit SFCs** (Option A):

| File | Mode | Purpose |
|---|---|---|
| `Add.vue` | `add` | Record creation control |
| `Edit.vue` | `edit` | Record editing control |
| `View.vue` | `view` | Read-only display |

When edit behaviour is identical to add, `Edit.vue` is a thin re-export wrapper:

```vue
<template>
  <Add v-model="model" v-bind="$attrs" :record="record" :config="config" :header="header" />
</template>
```

Diverging later means editing that one file — no container change.

---

## 2. Component interface contract

Every `Add.vue` / `Edit.vue` / `View.vue` implements exactly this surface:

| Name | Kind | Description |
|---|---|---|
| `modelValue` | `defineModel()` | The field's value. Bi-directional; writing `model.value` emits `update:modelValue`, which the container routes into `pageState`. |
| `record` | `Object` prop | The full row record, so a field can read sibling columns (dynamic link construction, conditional formatting, …). |
| `config` | `Object` prop | Fully resolved column metadata + control props (see §3). |
| `header` | `String` prop | The exact column header name. |

All components declare `inheritAttrs: false` and a `name` of the form
`Field<Type><Mode>`.

### Extra `View.vue` props

| Prop | Default | Meaning |
|---|---|---|
| `emptyText` | `'-'` | Null/blank fallback. |
| `compact` | `false` | The host is a dense, single-line container (a child table row, a line item). Also honoured as `config.compact`, which is how containers normally pass it. |

`compact` changes only what would otherwise break a table row's line height:

- `file` → a dense `attach_file` chip instead of `AqlFilePreviewCard`
- `status` / `toggle` → `size="sm"`, outer chip margin dropped
- `textarea` → one ellipsized line instead of `white-space: pre-line`

Types whose View is already a plain span or inline anchor ignore it.

### `config` contents

**Add / Edit** — `config` is `FormRecord.fieldRenderProps(field)`, merged
lowest → highest:

1. `$attrs` on `FormRecord`
2. base props from `useFormFields.mapField` (`label`, `hint`, `outlined`,
   `options`, `accept`, `resourceName`, `columnName`, …)
3. the `fieldProps` prop, keyed by header
4. a resolved `FormField<Header>.js` custom-UI modifier

`fieldType` / `component` / `componentName` are stripped before this reaches a
field component — they are resolution metadata, not control props.

**View** — `config` is `ViewRecord.getColProps(field)`: `$attrs`, `value`,
`record`, `field`, `resourceName`, `columnName`, `options`, and `displayValue`
(the default schema display, or whatever a `ViewColumn<Header>.js` modifier
produced). `View.vue` components prefer `config.displayValue` for the *label*
and the raw `modelValue` for anything machine-facing (an `href`, a file uuid).

> **Control-type attributes are owned by the field component.** Each `Add.vue`
> binds `v-bind="config"` first and then sets its own `type` (`url`, `tel`,
> `textarea`, `number`, …) afterwards, so `config` cannot silently turn a
> textarea into a text box.

---

## 3. Resolution

```js
import { resolveFieldComponent, resolveFieldType } from 'src/_fields/useFieldResolver'

resolveFieldComponent('link', 'view')   // → _fields/link/View.vue
resolveFieldComponent('unknown', 'add') // → _fields/text/Add.vue
```

- Registry is built eagerly from `import.meta.glob('./*/*.vue', { eager: true })`,
  so resolution is synchronous and cells never flash empty.
- Modes map `add|edit|view` → `Add|Edit|View`. An unknown mode falls back to
  `View`.
- An unknown type — or a type folder missing that mode's file — falls back to
  `text/<Mode>.vue`.

### Type normalization

`normalizeFieldType(type)` collapses the schema's spellings onto a folder name
(`url|website|hyperlink → link`, `money|price|amount → currency`,
`dropdown|enum|reference → select`, `boolean|checkbox → toggle`, …).

`resolveFieldType(field)` takes a whole field *definition* and adds the header
heuristics that `useFormFields.mapField` already applied, so add/edit and view
agree on the same type:

- explicit `field.type` always wins;
- otherwise a header ending in `Date` → `date`;
- otherwise a header of `Status` → `status`;
- otherwise `text`.

Where the two call sites get their type from:

| Container | Source | Call |
|---|---|---|
| `FormRecord.vue` | `useFormFields.mapField` output | `resolveFieldComponent(field.fieldType, mode)` |
| `ViewRecord.vue` | raw `APP.Resources.UIFields` entries | `resolveFieldComponent(resolveFieldType(field), 'view')` |
| `ViewChildCompact.vue` | raw `APP.Resources.UIFields` entries | `resolveFieldComponent(resolveFieldType(field), 'view')` with `config.compact = true` |

`mapField` emits `fieldType` rather than `type` because `type` is already a
QInput prop inside the same props bag.

---

## 4. Precedence in the containers

Unchanged by this system — `_fields` only occupies tier 2:

1. **High-priority per-resource custom `_ui` Vue override**
   `_ui/{ui}/components/{scope}/{slug}/formfield<header>.vue` (form) or
   `viewcolumn<header>.vue` (view). Wins outright.
2. **Base type component** `_fields/<type>/<Mode>.vue`.
3. **Fallback** `_fields/text/<Mode>.vue`.

JS modifiers (`FormField<Header>.js`, `ViewColumn<Header>.js`) are *not* a
separate tier — they merge into `config`, so they keep working against whichever
base type component renders.

---

## 5. Adding a new field type

> **Maintainer rule (mandatory).** The moment a new UI field `type` appears in
> `APP.Resources.UIFields` metadata (`GAS/syncAppResources.gs`), it MUST get a
> matching component directory here. A type with no folder silently degrades to
> `text/` — the schema says `datetime`, the user gets a plain text box, and
> nothing warns anyone. Schema and `_fields/` are a single change, never two.

1. Create `_fields/<type>/` with `Add.vue`, `Edit.vue`, `View.vue` following §2.
2. Register the type in `useFieldResolver.js`: the folder name resolves on its
   own, so add entries to `TYPE_ALIASES` only for the schema's *other* spellings
   of the same intent (`timestamp` → `datetime`, `money` → `currency`, …).
3. If `useFormFields.mapField` needs to prepare props for it (options, accept,
   resourceName, …), add a branch there that sets `fieldType: '<type>'`.
   Watch the branch ORDER — `mapField` falls through to `date` for any header
   ending in `Date`, which is why the `datetime` branch sits above it (a
   `RespondDate` column typed `datetime` must not be captured by that heuristic).
4. Add the folder to the §1 directory listing above.

No container edits. No registry edits.

### `datetime`

Stores and emits `YYYY-MM-DD HH:mm:ss`, 24-hour — the same shape
`GAS/sheetHelpers.gs → formatDateTime24()` writes into every `...At` workflow
stamp column. `Add.vue` is a `QInput` under that mask with a `QDate` popup on
`prepend` and a `format24h with-seconds` `QTime` popup on `append`; both pickers
carry the full mask so choosing a date preserves the time and vice versa.
`Add.vue` and `View.vue` both accept legacy epoch-millisecond values (rows
stamped before the backend switched formats) and normalize them for display.
