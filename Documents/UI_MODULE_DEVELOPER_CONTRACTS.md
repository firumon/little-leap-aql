# 3-Layer UI — Page Contracts, Imports & Reactivity

> Part of **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**. Page contracts and `Props<Identity>`, the strict import boundaries, reactivity rules and the prop-drilling chain.

---

## 5. Page Contracts — `Props<Identity>` Targeted Props

`Page.vue` binds one flat `pageProps` to **every** placeholder, and each placeholder drills
`$attrs` down to whatever it mounts. `Props<Identity>` carves targeted namespaces out of
that same flat bag:

```javascript
// _ui/{Ui}/pages/{Scope}/{Resource}/Index.js
export default {
  sections: ['PageHeader', 'MetricCards', 'FilterInput', 'ListSwitcher'],
  contents: ['List'],

  PropsSection:    { dense: true },               // broadcast: every section
  PropsContent:    { flat: true },                // broadcast: every content
  PropsAction:     { dense: true },               // broadcast: every action
  PropsPageHeader: { title: "Today's Work" },     // just PageHeader
  PropsList:       { layout: ['label'] },         // just the List content
  PropsListToday:  { perPage: 50 }                // just the per-view ListToday hop
}
```

> [!IMPORTANT]
> `sections`/`contents` **REPLACE the base contract's arrays; they do not extend them.**
> Omitting `'PageHeader'` drops the page title and back arrow. Always re-list everything
> still wanted.
>
> **The `Props<Identity>` block is spread FLAT onto the target.** `ListToday` reads
> `props.perPage` — never `props.PropsListToday.perPage`.

### 5.1 Precedence

`drilled $attrs → Props<Kind> broadcast → Props<Identity> → JS modifier` (later wins). The
JS modifier stays final, matching every other override in the system.

### 5.2 Rules

- **Keys are never stripped once consumed** — every `Props*` key rides `$attrs` all the way
  down, so a component nested three levels deep can still claim its own block.
- **Key matching is case-insensitive.**
- **A block may be a function** — evaluated with the live props bag, so it can read the
  active view's already-filtered `items` and re-sort them. A static object cannot see rows.
- **The whole BLOCK is the function, never one key inside it.** A function sitting on a
  single key is passed through untouched and reaches a `String` prop as a closure. This is
  the exact mechanism for forwarding container layout tokens down into nested section
  cards that render their own sub-cards:
  ```javascript
  PropsCard: (pageProps) => ({ title: 'Allocation Details', gutter: pageProps.gutter })  // ✓
  PropsCard: { gutter: (pageProps) => pageProps.gutter }                                  // ✗
  ```
- **Non-object blocks are ignored**, so a stray string can never be spread onto a component.

### 5.3 Prefer a `Props<Identity>` block over a standalone `.js` modifier file

> [!IMPORTANT]
> **A plain prop bag does not need its own file.** If a customization is only *values* —
> labels, colours, layout arrays, per-item resolver functions, sorted `items` — declare it
> as a `Props<Identity>` block in the page contract, where the whole page's behaviour reads
> in one place. Create a `{Placeholder}.js` modifier only when the file earns its existence:

| Create a file when… | Example |
|---|---|
| It mounts a **component** as a prop value | supplying `btn: SomeActionButtons` |
| It needs the modifier **context** | `(props, { pageState, resourceRecord, resourceConfig }) => …` |
| It must apply **across pages** of a resource, or scope-wide | gating a FAB on every page of a resource |
| It must **outrank** a `Props<Identity>` block declared by the page | see §5.1's precedence chain |

There is a reactivity reason behind the split, not just tidiness: **a JS modifier is
resolved once and cached**, so anything derived from rows must not live in one. Constants
and component values in the file; anything read off the store in a `Props<Identity>` block.

### 5.4 Page contract props

`pageProps` is one flat object `v-bind`-ed onto **every** placeholder on the page:

| Prop | Type | Description |
|---|---|---|
| `page` | String | `'index'` \| `'view'` \| `'add'` \| `'edit'` \| `'action'` \| custom slug |
| `scope` | String | route scope |
| `resource` | String | resource slug from the route |
| `uiName` | String | resolved `customUIName` |
| `gutter` | String | Quasar spacing token for the page's vertical gutter |
| `loading` | Boolean | record/list loading, already **unwrapped** |
| `noActions` | Boolean | `true` suppresses the whole `<Action action="PageAction">` mount |
| `noReports` | Boolean | `true` suppresses only the report cluster, keeping the CRUD FABs |

> [!IMPORTANT]
> **`pageProps` carries no form state.** Form values, validation, saving/submitting flags
> and every save/submit handler live in `pageState` (§6.2, §13.5, `UI_PAGE_STATE.md`).

### 5.5 Conventions every contract follows

Four decisions recur on every page of every module. Make them the same way each time.

**Head the file with a docblock stating what the page is for**, which placeholder belongs
to which step, and why anything sits at the tier it sits at. A contract is the one file
that explains a page's shape; a reader who has to open five components to learn the order
of a wizard has been failed by the contract.

**A multi-step contract carries the step map in that docblock** — every contract, including
`Add.js`, not only the action routes. The contract is where the step *assignment* lives
(`PropsAdjustItems: { step: 2 }`), so it is where the map is readable; `PageAction.js`'s own
docblock (§13.6) carries the *button* table for each step. Two halves of one flow, each
documented where it is decided:

```
 * step 1  outlet + mode   →  [ Cancel ] [ Continue       ]
 * step 2  item lines      →  [ Back   ] [ Continue       ]
 * step 3  review + comment→  [ Back   ] [ Submit Request ]
```

**Suppress the header's reload control on any page whose data is owned by `pageState`:**

```javascript
PropsPageHeader: { reload: false }
```

Add, Edit and every action route qualify. Reloading mid-form discards what the user typed
and re-seeds the node underneath them; the control invites a data loss the page cannot
undo. An Index or View page keeps it.

**Title an action or custom sub-route explicitly, by the verb it performs** — `'Approve Restock'`,
`'Confirm Delivery'`, `'Reallocate Stock'`. A custom sub-route has no canonical page name to
humanize, and the reader arrived from a list and needs to know what they walked into.

**An action route has no record loader, so its first content is the hydration point.**
`usePageResolver` loads no record for an `_action/:action` route, and such a page usually
has no `Create`/`Update` content to seed `pageState` — an approval does not edit the
request's fields, it decides where its stock comes from. The page's composable owns both
the fetch and the seeding, and the **first content the contract names** is where that
composable is first called. State this in the contract's docblock, so the load order is
readable without opening the card.

---

## 6. Strict Import Boundaries

> Full detail — every layer's rules stated together with worked examples — lives in
> [UI_RESOURCE_DOMAIN_LOGIC.md §6](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).
> This section carries the injection-relay pattern in full since it's the piece a component
> author reaches for directly while authoring UI files.

> [!IMPORTANT]
> **Enforced one-way dependency chain — zero layer-bypassing:**
> ```
> UI Component (.vue)
>    │  imports ONLY UI Composables — never inject() directly, never a Core Composable,
>    │  never a service/store
>    ▼
> UI Composable (_ui/{Ui}/composables/{Scope}/{Resource}/{Page}/)
>    │  owns inject() (the context relay, §6.2) + presentation assembly
>    │  imports Resource Composables + generic Core Composables (identity, navigation)
>    ▼
> Resource Composable (src/_resource/{Scope}/{Resource}/)
>    │  domain/workflow logic, UI-agnostic, pure
>    │  imports only generic Core Composables — never a store/service directly
>    ▼
> Core Composables (src/composables/)
>    │  generic identity/navigation reads, resolvers — resource-agnostic
>    ▼
> Stores / Infrastructure (Pinia stores, services)
> ```

### 6.1 Rules per layer

- **UI Components** (`.vue` files under `_ui/{Ui}/components/`) import **only** UI
  Composables. No direct generic Core Composable call, no direct `inject('resourceRecord')`
  — every one of those is relayed through a UI Composable, with zero exceptions, even for
  generic identity/navigation reads that carry no resource content.
- **UI Composables** may import Resource Composables and generic Core Composables. They
  must never import a Pinia store or a service module directly.
- **Resource Composables** contain only domain logic. They must never import a store or
  service directly, and must never import anything under `_ui/`.
- Page contracts and JS modifiers are **exempt from the "no direct inject" clause** — they
  already receive `{ pageState, resourceRecord, resourceConfig }` as function parameters
  from the resolver (they run outside any component's `setup()` and never called `inject()`
  to begin with). They still may only import UI/Resource Composables.

### 6.2 The injection-relay pattern

One **UI Composable per page** (Index/Add/Edit/View/action-route) owns every `inject()`
call that page's components need. Every `.vue` component under that page's `_ui/` tree
calls it instead of injecting directly:

```
_ui/{Ui}/composables/{Scope}/{Resource}/{Page}/use{Resource}Context.js
_ui/{Ui}/components/{Scope}/{Resource}/{Page}/{SomeCard}.vue
```

```javascript
// _ui/{Ui}/composables/{Scope}/{Resource}/{Page}/use{Resource}Context.js
import { inject, computed } from 'vue'

export function use{Resource}Context () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const pageState      = inject('pageState', null)

  return {
    record:  computed(() => resourceRecord?.record?.value || null),
    config:  computed(() => resourceConfig?.config?.value || null),
    pageState
  }
}
```

```html
<!-- _ui/{Ui}/components/{Scope}/{Resource}/{Page}/{SomeCard}.vue -->
<script setup>
import { use{Resource}Context } from 'src/_ui/{Ui}/composables/{Scope}/{Resource}/{Page}/use{Resource}Context'
defineOptions({ name: '{Resource}{Page}{SomeCard}' })
const { record } = use{Resource}Context()
</script>
```

A resource-wide helper that has no page-specific injection needs may still live directly
under `_ui/{Ui}/composables/{Scope}/{Resource}/` (per the folder tree in §2) — the
page-scoped subfolder is specifically for the injection relay and anything that depends on
it.

A component never calls `inject()` itself, and never imports a generic identity/navigation
Core Composable directly — both are relayed through this one file per resource.

### 6.3 Where a shared UI Composable goes — the placement ladder

A UI Composable sits at **the same tier as the most general component that imports it** —
never higher, never lower. This is §3.1's "share by placement, not by copying" applied to
`composables/` instead of `components/`, and it uses the same tier names:

| Consumers | Folder |
|---|---|
| One page of one resource | `_ui/{Ui}/composables/{Scope}/{Resource}/{Page}/` |
| Two or more pages of one resource | `_ui/{Ui}/composables/{Scope}/{Resource}/` |
| Two or more resources in one feature family | `_ui/{Ui}/composables/{Scope}/{Feature}/` |
| Every resource in a scope | `_ui/{Ui}/composables/{Scope}/` |

The test for "does this inject, so is it page-scoped?" is **which pages provide the
context**, not whether `inject()` appears in the file. One providing page means
page-scoped. Two pages providing the same context and resolving the same components means
the composable belongs at the tier those shared components already sit at — see
[UI_RESOURCE_DOMAIN_LOGIC.md §6.1–6.2](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).

`OutletRestocks` is the worked example: `Approve.js` and `Reallocate.js` both resolve
`WarehouseAndLocation` / `ItemAllocating` / `ReviewAllocating` / `ReviewPending` from the
resource tier, so `useRestockApproval` sits at the feature tier
(`composables/Operation/Outlets/`) rather than under either page. A `.vue` file has one
import line per composable, so a page-scoped copy of the composable would have forced a
page-scoped copy of all four cards — the drift §3.1 exists to prevent.

The ladder applies to Layer 3 only. A Resource Composable is always
`src/_resource/{Scope}/{Resource}/` however many resources read it (§4.4).

---

## 11. Reactivity Contracts

These are the rules that break silently.

**1. Never spread an enriched record.** `resourceRecord.record`/`.records` hand out cached
reactive objects built entirely from `Object.defineProperty` getters — no own data
properties. Object spread, `Object.assign({}, record)`, and `JSON.parse(JSON.stringify())`
copy **enumerable own properties only**; every relation getter is non-enumerable, so a
spread yields the header fields and strips every relation reference silently.

```javascript
out.push({ ...row, overdueDays: days })   // ✗ strips getters, freezes values
row.overdueDays = days; out.push(row)     // ✓ keeps the enriched reference
```

`Array.prototype.filter`/`sort` are safe — they carry references through. Only *copying*
breaks the contract.

**2. An enriched relation can be `null`.** `childRecordsByResource` and `$Relation` getters
are built by the same enrichment, which yields `null` for a row whose `Code` has not landed
yet. Normalize to an object **before** any predicate, or a `null` passes one guard and is
dereferenced by the next:

```javascript
const asRow = (value) => (value && typeof value === 'object' ? value : {})
rows.map(asRow).filter((row) => text(row.Code) && isActive(row))
```

**3. Modifier functions run once; function-valued props run per render.** See §3.3.

**4. A getter is re-read; a literal is latched.** `useActionResolver` merges a modifier's
result inside a `computed`, so an `actions` array or a `submitLabel` declared as a **getter**
is re-evaluated on every recompute and its reads of `pageState.meta.currentStep` are
tracked. A literal array latches the first step's button set forever.

**5. Never allocate props inline in a template.** A literal `:fields="['A','B']"` builds a
new array every render, and components watch such props **by reference** — a fresh identity
re-runs resolvers and default-seeding on every keystroke. Hoist to a module constant, or use
a `computed` when the value is genuinely data-derived. The same applies to an inline
`:style="{ … }"` object.

**6. Watch on primitives, never on array literals.** `watch` compares a getter's result with
`Object.is`, so a getter returning a fresh array re-fires on every reactive read. Resolvers
key their scan on a joined string for exactly this reason.

---

## 12. Prop Drilling Chain & Sub-Component Attribute Handling

> [!IMPORTANT]
> `inheritAttrs: false` is not mandatory on every component in a drill path — it is
> mandatory on the **leaf** component only.

### 12.1 Intermediate containers vs. leaf components

- **Intermediate containers** (components that pass props down to a nested child, and do not
  themselves need to filter what reaches the DOM) **preserve attribute/prop propagation** —
  leave `inheritAttrs` at its default (`true`) so `$attrs` reaches the child component
  automatically without a manual `v-bind="$attrs"` at every hop.
- **Leaf/terminal components** (the final component in the chain that actually renders a DOM
  root) explicitly configure `defineOptions({ inheritAttrs: false })` **or** `true`, based on
  that component's own DOM-binding requirements — this is where a stray object value (e.g. a
  `Props<Identity>` block) leaking onto the DOM as `propspageheader="[object Object]"` is
  actually prevented.

```html
<!-- Intermediate container — default inheritAttrs, props flow through untouched -->
<script setup>
defineOptions({ name: 'SwitcherContainer' })
</script>
<template>
  <SwitcherItem v-for="item in items" :key="item.key" :item="item" />
</template>
```

```html
<!-- Leaf — explicitly disables fallthrough because it has its own DOM root needing
     specific bindings, and re-binds $attrs.class/$attrs.style manually -->
<script setup>
defineOptions({ name: 'SwitcherItem', inheritAttrs: false })
</script>
<template>
  <q-chip :class="$attrs.class" v-bind="$attrs">{{ label }}</q-chip>
</template>
```

**A resolved card is a leaf even when it renders children.** The common case in a module is
a card whose root is a plain layout `<div :class="gutterClass">` wrapping child components.
It looks like an intermediate container, but it renders a **DOM root of its own**, and it is
the component the resolver mounts — so every `Props<Identity>` key on the page is in its
`$attrs` and would land on that div as `propsitems="[object Object]"`. It sets
`inheritAttrs: false`. The nested children it mounts receive their data as declared props,
not through fallthrough, so nothing is lost by stopping it there.

The genuine intermediate case is narrower than it looks: a component that adds no DOM root
of its own and exists only to forward — a wrapper re-emitting one child. That one keeps the
default.

Do not apply `inheritAttrs: false` reflexively to every component "just in case" — but a
resolver-mounted card with a layout root is not "just in case", it is the leaf.

### 12.2 The div-wrap trap

When a `.vue` override still wraps a framework presentation component, never add a bare
`<div>` to stop fallthrough — it swallows clicks, badges and permission props:

```html
<!-- ✗ Swallows back/reload actions, permission controls, status badges -->
<template><div><GenericHeaderPanel title="Custom Title" /></div></template>

<!-- ✓ Disable fallthrough, bind $attrs BEFORE your own props -->
<template><GenericHeaderPanel v-bind="$attrs" title="Custom Title" /></template>
<script setup>
defineOptions({ inheritAttrs: false })
</script>
```

---


---

⬑ Back to **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**.
