---
name: AQL Create Content Customization
description: Initialization prompt for creating custom UI overrides (Vue SFC, JS object, JS function) for the Create content system (Create.vue, FormRecord.vue, FormChild.vue) and for extending pageState-bound form/child-entry behavior.
---

# Scope Boundary

This document defines initialization parameters for agents tasked with resource-level `Create` content overrides, form field customization, and child-record entry mode configuration under `src/_ui/[UiName]/components/`.

This document does NOT cover:
- `View`/`List` content overrides — see [view_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/view_customization.md) / [content_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_customization.md).
- Submit/cancel button behavior, workflow actions, or FAB wiring — those live in `PageAction` sections (`Form.js` schema, §5.2 of `AQL_CONTENT_CUSTOMIZATION_SYSTEM.md`), out of scope for `Create` content itself.
- Page-level section ordering/visibility (`sections: [...]`) — see [page_and_section_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_section_system.md).

## Required Pre-Reads
Before creating or modifying any local `Create` content components:
1. **System Specification**: Read [AQL_CREATE_CONTENT_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_CREATE_CONTENT_SYSTEM.md) — the full `Create` canonical doc: component anatomy, complete prop tables, the `showFields`/`hideFields`/`workflowFields` visibility precedence chain, `defaultValues`/`fieldProps` function resolution, child entry modes, the three override hierarchies, and whole-content override examples. [AQL_CONTENT_CUSTOMIZATION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_CONTENT_CUSTOMIZATION_SYSTEM.md) §5.3 has a one-paragraph summary + link only — read the dedicated doc for anything beyond a quick orientation.
2. **PageState Contract**: Read [usePageState.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/usePageState.js) — `initResource` (incl. `isPrimaryKey`/`reset` lifecycle options), `setField`, `setControlField`/`getControlField` (non-schema custom fields — never `node.record`), `addChild`/`updateChild`/`removeChild`, `validateNode`.
3. **Architecture Constraints**: Read [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) for strict formatting rules (e.g. no inline `<style>` values, no `QTable`, mobile-first grid).

---

## 1. Context Tracing Protocol

To customize a resource's `Create` layout or field behavior:
1. **Confirm the page contract**: Check `src/pages/[scope]/create.js` (or equivalent) for `contents: ['Create']` — this confirms the page renders the `Create` content and which `sections` surround it (typically `PageHeader`, `PageAction`).
2. **Locate resource schema**: Read the target resource's headers/`ui.fields` under `src/metadata/schemas/` (or via the resolved `resourceConfig.resolvedFields`) to know which fields `useFormFields` will resolve and what control type each maps to (`mapField` in `useRecord.js` / `useFormFields.js`).
3. **Identify eligible children**: Determine which resources have `ParentResource` equal to the target resource (`resourceRecord.childResources` filtered by `child.parentResource === resourceName`) — each becomes a `FormChild` group unless `withChildren` is disabled.
4. **Find Target Override Paths** — there are FOUR independent override levels, checked from broadest to narrowest before writing anything new:
   1. Whole-content: `src/_ui/[UiName]/components/[scope]/[ResourceName]/[page]/create.(vue|js)` (standard content-resolver priority: resource+page → resource → page → scope → ui-wide).
   2. Per-child form: `src/_ui/[UiName]/components/[scope]/[ParentResourceName]/FormChild[ChildResourceName].(vue|js)` or `src/_ui/[UiName]/components/[ChildScope]/[ChildResourceName]/FormChild.(vue|js)`.
   3. Per-resource form: `src/_ui/[UiName]/components/[scope]/[ResourceName]/FormRecord.(vue|js)` (applies identically to the primary resource or any child resource, since both are rendered by the same `FormRecord.vue`).
   4. Per-field control: `src/_ui/[UiName]/components/[scope]/[ResourceName]/FormField[Header].(vue|js)` — **`_ui/*` ONLY**. There is NO `src/components/shared/FormField[Header]` fallback; absent an override, the standard `useFormFields` control (`app/Date.vue`, `QSelect`, `QToggle`, `AqlFileUpload`, `QInput`, …) is used.

   > **Slug normalization**: `[ResourceName]`/`[ParentResourceName]`/`[ChildResourceName]` folder segments above are matched against `toPascalCase(slug).toLowerCase()`, not the raw kebab-case resource slug — `outlet-visits` → `outletvisits`. Write override folders using the PascalCase-derived form (e.g. `_ui/AQL/components/operation/OutletVisits/` on disk, resolved case-insensitively), never with hyphens.
5. **Analyze Overriding Strategy**:
   - Prefer a **JS Logic Modifier** for prop-level adjustments at whichever level matches the change: `create.js` for `childMode`/`closeOnAdd`/`hideFields`/`defaultHideFields`/`fields`/`defaultValues`/`columns`/`title`/`withChildren`; `FormChild<Child>.js` for one child's props only; `FormRecord.js` for one resource's field list/columns/hides; `FormField<Header>.js` for one field's control props.
   - Use a **Vue Template SFC Override** ONLY when the required layout cannot be expressed through props at any of the four levels — e.g. custom non-linear field grouping, bespoke workflow widgets interleaved with fields, or a wizard/step layout.
   - Per-child entry mode (one child `popup`, another `multi`) is now a **first-class override**, not a full `create.vue` rewrite — use a `FormChild<ChildName>.js` JS modifier (§2.3).

---

## 2. Implementation Rules

### 2.1 Writing JS Logic Modifiers for `Create`
Create the target file at the resource+page-specific path for narrowest scope, e.g.:

```javascript
// src/_ui/AQL/components/master/products/create/create.js
export default function (props, { pageState, resourceConfig, resourceRecord }) {
  return {
    ...props,
    childMode: 'popup',      // 'inline' (default) | 'popup' | 'multi' | 'multiple'
    closeOnAdd: false,
    hideFields: ['InternalNotes'],
    workflowFields: 'hide',  // 'hide'/false (default, HIDE) | 'show'/true (SHOW)
    showStatus: false,       // true/'show' renders Status instead of hiding + seeding it
    showFields: ['ProgressApprovedComment'],  // HIGHEST precedence — beats hideFields/workflowFields
    fieldProps: { Price: { prefix: 'AED', min: 0 } },  // per-field control props
    fields: ['Name', 'SkuCode', 'Price', 'WarrantyMonths'],  // 'WarrantyMonths' outside the schema -> custom field
    defaultValues: { WarrantyMonths: 12 },  // Status is seeded by FormRecord automatically
    hideChildren: ['GoodsReceipt'],  // suppress one eligible child resource entirely
    columns: 2,
    title: 'Product Details',
    sectionTitles: { ProductVariants: 'Variants' }
  }
}
```

- The function receives `Create.vue`'s full current prop object plus `{ pageState, resourceConfig, resourceRecord }`, and must return the adjusted prop object.
- **ZERO-HARDCODING RULE.** Every default label, icon, colour, class, dialog width, and behaviour in `Create`/`FormRecord`/`FormChild` is already a prop. **Before writing any `.vue` override, check the prop tables in `AQL_CREATE_CONTENT_SYSTEM.md` §3** — reach for a Vue SFC override only when the *structure* differs, never to change a string, colour, or class.
- Setting `withChildren: false` suppresses ALL child `FormChild` groups even if eligible children exist — use only when child creation must happen elsewhere (e.g. a dedicated sub-route).
- **Workflow/audit hiding is dynamic, not a static list.** `FormRecord` hides any header matching `/(.+?)(By|At|Comment)$/` (e.g. `ProgressApprovedBy`, `StatusRejectedComment`) whenever `workflowFields` is `'hide'`/`false` (default); pass `workflowFields: 'show'`/`true` to render them. There is no `DEFAULT_CREATE_HIDDEN_FIELDS` constant — do not reintroduce a hardcoded list.
- **`Status` is hidden and seeded `statusDefault` (`'Active'`)** by `FormRecord` when the resource has a `Status` column. Use `showStatus: true` (or list `'Status'` in `showFields`) to render it editable, or `statusDefault: 'Draft'` for a different seed — do NOT add `Status` to `hideFields`. When rendered, it is not auto-seeded.
- **Visibility precedence is strictly `showFields` > `hideFields` > `workflowFields`** (see §2.1b). `hideFields` merges on top of the `showCode` (`Code`) hide, `Status`/workflow hiding, and (for children) the `hideParentLink` `*Code` hide — and `showFields` beats all of them.
- **`Code` is hidden by default and fully editable when shown.** Use `showCode: true` (or list `'Code'` in `showFields`) to render it — `useFormFields` no longer marks `Code` `disable: true`, so it behaves like any other input once visible.
- `fieldProps` overrides individual control props by header without needing a `FormField<Header>` file — see §2.1c.
- `fields` sets explicit primary-field order; any header not in the resource's resolved schema (like `WarrantyMonths` above) becomes a **custom field** — see §2.4.
- `defaultValues` seeds any listed header not already present on the record — works for both schema and custom headers, and supports functions (see §2.5). It is layered **on top of** backend `APP.Resources.DefaultValues` metadata, which `FormRecord` resolves automatically by resource name — see §2.5b.
- `sectionTitles` overrides individual child section divider titles by child resource name; `recordTitleFallback` changes the primary section's `'Details'` default.
- `hideChild` / `hideChildren` suppress specific eligible child resources entirely (matched case-insensitively by name or slug) — see §2.8.
- `formRecordProps` / `formChildProps` are escape hatches merged **last** into the primary `FormRecord` / every `FormChild` — use them for one-off props not surfaced on `Create` itself.

### 2.1b Field Visibility Precedence — `showFields` > `hideFields` > `workflowFields`

`FormRecord` builds a hidden-set in this exact order (each step overrides the earlier ones); `Create` and `FormChild` forward all five props unchanged:

1. `workflowFields: 'hide'`/`false` (default) — **adds** every header matching `/(.+?)(By|At|Comment)$/`. `'show'`/`true` skips this step.
2. `showStatus: false` (default) — **adds** `Status`.
3. `showCode: false` (default) — **adds** `Code`.
4. `hideFields: []` — **adds** each listed header (applies even when `workflowFields` is `'show'`).
5. `showFields: []` — **removes** each listed header. **Highest precedence**: a header here renders even if steps 1–4 all hid it (including `Status`, `Code`, and workflow stamps).

```javascript
{
  workflowFields: 'hide',                    // hide all *By/*At/*Comment
  hideFields: ['InternalNotes'],             // plus this one
  showFields: ['ProgressApprovedComment']    // ...except bring this one back
}
```

Use `showFields` instead of flipping `workflowFields: 'show'` when you only need one or two stamp columns — it keeps the rest hidden.

### 2.1c `fieldProps` — Per-Field Control Props (no override file needed)

```javascript
fieldProps: {
  ProgressPlannedComment: { label: 'Planning Comment', type: 'textarea', placeholder: 'Notes…' },
  Quantity: (record) => ({ suffix: record.Unit || 'pcs', min: 0 })   // per-header function
}
// or the whole map as a function:
fieldProps: (record, ctx) => ({ Rate: { prefix: ctx.resourceConfig.currency?.value } })
```

**Control prop merge order (lowest → highest):**
1. `$attrs` forwarded from the parent.
2. Base props from `useFormFields` (`label`, `type`, `options`, `outlined`, …).
3. `fieldProps[header]`.
4. `FormField<Header>.js` modifier from `_ui/*` — **highest**, so tenant custom UI always beats a page-level `fieldProps`.

Reach for `fieldProps` first; only create a `FormField<Header>.js` when the change must be tenant-scoped, or a `FormField<Header>.vue` when the control itself must be replaced.

### 2.1d `$attrs` Forwarding
All three components declare `inheritAttrs: false` and forward `useAttrs()` explicitly, so any attribute you set on a `<Create>`, `<FormRecord>`, or `<FormChild>` usage reaches the layer below without needing a dedicated prop:
- `Create` → primary `FormRecord` props + every `FormChild` section's props.
- `FormRecord` → the resolved whole-form override, the card wrapper, and **every field control**.
- `FormChild` → `AppList` and every inner `FormRecord` (draft, dialog, and each `multi` row).

Precedence: `...attrs` → explicit props → escape hatch (`formRecordProps`/`formChildProps`/`listProps`) → per-child JS modifier result. Because attrs are spread *first*, an explicit prop always wins over a stray forwarded attribute.

### 2.2 Writing Vue Template Overrides
- Must contain a `<template>` block — templateless overrides are never allowed.
- Inject `resourceConfig`, `resourceRecord`, and `pageState` directly (`inject('pageState')`, etc.) — a Vue override of `create.vue` does NOT automatically receive them as props; only `Create.vue`'s own declared props flow through `$attrs`.
- Compose using `FormRecord` and `FormChild` wherever possible instead of hand-rolling `q-input`/`q-select` controls — this preserves `useFormFields`' control-type resolution (file upload, `app/Date.vue` date-with-today-default, status toggle, cross-ref selects, and `AppOptions`-driven selects) and keeps the override thin:

  ```vue
  <!-- src/_ui/AQL/components/master/products/create/create.vue -->
  <template>
    <div class="q-gutter-y-md">
      <FormRecord
        resource="Products"
        :record="primaryRecord"
        :columns="2"
        @update:field="onField"
      />
      <!-- Custom widget interleaved between primary fields and children -->
      <SectionDividerLabel label="Variants" />
      <FormChild
        v-for="child in eligibleChildren"
        :key="child.name"
        :child-resource="child"
        parent-resource="Products"
        child-mode="multi"
      />
    </div>
  </template>

  <script setup>
  import { computed, inject } from 'vue'
  import FormRecord from 'components/contents/FormRecord.vue'
  import FormChild from 'components/contents/FormChild.vue'
  import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'

  const pageState = inject('pageState')
  const resourceRecord = inject('resourceRecord')

  const primaryRecord = computed(() => pageState.state.nodes.get('Products')?.record || {})
  const eligibleChildren = computed(() =>
    (resourceRecord.childResources.value || []).filter(c => c.parentResource === 'Products')
  )

  function onField(header, value) {
    pageState.setField('Products', header, value)
  }
  </script>
  ```

- **NEVER** use inline style blocks or raw HTML div-nesting for layout — use Quasar utility classes (`q-gutter-y-md`, `row`, `col-12 col-sm-6`, etc.).
- **NEVER** use `QTable` for the child-record list — `FormChild`'s inline/popup modes already use `q-list`/`q-card`; a custom override must follow the same stacked-card/list pattern (§7 of `ARCHITECTURE RULES.md`).

### 2.3 Per-Child, Per-Resource, and Per-Field Overrides (no full rewrite needed)

**Per-child `FormChild` override** — one child resource's entry mode/props, without touching the others. `Create.vue` resolves this itself (mirrors `ViewChildren`'s per-child resolution), so a plain JS modifier is enough:

```javascript
// src/_ui/AQL/components/master/products/formchildproductvariants.js
// Applied only to the "ProductVariants" child under Products' Create page.
export default function (childResource, { pageState, resourceConfig, resourceRecord }) {
  return {
    childMode: 'multi',
    listPosition: 'bottom',
    columns: 2
  }
}
```
Path: `src/_ui/[UiName]/components/[scope]/[ParentResourceName]/FormChild[ChildResourceName].js` (parent-scoped — e.g. `master/products/formchildproductvariants.js`), or `src/_ui/[UiName]/components/[ChildScope]/[ChildResourceName]/FormChild.js` (child-resource-scoped — applies wherever that child is rendered, not just under this parent). A `.vue` file at either path fully replaces `FormChild` for that child, receiving `{ childResource, parentResource, childMode, closeOnAdd, hideFields, columns }`.

**Per-resource `FormRecord` override** — one resource's field list/columns/hides, wherever that resource's form renders (primary in `Create.vue`, or as a child in any `FormChild`):

```javascript
// src/_ui/AQL/components/master/products/formrecord.js
export default function (props, { pageState, resourceConfig, resourceRecord }) {
  return { ...props, columns: 2, hideFields: [...props.hideFields, 'InternalNotes'] }
}
```
Path: `src/_ui/[UiName]/components/[scope]/[ResourceName]/FormRecord.(vue|js)`. A `.vue` override fully replaces the base field grid for that resource.

**Per-field `FormField<Header>` override** — one field's control, resource-specific or framework-wide:

```javascript
// src/_ui/AQL/components/master/products/formfieldsku.js
export default function (value, record, field, { pageState, resourceConfig, resourceRecord }) {
  return { hint: 'Format: XXX-0000', mask: 'AAA-9999' }
}
```
Path: `src/_ui/[UiName]/components/[scope]/[ResourceName]/FormField[Header].(vue|js)` — **`_ui/*` ONLY**. There is NO `src/components/shared/FormField[Header]` fallback: when no `_ui` override exists, `FormRecord` uses the standard `useFormFields` control directly. A `.vue` override receives `{ modelValue, field, record, ...otherProps }` and must emit `update:model-value`. Resolves for **both** schema fields and custom (non-schema) `fields` entries.

**Before writing a `FormField<Header>` override, check whether the standard control already covers the need** — you rarely need one:
- **Dates** (type `date`/`datetime`, or any `*Date` header like `TransactionDate`) already render via `app/Date.vue`, which defaults an empty value to today (`YYYY-MM-DD`) on mount.
- **Enumerated selects** resolve automatically from `AppOptions`: add an option group keyed `<ResourceName><Column>` to the `APP.AppOptions` sheet (the resolver tries the resource name as-is, singular, and plural — e.g. `ProductsType`/`ProductType`) and that column becomes a `QSelect` with no frontend change. Prefer this over a hand-built `FormField<Header>` select.

- **Column/field grouping** (sections, collapsible groups): not yet a first-class `Create`/`FormRecord` prop — requires a Vue override composing multiple `FormRecord` instances with different `hide-fields` splits, or wrapping in `q-expansion-item`.

### 2.4 Custom (Non-Schema) Fields — Strict Storage Rule

A `fields` array entry not present in the resource's resolved schema (`resourceConfig.resolvedFields`) is a **custom field**. `FormRecord` flags it `custom: true` and emits `update:field(header, value, { custom: true })`.

**`node.record` is reserved exclusively for canonical schema headers** — `defaultBuild` in `usePageState.js` reads only `node.record`/`node.children`/`node.records`/`node.action`, and a stray custom header inside `node.record` would be silently sent to GAS as if it were a real column. Route custom-field updates to `pageState.setControlField(resource, header, value)` instead (upserts `{ header, value }` into `node.controls`, which `defaultBuild` never reads):

```javascript
// Inside a custom Create.vue / FormRecord.vue override that renders FormRecord directly:
function onField(header, value, meta) {
  if (meta?.custom) pageState.setControlField('Products', header, value)
  else pageState.setField('Products', header, value)
}
```
`Create.vue` and `FormChild.vue` already implement this routing — you only need to replicate it if you hand-roll a `FormRecord` usage inside a full Vue override.

### 2.5 Dynamic `defaultValues` (functions at both levels)

`defaultValues` (on `Create`, `FormRecord`, and `FormChild`) accepts a plain object, a **function**, or an object whose **individual values are functions**. Every function is called with `(record, ctx)` where `ctx = { pageState, resourceConfig, resourceRecord }`:

```javascript
// src/_ui/AQL/components/operation/purchaseorders/create/create.js
export default function (props, { resourceConfig }) {
  return {
    ...props,
    // (a) function prop — the whole defaults object is computed
    defaultValues: (record, ctx) => ({
      Progress: ctx.resourceConfig.scope.value === 'master' ? 'ACTIVE' : 'DRAFT',
      // (b) function value — computed per key, re-evaluated as the record changes
      TotalQty: (rec) => (rec.CartonQty || 0) * (rec.UnitsPerCarton || 0)
    })
  }
}
```

Rules:
- If the prop is a function it is invoked first; each resulting value that is itself a function is then invoked.
- A throw in either is logged and that key is skipped — it never breaks the form.
- A header is seeded **only when `record[header] === undefined`** (an existing value, including `''` or `null`, is never overwritten).
- Seeding emits the normal `update:field(header, value, { custom })`; `FormRecord` never writes the record directly, so `setField`/`setControlField` routing applies unchanged.
- Re-runs when `resource`, `defaultValues`, `showStatus`, the resource's `Status`-column presence, the backend `APP.Resources.DefaultValues` map changes, or the `record` object's identity changes (e.g. a `pageState` reset that swaps in a fresh blank record for the same resource — see `PageAction.vue`'s reset handler). It is **not** a live formula — don't rely on it to keep a derived column in sync on every keystroke (an in-place field edit never changes `record`'s identity); use a `FormField<Header>.js` modifier or a computed column for that.

### 2.5b `APP.Resources.DefaultValues` (backend schema metadata) & Multi-Entry Child Seeding

Every resource row in `APP.Resources` carries a `DefaultValues` column (JSON object, e.g. `{"Status": "Active", "Currency": "AED"}`), exposed on the login `resources` payload entry (`GAS/resourceRegistry.gs`'s `buildAuthorizedResourceEntry()`) as `defaultValues`. `FormRecord` resolves this **automatically** via `useResourceConfig(resource).defaultValues` (never by importing `useAuthStore` directly — components must not import Pinia stores, per `ARCHITECTURE RULES.md` §5) — no wiring required in `Create.vue`/`FormChild.vue` beyond what already exists. Full precedence (lowest → highest): `APP.Resources.DefaultValues` < `defaultValues` prop < the `Status: statusDefault` fallback.

```json
// APP.Resources row for "SupplierQuotations" — DefaultValues column
{"ResponseType": "QUOTED", "Currency": "AED"}
```
```javascript
// A page-level override still wins over the backend value:
defaultValues: { ResponseType: 'PARTIAL' }
```

**Every new child entry is seeded, not just the first.** `FormChild` calls an internal `createChildDefaultRecord()` (same precedence chain, resolved from `childResource.defaultValues` + the `defaultValues` prop) every time a fresh entry point is created — `resetDraft()` (after Add, on Cancel, on popup open) and `addBlankRow()` (multi mode) — so the 1st, 2nd, 3rd, and every subsequent row starts pre-filled, not just the very first `FormRecord` mount.

### 2.6 PageState Lifecycle Awareness
- `Create.vue` already calls `pageState.initResource(resourceName, { isPrimaryKey: true, reset: true })` whenever the active resource changes, flushing stale nodes from a previously-visited Create/Update page and correctly setting `state.primaryKey`. A custom `create.vue` override that does NOT render `Create.vue` itself (a full replacement) must replicate this call itself in a `watch(resourceName, ...)` if it manages its own primary node — otherwise stale data from a prior page may leak into the new form.
- Never call `pageState.reset()` directly inside a JS modifier or override component's render path — lifecycle resets belong in a mount/`watch` side effect, not prop computation.

### 2.7 Verification & Safety
- Run `npx quasar build -m pwa` (or equivalent targeted check) after any override touching more than a couple of files to confirm no compilation issues.
- If you found yourself writing a `.vue` override purely to change a label, icon, colour, class, or dialog size, STOP — that is a prop. Re-check the prop tables in `AQL_CREATE_CONTENT_SYSTEM.md` §3 and use a `.js` modifier instead.
- Confirm `pageState.state.primaryKey` and `pageState.state.nodes` reflect only the active resource after navigating between two different Create pages in the same session — this is the specific regression this system was hardened against.
- If custom (non-schema) fields are involved, confirm `defaultBuild`'s assembled request payload for that resource contains ONLY canonical schema headers — custom values should be readable via `pageState.getControlField(resource, header)` but absent from `node.record`/the built request.

### 2.8 `hideChild` / `hideChildren` — Suppress a Child Resource

To exclude one or more eligible child resources from rendering on `Create` (without disabling `withChildren` for all of them), set `hideChild` (single) or `hideChildren` (array) — matched case-insensitively against the child's `name` **or** `slug`:

```javascript
// src/_ui/AQL/components/master/products/create/create.js
export default function (props) {
  return { ...props, hideChildren: ['GoodsReceipt', 'POReceivingItems'] }
}
```
Use this when a child relation exists in the schema but must be created through a different workflow (a dedicated sub-route, a separate wizard step) rather than inline on this `Create` page.

Alternatively, a single child can be suppressed via a dynamic `hide<ResourceName>: true` prop or `$attrs` flag (checked case-insensitively against `hide<Name>`, `hide<Slug>`, and `hide<PascalCaseName>`) without going through `hideChild`/`hideChildren` at all:

```vue
<Content content="Create" :hideGoodsReceipts="true" />
```

### 2.9 `maxRecords` — Cap Added Record Count (1-to-1 Relations)

`FormChild`'s `maxRecords` prop (`0` = unlimited default) caps the number of added record entries a child bucket may hold, across all three `childMode`s. Set it per-child via a `FormChild<ChildName>.js` modifier (§2.3) — a page-level `formChildProps` on `Create.vue` would apply the same cap to every child, which is rarely what you want:

```javascript
// src/_ui/AQL/components/operation/outlets/formchildoutletoperatingrules.js
// Outlet -> OutletOperatingRules is a 1-to-1 relation.
export default function (childResource) {
  return { maxRecords: 1 }
}
```
Once the cap is reached, every Add affordance (inline submit, popup trigger + dialog submit, multi "Add Row") is **disabled** — not hidden — so the existing record(s) stay visible and editable via the list's Edit button; only adding a *new* row is blocked.
