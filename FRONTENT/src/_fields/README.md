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
├── openselect/{Add,Edit,View}.vue
├── select/{Add,Edit,View}.vue
├── status/{Add,Edit,View}.vue
├── tel/{Add,Edit,View}.vue
├── text/{Add,Edit,View}.vue   ← FALLBACK TYPE, must always exist
├── textarea/{Add,Edit,View}.vue
├── toggle/{Add,Edit,View}.vue
└── toggleitem/{Add,Edit,View}.vue
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

### `openselect`

A `select` whose option list is OPEN. The list is the suggestion, not the rule: under the
options sits an **Enter a new value** row that prompts for free text, adds it to the list and
selects it. Its own type rather than a flag on `select`, because `select` guarantees the
stored value is one of the listed options and callers rely on that.

Use it where a column has a known vocabulary that users must still be able to extend without
a schema change — `Leads.Type`, seeded from the `LeadType` AppOptions group. `config.options`
seeds the list from either source (`field.options` or the AppOptions group `mapField` resolves).
`config.freeTextLabel` renames the prompt row.

A value already stored outside the list is appended to the options so it renders as selected
rather than blank — the same reason `View.vue` falls back to the raw value when nothing matches.

### `toggleitem`

A titled toggle **row**: title and description on the left, a `q-toggle` on the right. Its
own type rather than a flag on `toggle`, because it renders a label of its own — mounting it
where a bare `toggle` belongs prints the label twice, once in the row and once beside the
switch.

**Card-agnostic.** It renders the row and nothing else — no card, no border, no outer
padding — so it drops into whatever card, dialog or section the caller already has. The
caller owns the surface; this owns the row.

| `config` key | Alias | Meaning |
|---|---|---|
| `label` | `title` | The row's title. Falls back to `header`. |
| `caption` | `description` | Secondary line under the title. Omitted when blank. |
| `color` | — | Toggle colour (default `primary`). |
| `disable` | — | Renders the switch non-interactive. |

Any other `config` key passes through to the `q-toggle` (`true-value`, `false-value`,
`keep-color`, …). The four above are consumed by the row and deliberately not forwarded.

`View.vue` mirrors the same two-column shape with a square chip in place of the switch, so a
view page and its form read alike; `compact` drops the description and shrinks the chip for
child-table rows.

**Where it earns its place**: a settings-style choice that needs a sentence of explanation —
`OutletRestocks` Add's draft-vs-direct switch, `OutletConsumptions` Add's restock toggle.
For a bare boolean cell in a generated form, `toggle` is still the right type.

### Textarea Field Invariant (STRICT)

**A `textarea` control must look like a multiline box on arrival, before anyone types.**

Do **not** pass `dense`, `autogrow`, or a small `rows` to a `textarea` field's `config`:

* `dense` strips the vertical padding that distinguishes a textarea from a text input.
* `autogrow` starts the control at a single row and grows only as the user types — so at the
  moment the user is deciding whether to write a paragraph, the control is telling them it
  wants a few words. It also makes the form reflow under the cursor.
* A cramped `rows` (1–2) reads as a text input with a drag handle.

```javascript
// WRONG — arrives as a one-line box
:config="{ label: 'Comment', autogrow: true, dense: true }"

// RIGHT — a real multiline box from the start
:config="{ label: 'Comment', rows: 4 }"
```

The base `textarea/Add.vue` already renders `outlined` with Quasar's default height; the
invariant is about what CALLERS pass down. Where a note is genuinely a single line, use
`text`, not a shrunken `textarea`.
