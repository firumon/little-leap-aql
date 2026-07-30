# AQL Create Content System

This document is the complete canonical reference for the `Create` content system — resource-creation forms built from [Create.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/Create.vue), [FormRecord.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/FormRecord.vue), and [FormChild.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/FormChild.vue). It is a sibling document to [AQL_CONTENT_CUSTOMIZATION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_CONTENT_CUSTOMIZATION_SYSTEM.md), which covers the general `contents:` resolver, `List`, and `View`; `Create` shares that same resolver mechanics (§1 there) but has enough surface area (zero-hardcoding prop contract, four-step visibility precedence, three independent override hierarchies, custom-field storage rule) to warrant its own canonical doc.

[Create.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/Create.vue) (registered content name `Create`, component name `ContentsCreate`) is the framework's default resource-creation content, resolved exactly like `List`/`View` via `contents: ['Create']`:

```javascript
// src/pages/Master/create.js
export default {
  sections: ['PageHeader', 'PageAction'],
  contents: ['Create'],
}
```

---

## 1. Overview & Contracts
- `Create.vue` injects `resourceConfig`, `resourceRecord`, and `pageState` (all provided once at `Page.vue`) exactly like `View.vue`.
- **State binding, not fetching**: `Create` never calls services/stores directly (per §1/§3/§5 of `ARCHITECTURE RULES.md`) — every keystroke lands in the shared `pageState` reactive tree via `setField`/`setControlField`/`addChild`/`updateChild`, and `PageAction` sections own `submit()`/`build()`.
- **Primary node lifecycle**: on mount, and whenever `resourceConfig.resourceName` changes to a *different* resource, `Create.vue` calls `pageState.initResource(name, { isPrimaryKey: true, reset: true })`. This flushes any stale node/child-bucket data left in `pageState` from a previously-visited Create/Update page (the composable instance is provided once per `Page.vue` mount and persists across in-app navigations) and sets `state.primaryKey` to the active resource. If the resource name is unchanged but the node was cleared some other way, it re-initializes without wiping other nodes (`reset` omitted).
- **Parent Relations Constraint**: `Create` never renders a form for a parent relation — only the active resource's own fields and its **children** (resources whose `ParentResource` equals the active resource).
- **Child Relations Rule**: child resources are read from the injected `resourceRecord.childResources`, filtered to `child.parentResource === resourceName` (in `master` scope, only `master`-scoped children are surfaced — mirrors `ViewChildren`), then further filtered by `hideChild`/`hideChildren` (see §10). If `withChildren` is `true` (default) and at least one eligible, non-hidden child exists, `Create` renders the primary `FormRecord` **and** one `FormChild` per child resource; otherwise it renders only the primary `FormRecord`.
- **Field visibility precedence — `showFields` > `hideFields` > `workflowFields`**: `FormRecord` builds an explicit hidden-set in that exact order (see §4). There is no `DEFAULT_CREATE_HIDDEN_FIELDS` constant; workflow hiding is dynamic pattern matching. Audit `Created*/Updated*` columns are stripped earlier by `useFormFields`.
- **`Status` handling**: hidden by default and seeded with `statusDefault` (`'Active'`), so it submits without being editable. Pass `showStatus: true` (or `'show'`) — or list `'Status'` in `showFields` — to render it as a normal control instead, in which case it is **not** auto-seeded. Only applies when the resource actually has a `Status` column.
- **Default value seeding**: any `defaultValues` entry whose header is currently `undefined` on the record is seeded the same way. `defaultValues` may be an object, a function, or an object of functions — see §5. Backend-authored `APP.Resources.DefaultValues` metadata is also folded into the same seeding pass, at the lowest precedence — see §5.1.
- **Date fields**: date controls (field type `date`/`datetime`, or any header ending in `Date`) render via [app/Date.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/app/Date.vue), which defaults an empty value to today (`YYYY-MM-DD`) on mount.
- **AppOptions selects**: when `useFormFields` finds an `AppOptions` group keyed `<ResourceName><Column>` (trying the resource name as-is, singular, and plural — e.g. `ProductsType`/`ProductType`), that column renders as a `QSelect` populated from the group's values.
- **Child record caps**: `FormChild`'s `maxRecords` prop (default `0` = unlimited) caps how many added record entries a child bucket may hold — see §12.
- **Dynamic child suppression**: alongside `hideChild`/`hideChildren`, `Create` also honors a dynamic `hide<ResourceName>: true` (or `hide<Slug>` / `hide<PascalName>`) prop or `$attrs` flag per eligible child — see §11.

---

## 2. Zero-Hardcoding Contract

All three components follow one rule: **any built-in default value, label, icon, colour, CSS class, or behaviour is exposed as a prop.** Nothing in `Create`/`FormRecord`/`FormChild` requires a Vue SFC override just to change a string, a colour, a card style, or a dialog width — reach for a `.vue` override only when the *structure* differs.

They also all declare `inheritAttrs: false` and forward `useAttrs()` explicitly:
- **`Create.vue`** merges `attrs` into `primaryFormProps` (the primary `FormRecord`) and into every `FormChild` section's props.
- **`FormRecord.vue`** merges `attrs` into the resolved whole-form override's props, the card wrapper's props, and **every field control's** props (before field-specific props, so explicit field props always win).
- **`FormChild.vue`** merges `attrs` into `AppList` and into every inner `FormRecord` (draft form, dialog form, and each `multi` row).

Precedence everywhere is: `...attrs` → explicit component props → caller escape hatch (`formRecordProps` / `formChildProps` / `listProps`) → per-child JS modifier result.

---

## 3. Component Anatomy & Props

**`Create.vue`** — orchestrator; resolves eligible children (plus any per-child `FormChild` override), owns the primary pageState node, and lays out one section per record/child group with a staggered entrance (matching `View.vue`'s `rv-section`).

| Prop | Type | Default | Description |
|---|---|---|---|
| `withChildren` | `Boolean` | `true` | Master switch — when `false`, only the primary `FormRecord` renders even if child resources exist. |
| `hideChild` / `hideChildren` | `String`\|`Array` | `null` | Suppresses specific eligible child resources from rendering, matched case-insensitively by resource name **or** slug. Accepts a single string or an array; both props are equivalent and merged together. See §11. |
| `childMode` | `String` | `'inline'` | Forwarded to every `FormChild`: `'inline'`, `'popup'`, `'multi'`/`'multiple'`. |
| `listPosition` | `String` | `'top'` | Forwarded to every `FormChild` — added-records list above or below the entry form. |
| `closeOnAdd` | `Boolean` | `true` | Forwarded to `FormChild` (popup mode only) — whether the dialog auto-closes after a successful Add. |
| `hideFields` | `Array` | `[]` | Extra field headers to hide, applied to both the primary form and every child form. |
| `showFields` | `Array` | `[]` | **Highest-precedence** visibility switch — forces these headers visible over `hideFields`/`showCode`/`workflowFields`/`Status`. Forwarded to the primary form and every child form. |
| `showCode` | `Boolean` | `false` | `Code` is server-generated and hidden by default; `true` renders it as a normal, fully editable control. Forwarded to the primary form and every child form. |
| `hideParentLink` | `Boolean` | `true` | Hides `ParentCode` / `<SingularParent>Code` on child forms (filled by `compositeSave`). Set `false` to render them. |
| `childHideFields` | `Array` | `[]` | Extra headers hidden on child forms only (on top of `hideFields`). |
| `workflowFields` | `String`\|`Boolean` | `'hide'` | Forwarded to the primary `FormRecord` + children — `'hide'`/`false` hides workflow action-stamp headers, `'show'`/`true` renders them. |
| `showStatus` | `Boolean`\|`String` | `false` | Forwarded — `true`/`'show'` renders `Status` as an editable control instead of hiding + seeding it. |
| `statusDefault` | `String` | `'Active'` | Forwarded — the value seeded for `Status` while hidden. |
| `fields` | `Array` | `null` | Explicit primary-field ordering, forwarded straight to the primary `FormRecord`. |
| `defaultValues` | `Object`\|`Function` | `{}` | Forwarded to the primary `FormRecord` — see §5. Layered on top of backend `APP.Resources.DefaultValues` (§5.1). |
| `fieldProps` | `Object`\|`Function` | `{}` | Per-field control prop overrides keyed by header — forwarded to the primary form and every child form. See §6. |
| `columns` | `Number` | `1` | Forwarded to every `FormRecord`/`FormChild` — responsive field-grid column count. |
| `title` | `String` | `''` | Section-divider title above the primary form. |
| `recordTitleFallback` | `String` | `'Details'` | Title used for the primary section when `title` is empty **and** children exist (empty otherwise). |
| `sectionTitles` | `Object` | `{}` | Per-child title overrides keyed by child resource name, e.g. `{ ProductVariants: 'Variants' }`. |
| `formRecordProps` | `Object` | `{}` | Escape hatch merged last into the primary `FormRecord`'s props. |
| `formChildProps` | `Object` | `{}` | Escape hatch merged last into every `FormChild`'s props. |
| `sectionClass` | `String`\|`Array`\|`Object` | `'cf-section'` | Wrapper class per section (carries the entrance animation). |
| `sectionStagger` | `Number` | `60` | Per-section entrance delay in ms; `0` disables the stagger. |

**`FormRecord.vue`** — atomic bottom-layer form renderer, the form counterpart of `ViewRecord.vue`. Designed to be reused **unchanged** by the upcoming `Update` content: it is purely presentational, reading from `record` and emitting `update:field`, never touching `pageState` itself. The caller (`Create.vue` for the primary record, `FormChild.vue` for child rows, and eventually `Update.vue`) decides where each emitted field lands.

| Prop | Type | Default | Description |
|---|---|---|---|
| `resource` | `String` | required | Resource name — resolves the control schema via `useFormFields`. |
| `record` | `Object` | required | The reactive target object driving every control's `model-value` (a `pageState` node's `.record`, or a child row's `.data`). |
| `title` | `String` | `''` | Optional `SectionDividerLabel` above the fields; empty renders no divider. |
| `hideFields` | `Array` | `[]` | Field headers to exclude from rendering (step 4 of the precedence chain). |
| `showFields` | `Array` | `[]` | **Highest precedence** — forces these headers visible regardless of `hideFields`, `workflowFields`, the `Status` default, or the `Code` default (step 5). |
| `workflowFields` | `String`\|`Boolean` | `'hide'` | `'hide'`/`false` excludes headers matching `/(.+?)(By\|At\|Comment)$/`; `'show'`/`true` renders them like any other field (step 1). |
| `showStatus` | `Boolean`\|`String` | `false` | `false`/`'hide'` → `Status` hidden and seeded with `statusDefault`; `true`/`'show'` → rendered as a normal editable control (and not auto-seeded). Step 2. |
| `statusDefault` | `String` | `'Active'` | Value seeded into `Status` while hidden. Set `null` to skip seeding entirely. |
| `showCode` | `Boolean` | `false` | `false` → `Code` hidden (step 3); `true` → rendered as a normal, fully editable control (`useFormFields` no longer marks it `disable: true`). |
| `fields` | `Array` | `null` | Explicit field ordering. A header not present in the resource's resolved schema is treated as a **custom (non-schema) field** — see §7. `null`/omitted falls back to natural schema order. |
| `defaultValues` | `Object`\|`Function` | `{}` | Seed values — see §5. Merged over `APP.Resources.DefaultValues` (backend schema metadata, resolved via `useResourceConfig(resource).defaultValues` — §5.1). |
| `fieldProps` | `Object`\|`Function` | `{}` | Per-field control prop overrides keyed by header — merged over the `useFormFields` base props and under any `FormField<Header>.js` modifier. See §6. |
| `columns` | `Number` | `1` | `1` → `colClass`; `>1` → `colClassMulti` responsive grid. |
| `scope` / `resourceSlug` / `uiName` | `String` | `''` | Content-resolver identity for this specific form's own overrides (§8) — the caller must pass these explicitly (mirrors `ViewRecord`'s props); `FormRecord` does not infer them from injected `resourceConfig`. |
| `card` | `Boolean` | `true` | Wraps fields in a `q-card` when `true`; renders bare (`:card="false"`) when hosted inside a dialog or a `FormChild` `multi` row card that supplies its own chrome. |
| `cardClass` | `String`\|`Array`\|`Object` | `'aql-premium-gradient-form'` | Card class when `card` is on. |
| `cardFlat` / `cardBordered` | `Boolean` | `true` / `true` | Card elevation/border. |
| `gridClass` | `String`\|`Array`\|`Object` | `'row q-col-gutter-x-md'` | Field-grid container class. |
| `fieldClass` | `String`\|`Array`\|`Object` | `'fc-field q-py-xs'` | Per-field wrapper class (carries the rise-in animation). |
| `colClass` | `String` | `'col-12'` | Column span class when `columns === 1`. |
| `colClassMulti` | `String` | `'col-12 col-sm-6'` | Column span class when `columns > 1`. |
| `emptyText` | `String` | `'No fields configured for this resource.'` | Shown when no field survives filtering. |
| `emptyClass` | `String`\|`Array`\|`Object` | `'text-grey-6 text-center q-pa-md'` | Empty-state class. |
| `fieldStagger` | `Number` | `40` | Per-field entrance delay in ms; `0` disables the stagger. |

Emits **`update:field(header, value, { custom })`** on every control's `update:model-value` (and for seeded defaults) — `custom` is `true` when the header isn't part of the resource's resolved schema. `Create.vue`/`FormChild.vue` route `custom: true` updates to `pageState.setControlField` and everything else to `pageState.setField`/child bucket mutations.

**`FormChild.vue`** — child-record entry/list container. Every individual record's inputs are always delegated to `FormRecord`, regardless of mode.

| Prop | Type | Default | Description |
|---|---|---|---|
| `childResource` | `Object` | required | The child resource config entry (from `resourceRecord.childResources`). |
| `parentResource` | `String` | required | Active/primary resource name — the pageState node the child bucket lives under. |
| `childMode` | `String` | `'inline'` | `'inline'` \| `'popup'` \| `'multi'`/`'multiple'`. |
| `listPosition` | `String` | `'top'` | `'top'`/`'above'` renders the added-records list before the entry form/Add button (default); `'bottom'`/`'below'` renders it after. Ignored in `multi` mode (no separate list). |
| `closeOnAdd` | `Boolean` | `true` | Popup mode only — auto-close the dialog after a successful Add (edits always close). |
| `maxRecords` | `Number` | `0` | Maximum number of added record entries allowed (`0` = unlimited). Use `1` for 1-to-1 child relations (e.g. `Outlet` → `OutletOperatingRules`). See §12. |
| `hideFields` | `Array` | `[]` | Extra field headers to hide on child rows. |
| `showFields` | `Array` | `[]` | **Highest precedence** — forces these headers visible on child rows (also removes them from `hideFields` for the derived list label/caption and required-field checks). |
| `showCode` | `Boolean` | `false` | `Code` is server-generated and hidden by default on child rows; `true` renders it as a normal, fully editable control. Forwarded to each `FormRecord`. |
| `columns` | `Number` | `1` | Forwarded to each `FormRecord`. |
| `title` | `String` | `''` | Overrides the auto-derived section title (`resolveChildTitle(childResource)`); the divider is omitted when the resolved title is empty. |
| **Forwarded to each `FormRecord`** | | | |
| `fields` | `Array` | `null` | Explicit child-field ordering. |
| `workflowFields` | `String`\|`Boolean` | `'hide'` | Workflow action-stamp hiding for child rows. |
| `showStatus` / `statusDefault` | `Boolean`\|`String` / `String` | `false` / `'Active'` | `Status` visibility + seed value for child rows. |
| `defaultValues` | `Object`\|`Function` | `{}` | Seed values for child rows (same function support as `FormRecord`), merged over the child resource's own `APP.Resources.DefaultValues` — see §5.1. Applied to **every** new row/draft, not just the first — see §5.2. |
| `fieldProps` | `Object`\|`Function` | `{}` | Per-field control prop overrides for child rows. |
| `formRecordProps` | `Object` | `{}` | Escape hatch merged last into every inner `FormRecord`. |
| **List rendering** | | | |
| `listProps` | `Object` | `{}` | Escape hatch merged last into `AppList`'s props. |
| `listDense` / `listSeparator` / `listBordered` | `Boolean` | `true` / `true` / `false` | `AppList` styling. |
| `listClassTop` / `listClassBottom` | `String`\|`Array`\|`Object` | `'q-mb-sm'` / `'q-mt-sm'` | Class applied to the list in each position. |
| `itemLabel` / `itemCaption` | `String`\|`Function` | `null` | Override the derived per-row label/caption resolvers. |
| `captionParts` | `Number` | `3` | Max `field: value` pairs in the derived caption. |
| `captionSeparator` | `String` | `' • '` | Joiner between caption parts. |
| `newItemLabel` | `String` | `''` | Label for a row with no filled fields yet (defaults to `New <Title>`). |
| `emptyText` | `String` | `''` | Empty-state text (defaults to `No <Title> added yet.`). |
| `emptyClass` | `String`\|`Array`\|`Object` | `'text-caption text-grey-6 text-center q-py-xs'` | Empty-state class. |
| **Card styling** | | | |
| `cardClass` | `String`\|`Array`\|`Object` | `'aql-premium-gradient-form'` | Class for the inline entry card and each `multi` row card. |
| `cardFlat` / `cardBordered` | `Boolean` | `true` / `true` | Card elevation/border. |
| `rowTitleClass` | `String`\|`Array`\|`Object` | `'text-caption text-weight-medium text-grey-7'` | Per-row heading class in `multi` mode. |
| `transitionName` | `String` | `'aql-list-item'` | TransitionGroup name for `multi` row cards. |
| **Dialog (popup mode)** | | | |
| `dialogStyle` | `String`\|`Object` | `'max-width: 520px'` | Dialog card sizing. |
| `dialogTitleClass` | `String`\|`Array`\|`Object` | `'text-subtitle1 text-weight-medium'` | Dialog heading class. |
| `dialogAddTitleLabel` / `dialogEditTitleLabel` | `String` | `''` | Full dialog heading overrides (default to `Add <Title>` / `Edit <Title>`). |
| **Labels / icons / colours** | | | |
| `addLabel` / `updateLabel` / `cancelLabel` | `String` | `'Add'` / `'Update'` / `'Cancel'` | Button labels (`addLabel` also builds the `Add <Title>` inline/FAB label). |
| `addIcon` / `updateIcon` / `editIcon` / `deleteIcon` / `closeIcon` | `String` | `'add'` / `'check'` / `'edit'` / `'delete'` / `'close'` | Icons. |
| `submitColor` / `cancelColor` / `editColor` / `deleteColor` | `String` | `'primary'` / `'grey-7'` / `'primary'` / `'negative'` | Button colours. |
| `actionBtnSize` | `String` | `'sm'` | Size of the per-row Edit/Delete buttons. |

All mutations flow through `pageState.addChild(parentResource, childResource.name, row)`, `updateChild(...)`, and `removeChild(...)` — the same primitives `usePageState.js` already exposed; `FormChild` adds no new state surface.

**Added-record list rendering**: the inline/popup modes' added-record list is rendered via `AppList` (not a raw `q-list`), passing `items` (the pageState child bucket's `records` array), a function `itemKey` (stable per-row identity via a component-local `WeakMap`), function `label`/`caption` resolvers (derived from the child resource's resolved fields), and a `#btn` slot rendering Edit + Delete buttons per row. `AppList` forwards straight to `abstract/List.vue`, so FLIP entrance/reorder/removal transitions (`aql-list-item-*`, see `AQL_CONTENT_CUSTOMIZATION_SYSTEM.md` §2) and responsive layout (mobile-first `q-item` stacking) are inherited for free — no bespoke list markup or CSS.

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
Resolution order: if the prop is a function it is called first; each resulting value that is itself a function is then called. A throw in either is logged and that key is skipped. Each resolved header is seeded **only when `record[header] === undefined`**, by emitting the normal `update:field` — `FormRecord` never writes `record` directly, so the caller's `setField`/`setControlField` routing applies unchanged. Seeding re-runs when `resource`, `defaultValues`, `showStatus`, the resource's `Status`-column presence, or the backend `APP.Resources.DefaultValues` map changes.

### 5.1 `APP.Resources.DefaultValues` (backend schema metadata)

Every resource entry synced from the `APP.Resources` sheet carries a `defaultValues` object. `GAS/resourceRegistry.gs`'s `buildAuthorizedResourceEntry()` copies `config.defaultValues` onto the login `resources` payload entry (see `LOGIN_RESPONSE.md` §4), and `parseJsonCell` parses the sheet's `DefaultValues` column, e.g. `{"Status": "Active", "Currency": "AED"}`. `FormRecord` resolves this via `useResourceConfig(resource).defaultValues` — **not** by reaching into `authStore` directly (per `ARCHITECTURE RULES.md` §5, components must not import Pinia stores) — matched by its own `resource` prop (the resource **name**). This works identically whether `FormRecord` is rendering the primary resource (from `Create.vue`) or a child resource (from `FormChild.vue`), since both pass their own resource's name, with no extra wiring required from either caller.

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
- **`multi` mode**: `addBlankRow()` seeds the newly-added `pageState` row the same way instead of `addChild(..., {})`.

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

(A `FormField<Header>.vue` component override replaces the control outright rather than merging props; it still receives the merged props from steps 1–3 plus `field` and `record`.)

---

## 7. Custom (Non-Schema) Fields — Strict Storage Rule

`node.record` is reserved **exclusively** for canonical resource headers sent to GAS (`defaultBuild` in `usePageState.js` reads only `node.record`/`node.children`/`node.records`/`node.action`). A `fields` entry that isn't part of the resource's resolved schema (e.g. a UI-only wizard field, a computed helper input) is flagged `custom: true` by `FormRecord` and must **never** land in `node.record`. Instead:
- `pageState.setControlField(resource, header, value)` upserts `{ header, value }` into `node.controls` (a dedicated slot `defaultBuild` never reads).
- `pageState.getControlField(resource, header)` reads it back.
- If no `FormField<Header>` override is found for a custom header, `FormRecord` falls back to a bare `QInput`.

`Create.vue` and `FormChild.vue` already implement `custom`-aware routing (`meta.custom ? setControlField : setField`); a hand-rolled `FormRecord` usage inside a full Vue override must replicate that routing itself.

---

## 8. Child Entry Modes

1. **`inline` (default)** — The added-records `AppList` (positioned per `listPosition`, above by default) sits alongside a permanent `FormRecord` (bare, `:card="false"`, wrapped in `FormChild`'s own card). Submitting (guarded by `canSubmit` — at least one filled field, all resource-required fields present) calls `addChild` and resets the draft. Edit repopulates the draft and switches the button to "Update", calling `updateChild` on submit; Delete calls `removeChild`.
2. **`popup`** — Same `AppList`, but with an "Add {Title}" button instead of a permanent form. Clicking it opens a `q-dialog` hosting a bare `FormRecord`; submitting calls `addChild`/`updateChild` and closes the dialog when `closeOnAdd` is `true` (edits always close). Editing an existing row reopens the dialog prefilled via the same draft state.
3. **`multi` / `multiple`** — No shared draft state and no separate list at all (`listPosition` is a no-op here): every added child row renders its own always-editable `FormRecord` (bare, inside its own small `q-card`) bound directly to the row's live `pageState` data (`update:field` calls `updateChild` immediately, no local draft). An "Add Row" button appends a blank child node via `addChild(parentResource, childName, {})`; each row has its own remove button.

Regardless of mode, list/row entrance and removal reuse the exact `aql-list-item-*` transition classes documented in `AQL_CONTENT_CUSTOMIZATION_SYSTEM.md` §2's "Centralized List Transitions" — no new CSS was added for `Create`.

---

## 9. Custom Component Resolution Hierarchies

Three independent, narrowly-scoped override points exist beneath the page-level `Create` content-resolver override (§10). Each is resolved by the component that renders it, exactly like `ViewRecord`/`ViewChildren` resolve their own record/child overrides.

> [!IMPORTANT]
> **Slug normalization.** Every `[resourceSlug]`/`[parentResourceSlug]`/`[childResourceSlug]` path segment below is normalized as `toPascalCase(slug).toLowerCase()` before the glob-registry lookup — **exactly** matching `useContentResolver.js`'s own `toPascalCase(resource || '').toLowerCase()` normalization (line ~71) used for `List`/`View` overrides. A kebab-case slug like `outlet-visits` becomes `outletvisits`, not `outlet-visits` — Vite's glob-registry keys never contain hyphens, since folder names are PascalCase-derived (`OutletVisits/` → key `outletvisits`). `FormRecord.vue` (`normalizeSlug`), `Create.vue` (`resolveChildOverride`), and `FormChild.vue` (`fieldResourceSlug`) all apply this normalization to whatever `resourceSlug`/`childResource.slug` they receive — callers do not need to pre-normalize slugs before passing them as props. This is not a redundant conversion: real resource menu routes (`ui.menus[].route`) ARE kebab-case in production (confirmed against live seed data in `GAS/syncAppResources.gs`, e.g. `/operation/outlet-visits`), so `resourceSlug` genuinely arrives kebab-cased and needs this normalization to reach the PascalCase-derived glob key.

1. **Child form override (resolved by `Create.vue`, one lookup per eligible child)**:
   - `_ui/[uiName]/components/[scope]/[parentResourceSlug]/FormChild[ChildResource].(vue|js)` — e.g. `_ui/AQL/components/operation/outletrestocks/formchildoutletrestockitems.vue`
   - `_ui/[uiName]/components/[childScope]/[childResourceSlug]/FormChild.(vue|js)` — e.g. `_ui/AQL/components/operation/outletrestockitems/formchild.vue`
   - A **Vue override** fully replaces that child's `FormChild` with the resolved component, receiving `{ childResource, parentResource, childMode, closeOnAdd, hideFields, columns }`. A **JS modifier** — `mod(childResource, { pageState, resourceConfig, resourceRecord })` (or a plain object) — merges into the default `FormChild` props for that one child only (e.g. force `childMode: 'multi'` on just one child while others stay `'inline'`).
2. **Main/child resource form override (resolved by `FormRecord.vue` itself, based on its own `scope`/`resourceSlug`/`uiName` props)**:
   - `_ui/[uiName]/components/[scope]/[resource]/FormRecord.(vue|js)` — applies identically whether `FormRecord` is rendering the primary resource (from `Create.vue`) or a child resource (from `FormChild.vue`), since both pass their own scope/slug context down.
   - A **Vue override** replaces the base field grid entirely, receiving the full `FormRecord` prop set (`resource`, `record`, `hideFields`, `showFields`, `fields`, `defaultValues`, `fieldProps`, `columns`, `scope`, `resourceSlug`, `uiName`, `card`). A **JS modifier** — `mod(props, { pageState, resourceConfig, resourceRecord })` — adjusts those props before the base grid renders (e.g. force `columns: 2` or extend `hideFields` for one resource only).
3. **Single-field override (resolved by `FormRecord.vue`, per visible field) — `_ui/*` ONLY**:
   - `_ui/[uiName]/components/[scope]/[resource]/FormField<Header>.(vue|js)` — resource-specific (e.g. `FormFieldEmail.vue`). This is the **only** path checked; there is **no** `components/shared/FormField<Header>` framework fallback. When no `_ui` override exists, `FormRecord` uses the standard `useFormFields`-resolved control directly (`app/Date.vue`, `QSelect`, `QToggle`, `AqlFileUpload`, `AqlStatusToggle`, `QInput`, …).
   - A **Vue override** replaces just that field's control, receiving `{ modelValue: record[header], field, record, ...otherFieldProps }` and expected to emit `update:model-value`. A **JS modifier** — `mod(value, record, field, { pageState, resourceConfig, resourceRecord })` (or a plain object) — merges into the base control's props per §6's merge order (mirrors `ViewRecord`'s per-column modifier contract exactly).
   - Applies to **both** schema fields and custom (non-schema) `fields` entries — for a custom header with no `_ui` override, `FormRecord` falls back to a bare `QInput`.

---

## 10. Custom UI Overrides (whole-content level)

`Create` participates in the same two-step content resolver as every other content (`AQL_CONTENT_CUSTOMIZATION_SYSTEM.md` §1) — `useContentResolver` is content-name-agnostic:

- **Vue Template Override** — replaces the entire `Create` content:
  - `_ui/[uiName]/components/[scope]/[resource]/[page]/create.vue` (resource + page specific — most common: targets just the Create page of one resource)
  - `_ui/[uiName]/components/[scope]/[resource]/create.vue`
  - `_ui/[uiName]/components/[scope]/[page]/create.vue`
  - `_ui/[uiName]/components/[scope]/create.vue`
  - `_ui/[uiName]/components/create.vue`
- **JS Logic Modifier** — keeps `ContentsCreate` but adjusts its props before render, at the same path priority with `.js` instead of `.vue`.

```javascript
// src/_ui/AQL/components/master/products/create/create.js
// Hides SKU-specific fields from the primary form and forces popup child entry.
export default function (props, { pageState, resourceConfig, resourceRecord }) {
  return {
    ...props,
    childMode: 'popup',
    closeOnAdd: false,
    hideFields: ['InternalNotes'],
    columns: 2
  }
}
```

```vue
<!-- src/_ui/AQL/components/master/products/create/create.vue -->
<!-- Full replacement — only used when the stock layout is fundamentally different
     from FormRecord/FormChild's generic field-grid + child-list/dialog/multi shapes. -->
<template>
  <div class="q-gutter-y-md">
    <FormRecord
      resource="Products"
      :record="pageState.state.nodes.get('Products')?.record || {}"
      :columns="2"
      @update:field="(h, v) => pageState.setField('Products', h, v)"
    />
    <!-- custom child layout, workflow-specific widgets, etc. -->
  </div>
</template>

<script setup>
import { inject } from 'vue'
import FormRecord from 'components/contents/FormRecord.vue'
const pageState = inject('pageState')
</script>
```

A Vue override receives all `pageProps` unmodified via `$attrs`/injection (exactly like `List`/`View` overrides) — read `resourceConfig`/`resourceRecord`/`pageState` via `inject()`, not props, since `Create.vue` itself only forwards its own declared props (`withChildren`, `childMode`, etc.), not the full page context.

---

## 11. `hideChild` / `hideChildren` / dynamic `hide<ResourceName>` — Child Resource Suppression

`Create.vue` accepts `hideChild` and `hideChildren` (equivalent aliases — both are checked and merged into one lookup set) to suppress specific eligible child resources from rendering at all, without disabling `withChildren` globally. Matching is case-insensitive against **both** the child resource's `name` and its `slug`:

```javascript
// Single child
{ hideChild: 'GoodsReceipt' }

// Multiple children
{ hideChildren: ['GoodsReceipt', 'POReceivingItems'] }
```

Filtering happens in `eligibleChildren` — the same computed that already applies the `ParentResource` match and the master-scope restriction — so a hidden child is excluded before any `FormChild<ChildName>` override resolution, per-child JS modifier, or section-list entry is ever built for it. This is the right tool when a child relation exists in the schema but must be created elsewhere (e.g. via a dedicated sub-route or a different workflow step) rather than inline on the primary `Create` page.

**Dynamic `hide<ResourceName>` suppression** — alongside the array/string `hideChild`/`hideChildren` props, `eligibleChildren` also checks, per child, for a dynamic boolean flag on either `props` or `$attrs`: `hide<Name>`, `hide<Slug>`, or `hide<PascalCaseName>` (case-insensitive), e.g. `hideGoodsReceipts: true` or `hidePOReceivingItems: true`. A `true` (or the string `'true'`) value suppresses that child exactly like listing it in `hideChild`. This is useful when a page wants to hide one specific child via a plain attribute without threading it through `hideChild`/`hideChildren`:

```vue
<!-- suppresses the GoodsReceipts child section for this page only -->
<Content content="Create" :hideGoodsReceipts="true" />
```

---

## 12. `maxRecords` — Maximum Added Record Count

`FormChild`'s `maxRecords` prop (`0` = unlimited, the default) caps how many added record entries a single child bucket may hold, independent of `childMode`. The canonical use case is a 1-to-1 child relation — e.g. `Outlet` → `OutletOperatingRules` — where `maxRecords: 1` guarantees at most one child record can ever be added:

```javascript
// src/_ui/AQL/components/operation/outlets/formchildoutletoperatingrules.js
export default function (childResource) {
  return { maxRecords: 1 }
}
```

Once `records.length >= maxRecords` (computed as `maxReached`), every Add affordance across all three modes is disabled (not hidden, so the added record remains visible and editable):
- **`inline`**: the submit button is disabled when adding a *new* row (`editIndex === null`); editing the existing row(s) via the list's Edit button is unaffected.
- **`popup`**: both the outer "Add {Title}" trigger and the in-dialog submit button are disabled for a new entry; editing an existing row still works.
- **`multi`**: the "Add Row" button is disabled.

The underlying mutation functions (`submitDraft` for the add path, `addBlankRow`) also guard on `maxReached` directly, so the cap holds even if a disabled button were somehow bypassed. `maxRecords` is set per child either via `formChildProps` on `Create.vue` (applies uniformly to every child) or, for a single specific child, via a `FormChild<ChildName>.js` JS modifier as shown above (§9).
