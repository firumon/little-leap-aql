# `_fields/` Type Registry

Purpose: single source of truth for every implemented field `type` under
`src/components/_fields/`. `RESOURCE_UI_MODULE_DEVELOPER_GUIDE.md` §13.1 and every other
doc that describes schema-driven form/view rendering points here instead of restating this
table — update this file when a type is added, renamed, or its behavior changes, and every
doc referencing it stays correct.

Rule: the moment a new UI field `type` appears in `APP.Resources.UIFields` metadata, it
MUST get a matching folder here (`README.md` §5) — a type with no folder silently degrades
to `text`. Adding the folder and updating this table is one change, never two.

| Type | Aliases (`TYPE_ALIASES`) | Add/Edit behavior | View behavior |
|---|---|---|---|
| `text` | `string`, `str`, `input` — **fallback type**, every unmapped/unknown type lands here | Plain text input | Plain span |
| `textarea` | `longtext`, `multiline`, `memo`, `notes` | Multi-line text input | `white-space: pre-line`; one ellipsized line when `compact` |
| `number` | `int`, `integer`, `decimal`, `float` | Numeric input | Formatted number span |
| `currency` | `money`, `amount`, `price` | Numeric input with currency formatting/masking | Currency-formatted span |
| `date` | — (also inferred from any header ending in `Date` with no explicit type) | `QDate`-backed input | Formatted date span |
| `datetime` | `timestamp`, `date-time`, `datetimelocal` | `QInput` masked `YYYY-MM-DD HH:mm:ss` (24h) with `QDate` prepend + `QTime` (`format24h with-seconds`) append popups | Formatted datetime span; both Add and View accept legacy epoch-millisecond values and normalize them |
| `select` | `dropdown`, `enum`, `reference` | `QSelect`, options from `field.options` or a cross-reference (`APP.Resources.Relations`) | Resolved option label span |
| `multiselect` | `multi`, `multiselection`, `tags` | `QSelect multiple` — array-valued `modelValue`, a distinct type from `select` (not a flag on it) | Comma-joined label list |
| `status` | — (also inferred from a header named `status`) | Chip-styled select (`AqlStatusToggle` or `q-select` with `STATUS_OPTIONS`) | Colored status chip |
| `toggle` | `boolean`, `bool`, `checkbox` (also inferred from a 2-option Yes/No-shaped `options` array) | `q-toggle` switch | On/off chip or icon |
| `tel` | `phone`, `mobile`, `telephone` | `QInput type="tel"` | `tel:` anchor or plain span |
| `link` | `url`, `uri`, `website`, `hyperlink` | `QInput type="url"` | Anchor, opens external |
| `file` | `attachment`, `upload`, `image` | File picker / uploader | `AqlFilePreviewCard`, or a dense `attach_file` chip when `compact` |

## Cross-cutting behavior (applies to every type)

- Every `Add.vue`/`Edit.vue`/`View.vue` declares `inheritAttrs: false` and a `name` of the
  form `Field<Type><Mode>`.
- `View.vue` accepts `emptyText` (default `'-'`) and `compact` (dense single-line rendering
  for child-table rows) — see `README.md` §2 for the exact per-type `compact` behavior.
- Resolution: `resolveFieldComponent(type, mode)` — unknown type or missing mode file falls
  back to `text`. See `README.md` §3 for the full resolution/precedence chain and
  `useFieldResolver.js` for `TYPE_ALIASES`.

## Mounting a control by hand

Most controls are mounted for you by the form generator (`useFormFields` → `FormRecord`).
A **workflow form** — one whose primary input is a derived tree rather than the resource's
own columns — mounts single controls itself
([RESOURCE_UI_MODULE_DEVELOPER_GUIDE.md §13.0](file:///f:/LITTLE%20LEAP/AQL/Documents/RESOURCE_UI_MODULE_DEVELOPER_GUIDE.md)).
When it does, this is the contract.

**Resolve; never deep-import.** `resolveFieldComponent(type, mode)` and
`import FieldSelectAdd from 'components/_fields/select/Add.vue'` render the same component
today and diverge the moment the type gains an alias, a prepared-props branch or a
replacement — only the resolved path follows it. The registry is built eagerly, so the
lookup is synchronous and the control never flashes empty while a chunk loads.

```javascript
import { resolveFieldComponent } from 'components/_fields/useFieldResolver'

// Resolved once, at setup — not inside a computed or the template.
const QtyField = resolveFieldComponent('number', 'add')
```

```html
<component
  :is="QtyField"
  :model-value="quantityIn(sku, bin)"
  :record="row"
  :config="binFieldConfig(sku, bin)"
  header="Quantity"
  @update:model-value="(value) => onQuantity(sku.code, bin, value)"
/>
```

### The four props

| Prop | Purpose |
|---|---|
| `modelValue` | the value, projected from `pageState` — never a local `ref` mirroring it |
| `record` | the row the value belongs to; used by controls that derive from siblings. Pass `{}` when there is no record |
| `header` | the column name, so the control can read its own `_fields` metadata |
| `config` | **everything else** — see below |

### Everything else travels in `config`

> [!IMPORTANT]
> **Every `Add.vue`/`Edit.vue`/`View.vue` declares `inheritAttrs: false` and does not re-bind
> `$attrs`.** A plain attribute on the placeholder — a `label`, a `style`, a `data-testid` —
> is **dropped silently**. `config` is spread onto the inner Quasar control, so that is where
> those belong.

```javascript
const binFieldConfig = (sku, bin) => ({
  label: `${short(bin.warehouseName)}: ${short(bin.storageName)}`,
  min: 0,
  hideBottomSpace: true,
  inputClass: 'text-right',
  disable: bin.outside,
  suffix: `/${bin.available}`,
  'data-testid': `restock-approve-qty-${sku.code}-${bin.id}`
})
```

Anything Quasar's underlying control accepts is valid here — `label`, `hint`, `min`,
`options`, `clearable`, `disable`, `suffix`, `inputClass`, `style`, plus test hooks.

Two rules that come from the visual contract, not from this layer:

- **The flow-anchoring input is never `dense`.** The one number a screen exists to collect
  keeps its full height; a dense primary field ends up smaller than the buttons flanking it.
  Reserve `dense` for secondary and read-mostly fields.
- **Hoist or memoize the config object.** A fresh object literal per render is a new prop
  identity every time, which re-runs the control's own watchers.

### Which mode

`add` for a control collecting a value that does not exist yet, `edit` for one amending a
loaded record, `view` for read-only display. A control mounted in the wrong mode still
renders — the difference is seeding, clearability and empty-value handling.

## Adding a new type

Full procedure: `README.md` §5. Summary: create the folder, register aliases in
`useFieldResolver.js`, branch `useFormFields.mapField` if the type needs prepared props,
then add a row to this table.
