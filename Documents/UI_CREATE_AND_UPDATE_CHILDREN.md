# Create & Update — Child Entries & Hydration

> Part of **[﻿# AQL Create & Update Content Systems](UI_CREATE_AND_UPDATE_SYSTEM.md)**. Child entry modes, custom component resolution, child suppression and limits, `Update.vue` hydration, and soft-delete with undo.

---

## 8. Child Entry Modes

1. **`inline` (default)** — The added-records `AppList` (positioned per `listPosition`, above by default) sits alongside a permanent `FormRecord` (bare, `:card="false"`, wrapped in `FormChild`'s own card). Submitting (guarded by `canSubmit` — at least one filled field, all resource-required fields present) calls `addChild` and resets the draft. Edit repopulates the draft and switches the button to "Update", calling `updateChild` on submit; Delete calls `removeChild`.
2. **`popup`** — Same `AppList`, but with an "Add {Title}" button instead of a permanent form. Clicking it opens a `q-dialog` hosting a bare `FormRecord`; submitting calls `addChild`/`updateChild` and closes the dialog when `closeOnAdd` is `true` (edits always close). Editing an existing row reopens the dialog prefilled via the same draft state.
3. **`multi` / `multiple`** — No shared draft state and no separate list at all (`listPosition` is a no-op here): every added child row renders its own always-editable `FormRecord` (bare, inside its own small `q-card`) bound directly to the row's live `pageState` data (`update:field` calls `updateChild` immediately, no local draft). An "Add Row" button appends a blank child node via `addChild(childName, {}, parentResource)`; each row has its own remove button.

Regardless of mode, list/row entrance and removal reuse the exact `aql-list-item-*` transition classes documented in `UI_CONTENT_SYSTEM.md` §2's "Centralized List Transitions" — no new CSS was added for `Create`.

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
   - `_ui/[uiName]/components/[scope]/[resource]/FormField<Header>.(vue|js)` — resource-specific (e.g. `FormFieldEmail.vue`). This is the **only** path checked; there is **no** `components/shared/FormField<Header>` framework fallback. When no `_ui` override exists, `FormRecord` mounts the base type component `_fields/<fieldType>/<Add|Edit>.vue` (§15).
   - A **Vue override** replaces just that field's control, receiving `{ modelValue: record[header], field, record, config, header, ...otherFieldProps }` and expected to emit `update:model-value`. A **JS modifier** — `mod(value, record, field, { pageState, resourceConfig, resourceRecord })` (or a plain object) — merges into the base control's props per §6's merge order (mirrors `ViewRecord`'s per-column modifier contract exactly).
   - Applies to **both** schema fields and custom (non-schema) `fields` entries — for a custom header with no `_ui` override, `FormRecord` falls back to a bare `QInput`.

---

## 10. Custom UI Overrides (whole-content level)

`Create` and `Update` participate in the same two-step content resolver as every other content (`UI_CONTENT_SYSTEM.md` §1) — `useContentResolver` is content-name-agnostic, so the two share one path shape that differs only in the filename (`create` vs `update`):

- **Vue Template Override** — replaces the entire content:
  - `_ui/[uiName]/components/[scope]/[resource]/[page]/create.vue` — and `.../[page]/update.vue` (resource + page specific — most common: targets just the Create/Edit page of one resource)
  - `_ui/[uiName]/components/[scope]/[resource]/create.vue` — and `.../[resource]/update.vue`
  - `_ui/[uiName]/components/[scope]/[page]/create.vue` — and `.../[page]/update.vue`
  - `_ui/[uiName]/components/[scope]/create.vue` — and `.../[scope]/update.vue`
  - `_ui/[uiName]/components/create.vue` — and `.../update.vue`
- **JS Logic Modifier** — keeps `ContentsCreate`/`ContentsUpdate` but adjusts its props before render, at the same path priority with `.js` instead of `.vue`.

Because the two resolve independently, a resource can override just its edit form (`update.js`) and keep the stock Create, or vice versa. When both need the same prop adjustments, either duplicate the small modifier or have both import one shared module.

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
      @update:field="(h, v) => pageState.setRecord(h, v, 'Products')"
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

On an `Update` page the cap counts **visible** rows only, so soft-deleting a row (§14) frees its slot. For a `maxRecords: 1` relation this is what makes "replace the existing record" possible: the payload then carries a `deactivate` for the old row plus a `create` for the new one.

---

## 13. `Update.vue` Hydration Lifecycle

`Create` starts from a blank node; `Update` starts from a record the page has **already fetched**. `defaultHydrate` in `usePageState.js` only fills `node.record` and never touches `node.children`, so `Update.vue` owns child hydration itself. All hydration runs through one `syncFromServer()` entry point (`hydrateParent()` then `hydrateExistingChildren()`), driven by two watchers.

### 13.1 Primary record

```javascript
pageState.initResource(name, { isPrimaryKey: true, reset: true, code: record.Code })  // only if the node is absent
pageState.load(record, name)                                                          // guarded, see below
```

`load()` is keyed on a composite guard `${name}::${node.identifier}::${recordId(record)}`:
- `node.identifier` — changes when the node instance is replaced (see §13.3).
- `recordId(record)` — a `WeakMap`-assigned id per pristine server-record **object**, since the record carries no id of its own and its identity is what marks a genuinely different record having loaded.

If the composite key is unchanged, `load()` is skipped. This is what makes hydration idempotent: an unrelated recompute can re-run the watcher freely without re-applying the pristine record over what the user has typed. Passing `code: record.Code` on init is what later makes `defaultBuild` emit a `compositeSave`/update request rather than a create.

### 13.2 Existing child rows

Each row from `resourceRecord.childRecordsByResource[childName]` is pushed as an `update` entry:

```javascript
pageState.addChild(child.name, { ...row }, name, null, { action: 'update' })
```

- `defaultBuild` forwards this verbatim into the `compositeSave` child records array as `_action: 'update'`, and GAS's `handleCompositeSave` locates the sheet row by `data.Code` and merges it.
- The spread is deliberate: enriched records expose relation/metadata keys (`_Children`, `$parent`, …) as **non-enumerable**, so `{ ...row }` yields only canonical schema headers and nothing leaks into the request payload.
- Guarded per `${node.identifier}::${childName}` in a `Set`, so each bucket fills exactly once and the user's subsequent adds/edits/removals are never clobbered.
- Child rows may arrive **after** mount (background resource fetch), so `childRecordsByResource` is watched and each bucket hydrates the first time its rows become available.

### 13.3 Node-reset detection (`PageAction.onReset()`)

`PageAction.onReset()` swaps in a **fresh** node, which flushes `node.children`. A plain record/resource watch cannot detect this — `resourceRecord.record` keeps the same object identity across a reset — so `Update.vue` watches `node.identifier` explicitly. When it changes, both guards miss, and the parent record plus every child bucket re-hydrate, restoring the original server rows. This is the mechanism that makes the Reset action work correctly on an edit form with children.

The two watchers are:

| Watch source | Fires on |
|---|---|
| `[resourceName, serverRecord]` (immediate) | Initial mount, record arrival, and resource switch. On a *different* resource it clears both guards and calls `initResource(..., { reset: true })`, flushing stale nodes from a previously-visited page (same reset contract as `Create.vue` — one `pageState` instance is shared across in-app navigations). |
| `[() => primaryNode.identifier, () => childRecordsByResource, eligibleChildren]` | Node replacement (reset) and late-arriving child rows. |

> [!IMPORTANT]
> Both watchers read `eligibleChildren` while collecting dependencies, so they **must** stay declared below `eligibleChildren`/`hiddenChildKeys` in the setup block — registering them any earlier hits those computeds' temporal dead zone and throws at mount. A single-line comment marks this in the source; do not reorder it.

A full `update.vue` Vue override that does **not** render `Update.vue` itself inherits none of this — it must replicate the `load()` call, the child pre-population, and the identifier guard itself, or stale/duplicated child rows will reach the payload.

---

## 14. Child Soft-Deletion & Undo (`_action: 'deactivate'`)

On a `Create` page every child row is new, so removing one just splices it out. On an `Update` page a child row may already exist in the sheet — and splicing that row merely makes it **absent from the payload**, which leaves the sheet row untouched. `FormChild.remove()` therefore branches on the row's `_action`:

| Row state | Behaviour |
|---|---|
| `_action: 'update'` **and** a non-blank `data.Code` (hydrated by §13.2) | `_action` is flipped in place to `'deactivate'`. The row stays in the bucket, reaches the payload, and GAS's `handleCompositeSave` locates it by Code, sets `Status = 'Inactive'`, applies audit fields, and queues the update. |
| `_action: 'create'` (added this session) | Spliced out via `pageState.removeChild(...)` — it was never persisted, so there is nothing to deactivate. |
| `_action: 'update'` with **no** Code | Spliced out. GAS matches on `_originalCode \|\| data.Code`, and `defaultBuild` drops `_originalCode`; without a Code, GAS would fall through to its create branch and **duplicate** the row instead of deactivating it. |

The flip is a direct mutation on the bucket record object (`records.value[i]._action = 'deactivate'`) rather than a `pageState` call, because `updateChild` merges only `data` and cannot set `_action`. This is reactive: the bucket lives inside `usePageState`'s `reactive()` tree, so the record is a reactive proxy and dependent computeds re-evaluate. No `usePageState.js` or GAS change was required for any of this — both already forwarded and handled `_action` verbatim.

### 14.1 `visibleRecords` and the visible↔bucket index split

Deactivated rows must stay in the reactive bucket (for the payload) but disappear from the UI. `FormChild` therefore keeps two views:

- **`records`** — the raw pageState bucket, including deactivated rows. Every `pageState` mutation and `editIndex` is expressed in **bucket** indices.
- **`visibleRecords`** — `records` filtered to exclude `_action === 'deactivate'`. Drives the `AppList` `items` binding, the `multi`-mode `v-for`, and `maxReached`.

Because hiding rows makes the two index spaces diverge, every rendered row is mapped back with `bucketIndexOf(row)` — an identity `indexOf`, valid because `filter` preserves the same reactive objects rather than copying them. `rowTitle(index)` is the one deliberate exception: it uses the **visible** index so `multi`-mode numbering stays gap-free. Keeping `editIndex` in bucket space means `submitDraft`'s `updateChild` needs no translation, and the existing "shift `editIndex` down when an earlier row splices" correction still holds (a soft delete performs no splice, so no shift is needed — only an in-flight edit of that same row is cleared).

### 14.2 Undo

Since the row is hidden, there is nowhere to hang an inline affordance, so the undo lives in a transient `$q.notify` raised by `remove()`:

```javascript
$q.notify({
  message: props.undoMessage || `${resolvedTitle} removed`,
  actions: [{ label: props.undoLabel, handler: () => restore(row) }]
})
```

`restore(row)` flips `_action` back to `'update'`, which returns the row to `visibleRecords` (with its stable `rowKey`, so the list transition plays in reverse) and to a normal merge on submit. Message, label, colours, timeout, and position are all props (see §3's `undoRemove`/`undoLabel`/`undoMessage`/`undoColor`/`undoTextColor`/`undoBtnColor`/`undoTimeout`/`undoPosition`), per the zero-hardcoding contract; `undoRemove: false` suppresses the notification while leaving the soft delete intact.

---


---

⬑ Back to **[﻿# AQL Create & Update Content Systems](UI_CREATE_AND_UPDATE_SYSTEM.md)**.
