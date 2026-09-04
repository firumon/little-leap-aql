# Create & Update — Visibility, Defaults & Field Props

> Part of **[﻿# AQL Create & Update Content Systems](UI_CREATE_AND_UPDATE_SYSTEM.md)**. The `showFields` > `hideFields` > `workflowFields` chain, dynamic `defaultValues`, `fieldProps`, and the custom-field storage rule.

---

## 4. Field Visibility Precedence — `showFields` > `hideFields` > `workflowFields`

`FormRecord` computes a hidden-set in exactly this order; each later step overrides the earlier ones. `Create` and `FormChild` forward all five props unchanged, so the chain behaves identically on primary and child forms.

**Truth table for `workflowFields`:**

| `workflowFields` value | Effect |
|---|---|
| `'hide'` (default string) | HIDE all workflow action-stamp fields |
| `false` | HIDE all workflow action-stamp fields |
| `'show'` | SHOW all workflow action-stamp fields |
| `true` | SHOW all workflow action-stamp fields |

| Step | Input | Effect |
|---|---|---|
| 1 | `workflowFields` (`'hide'`/`false`, default) | Every header matching `/(.+?)(By\|At\|Comment)$/` (e.g. `ProgressApprovedBy`, `StatusRejectedComment`) is **added** to the hidden set. `'show'`/`true` skips this step entirely. |
| 2 | `showStatus` (`false`, default) | `Status` is **added** to the hidden set unless `showStatus` is `true`/`'show'`. |
| 3 | `showCode` (`false`, default) | `Code` is **added** to the hidden set unless `showCode` is `true`. |
| 4 | `hideFields` (`[]`) | Each listed header is **added** to the hidden set — this applies even when `workflowFields` is `'show'`/`true`. |
| 5 | `showFields` (`[]`) — **highest precedence** | Each listed header is **removed** from the hidden set. A header here renders even if steps 1–4 all hid it (including `Status`, `Code`, and workflow stamps). |

```javascript
// Hide everything workflow-ish, but bring back one approval comment field,
// and additionally suppress a column that would otherwise show.
{
  workflowFields: 'hide',
  hideFields: ['InternalNotes'],
  showFields: ['ProgressApprovedComment']   // wins over step 1
}
```

Listing `'Status'` in `showFields` renders it exactly like `showStatus: true` — and, as with `showStatus`, it is then **not** auto-seeded with `statusDefault`. Listing `'Code'` in `showFields` renders it exactly like `showCode: true`. Whenever rendered, `Code` is a normal, fully editable control — `useFormFields`'s `Code` mapping carries no `disable: true` (unlike the read-only rendering in `ViewRecord`).

---

## 5. Dynamic `defaultValues` (functions at both levels)

`defaultValues` accepts a plain object, a function, or an object whose individual values are functions. Every function receives `(record, ctx)` where `ctx = { pageState, resourceConfig, resourceRecord }`:

```javascript
// 1. Plain object
defaultValues: { Progress: 'DRAFT' }

// 2. Function prop — the whole object is computed
defaultValues: (record, ctx) => ({
  Progress: ctx.resourceConfig.scope.value === 'master' ? 'ACTIVE' : 'DRAFT'
})

// 3. Function values inside the object — computed per key
defaultValues: {
  Progress: 'DRAFT',
  TotalQty: (record) => (record.CartonQty || 0) * (record.UnitsPerCarton || 0)
}
```
Resolution order: if the prop is a function it is called first; each resulting value that is itself a function is then called. A throw in either is logged and that key is skipped. Each resolved header is seeded **only when `record[header] === undefined`**, by emitting the normal `update:field` — `FormRecord` never writes `record` directly, so the caller's `setRecord`/`setControls` routing applies unchanged. Seeding re-runs when `resource`, `defaultValues`, `showStatus`, the resource's `Status`-column presence, or the backend `APP.Resources.DefaultValues` map changes.

### 5.1 `APP.Resources.DefaultValues` (backend schema metadata)

Every resource entry synced from the `APP.Resources` sheet carries a `defaultValues` object. `GAS/resourceRegistry.gs`'s `buildAuthorizedResourceEntry()` copies `config.defaultValues` onto the login `resources` payload entry (see `API_LOGIN_RESPONSE.md` §4), and `parseJsonCell` parses the sheet's `DefaultValues` column, e.g. `{"Status": "Active", "Currency": "AED"}`. `FormRecord` resolves this via `useResourceConfig(resource).defaultValues` — **not** by reaching into `authStore` directly (per `CORE_ARCHITECTURE_RULES.md` §5, components must not import Pinia stores) — matched by its own `resource` prop (the resource **name**). This works identically whether `FormRecord` is rendering the primary resource (from `Create.vue`) or a child resource (from `FormChild.vue`), since both pass their own resource's name, with no extra wiring required from either caller.

**Full default-value precedence (lowest → highest):**
1. `APP.Resources.DefaultValues` (backend schema metadata, resolved automatically).
2. `defaultValues` prop (Object or Function — §5 above) — overrides any backend key it also defines.
3. The hardcoded `Status: statusDefault` fallback (`'Active'`) — applied **only** if `Status` is still unset after steps 1–2.

```json
// APP.Resources row for "SupplierQuotations" — DefaultValues column
{"ResponseType": "QUOTED", "Currency": "AED"}
```
```javascript
// A page-level defaultValues prop can still override a backend-seeded key:
defaultValues: { ResponseType: 'PARTIAL' }   // wins over the backend "QUOTED"
```

`FormChild` resolves the same metadata for a **child** resource from `props.childResource.defaultValues` (the child resource config entry already carries this field from the same login `resources` payload) — see §5.2.

### 5.2 Multi-Entry Child Default Seeding (`FormChild.vue`)

`FormChild` exposes an internal `createChildDefaultRecord()` helper that resolves the same three-tier precedence chain as §5.1 (`childResource.defaultValues` < `defaultValues` prop < `Status` fallback) and returns a fresh, pre-filled data object. Unlike relying solely on `FormRecord`'s own mount-time seeding watcher (which only fires once per component instance), `createChildDefaultRecord()` is called explicitly every time a **new** entry point is created, so defaults apply consistently to the 1st, 2nd, 3rd, and every subsequent row:
- **`inline`/`popup` modes**: `resetDraft()` (called after every successful Add, on Cancel, and when a popup dialog opens for a new entry) seeds `draft` with `createChildDefaultRecord()` instead of `{}`.
- **`multi` mode**: `addBlankRow()` seeds the newly-added `pageState` row the same way instead of `addChild(child, {}, parent)`.

This means a child resource with `defaultValues: { Currency: 'AED' }` (or a backend `APP.Resources.DefaultValues` entry) has every row pre-filled with `Currency: 'AED'` the moment it's created — the user never has to re-select a value that should always be the same.

---

## 6. `fieldProps` — Per-Field Control Prop Overrides

`fieldProps` supplies extra props to individual controls, keyed by header, without needing a `FormField<Header>` file. Like `defaultValues`, it accepts an object, a function, or an object of per-header functions — each function receives `(record, ctx)` with `ctx = { pageState, resourceConfig, resourceRecord }`:

```javascript
fieldProps: {
  ProgressPlannedComment: { label: 'Planning Comment', type: 'textarea', placeholder: 'Notes…' },
  Quantity: (record) => ({ suffix: record.Unit || 'pcs', min: 0 })
}
// or the whole map as a function:
fieldProps: (record, ctx) => ({ Rate: { prefix: ctx.resourceConfig.currency?.value } })
```

**Control prop merge order (lowest → highest):**
1. `$attrs` forwarded from the parent.
2. Base field props resolved by `useFormFields` (`label`, `type`, `options`, `outlined`, …).
3. `fieldProps[header]` — prop-level per-field overrides.
4. `FormField<Header>.js` modifier output from `_ui/*` — **highest priority**, so a tenant's custom UI always wins over a page-level `fieldProps`.

The merged result is handed to the resolved `_fields/<type>/<Mode>.vue` component as its **`config`** prop, which the component spreads onto its inner Quasar control. Resolution metadata (`fieldType`, `component`, `componentName`, `custom`, `header`) is stripped first, so nothing leaks onto the rendered input.

> **Control-type attributes are owned by the field component.** Each `Add.vue` binds `v-bind="config"` first and then sets its own `type` (`url`, `tel`, `textarea`, `number`, …). Consequently `fieldProps` and JS modifiers cannot change a field's input `type` — change the column's schema type instead, so both the form and the view agree. Everything else merges normally.

(A `FormField<Header>.vue` component override replaces the control outright rather than merging props; it still receives the merged props from steps 1–3 plus `field`, `record`, `config`, and `header`.)

---

## 7. Custom (Non-Schema) Fields — Strict Storage Rule

`node.record` is reserved **exclusively** for canonical resource headers sent to GAS (`defaultBuild` in `usePageState.js` reads only `node.record`/`node.children`/`node.records`/`node.action`). A `fields` entry that isn't part of the resource's resolved schema (e.g. a UI-only wizard field, a computed helper input) is flagged `custom: true` by `FormRecord` and must **never** land in `node.record`. Instead:
- `pageState.setControls(header, value, resource)` upserts `{ header, value }` into `node.controls` (a dedicated slot `defaultBuild` never reads).
- `pageState.getControls(header, fallback, resource)` reads it back.
- If no `FormField<Header>` override is found for a custom header, `FormRecord` falls back to `_fields/text/<Mode>.vue` (an outlined `QInput`) — custom entries are stamped `fieldType: 'text'`.

`Create.vue` and `FormChild.vue` already implement `custom`-aware routing (`meta.custom ? setControls : setRecord`); a hand-rolled `FormRecord` usage inside a full Vue override must replicate that routing itself.

---


---

⬑ Back to **[﻿# AQL Create & Update Content Systems](UI_CREATE_AND_UPDATE_SYSTEM.md)**.
