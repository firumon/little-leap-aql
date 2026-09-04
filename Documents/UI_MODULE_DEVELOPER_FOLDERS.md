# 3-Layer UI — Folder Layout & Naming

> Part of **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**. Path segments, where helper logic lives, resource-private sub-components, field control and whole-page overrides.

---

## 2. Folder Layout & Naming

```
FRONTENT/src/_ui/
└─ {UiName}/                 ← PascalCase folder — the UI's own identity (e.g. AQL, LittleLeap)
   ├─ _config/               ← this UI's design tokens (§10.3) — created with the folder
   │  ├─ config.js
   │  └─ config.md
   ├─ components/            ← placeholder overrides + resource-private sub-components (§2.2, §2.3)
   │  ├─ sections/           ← UI-wide generic BASE sections
   │  ├─ contents/           ← UI-wide generic BASE contents
   │  ├─ actions/            ← UI-wide generic BASE actions
   │  ├─ {Scope}/                                     e.g. Operation, Master
   │  │  ├─ {Resource}/                               e.g. a resource's PascalCase name
   │  │  │  ├─ {page}/                                e.g. Index, View, Add, Edit, MarkDelivered
   │  │  │  │  └─ {Placeholder}.vue | .js
   │  │  │  └─ {Placeholder}.vue | .js
   │  │  └─ {Placeholder}.vue | .js
   │  └─ {Placeholder}.vue | .js
   ├─ composables/           ← presentation-only helper logic (§4)
   │  └─ {Scope}/
   │     └─ {Resource}/
   │        ├─ {page}/                                  e.g. Index, Add, Edit, View
   │        │  └─ use{Feature}.js                       page-scoped helper (e.g. the injection relay, §6.2)
   │        └─ use{Feature}.js                          resource-wide helper, shared across pages
   └─ pages/                 ← page contracts & full-page overrides (§2.5)
      ├─ {Scope}/
      │  ├─ {Resource}/
      │  │  └─ {page}.vue | {page}.js
      │  └─ {page}.vue | {page}.js
      └─ {page}.vue | {page}.js
```

`{UiName}` comes from `APP.Resources.CustomUIName`, read **per resource** — it is a
resource-level setting, not an account-level or tenant-level one. When it's blank, the
resource resolves under `_ui/AQL/`; when it's set, the resource resolves under
`_ui/{ThatName}/` instead. Nothing else about the resolver changes based on which name is
in play — every `_ui/{UiName}/` folder, whichever name it carries, is scanned the same way
by the same resolver.

Because the setting lives on the resource, **two resources in the same app can carry two
different `CustomUIName` values** and resolve under two completely separate `_ui/` trees,
each with its own display, its own design tokens and its own presentation-layer logic. A
`{UiName}` is not "one tenant, one UI" — it is simply which `_ui/` folder a given
resource's pages, components and composables are looked up in. A new named UI is a new
sibling folder plus that value set on whichever resource(s) should use it; no code change
either way.

> [!IMPORTANT]
> **A new `_ui/{UiName}/` folder gets its `_config/config.js` + `config.md` before its
> first component** (§10.3). A UI with no `_config/` has no design system, and every module
> built under it will invent its own.

> [!IMPORTANT]
> **`_ui/` folders must be named in PascalCase.** Every lookup path is built lowercase and
> the Vite glob registry lowercases every indexed path, so casing is irrelevant to
> *matching* — but a **hyphen is not**. A resource slug goes through
> `toPascalCase(slug).toLowerCase()`, so `outlet-visits` becomes the key `outletvisits`.
> A literal folder named `outlet-visits/` produces the key `outlet-visits` and will
> **never** resolve. Name it `OutletVisits/`.

### 2.1 Path segment transformation

| Segment | Input | Transformation | Example |
|---|---|---|---|
| `{UiName}` | `CustomUIName` | lowercased as-is | `AQL` → `aql` |
| `{Scope}` | route scope | lowercased as-is | `Operation` → `operation` |
| `{Resource}` | resource **slug** | `toPascalCase` → lowercased | `purchase-orders` → `PurchaseOrders` → `purchaseorders` |
| `{page}` | canonical page | lowercased as-is | `View` → `view` |
| `{page}` (action route) | `:action` route **param** | `toPascalCase` → lowercased | `mark-delivered` → `MarkDelivered` → `markdelivered` |
| `{page}` (custom sub-route) | `:pageSlug` route **param** | `toPascalCase` → lowercased | `my-custom-page` → `MyCustomPage` → `mycustompage` |
| `{Placeholder}` | section / content / action name | lowercased as-is | `PageHeader` → `pageheader` |

`{page}` is the **canonical** page name resolved by `usePageResolver`: `'index'`, `'view'`,
`'add'`, `'edit'`, `'resource'`, `'record'`, or — on a **custom** route — the route's own
slug: the `action` param on `_action/:action`, and the `pageSlug` param on a `resource`
(`/{scope}/{resource}/:pageSlug`) or `record` (`/{scope}/{resource}/{code}/:pageSlug`)
sub-route. All three are normalized the same way, through
`toPascalCase(slug).toLowerCase()`. That normalization is what lets a **multi-word slug**
be filed under a PascalCase name like every other `_ui/` path segment: `mark-delivered`
resolves to the page key `markdelivered`, matching both
`pages/{Scope}/{Resource}/MarkDelivered.js` and the placeholder folder
`components/{Scope}/{Resource}/MarkDelivered/`; a `my-custom-page` sub-route resolves to
`mycustompage` and reads `MyCustomPage.js` plus
`components/{Scope}/{Resource}/MyCustomPage/`. Single-word slugs are unchanged: `approve`
→ `approve` → `Approve.js`. A `resource` / `record` route with **no** slug keeps its
canonical name (`resource` / `record`), unchanged from before.

### 2.2 Helper logic belongs in `composables/`, not `components/`

> [!IMPORTANT]
> **A loose `.js` file dropped into a component folder is a layering mistake** — the
> resolver tolerates it (indexed by the Vite glob, never resolved, since its name matches
> no placeholder identity) but every piece of shared presentation helper logic — display
> formatters, row presets, gate-relay wrappers — goes in
> `_ui/{Ui}/composables/{Scope}/{Resource}/use{Feature}.js` (§4).

**Naming and shape.** The file is `use<Feature>.js` and should export a matching
`use<Feature>()` function. Page contracts and JS modifiers (`pages/.../Index.js`, and any
`{Placeholder}.js` under `components/`) are evaluated **outside any component setup**, so
they cannot call a composable that injects context or holds reactive state directly — they
receive `{ pageState, resourceRecord, resourceConfig }` as plain parameters instead. The
workable shape is therefore named pure exports, plus a `use<Feature>()` wrapper for
setup-context callers:

```javascript
// _ui/{Ui}/composables/Operation/{Resource}/use{Feature}.js

// Named PURE exports — importable from a page contract or a JS modifier.
export function progressColor (row) { /* … */ }
export function respondDelayDays (row) { /* … */ }

// Composable shape for setup-context callers. Same functions, one import.
export function use{Feature} () {
  return { progressColor, respondDelayDays }
}
```

This split is what lets a `PageAction.js` on an action route submit exactly what the page
displayed: the cards call the composable inside setup, and the modifier imports the same
file's **pure** exports and reads the same `pageState` control field the cards wrote (§8.2).

### 2.3 Resource-private sub-components

Not every `.vue` file under a resource folder is a placeholder. A **resource-private
sub-component** is one that no page ever names in `sections:`/`contents:` — a shared row
layout, a per-item card, a row action cluster. It sits beside its consumers, at the tier
those consumers share:

```
components/{Scope}/{Resource}/StockMatchGroups.vue    ← shared by two resource-tier cards
components/{Scope}/{Resource}/Index/RowActions.vue    ← used only by the Index page's lists
```

Two rules keep it distinguishable from a placeholder:

- **Its name must not collide with any placeholder identity** the page might list. A
  private component named `List.vue` would be resolved as the `List` content by any page
  that names it.
- **It is imported by relative path** (`./SkuAllocatingCard.vue`), never resolved. If it
  should be overridable per tier, it is not private — make it a placeholder and list it.

**Every component declares its registered name**, private or not, as
`{Resource}{Page}{Card}` in PascalCase — `OutletRestocksViewAllocationDetails`,
`OutletRestocksApproveSkuAllocatingCard`. Omit the page segment for a component resolved at
the resource tier (`OutletRestocksStockMatchGroups`). The name is what a devtools tree, a
warning trace and a test selector show, and a file path alone doesn't reach any of them:

```javascript
defineOptions({ name: 'OutletRestocksViewAllocationDetails', inheritAttrs: false })
```

### 2.4 Maximum Field Control Utilization

> [!IMPORTANT]
> **Custom UI components and forms MUST use the modular base field controls in
> [`FRONTENT/src/_fields/`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/)
> — resolved through `resolveFieldComponent(type, mode)` — instead of hand-rolling raw
> native or Quasar input controls.**

A `_fields/{type}/` folder owns three explicit SFCs (`Add.vue`, `Edit.vue`, `View.vue`) and
is the single place a given input's behaviour is defined. Reaching past it for a bare
`<q-input>` or `<q-select>` forks that behaviour: the search-threshold rule, the
option-filter debounce, the empty-value display text, and the add/edit/view symmetry all
silently stop applying to that one control.

**Resolve, never deep-import.** `resolveFieldComponent('select', 'add')` and
`import FieldSelectAdd from 'src/_fields/select/Add.vue'` render the same component
today and diverge the moment the type gains an alias, a prepared-props branch or a
replacement — only the resolved path follows it. The registry is built eagerly, so the
lookup is synchronous and the control never flashes empty:

```javascript
const QtyField = resolveFieldComponent('number', 'add')   // ✓ resolved once, at setup
```

Mounting one by hand has a prop contract of its own — `modelValue`, `record`, `header`, and
a `config` object that carries **everything else**, because the controls declare
`inheritAttrs: false` and a plain attribute on the placeholder is dropped. That contract,
and the full type catalogue, live in
[`_fields/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/REGISTRY.md).

**The `mode` argument follows the value, not the page.** `'add'` when the value does not
exist yet, `'edit'` when the control is amending one already loaded, `'view'` for read-only
display — the page's canonical name is irrelevant. An action route that pre-seeds an
existing comment from the record mounts `resolveFieldComponent('textarea', 'edit')` even
though the route creates rows, because the *value* is being amended. The wrong mode still
renders; what differs is seeding, clearability and empty-value handling.

**Reach for a raw Quasar control only when no `_fields` type fits** — and when that
happens, the correct move is usually to *add the type* (a new `_fields/{type}/` folder plus
its `TYPE_ALIASES` entries) rather than to inline a one-off.

### 2.5 Overriding a Whole Page

`usePageResolver` loads the base page contract `src/pages/{Scope}/{page}.js`, then scans
**6** page candidates under `_ui/{ui}/pages/` (first match wins):

| # | Path | Type |
|---|---|---|
| 1 | `{scope}/{resource}/{page}.vue` | Full Vue override |
| 2 | `{scope}/{resource}/{page}.js` | JS modifier |
| 3 | `{scope}/{page}.vue` | Scope-wide Vue override |
| 4 | `{scope}/{page}.js` | Scope-wide JS modifier |
| 5 | `{page}.vue` | UI-wide Vue override |
| 6 | `{page}.js` | UI-wide JS modifier |

On a custom `resource` / `record` sub-route, `{page}` is the normalized `pageSlug`, so the
page override lives at `_ui/{ui}/pages/{scope}/{resource}/MyCustomPage.js`. The framework
layer does **not** need a matching `src/pages/{Scope}/MyCustomPage.js`: when that base
contract is missing, the resolver falls back to `resource.js` / `record.js`, so the
standard defaults (`PageHeader`, …) still apply.

A page JS modifier is the preferred tool — it declares *which* placeholders render and
hands each its props (§5). A full-page `.vue` override is the **last resort**: it replaces
the page body outright, bypassing the section/content layout, and loses every downstream
tier of overridability at once.

---


---

⬑ Back to **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**.
