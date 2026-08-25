# 3-Layer UI — Resource UI Module Developer Guide

The canonical blueprint for generating a complete resource UI module — Index, Add, Edit,
View, and any action route it needs — under the **3-Layer UI Architecture** (`FRONTENT/src/_ui/`). This document plus a
module's business workflow specification is everything a developer, or an AI agent, needs
to produce a module.

It covers the resolver mechanics, folder layout, page contracts, page-by-page blueprints
and the generation rules directly. Three things it deliberately does **not** restate,
because they are catalogues that go stale the moment they are duplicated:

| Subsystem | Canonical spec |
|---|---|
| Implemented `_fields` types, and how to mount one by hand | [`_fields/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/REGISTRY.md) |
| Reusable component bases — every generic Section/Content/app component, its props and its hide rules | [`components/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md) |
| A UI's own design tokens — card shell, motion, spacing, tap targets | `_ui/{UiName}/_config/config.md` (e.g. [`_ui/AQL/_config/config.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_ui/AQL/_config/config.md)) |

Plus the subsystem specs this guide summarizes inline and links out to for full detail:

| Subsystem | Canonical spec |
|---|---|
| Resource domain logic, import boundaries & payload chains | [UI_RESOURCE_DOMAIN_LOGIC.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md) |
| Pages & Sections | [UI_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_AND_SECTION_SYSTEM.md) |
| Contents | [UI_CONTENT_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CONTENT_SYSTEM.md) |
| Actions | [UI_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_ACTION_SYSTEM.md) |
| Create / Update forms | [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md) |
| View content | [UI_VIEW_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_VIEW_SYSTEM.md) |
| Page state / submission | [UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md) |
| Resource schema (`_fields`, `Relations`) | [SCHEMA_RESOURCE_COLUMNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SCHEMA_RESOURCE_COLUMNS.md) |
| Architecture constraints | [CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) |

---

## 0. Build to the Workflow

> [!IMPORTANT]
> A module's shape is decided entirely by its business workflow instructions. This guide
> supplies every piece needed to build any resource UI module correctly; which pieces a
> given module actually uses depends on what that module's workflow calls for.

A flat toggle workflow needs a single-view form, a generic View grid, and one domain
composable. A multi-step, multi-actor workflow needs a wizard, action routes, several
stateful composables, and business-concept View cards. Both are produced by following this
guide against the workflow at hand. Apply the sections a module's workflow actually calls
for; skip the machinery it has no use for (a flat-toggle resource has no wizard step, so
§13.6 simply doesn't apply to it) — never build in complexity the workflow didn't ask for,
and never omit complexity it did ask for.

A module that starts out flat and later grows a second workflow branch, an approval step,
or a business-concept View card is not "upgrading tiers" — it is following the same guide
against its resource's now-larger workflow.

---

## 1. The Model in One Picture

Every resource page is assembled at runtime from **placeholders**. A placeholder is a
generic component that is told *what* it stands for and resolves *which* component
actually renders through a registry scan.

```
vue-router
   │
   └─ src/pages/Page.vue ──── usePageResolver ──┬─ base page contract   src/pages/{Scope}/{page}.js
                                                └─ page override scan   _ui/{Ui}/pages/…            (§2.5)
        │
        ├─ <ResourceBreadcrumb />                       always, never overridable via _ui
        │
        ├─ .aql-page-body
        │     ├─ <Section section="PageHeader"  v-bind="pageProps" />   → useSectionResolver
        │     ├─ <Section section="…"           v-bind="pageProps" />
        │     └─ <AqlContentWrapper>
        │           └─ <Content content="List"  v-bind="pageProps" />   → useContentResolver
        │
        └─ <Action action="PageAction" v-bind="pageProps" />            → useActionResolver
```

Three paradigms, three resolvers, three base folders — **one shared 10-tier `_ui/`
override model** (§3):

| Paradigm | Placeholder | Identity prop | Resolver | Framework base folder |
|---|---|---|---|---|
| Section | `components/Section.vue` (`AqlSection`) | `section` | `useSectionResolver.js` | `src/components/sections/` |
| Content | `components/Content.vue` (`AqlContent`) | `content` | `useContentResolver.js` | `src/components/contents/` |
| Action | `components/Action.vue` (`AqlAction`) | `action` | `useActionResolver.js` | `src/components/actions/` |

A file's **folder is its resolution contract**. A section placed in `actions/` resolves as
nothing. Never cross them.

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

## 3. The 10-Tier Lookup

Identical in shape for all three resolvers (Section, Content, Action). **First match wins,
most specific first.** `{P}` is the lowercased placeholder name.

| # | Tier | Path under `_ui/{ui}/components/` | Type |
|---|---|---|---|
| 1 | resource + page | `{scope}/{resource}/{page}/{P}.vue` | Vue override |
| 2 | resource + page | `{scope}/{resource}/{page}/{P}.js` | JS modifier |
| 3 | resource | `{scope}/{resource}/{P}.vue` | Vue override |
| 4 | resource | `{scope}/{resource}/{P}.js` | JS modifier |
| 5 | page | `{scope}/{page}/{P}.vue` | Vue override |
| 6 | page | `{scope}/{page}/{P}.js` | JS modifier |
| 7 | scope-wide | `{scope}/{P}.vue` | Vue override |
| 8 | scope-wide | `{scope}/{P}.js` | JS modifier |
| 9 | ui-wide | `{P}.vue` | Vue override |
| 10 | ui-wide | `{P}.js` | JS modifier |

**A `.vue` and a `.js` at the same tier are mutually exclusive** — the `.vue` wins and the
`.js` is never read.

### 3.1 Choosing a tier — share by placement, not by copying

The tier a file sits at *is* the statement of who it serves. Put a placeholder at the
**most general tier every page that needs it can reach**, and both pages resolve the same
file with no imports, no copies and no renames:

| The card is needed by… | Tier | Path |
|---|---|---|
| one page only | 1/2 | `{resource}/{page}/{P}.vue` |
| two or more pages of one resource | 3/4 | `{resource}/{P}.vue` |
| every resource in a scope | 7/8 | `{scope}/{P}.vue` |

This is the mechanism behind the shared-form rule (§13.4) and behind reusing one decision
across two action routes: an approval page and a later reallocation page collect the *same*
decision, so their cards live at tier 3 and both contracts simply name them. Anything
genuinely page-only goes in the page folder, which outranks the resource tier.

Two independently authored components for one decision drift the moment one gets a control
the other doesn't. Sharing by placement makes drift structurally impossible instead of
relying on discipline to prevent it.

**The cards share; the sticky bar does not.** Two routes collecting one decision resolve
one set of content cards and keep **two separate `PageAction.js` files**, because what
actually differs between them is precisely what the bar owns: the verb on the primary
button, the permission set, and the payload builder. A single bar branching on which route
mounted it re-introduces, in one file, the divergence the shared cards just eliminated —
and the branch has to be re-read on every recompute to stay correct. Duplicating a getter
and a `permitted()` is the cheaper half.

### 3.2 Two-step resolution

**Step 1 — find the BASE component:**

1. `_ui/{ui}/components/{sections|contents|actions}/{P}.vue` — UI-wide generic base.
2. `src/components/{sections|contents|actions}/{P}.vue` — framework default base.
3. Otherwise, **the first `.vue` candidate from the 10-tier list is promoted to base.**
4. Otherwise, the caller-supplied `defaultComponent`.
5. Otherwise, the placeholder renders its "… Not Defined" warning card.

> [!IMPORTANT]
> **Step 1.3 is how you invent a brand-new placeholder with no framework base at all.**
> Drop `_ui/{Ui}/components/{Scope}/{Resource}/{Name}.vue`, list `'{Name}'` in the page's
> `sections`/`contents`, and it renders. No registration anywhere.

**Step 2 — scan the 10 tiers** for an override or modifier of that base.

### 3.3 Vue override vs JS modifier

| | Vue override (`.vue`) | JS modifier (`.js`) |
|---|---|---|
| Effect | **Replaces** the base component's template entirely | **Keeps** the base component, changes the props fed to it |
| Receives | `finalProps` unmodified, readable via `$attrs` | `(currentProps, ctx)` and returns a props object |
| Use when | The layout itself is wrong | Only labels / colours / data / visibility are wrong |
| Precedence | Wins over a `.js` at the same tier | Final layer of the props merge (§5) |

A JS modifier exports **either** a plain object **or** a function:

```javascript
// ctx = { pageState, resourceRecord, resourceConfig } — the RAW injected objects.
export default (currentProps, { pageState, resourceRecord, resourceConfig }) => ({
  // A FUNCTION-valued prop is re-evaluated per render by the receiving component
  // through evaluateProp — which is how a modifier stays reactive.
  title: (record) => `Record: ${record?.Name || 'Unnamed'}`,
  chipColor: 'accent'
})
```

> [!IMPORTANT]
> **A modifier function is evaluated ONCE per resolve, not per render.** If a value must
> track the record, return it as a **function-valued prop** — never compute it eagerly
> inside the modifier. This applies to *every* read, including permission reads: an
> `allowed()` call taken at resolve time, before the auth payload lands, latches `false`
> for the life of the page.
>
> ```javascript
> // ✗ Frozen at whatever Progress was on the first resolve
> export default (props, { resourceRecord }) => ({
>   show: resourceRecord?.record?.value?.Progress === 'PLANNED'
> })
>
> // ✓ Re-evaluated per render through evaluateProp
> export default { show: (record) => record?.Progress === 'PLANNED' }
> ```

### 3.4 `evaluateProp` — the closure contract

Customizable props are typed `[Type, Function]`, and the receiving component resolves them
through `evaluateProp(value, resourceRecord, resourceConfig)`, which calls the closure with
**plain unwrapped objects**:

```javascript
title: (record, config) => `${config?.name}: ${record?.Code}`   // ✓
title: (record) => record.value.Code                            // ✗ never call .value
```

> [!NOTE]
> **Per-item list resolvers are NOT `evaluateProp` props.** `label`, `caption`, `chip`,
> `chipColor`, `highlightColor`, `btn` on `List`/`AppList` are `(item) => value` resolvers,
> called once per row. Do not route them through `evaluateProp`.

### 3.5 When a repeated item becomes its own component

**A `v-for` body longer than a few lines becomes its own component.** Two things follow
from the split, and both are the reason for it:

- the parent stays a thin list — the loop, the empty state, and nothing else;
- the item card becomes **independently overridable at any of the 10 tiers**, so a tenant
  can restyle one card without replacing the list that holds it.

The item component is presentational: figures arrive already computed on its one `group` /
`item` prop, every control emits upward, and it performs no arithmetic of its own. That is
what guarantees the number it renders is the number the payload carries.

Whether it is a placeholder or a private sub-component (§2.3) depends only on whether any
page names it.

---

## 4. Correct Business Logic Placement — The 3-Layer UI Boundary

> Full detail — folder structure, every rule, and worked examples — lives in
> [UI_RESOURCE_DOMAIN_LOGIC.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).
> This section is the summary a module generator needs inline; read the linked doc before
> writing any `src/_resource/` file.

### 4.1 The boundary

```
src/components/, src/composables/, src/pages/        Layer 1 — Core System Infrastructure
src/_resource/{Scope}/{Resource}/                     Layer 2 — Resource Domain & Business Logic
src/components/{sections,contents,actions}/           Layer 3 — UI Presentation
src/_ui/{Ui}/**  (one folder per UI name)
```

Business logic is UI-agnostic and lives outside the UI tree entirely — in `src/_resource/`,
never inside a `_ui/{Ui}/` presentation folder — so every UI, whichever `CustomUIName` it
carries, consumes the exact same workflow logic. Import direction is strictly one-way,
Layer 3 → Layer 2 → Layer 1, with no per-UI override of domain logic (business differences
are data/config, never a second code path).

### 4.2 What belongs in `src/_resource/`

Progress/workflow vocabularies, state-transition predicates, stateful workflow aggregates
that back a wizard/action page, and payload/request builders — everything that answers
"what can this record do right now, and why." Full list:
[UI_RESOURCE_DOMAIN_LOGIC.md §3](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).

### 4.3 What stays in `_ui/{Ui}/composables/`

Presentation-only helpers that assemble display from a Layer-2 predicate but are not
themselves a business rule — row presets, per-view formatting, and the injection-relay
composable (§6.2). Full list:
[UI_RESOURCE_DOMAIN_LOGIC.md §4](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).

### 4.4 Shape

Named pure exports + a `use{Feature}()` wrapper — same shape either layer uses. Every
Layer 2 export takes `record`/`records` **only** — never a `config` parameter. Each
`src/_resource/{Scope}/{Resource}/` composable hardcodes its own resource name and calls
`useResourceConfig('{ThatName}')` internally whenever it needs headers, permissions, or
`allowed()` — never route-derived, never passed in by the caller. Multi-resource logic is
composed by importing multiple named domain modules from the UI side, not by parameterizing
one function over different configs. See
[UI_RESOURCE_DOMAIN_LOGIC.md §3.2 and §5](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md)
for the full rule and worked example.

### 4.4b The domain composition cascade

Every resource — including child relations and configuration entities
(`OutletOperatingRules`, `OutletStorages`) — gets its own Layer 2 module, and downstream
resources consume upstream ones **in series** rather than reaching past them to the store.
Three rules govern the chain, and the module you are generating must satisfy all three:

1. **No bypass links, no hardcoded defaults.** A resource default comes from
   `useResourceConfig(RESOURCE_NAME).defaultValues`, never a literal in a consumer.
2. **Non-destructive entity travel.** An enricher spreads the source row first and adds
   derived keys beside it; Layer 3 picks what to render.
3. **Pre-indexed lookups.** The owning resource publishes single, composite and rollup
   `Map` indexes built in one pass; consumers read them in `O(1)`.

Full rule, index schemas and self-check:
[UI_RESOURCE_DOMAIN_LOGIC.md §10](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).

**Discovering a gap mid-build.** If, while building a page, you find that a domain helper,
aggregation or cross-resource projection is missing from Layer 2, do NOT write it in the
page or its UI composable. Name the gap, say which resource module owns it, ask the user to
confirm, then implement it in that Layer 2 module to the full invariant set and consume it
from the page. Protocol:
[UI_RESOURCE_DOMAIN_LOGIC.md §10.6](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).

### 4.5 One workflow vocabulary per resource

A resource's states, their order, and their **label, colour and icon** are declared once, in
its domain layer, and every consumer reads them from there — the funnel's legend, a list
row's chip, a View card's badge, an action's gate.

```javascript
export const WORKFLOW_STATES  = [DRAFT, PENDING_APPROVAL, /* … */]
export const IN_FLIGHT_STATES = [/* terminal states deliberately absent */]
export function progressLabel (state) { /* … */ }
export function progressColor (state) { /* … */ }
export function progressIcon  (state) { /* … */ }
```

A component picking its own colour for a state is how a funnel segment and the row beneath
it end up disagreeing about what "Partially Delivered" looks like. The same rule covers
per-item states (allocated / partial / none / cancelled): one icon+colour+label function,
with the **settled case tested first** — a cancelled line reported as merely "not
allocated" hides that the shortfall was already written off.

Three ways this rule gets broken, all of which look reasonable while being written:

- **A per-page copy.** A View page whose cards render *both* the record's states and its
  line items' states needs a map covering both — so it declares its own, and a comment
  saying it must be "kept in step" with the original. Two maps that must be kept in step
  are one map that isn't. **Extend the single vocabulary file with the item-row states**
  and have both pages read it; the parent and child vocabularies sharing a value (both have
  a `DELIVERED`) is the reason they must not be shown differently on one screen.
- **A widget's `items` payload.** The rule governs the colour a widget *emits*, not only
  the chips and badges a template renders. A count card standing for exactly one state
  reads `progressColor(state)`; only a card standing for a **set** of states — a combined
  fulfilment queue — names its own colour, and says in a comment which set it covers.
- **A threshold table.** Ageing bands, urgency cut-offs and any other numeric scale that a
  widget *and* a row chip both read are one exported table in the vocabulary file, not an
  array literal in each. See §9.2.

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

## 7. Content — Lists, Rows, and the View Blueprint

Framework bases in `src/components/contents/` include `List.vue`, `View.vue`, `Create.vue`,
`Update.vue`, `FormRecord.vue`, `FormChild.vue`, `ViewRecord.vue`. Their full prop surfaces
are in [`components/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md).
Resolution mirrors §3.

### 7.1 Per-active-view list overrides — `List<ViewName>`

When a list view is active, `contents/List.vue` sets its resolver identity to
``List${toPascalCase(activeViewName)}`` instead of plain `'List'`.

```
APP.Resources.ListViews  →  [{ "name": "Today", … }, { "name": "Overdue", … }]
                                      │
active view "Today"  ──►  content identity "ListToday"
                                      │
       _ui/{Ui}/components/{Scope}/{Resource}/Index/ListToday.vue    (Vue override)
       _ui/{Ui}/components/{Scope}/{Resource}/Index/ListToday.js     (JS modifier)
```

> [!IMPORTANT]
> The view's `name` in the sheet is the **bare bucket** (`"Today"`), not `"ListToday"`. A
> view named `"ListToday"` looks for `ListListToday` and matches nothing.

**Start with a `PropsList<ViewName>` block** (§5.3) and fall back to a file only when it
earns one — mounting a component as a prop value, or needing a template.

**A `.vue` per-view override must read rows from both places.** `items` arrives as a
declared prop from the resolver's final bag, but the override is also mounted with the
drilled attrs, and which of the two carries the rows depends on how far up the chain they
were set:

```javascript
const incoming = computed(() => (props.items?.length ? props.items : (attrs.items || [])))
```

**A view that unions two states divides, it does not tab.** When one queue is genuinely one
job to the person doing it — approved and partially-delivered are both "stock committed,
not yet at the outlet" — the list view unions them and the override restores the
distinction as a labelled divider (`SectionDividerLabel`) between two groups. Splitting
them into two pills makes the user check two lists to answer one question. When it does:

- **one consolidated empty state for the whole view**, not one per group — two "nothing here"
  cards stacked read as two failures instead of one clear queue. If one sub-list has no items,
  hide its section divider and space completely; if *all* sub-lists are empty, show a single
  clean empty-text box (`empty-text="Nothing awaiting delivery."`);
- **drop any per-row chip the divider now carries.** The divider already names the state; a
  chip repeating the heading on every row is noise. Keep what varies per row.

**The same rule applies inside a card.** A review step reporting a split outcome — what is
being committed versus what is being written off — renders two labelled lists, not one list
with a status column. A mobile row has no width to make that distinction legible, and the
two are different *kinds* of outcome (deferred work versus work that will never happen),
which a column of chips flattens into a detail.

### 7.2 List rows — presentation, ordering, and what a row says

Before writing a single resolver, check §9.4: the list strategy already infers
label/caption/chip/meta from the resource's headers and relations. Override only what the
inference gets wrong.

When a resource's queues do need presets, they follow one shape — a shared preset function
per view, exported from the resource's composable and applied as a function-valued
`Props<Identity>` block, so the same row reads identically wherever it is rendered:

```javascript
PropsListPendingApproval: (props) => awaitingApprovalPreset(props.items)
```

**Personal queue scoping vs. upline record access policies.** A personal work queue (such
as `"My Drafts"`) must filter rows down to the active `userId` (`user.value?.id`). While
`RecordAccessPolicy: OWNER_AND_UPLINE` permits managers to read subordinates' rows, drafts
are editable only by their author. Without explicit `userId` scoping, a manager's draft
queue becomes cluttered with un-editable drafts from other people.

**Queue-intent caption derivation matrix.** A row's caption should state the exact fact
explaining why the row sits in this specific queue, rather than a generic record summary:

| Work queue | Primary caption content | Secondary detail |
|---|---|---|
| **Drafts** | `Date` (creation date) | Requester's private draft context |
| **Pending Approval** | `RequestedUser` + `SubmittedComment` | Who asked and why |
| **Needs Revision** | `RevisionRequiredComment` | The reviewer's exact instructions to change |
| **Approved / In Fulfilment** | `Date` + `ApprovedBy` or `ApprovedComment` | Committed date and approver context |
| **Partially Delivered** | `Date` + `DeliveredComment` | Outstanding delivery note |
| **Delivered / History** | `Date` + `DeliveredBy` | Final completion timestamp and actor |
| **Rejected** | `RejectedComment` | Rejection rationale |

**Ordering is a work order, not a preference:**

| Queue type | Order | Why |
|---|---|---|
| Awaiting someone's action | **oldest first** | the longest wait is the most urgent |
| Settled / history | **newest first** | the most recent completion is the interesting one |

**A settled row drops the urgency chip.** A colour-coded age chip is a queue position; on a
delivered or rejected row the same age is history, and only the plain "how long ago"
caption survives. The chip's *weight* carries the same distinction one step earlier: a
queue row's age chip is **outlined** (`chipOutline: true`) so a screen of them reads as a
scale rather than a wall of solid colour, and a row that keeps a solid chip is carrying a
state, not an age.

> [!IMPORTANT]
> **A preset sets an unwanted slot to explicit `null` — it does not omit it.** §9.4's
> inference is a *baseline* that explicit props layer over, so an omitted key is not "off",
> it re-admits whatever the list strategy inferred for that resource. A preset that means
> "this row has no badge" must say so:
>
> ```javascript
> chip: (row) => ageLabel(daysSince(settledAt(row))),
> chipColor: (row) => ageColor(daysSince(settledAt(row))),
> chipOutline: true,
> meta: null, badge: null, metaLabel: null, metaCaption: null   // ✓ suppressed, not omitted
> ```
>
> This is also why a preset that *re-enables* a slot for one view passes `undefined` rather
> than deleting the key — `undefined` falls back to the base preset's own value.

**Sort and age through a resolver with a documented fallback, never a bare stamp column.**
Not every row carries every stamp (a record migrated in, or created before the stamp
existed). Sorting on the raw column sinks all of those to the end however old they are, so
the list shows "85 days" below "Yesterday" while claiming to be ordered by age. Resolve the
stamp, fall back to the record's own date, and use the *same* reader for the sort and for
the displayed age.

**Never surface an unresolved raw identifier code in a row.** Stamp columns are not uniform
about this: some `*By` columns store a display name, others store a database user code
(`U0001`). Check which before putting one in a label or caption — a raw code renders as an
opaque string nobody can read. When the stamp holds a code, prefer the fact the reader
actually needs (the reason, the age) and leave "who" to the View page, where it can be
resolved.

### 7.3 Mobile-first row action clusters

A row's `btn` slot is the one place a list becomes interactive. Six rules govern it:

**1. Mobile width constraint — maximum 3, preferred 2 buttons.** Most users navigate on
mobile devices. Each button competes with the row's own content for screen width; exceeding
3 buttons forces record labels into multi-line text wrapping and collides chips with
captions. The standard pair is **1 View navigation button + 1 primary contextual next action**.

**2. Supply the View button explicitly.** `abstract/List.vue` deliberately makes a row
non-clickable once it carries a `btn`, so a row with buttons never has an ambiguous tap
target. While correct in general, adding row action buttons turns off whole-row tap
navigation — always put an icon-only `View` button back explicitly (`icon="visibility"`).

**3. Key the cluster on the record's state, never the active view.** A modifier-mounted `btn`
component is mounted with `item` and nothing else — `useContentResolver` returns props, not
slots, so the cluster cannot be told which view it is in. That constraint produces the right
rule anyway: a record offers Approve because it is pending approval, not because the reader
happens to be looking at a particular pill, and a unioned view (§7.1) holds rows in two
states that must offer two different clusters in the same list:

```javascript
const ACTIONS_BY_PROGRESS = {
  [DRAFT]:             [],
  [PENDING_APPROVAL]:  ['Approve'],
  [APPROVED]:          ['MarkDelivered'],
  [PARTIALLY_DELIVERED]: ['Reallocate', 'MarkDelivered']
}
```

This is a **whitelist of interest, not a permission list** — `useAdditionalActions` still
decides which of them the signed-in user may see (§8.5). Everything omitted stays available
on the record's View page.

**4. Prohibit destructive and reason-requiring actions on list rows.** An inline row action
must be one tap, non-destructive, and either navigate or commit something trivially
reversible. Therefore:
- an action needing a **written reason** (reject, request revision) belongs on the record or
  action page, not one tap from a scrolling list;
- a **destructive** action (cancel, delete) is never placed on a row;
- an action where the user **must inspect items first** (submit, resubmit) is off the row
  — the button that opens the review form (Edit) is the one that belongs there.

**5. Inline Edit buttons require state and ownership gates.** Inline Edit is a CRUD route
dispatched locally. It must fail closed on missing IDs, verifying both state eligibility
and strict ownership (`CreatedBy === user.value?.id`).

**6. Dispatch CRUD yourself, delegate workflow.** Edit and View are CRUD routes: the cluster
navigates them directly. Everything else is a workflow action and goes through
`AdditionalActionsButtons`, which owns eligibility. Render them as loose siblings at one
visual scale, never in a `q-btn-group` — see [`_config/config.md` §3.5](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_ui/AQL/_config/config.md).

### 7.4 The View Blueprint — Business-Concept Card Grouping

`contents/ViewRecord.vue` — a generic key-value grid over every header, extensible per
column via `ViewColumn<Col>` — is the right default for a simple, mostly-flat resource. It
stops being the right tool the moment a resource's data has real relational shape: line
items, allocations, a workflow history. Forcing that shape into a flat key-value grid reads
as a data dump instead of a summary.

The alternative: **replace `ViewRecord` outright with custom cards, one per business
concept**, using the base-promotion path (§3.2 step 1.3).

**Applying the blueprint to a new module:**

1. Does the resource have line items, allocations, multi-step workflow, or more than one
   *kind* of related fact (not just more columns)? If not, stay on `ViewRecord` +
   `ViewColumn<Col>` overrides — less code, stays in sync with the schema automatically.
2. If yes, name one card per business concept the record represents. Do not create a card
   that is just "the rest of the columns."
3. Back every card with one page-scoped UI Composable (§6.2), never per-card ad-hoc
   computeds.
4. Build every card on the shared shell (§10.1) and the authoring contract in §7.5.

**Canonical View Card Stacking Order:**

```
1. Action Request Banner   (RevisionRequiredBanner — instruction, only rendered when action is needed)
2. Parent Identity Card    (RestockHeader — who, what, when, current state)
3. Content Summary Card    (Items — what was requested / entered)
4. Operational Breakdown   (AllocationDetails — source bins, where stock is coming from / going)
5. Workflow History Card   (Workflow — chronological timeline of actual events)
```

**One composable, so cards cannot disagree.** All cards inject the same page-scoped UI
Composable, which calls the resource's domain composable (§4) for any derived state, and
read *projections* of one derived tree rather than each re-deriving grouping logic. Two
cards reading the identical derived structure means "what was requested" and "where it's
coming from" can never drift apart on screen.

Four rules the recurring cards each carry:

- **The identity card drops blank rows rather than padding them with em dashes.** A
  detail card reads better short, and a `Note: —` row states nothing while looking like it
  does. The two facts that *identify* the record are shown even when unresolved.
- **The disposition card morphs by phase and explains empty phases.** Before a workflow
  commits anything, there is no source behind any line — the card states each line's position
  and says, in one banner ("Stock is allocated once approved"), when the source will exist.
  After approval, it swaps to detailed warehouse and storage bin rows. The phase test is a
  domain predicate, never a raw `Progress` comparison written in the card.
- **The history timeline is chronological event history, not a checklist.** Order by the
  recorded timestamp (`...At`), not by canonical state order, so a record that went out for
  revision and came back reads in the order it actually happened. Stages never reached are
  **absent, not greyed out.** Which column holds which stamp is a map in the page composable,
  because a stamp prefix and its resulting state genuinely differ (submitting stamps
  `ProgressSubmitted*` but moves the record to `PENDING_APPROVAL`).
- **Pass container gutter tokens to nested section cards.** Compound cards that render
  internal product cards must accept `gutter` from `pageProps.gutter` and space their
  internal children consistently with the outer page rhythm (§5.2).

**Where View cards go in the contract.** A business-concept card set is declared in
`sections`, with `contents: []` — the second named exception to §9.1's
sections-are-not-record-dependent rule, alongside header-adjacent metrics. The trade is
explicit: `sections` render outside `<AqlContentWrapper>`, so **each card self-guards its
own loading, empty and missing-record states** (§10.4) instead of inheriting the wrapper's.
That is why the shared page composable exposes `pending` — every card reads it.

**Order the stack by what the reader must do.** A card that asks for an action leads; cards
that report one follow. A card that renders nothing in most states costs nothing at the top
(§10.4's `v-if` rule), and putting the one instruction on the page below three summaries
buries it.

**That leading card is the one place a page may break the neutral shell.** Exactly one card
per page may carry the UI's accent tint and rail (`accentCardClass` / `accentBorderStyle`,
§10.3), and only the one that asks for an action rather than reporting one — the page is
otherwise uniformly neutral, which is what makes the colour mean something. Two accented
cards on one page means neither is emphasised, and an accented card that merely *reports*
spends the page's only emphasis on a statement. It still uses the standard row grammar and
stagger; only the tint differs, so it reads as emphasis rather than as a differently-built
card.

### 7.5 Custom card authoring contract

Every custom Section/Content card a module adds exposes the same surface, so a later tier
can retitle, retint or re-feed it without a `.vue` override:

```javascript
const props = defineProps({
  // Function-capable, resolved through evaluateProp — a modifier may make it
  // read off the record.
  title:   { type: [String, Function], default: 'Allocation Details' },
  // The tree to render. Defaults to the composable's own projection; supplied
  // only when a caller renders this card against something else.
  items:   { type: Array,  default: null },
  // Horizontal inset (§10.2). Vertical rhythm is the container's.
  padding: { type: String, default: 'sm' },
  // Rhythm BETWEEN this card's own children, when it renders several.
  gutter:  { type: String, default: 'xs' },

  // ── Optional, only when the card needs them ──────────────────────────────
  // The record to render against. Defaults to the injected one; supplied when a
  // caller renders this card for something other than the page's own record.
  record:  { type: Object, default: null },
  // Overrides a state-derived tint. Function-capable: (record, config) => 'positive'.
  color:   { type: [String, Function], default: null }
})
```

Those six are the whole surface. A card needing something outside it is either doing two
jobs or reaching for state its composable should be handing it — check both before adding a
seventh prop.

- **Heading**: `SectionDividerLabel` with the resolved title, so a stack of cards is
  scannable by heading alone.
- **`items` defaulting to `null`, not `[]`**: `null` means "use my own projection", `[]`
  means "a caller handed me nothing" — collapsing them makes the card un-narrowable.
- A card that renders **siblings inside itself** takes `gutter` explicitly from the page
  contract, because `.aql-page-body`'s gutter reaches the *section*, never its children.

**One step is not one card. Scope decides the split:** a control acting on **every row** on
the page gets its own card above them; a control acting on **one row** lives in that row's
card. A select-all, an auto-fill, a running "N of M" total and the setting that determines
what the rows even contain each act on the whole set, so each sits in a card of its own,
ahead of the list — putting them inside the first item's card says they belong to that item.
A step legitimately renders three cards when it asks three differently-scoped questions.

### 7.6 Form and field overrides

Within `Create`/`Update`, three further hierarchies resolve **only** under `_ui/` (no
framework fallback): `FormChild<ChildName>` (one child block), `FormRecord` (the primary
form), `FormField<Header>` (one column's control).

Field **visibility** follows a strict precedence chain — `showFields` > `hideFields` >
`workflowFields` — and `fields` fixes both the set and the order (§13.3).

---

## 8. Actions — Dispatch, Handlers & FABs

Framework bases in `src/components/actions/`: `PageAction.vue`, `FormActions.vue`,
`FormActionSubmit.vue`, `FormActionReset.vue`, `FormActionCancel.vue`, `ResourceActions.vue`,
`ResourceActionItem.vue`, `ResourceActionsFab.vue`, `ResourceReports.vue`.

`Page.vue` mounts exactly one `<Action action="PageAction" v-bind="pageProps" />` on every
resource page, gated only by `noActions !== true` — not driven by the `sections` array.
`PageAction` then picks the live cluster: `add`/`edit`/`action` → `FormActions` (the sticky
bottom bar); everything else → `ResourceActions` (CRUD + workflow FAB cluster) and
`ResourceReports`.

### 8.1 The three most common action overrides

**Gate or restyle one FAB item** — each `AdditionalActions` entry and each CRUD button
resolves under its own action name with `ResourceActionItem` as the fallback base:

```javascript
// _ui/{Ui}/components/{Scope}/{Resource}/ResourceActionEdit.js
import { isEditable } from 'src/_resource/{Scope}/{Resource}/composables/use{Feature}Progress'

export default {
  // Function-valued so evaluateProp re-runs it per render.
  show: (record) => isEditable(record),
  label: 'Edit'
}
```

`show: false` / `hide: true` suppress an item; `handler: (ctx) => …` with
`ctx = { record, config, pageState, nav }` **replaces** its click behaviour outright.

Two rules for a gate predicate:

- **State and ownership are separate conditions, and both are required** where the action
  rewrites what someone else will read as the record owner's own words. Match on the user's
  **code**, never their name — names are neither unique nor stable.
- **Fail closed.** An unidentified session or an unstamped record must not pass: two blanks
  compare equal and hand the action to everyone.

```javascript
const owner = text(record?.CreatedBy)
const me    = text(user.value?.id)
return !!owner && !!me && owner === me
```

**A sheet-level `visibleWhen` may not be enough.** It tests one column of the parent row; if
eligibility actually depends on the record's *children* ("are there lines left to
allocate?"), the gate reads them off the enriched record in a function-valued `show`. A
relation getter is non-enumerable — invisible to a spread, perfectly readable by name
(§11):

```javascript
// _ui/{Ui}/components/{Scope}/{Resource}/ResourceActionReallocate.js
function hasPendingItems (record) {
  const rows = record?.$OutletRestockItems
  if (!Array.isArray(rows)) return false
  return rows.some((row) => text(row.Code) && text(row.Status || 'Active') === 'Active' &&
    (text(row.Progress) || 'PENDING') === 'PENDING')
}
export default {
  show: (record) => text(record?.Progress) === 'PARTIALLY_DELIVERED' && hasPendingItems(record),
  label: 'Reallocate Pending Items'
}
```

**Change the sticky bar's buttons, or veto a submission** — the container owns both:

```javascript
// _ui/{Ui}/components/{Scope}/{Resource}/Add/PageAction.js
export default {
  actions: ['cancel', 'submit'],
  submit: (name, { pageState }) => {
    const node = pageState.state.nodes.get('{Resource}Items')
    if (!node?.children?.length) return { valid: false, message: 'Add at least one item.' }
  },
  successRoute: 'view'
}
```

**Disable a single button conditionally:**

```javascript
// _ui/{Ui}/components/{Scope}/{Resource}/Edit/FormActionSubmit.js
import { isEditable } from 'src/_resource/{Scope}/{Resource}/composables/use{Feature}Progress'
export default { disabled: (record) => !isEditable(record), label: 'Save' }
```

> [!IMPORTANT]
> The cancel-override prop is `cancelHandler`, **not** `onCancel`. Vue treats any `onXxx`
> prop as an emit listener, which would silently bind `pageProps.onCancel` and
> double-navigate.

### 8.2 The handler contract

Every button routes through one dispatcher, `handleAction(name, payload)`, which looks a
handler up **by the action's own name**. What a handler returns decides what happens next:

| Return | Effect |
|---|---|
| `undefined` | continue with the default behaviour (the built-in step increment, navigation, or submit) |
| `false` | abort silently — the default behaviour does **not** run |
| `{ valid: false, message }` | abort and show the message |
| an array | treated as `{ requests: [...] }` |
| an object | merged into the `pageState` call options |

The keys that object may carry:

| Key | Purpose |
|---|---|
| `requests` | the batch to run, in order |
| `successMsg` | the toast text — **not** `successMessage`, see below |
| `onSuccess` | a callback run after the batch settles, **overriding `successRoute` for this handler alone** |

**`onSuccess` is how a secondary button lands somewhere the primary one doesn't.** A page
declares one `successRoute` for its normal outcome; a handler whose outcome routes
differently (a rejection returning to the record rather than continuing the flow) returns
its own callback instead of the page changing its route for everyone:

```javascript
reject: (name, { nav }) => ({
  requests: [...buildRejectRequests(parent, active, actor(), comment())],
  successMsg: 'Request rejected.',
  onSuccess: () => { pageState.reset(); nav.goTo('view') }
})
```

Reset the page state inside it when the handler abandons a plan the user built — otherwise
the node survives the navigation and re-seeds the next visit.

**Toast text is `successMsg`, not `successMessage`.** The two names are both real and they
are not interchangeable: `successMessage` is a **prop** on `PageAction`, evaluated and
converted; `successMsg` is the key a **handler return** must use, because it is merged
straight into `pageState.submit()`'s options. Returning `successMessage` from a handler
silently produces no toast.

```javascript
submit: () => ({ requests: [...], successMsg: 'Restock request approved.' })
```

**Cancel navigates explicitly and returns `false`.** Abandoning a form should not replay
whatever history brought the user here — they may have arrived from a related record's page,
not from the list. Go to a known route, then return `false` so the dispatcher's built-in
`goBack()` doesn't pop a second history entry on top of it:

```javascript
cancel: (name, { nav }) => { nav.goTo('index'); return false }
```

**Downstream irreversibility validation.** Any handler that performs a reversal, rejection,
or cancellation must verify what has already occurred downstream before proceeding. If child
lines have already been physically delivered (`active.some(row => row.Progress === 'DELIVERED')`),
reversing or rejecting the parent record is blocked and vetoed with a clear message:

```javascript
if (active.some((row) => text(row.Progress) === 'DELIVERED')) {
  return { valid: false, message: 'This request has delivered items and can no longer be rejected.' }
}
```

**Refresh what the batch invalidated, in the same round trip.** If a submit changes data a
*different* resource derives (a stock movement changing on-hand balances), append a read to
the same batch rather than leaving the next page to discover it stale:

```javascript
return {
  requests: [...buildAllocationRequests(parent, rows, actor, comment),
             resourceGetRequest(['WarehouseStorages'])],
  successMsg: 'Stock allocated.'
}
```

**A request may reference a record an earlier request in the same batch creates.** When a
submit writes a parent and children that must point at it, do not split into two round
trips to learn the parent's code — `batchRef` names it forward, and the backend resolves it
as the batch runs:

```javascript
ReferenceCode: batchRef('OutletRestocks.latest.code')
```

That is what lets one submit create a record and its stock movements atomically. Two round
trips would leave the second failable after the first has already committed.

**Retain a handler whose button is not currently mounted.** Handlers are dispatched by
name, so keeping `reject` defined while `actions` omits the Reject button leaves the
reversal logic available to any tier that re-adds the button — via a
`PropsPageAction: { actions: [...] }` block or a tenant modifier — without restating it.

### 8.3 Adding a new named button to the sticky bar

`FormActions` resolves any `actions` entry it does not recognise as `FormAction<Name>` and
wires its click to the generic `action(key)` emit. Three pieces, and no registration:

1. Name it in `actions` — `['cancel', 'reject', 'submit']`.
2. Add `_ui/{Ui}/components/{Scope}/{Resource}/{Page}/FormAction{Name}.vue`. There is no
   framework base for the name, so this is a `.vue` (promoted to base by §3.2 step 1.3),
   not a `.js`. Mirror `FormActionSubmit`'s shape: `[String, Function]` props for
   `label`/`icon`/`color`/`disabled`, each resolved through `evaluateProp`.
3. Add a handler of the same name to `PageAction.js`.

**The button reports intent and never dispatches.** A button that acted on its own would
make the handler's `{ valid: false }` veto unable to stop it — the same reason
`FormActionCancel` does not navigate. And it **disables** while a dispatch is in flight,
never spins: the blocking indicator is `AqlContentWrapper`'s overlay, and a second spinner
inside a button competes with it.

### 8.4 Permission gates in a handler

A submit re-checks permission even though the entry point was gated. Hiding the FAB is UX;
failing closed in the handler is the rule (§13.6 explains when a re-check is warranted and
when it is redundant).

**Name every resource the batch writes.** A handler that creates child rows and stock
movements needs all three permissions, not just the parent's:

```javascript
resourceConfig?.allowed({
  OutletRestocks:     'approve',
  OutletRestockItems: 'create',
  StockMovements:     'create'
})
```

> [!IMPORTANT]
> **Action names in an `allowed()` map are lower-camel, always.** The permission key is
> derived by upper-casing the **first character only** — `approve` → `canApprove`,
> `markDelivered` → `canMarkDelivered`. An all-caps `'APPROVE'` resolves to `canAPPROVE`,
> matches nothing, and **fails closed**, silently blocking a button that should work.

**Child-only action routes isolate payloads and permissions.** When an action route settles
child lines without modifying parent state (e.g. `Reallocate` allocating leftover lines on a
`PARTIALLY_DELIVERED` order), it asks only for stock and child line write permissions
(`{ OutletRestockItems: 'create', StockMovements: 'create' }`), never parent approval
permissions (`OutletRestocks: 'approve'`). The parent record remains unchanged.

**When one page serves two entry states, the permission map is a function of the state, not
a page constant.** The same approval page deciding a pending record needs the decision
permission; the same page allocating the leftovers of one already decided does not, because
it re-decides nothing. Key `permitted()` off the record, exactly as the submit label and the
payload builder are:

```javascript
const isInitialApproval = () => text(restock().Progress) === 'PENDING_APPROVAL'

function permitted () {
  return isInitialApproval()
    ? resourceConfig?.allowed({ OutletRestocks: 'approve', OutletRestockItems: 'create', StockMovements: 'create' })
    : resourceConfig?.allowed({ OutletRestockItems: 'create', StockMovements: 'create' })
}
```

A single literal map covering both states either over-asks (locking out the user the second
state exists for) or under-asks (letting an unpermitted user perform the first).

### 8.5 Cross-Resource Actions via Domain Payload Chains

> [!IMPORTANT]
> **Zero UI Schema Invention**: `PageAction.js`, action handlers, and custom forms must **never** construct secondary or child business records directly inside `_ui/`. 
> When a submission on Resource A causes side-effects or creates records in Resource B (e.g. Order → Invoice, Audit → Restock, Approval → Audit Logs), all batch request construction and permission aggregation must be delegated to the primary resource's Layer 2 Domain Payload Builder (`src/_resource/{Scope}/{Resource}/composables/use{Resource}Payload.js`). See [UI_RESOURCE_DOMAIN_LOGIC.md §9](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md#9-domain-payload-chain-architecture) for the full specification.

#### Standard Consumption Pattern in `PageAction.js`

Every `PageAction.js` handler orchestrating a cross-resource mutation follows this exact 5-step pipeline:

```javascript
// _ui/{Ui}/components/{Scope}/{Resource}/{Page}/PageAction.js
import { buildAuditCompletionChainRequests } from 'src/_resource/{Scope}/{Resource}/composables/use{Resource}Payload'

export default {
  actions: ['cancel', 'submit'],
  submit: (name, { pageState, resourceRecord, resourceConfig }) => {
    // 1. Collect inputs and draft allocations from pageState
    const formRecord = pageState.state.formRecord
    const discrepancies = pageState.state.nodes.get('Discrepancies')?.children || []
    const auditRecord = resourceRecord?.record?.value

    // 2. Invoke the Layer 2 Domain Payload Chain Builder
    const result = buildAuditCompletionChainRequests({
      auditRecord,
      discrepancies,
      actor: formRecord.ActorName,
      notes: formRecord.Notes
    })

    // 3. Early exit if internal business validation fails
    if (!result.valid) {
      return { valid: false, message: result.message }
    }

    // 4. Gate submission with aggregated permissions returned by the chain
    if (!resourceConfig?.allowed(result.permissions)) {
      return { valid: false, message: 'You do not have permission to execute all required operations in this action.' }
    }

    // 5. Return requests and toast message to pageState.submit()
    return {
      requests: result.requests,
      successMsg: result.successMsg
    }
  }
}
```

### 8.6 Workflow eligibility is not yours to re-derive

`AdditionalActions` gating — permissions, `visibleWhen`, `only`/`exclude`, and
navigate-vs-mutate dispatch — lives in a dedicated Core Composable; request mechanics live
in the additive-actions pipeline. A component that re-derives eligibility drifts from the
config contract. Ordering is the **one** thing a consumer may decide locally — it is
presentation, not eligibility, and escalation order is the sensible default.

### 8.7 Suppression gates

| Gate | Effect |
|---|---|
| `noActions: true` | drops the entire `<Action>` mount — bar and both FAB clusters |
| `noReports: true` | drops only the report cluster; CRUD FABs stay |
| `resourceactions.js` → `{ show: false }` | drops the CRUD/workflow cluster only |

---

## 9. Index Page & Operational Metrics

An Index page is a **worklist**, not a report. Users visit an Index page to handle tasks,
clear backlogs, and review live progress. It answers "what does the signed-in user need to
act on right now" — never "how did this resource trend last quarter." That second question
belongs on the main system dashboard, which aggregates across resources and time.

> [!IMPORTANT]
> **Scope rule.** An Index widget may only summarize records the current user owns or is
> upline for, in **live/open states** — pending queues, today's schedule, in-flight
> workflow. It must never summarize **all-time totals**, **terminal states** (delivered,
> rejected, cancelled) as a running count, or **calendar-aggregated** figures (this month's
> volume). A widget that needs "since X date" to make sense is a dashboard chart, not an
> Index widget.

### 9.1 Sections vs. Contents & The 4-Stage Index Hierarchy

| | `sections` | `contents` |
|---|---|---|
| Scope | **Resource-level / configuration-level.** Operates on resource metadata/config, not an active record instance — page header, static controls, filters. | **Record-dependent.** Operates on `records` (a list) or a single `record` — data lists, detail views. |
| Rendered | Directly inside `.aql-page-body`, outside `<AqlContentWrapper>` | Inside `<AqlContentWrapper>` — loading/empty/missing-record/submission overlay handled automatically |
| Gating | None — must self-guard | Automatic |

**The 4-Stage Index Section Ordering Formula:**
Stack Index sections by descending operational urgency:

```
1. Top / Immediate Action   (MetricCards — what needs my action right now)
2. Middle / Pipeline Health (LinearProgress, WorkflowFunnel — fulfillment rate and moving stage counts)
3. Lower / Backlog Risk     (AgeingBuckets — how long have items sat in bottleneck queues, approver-gated)
4. Bottom / Work Execution  (FilterInput, ListSwitcher, List — the actual work queue items)
```

Every widget section hides itself (`return []`) when it has nothing to report, so a fresh
tenant or a clear backlog presents a clean list rather than a wall of empty zeroes.

### 9.2 Index widgets

An Index widget is any **framework base Section** driven by a resource-specific JS modifier
(§3.3) that supplies `items` as a function-valued prop reading the resource's domain layer
(§4) for live/open-state data. The pattern is open, not a fixed catalogue: whatever queue,
ratio, pipeline or time-based reading a resource's workflow actually needs is a valid
widget, built the same way — find or add a generic base under `src/components/sections/`,
then drive it with a resource-specific modifier. A widget type that doesn't exist yet is
added as a new **generic** section (reusable by any future resource), never a bespoke
component private to one module.

**The bases already available — `MetricCards`, `LinearProgress`, `WorkflowFunnel`,
`AgeingBuckets`, `FilterInput`, `ListSwitcher` — are catalogued with their full prop
surfaces and hide rules in
[`components/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md).**
Read that before adding a widget; read it before inventing a base.

Five rules bind every widget, whichever base it drives:

**1. `items` is function-valued.** A JS modifier is invoked once, at resolve time, and its
return is cached. A plain array freezes at whatever the store held on that first tick —
usually empty, since a page resolves its sections before the fetch settles.

**2. Return `[]` when there is nothing to say.** Every widget base has a strict hide rule
and removes itself from the page entirely on an empty `items`. A 0% bar on a workflow that
has not started is a false alarm, not information; a wall of zeroes on a fresh tenant reads
as a broken page. Never zero-fill to keep a widget on screen.

The guard is **all-or-nothing across the whole widget**, and it is the widget's own last
statement before the `return`. A `MetricCards` hides only when *every* card it would render
is zero; a single live figure keeps the whole set on screen, and the zeroes beside it are
then real context rather than noise — that is what per-card grey-vs-alarm colouring is for.
Never hide individual cards out of a rendered set: the row would change width between reads
and the reader loses the fixed position they scan for.

**Test the figure each card actually prints.** A money card is empty when its *amount* is
zero, not when its row count is — an aggregate can return rows that all total nothing, and a
guard written against `.length` alone lets a wall of `AED 0.00` through. Test amounts and
counts together, exactly the set of values the returned items display.

**Empty is not "not yet loaded".** Both look like zero on the first tick, and the widget
correctly renders nothing for both — the distinction costs nothing here *only because* rule 1
keeps `items` function-valued, so the widget appears by itself the moment the fetch settles.
A widget that hides on a cached array never comes back, which reads as permanent emptiness.

**3. Every widget on a page shares one row-eligibility predicate**, exported from the
resource's domain layer and applied identically:

```javascript
for (const row of records) {
  if (!countsForUser(row, me)) continue
  …
}
```

Apply it even where it changes no number today. The point of a shared predicate is that a
widget cannot opt out of the rule by forgetting about it — the moment a new card counts an
earlier state, an unshared rule starts leaking other people's records silently, and the
widget disagrees with the pill beside it.

**4. Count from `records`, never `filteredRecords`.** These widgets are the *reason* to
switch views, so they must not change when a view is switched. A funnel describing only the
view already on screen is a tautology.

**5. Gate a widget on the permission for the action that clears its queue.** "5 requests
have waited over a week" is an instruction to an approver and merely an anxiety to a
requester, who cannot act on it and is often reading their own submission back as a red
number. Return `[]` when unpermitted, so the widget disappears rather than showing empty —
and take the permission read **inside** the closure (§3.3):

```javascript
export default function (props, { resourceRecord, resourceConfig }) {
  return {
    title: 'Approval Queue Ageing',
    items: () => {
      // Inside the closure: the modifier resolves before the auth payload lands,
      // and a permission read taken then would latch a false for the page's life.
      if (resourceConfig?.allowed?.({ OutletRestocks: 'approve' }) !== true) return []
      …
    }
  }
}
```

> [!IMPORTANT]
> **Actionable queue constraint for `MetricCards`.** Metric cards are reserved strictly for
> open, actionable queues owned by active actors (e.g., Pending Approval, Needs Revision,
> Pending Completion). Historical or terminal states (Delivered, Rejected) belong in the
> funnel or reports, not in metric cards.
>
> **Committed obligation denominator for ratios.** A ratio's denominator includes only
> records that incurred a true obligation (e.g. `APPROVED + PARTIALLY_DELIVERED + DELIVERED`).
> Pre-approval drafts and rejections never became delivery commitments; including them would
> let a user falsely improve the fulfillment rate by rejecting requests.
>
> **In-flight funnel boundaries.** Funnel widgets represent moving pipelines and exclude
> terminal states (`DELIVERED`, `REJECTED`) so accumulated history does not compress active
> states into slivers over time.
>
> **Ageing queue selection & timestamp precedence.** Ageing breakdowns apply only to
> queues where elapsed time indicates human friction or delay (such as approval queues), and
> measure elapsed time from the specific queue-entry stamp (`ProgressSubmittedAt`), falling
> back to requested `Date`, rather than creation date (`CreatedAt`).

**The band table is exported from the vocabulary file, not written in the widget.** An
ageing widget's thresholds and the colour a row's own age chip uses are the same scale — if
a row sits in the widget's red band, its chip must be red. Two array literals, one in the
modifier and one in a `ageColor()`-style helper, are a scale that silently splits the first
time either is tuned. Export the bands and derive both from them (§4.5):

```javascript
// domain layer — one definition, read by the widget AND the row chip
export const AGE_BANDS = [
  { label: '0–1 days', caption: 'On track', color: 'positive', max: 1 },
  { label: '2–3 days', caption: 'Watch',    color: 'info',     max: 3 },
  { label: '4–7 days', caption: 'Chase',    color: 'warning',  max: 7 },
  { label: '7+ days',  caption: 'Overdue',  color: 'negative', max: Infinity }
]
export const ageColor = (days) => AGE_BANDS.find((b) => days <= b.max)?.color ?? 'grey-6'
```

**A widget naming a set uses `title`; a widget rendering one figure names it on the item.**
A card row, a funnel and a band scale are *sets*, so the heading belongs to the section
(`title: 'Approval Queue Ageing'`). A single-ratio progress bar has exactly one thing to
name, and naming it twice — once as a section heading and once as the bar's own label —
reads as two headings for one number. Put the name on the item's `label` and omit `title`.

### 9.3 The work-queue switcher

A **work queue** is a `ListSwitcher` view rendered through `List<ViewName>` — `contents`,
not a section. Name each view for the state it surfaces (`PendingApproval`, `NeedsRevision`,
`Drafts`), not a generic bucket name.

**Gate each pill on the permission for the action that view exists to start.** A switcher
showing eight views to everyone is a wall of pills where seven are someone else's job:

```javascript
// A view absent from this map is ungated. `any` = one of the listed actions suffices.
const VIEW_GATES = {
  Drafts:            { any: ['create'] },
  PendingApproval:   { any: ['approve'] },
  PendingCompletion: { any: ['markDelivered', 'reallocate'] }
}
```

Read-only states of records the user can already see carry no gate beyond the resource's own
read permission.

**A view whose name claims a person needs a client-side ownership filter.** A sheet view
filters on a column, so a view named for a *state* is fully expressed there — but a pill
titled "My Drafts" is making a claim the sheet cannot check. Under an
`OWNER_AND_UPLINE` access policy a manager legitimately receives their reports' drafts, and
the view hands them all to a pill promising only their own. Pass the signed-in user into the
view's preset and filter there:

```javascript
PropsListDrafts: (props) => draftsPreset(props.items, user.value?.id)
```

This is the case that justifies a preset taking an argument at all. Match on the user's
code, and fail closed on a blank (§8.1).

**Gating the switcher is menu hygiene, not access control.** A hidden view is still a filter
the record store knows about and a deep link could still select it. That is fine when — and
only when — every view filters on a state column over rows the user is already authorised to
read. It is never a substitute for a record access policy.

**Move the active view when the default has been gated away.** `default: true` lives in the
sheet config, which knows nothing about permissions, so a user whose default pill is hidden
still *lands* on it and reads an empty list with no pill highlighted — which looks like a
data failure. Correct it to the first visible view, deferred to a microtask (the correction
runs inside a render-time prop evaluation and writes reactive state the same render is
reading) and guarded so it is idempotent.

**Fall back rather than render an empty switcher.** If every gated view is hidden, show the
ungated set instead of no pills over a list still filtered by a view the user cannot see.

### 9.4 Dynamic lists — auto-inferring rows from schema

The list-strategy composable derives a list row's presentation from the resource's
**headers and relations alone** — no per-view manual config required. A new resource with
zero `_ui/` files already renders a sensible list.

**Label** — first match wins: own descriptive column (e.g. `Name`) → borrow a parent's
descriptive column → join the first two non-audit, non-foreign-key columns → a single
descriptive column → the record's own `Code`.

**Caption** fills whatever the label pass didn't consume, upgraded to a multi-parent join
or a date+user pairing when both are present.

**Chip / highlight state** — state-column resolution order: `Progress` → `Status` → `Type`.
Whichever exists drives both the row's colored chip and its highlight state.

**Meta value** — resolved from an amount/quantity-header priority list once a resource
crosses a column-count threshold, surfacing the most important number without being told to.

> [!IMPORTANT]
> **Check what the list strategy already infers before hand-writing `label`/`caption`/
> `chip` resolvers for a new resource.** A `Props<Identity>` override (§5) is for the case
> the inference gets wrong — not the default path for every new module. Most resources need
> zero list customization; a resource with several state-specific queues (§7.2) is the case
> that needs presets.

---

## 10. Visual Design Contract

> [!IMPORTANT]
> **Theme uniformity.** Every module under one `_ui/{Ui}/` scope shares one visual
> language. A user navigating between modules under the same UI name must never feel like
> they've entered a different, standalone app — no module-by-module divergence in card
> shell, radius, gradient, shadow, motion or spacing.

### 10.1 The card shell is a per-UI token

**One shell for every custom UI surface** under a given UI — detail sections, wizard steps,
review summaries, empty states, per-item cards. Not just View pages, and with no
display-versus-input variant.

**Which shell that is belongs to the UI, not the module.** It is
`_ui/{Ui}/_config/config.js`'s `cardClass`, read by every component in that tree.

**How a component obtains `ui`.** A `.vue` may not import the config directly — §6.1 admits
only UI Composables — so one composable per UI relays it, and each page's context composable
re-exports it so a card needs a single import:

```javascript
// _ui/{Ui}/composables/use{Ui}Config.js — the ONE file that imports _config/config.js
import config from 'src/_ui/{Ui}/_config/config'
export function use{Ui}Config () { return config }
```

```javascript
// _ui/{Ui}/composables/{Scope}/{Resource}/{Page}/use{Resource}Context.js
import { use{Ui}Config } from 'src/_ui/{Ui}/composables/use{Ui}Config'

export function use{Resource}Context () {
  const ui = use{Ui}Config()
  // … record / config / pageState, per §6.2
  return { record, config, pageState, pending, ui }
}
```

```html
<script setup>
const { record, pending, ui } = use{Resource}Context()
const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>

<template>
  <q-card flat bordered :class="ui.cardClass">
    <div :class="ui.detailGridClass">
      <div v-for="(line, i) in lines" :key="line.label"
           class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]"
           :style="rowDelay(i)">
        …
      </div>
    </div>
  </q-card>
</template>
```

The token object is a plain frozen module export, not reactive state — reading it in setup
and in the template is safe, and it costs nothing per render. `rowDelay` is a function
returning a fresh object per call, which is fine on a `:style` binding but must never become
a hoisted-looking inline literal in the template (§11 rule 5).

A literal `class="page-card aql-premium-gradient-card"` and a local
`const ROW_STAGGER_MS = 40` both defeat the point: retuning the UI stops being a one-file
change, and a second UI inherits AQL's shell whether or not it wants it.

For `_ui/AQL/` that resolves to `page-card aql-premium-gradient-card` — `flat` drops
Quasar's default shadow so the class's own is the only one, `bordered` supplies the hook the
class refines, `page-card` carries the shared radius token and the entry animation. A second
UI naming a different class in its own `_config/` is not divergence; it is the mechanism.
The rationale for each of AQL's values is
[`_ui/AQL/_config/config.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_ui/AQL/_config/config.md).

| Part | Token | Rule |
|---|---|---|
| Card | `cardClass` | never a hand-written class string, never a per-module variant |
| Rows | `detail*Class` — `grid` › `line` › `key` + `val` | the shared label/value grid; never rebuilt from raw `row`/`col` |
| Stagger | `detailRowClass` + `:style="rowDelay(i)"`, `rowStaggerMs` | stacked cards animate in step only if every one shares the interval |
| Rhythm | the parent's `q-gutter-y-{gutter}` (§10.2) | vertical spacing belongs to the container, never a `q-mb-*` on the card |

`AqlGroupedList`'s `card-class` is **appearance only** — never put spacing in it. Spacing
goes through its `gutter` prop. A nested list inside a gradient card must be wrapped in
`.aql-grouped-list-body` so it inherits the card's fill/radius rather than painting an
opaque row surface over the gradient.

### 10.2 Spacing — `gutter` vertical, `padding` horizontal

> [!IMPORTANT]
> **`pageProps.gutter` is the only mechanism for spacing BETWEEN sibling surfaces, and it
> is mandatory.** Inline `style` margins, and ad hoc `q-mb-*`/`q-mt-*`/`q-py-*` used to
> push one card away from the next, are **strictly forbidden** — as are one-off
> gradient/shadow values and per-module radius overrides.

**What the ban does not cover.** Spacing *inside* a card is not gutter's job and never was.
These are sanctioned, and a module writes them as shown rather than inventing its own:

| Inside a card | Sanctioned |
|---|---|
| the empty and skeleton shells' own inset | exactly as §10.4 prints them — `q-py-lg`, `q-mb-sm`, `q-mx-auto` |
| padding within a `q-card-section` | Quasar's own `q-pt-*`/`q-pb-*`/`q-ml-*` where a sub-block needs separating from the one above it |
| a horizontal inset on a section root | one declared `padding` prop, below |

The test is what the class is spacing *from*. Pushing a card away from its neighbour is
gutter's job and belongs to the container. Setting a separator's breathing room inside one
card is that card's own composition, and routing it through gutter would couple a card's
internals to the page's rhythm.

```javascript
import { computed, useAttrs } from 'vue'
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
```

`gutter` reaches every placeholder through drilled `pageProps`. Read it via `useAttrs()` —
never `v-bind="$attrs"` onto the root just to get it through (that leaks `Props<Identity>`
object values onto the DOM, §12.2). A component's own `|| 'sm'` fallback fires only when
`gutter` is absent entirely — standalone usage outside page-driven resolution — and is not
meant to agree with `pageProps`' own default.

**Horizontal inset is a separate, declared channel.** A section renders edge-to-edge inside
`.aql-page-body`, so a card that needs to sit inboard of the page edge declares a `padding`
prop and applies it as `q-px-{padding}` (§7.5). This is the *only* sanctioned use of a
Quasar padding class in a module: one declared prop, horizontal axis only, defaulted in the
component and overridable from the contract. Vertical padding still belongs to gutter.

**A card holding siblings passes gutter down explicitly.** `.aql-page-body`'s gutter reaches
the section, never its children, so a card rendering several sub-cards takes `gutter` from
the page contract and spaces them itself — the same way `AqlGroupedList` takes its own.

### 10.3 Per-UI configuration — `_ui/{Ui}/_config/`

> [!IMPORTANT]
> Card shell, radius, gradient, border colour, motion timing, tap-target floor, empty-state
> shell and any other UI-scoped design token live in **one place per UI name**:
>
> ```
> _ui/{Ui}/_config/
> ├─ config.js      machine-readable tokens/classes THIS UI uses (imported by components)
> ├─ config.md      human doc: what this UI's design system is, and why
> └─ style.scss     (optional) the CSS for this UI's own shell, scoped to its identity
> ```
>
> **Both `config.js` and `config.md` are created with the `_ui/{UiName}/` folder itself,
> before its first component.** Every module built under that name inherits its tokens
> purely by being built there. No module hardcodes its own radius/gradient/colour/animation
> values — a module-level override is exactly the divergence §10's uniformity rule forbids.

`config.js` exports the concrete class names and token values this UI's components bind to;
`config.md` is the paired human explanation — what the visual language is, which tokens
exist, and why each holds its value. A value with no stated reason gets reverted by the next
person who finds it inconvenient, which is why the `.md` is not optional.

Components read tokens through their UI Composable (§6.2) rather than importing the config
directly, so retuning one UI's shell stays a one-file change.

**Runtime scoping.** `pageProps.uiName` (§5.4) is known at the page root on every render.
Scoping each `_ui/{Ui}/_config/style.scss` ruleset under a selector keyed to that value —
a `ui-scope-{uiName}` class or a `data-ui-scope` attribute on the page root — makes the
browser's own cascade do the swap: navigating between resources under different UI names
changes the attribute, one UI's rules stop matching and the other's start, with no unload
step and no JavaScript beyond setting the attribute. It requires each `style.scss` imported
once so its rules exist in the bundle, and the page-root wrapper carrying the live `uiName`.
Wiring that is an infrastructure task, not part of generating a module; until it is wired,
a UI's CSS lives in the global stylesheet and its `config.md` records which rules are its
own.

### 10.4 Loading, empty, and hidden — the three quiet states

A card outside `<AqlContentWrapper>` (§9.1's exceptions) owns all three itself. They use one
recipe, not a bespoke one per component.

**Loading** — a skeleton *inside the card shell*, so the surface doesn't appear and reflow
as data lands:

```html
<q-card-section v-if="pending">
  <q-skeleton type="text" width="40%" class="q-mb-sm" />
  <q-skeleton type="text" width="80%" />
</q-card-section>
```

**Empty** — the standard shell → a centered `q-card-section` → an icon at the UI's
`emptyIconSize`/`emptyIconColor` → a bold short subtitle → **a caption line explaining the
empty state in one sentence.** The caption is required: an icon and a bold "No items" says
something is missing; the caption is what says whether that is normal. A larger or darker
icon turns an ordinary empty state into an error.

**Hidden** — a card that renders nothing in a given state uses **`v-if` at the root, never
`v-show`.** A hidden root still occupies a slot in the page body's gutter stack and opens a
blank gap between the cards around it.

Two refinements:

- **Hide while loading, too**, for a card that is conditional on record state. Flashing an
  instruction card in and out on a slow fetch is worse than showing it a moment late.
- **Empty is not always neutral.** A card whose emptiness is *good news* ("every requested
  unit is covered") says so, with a positive icon — the shell is the same, the wording and
  colour follow the meaning.

**Banner vs. card.** A `q-banner` is the one surface that is deliberately *not* the card
shell, and the distinction is what it is talking about:

| | Card | Banner |
|---|---|---|
| States | a fact of its own — this record, these items | a fact **about the cards around it** |
| Examples | identity, contents, disposition, history | "stock is allocated once approved", "cancelled lines write no movement", "editing is disabled in this state" |
| Shell | the UI's `cardClass` | `q-banner rounded dense`, no card class |

Tint follows the same rationing as everything else: neutral (`bg-grey-2`) when it explains a
consequence the reader should know about, warning-tinted only when it explains why something
the reader came to do **will not work**. A banner never carries the card shell, and a card
never does a banner's job — an explanation dressed as a card reads as another item in the
stack, and the reader counts it as data.

### 10.5 Layout rules worth stating explicitly

These recur often enough to name, so a module author reaches for the rule instead of
guessing. Numeric values come from `_config/config.js`.

- **Truncated display text** in a narrow column gets an explicit, reasoned character cap —
  pick the number from the column's actual width and say so in a one-line comment. Don't
  truncate without a reason, and don't leave long text unbounded in a column sized for
  something short.
- **A flex column holding text of unknown length beside a fixed-width figure or button
  cluster** carries the UI's `flexWrapTextClass`. A flex child's implicit `min-width: auto`
  floors it at its longest word, which is what pushes the trailing figures onto a new line
  for a long name.
- **Grouped/repeating controls in a row** cap at `maxControlsPerRow` (three) before
  wrapping, and derive the column width from the item **count**, not a fixed grid — four
  splits 2+2, never 3+1 with a stranded control.
  ```javascript
  // Dynamic Control Grid Partitioning Formula:
  // 1 item -> col-12; 2 or 4 items -> col-6 (2+2); 3 or 5+ items -> col-4 (3+3)
  function binColumnClass (count) {
    if (count <= 1) return 'col-12'
    if (count === 2 || count === 4) return 'col-6'
    return 'col-4'
  }
  ```
- **Hierarchical 3-level tri-state selection trees** (Product › SKU › Storage Bin) in
  delivery or dispatch pickers use `indeterminate-value="null"` on parents:
  ```html
  <q-checkbox :model-value="productState(prod)" :indeterminate-value="null"
              @update:model-value="toggleProduct(prod)" />
  ```
  Toggling a parent sets all descendants; selecting a subset computes an indeterminate state
  automatically.
- **Icon-only controls** meet `minTapTargetPx` and carry an `aria-label`. **A tooltip does
  not satisfy this** — it is invisible to a screen reader and to a touch user who cannot
  hover, so a `q-tooltip` is an addition to the label, never a substitute. Note that the
  UI's `rowActionBtnProps` preset supplies **neither**: adopting the shared button
  presentation leaves both obligations open on every button.
- **Apply `minTapTargetPx` from the token, not a literal.** Bind the UI's `tapTargetStyle`
  rather than writing `style="min-width: 40px; min-height: 40px"` — a hardcoded pair is the
  per-module override §10.3 forbids, and it silently stops tracking the UI that owns the
  number. Sizing bound from a token is not what §10.2's inline-style ban is about; that ban
  is about spacing.
  ```html
  <q-btn outline round icon="remove" padding="none" :style="ui.tapTargetStyle" … />
  ```
- **A primary, flow-anchoring input** — the one field the screen exists to collect — is
  never `dense`. Reserve `dense` for secondary and read-mostly fields; a dense primary field
  ends up smaller than the buttons flanking it.
- **Chips carry state; figures are text — and a count of records *in* a state is a state
  legend, so it may be a chip.** The distinction is whether the number is a *reading* or a
  *value the user is changing*: `3 fully covered / 1 partial / 2 unallocated` is a legend
  over three states and belongs in chips; the running `12 of 40 units` the same user is
  driving upward is plain text at a larger weight. Two adjacent numbers can legitimately get
  different treatments for this reason.
- **Disable rather than hide an inapplicable inline control** — *when its question still
  stands.* The two cases:

  | | Treatment |
  |---|---|
  | The question stands, the answer is currently unavailable (nothing left to cancel, no rows to act on) | **disable** — a present-but-inert control reads honestly; an enabled one that silently does nothing does not |
  | The question has become meaningless (a submission comment while the record is being saved as a draft — there is no reader for it yet) | **hide** — asking and then withdrawing the question reads as the card changing its mind, and a disabled field still says "you should have something to put here" |

  Also don't toggle a row's presence inside a block being actively edited: a block that
  gains or loses a row as numbers change shifts the inputs under the user's cursor mid-edit.
  Render it always and disable it instead.
- **A one-click control that computes a result the user did not specify states its rule on
  screen**, in one caption beneath it — "empties the smallest bins first", "fills from the
  nearest warehouse". An auto-fill the user cannot predict is one they have to undo and redo
  by hand to trust, which costs more than the button saved.
- **State the operator when a card shows arithmetic.** A header reading `12 + 3 = 15` says
  strictly more than a `+3` chip, and costs one row.

### 10.6 Other styling rules

- No `<style>` block in any resolver-backed component — a tenant `.vue` override cannot
  inherit a scoped style, so scoped CSS silently breaks the override contract.
- No `QTable` for record lists — horizontal scroll on mobile. Use stacked cards/lists.
- Every animation must honour `@media (prefers-reduced-motion: reduce)`.
- Dynamic colours go through a CSS custom property, not per-colour class variants.
- A colour named in a `var()` must be one the build actually defines. Quasar publishes brand
  variables only for `primary`, `secondary`, `accent`, `dark`, `positive`, `negative`,
  `info` and `warning` — anything else needs a literal fallback (e.g.
  `var(--q-orange, #ff9800)`) or it resolves to nothing.

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

## 13. Form Architecture

### 13.0 Which form shape does this resource need?

Two shapes, one test. Ask what the form's **primary input** is.

| | Generated form | Workflow form |
|---|---|---|
| Primary input | the resource's **own columns** | a **derived tree** the schema cannot express — line items with per-bin quantities, allocations, a selection across child rows |
| Contents | `['Create']` / `['Update']` | bespoke content cards, one per decision |
| Field set | generated from `_fields`, narrowed via `fields`/`showFields`/`hideFields`/`fieldProps` | each single header mounts its own `_fields` control (§2.4) |
| Default | **yes — start here** | only when the test above says so |

A workflow form is not a licence to hand-assemble a resource's columns. Even inside one:

- **every input is still a `_fields` control**, resolved through `resolveFieldComponent`
  (§2.4) — no raw `q-input`/`q-select`;
- **every real header still writes through `pageState.setField`** and rides the normal
  payload — §13.5;
- **a header collected on more than one page uses the same header, the same control and the
  same wording on each.** A draft submitted from Edit and one submitted from the Add wizard
  must ask the requester for the same thing.

Sections 13.1–13.3 govern the generated form. 13.4–13.6 apply to both.

**A second workflow branch may live inside Add, or belong on its own action route.** Some
resources offer a mode that skips the normal path — a direct entry that self-approves and
writes its consequences immediately. Two tests decide where it is built:

| Build it **inside Add** when… | Build it as an **action route** when… |
|---|---|
| the branch is chosen **before** any data is entered, as part of the same first decision | it acts on a record that already exists |
| it produces the **same record shape**, differing only in the states and side-effects the submit handler writes | it collects a different set of inputs |
| the user could plausibly flip between the two mid-form without losing work | entering it is itself a workflow transition |

A skip-approval mode chosen on step 1 alongside the outlet passes all three: it is one
wizard whose final handler writes a different `Progress` and appends the movements, gated by
whatever makes the mode available (a region, a permission). Forcing it onto a separate route
would ask the user to decide *which page to open* before they know what they are entering.
Keep the mode in a control field (§13.5) so the handler reads it back, and render its
control only when it can actually be honoured — an unavailable mode is not shown disabled,
it is not shown.

### 13.1 What the form-fields composable derives from `_fields`

> [!IMPORTANT]
> **A generated form's field set comes from its `_fields` metadata
> (`APP.Resources.UIFields`, see `SCHEMA_RESOURCE_COLUMNS.md`), never hand-assembled.** A
> `_ui/` override narrows or reorders the generated set; it does not replace generation with
> a manually written field list.

Reads `config.ui.fields` (`UIFields`) merged with any sheet header not already declared,
drops audit columns (`AccessRegion`, `CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy`),
and maps each survivor to a control **by schema signal, in this priority**:

1. `type: 'file'` → file upload control.
2. `type: 'datetime'` → the datetime `_fields` control.
3. `type: 'date'`, or a header ending in `Date` → the date control — naming convention alone
   is enough, no explicit `type` required.
4. Header is exactly `Code` → readonly text.
5. Toggle-shaped (`type: 'toggle'`/`'boolean'`, or a 2-option Yes/No-style `options` array)
   → a toggle switch.
6. Header `status` or `type: 'status'` → the status control (chip-styled select).
7. `type: 'select'`/`'dropdown'` → a select populated from `field.options`.
8. Otherwise, a declared cross-reference (`APP.Resources.Relations`) → a relation picker.
9. Otherwise → a generic text-family input, typed further by type normalization.

Every one of these resolves through `resolveFieldComponent(type, mode)` into
`src/_fields/<type>/` — the priority list decides **which type**, never which raw
Quasar control. For what each resolved type renders, which aliases map to it, and how to
mount one by hand, see
[`_fields/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/REGISTRY.md).

### 13.2 Cross-reference option labels

`APP.Resources.Relations` (keyed by source column) supplies `resource`, `targetHeader`
(default `Code`) and `labelHeader` — a column name, a `$parent.Field` path, or a label
template. A relation picker's options always render through that one expression, so
`Name (Code)` (or whatever `Relations` specifies) is never re-derived by hand. Narrow the
option **set** with `fieldProps: { OutletCode: { options: filtered } }`.

### 13.3 What a `_ui/` override may change — and must not

| May do | Must not do |
|---|---|
| Fix the field **set and order** via `fields: [...]` | Invent a field the schema doesn't declare |
| Re-admit a hidden field via `showFields` | Hand-roll a raw `q-input`/`q-select` bypassing `_fields` |
| Narrow a picker's `options` via `fieldProps` | Re-derive a cross-ref label instead of using the resolved option set |
| Relabel/require a field via `fieldProps` | Reformat a value outside its `_fields` control |
| Replace one column's control via `FormField<Header>` | Replace a generated form with a static template |

Field visibility precedence: **`showFields` > `hideFields` > `workflowFields`**; `fields`
fixes both set and order.

> [!IMPORTANT]
> **A workflow stamp column (`Progress`, `...At`, `...By` audit trios) is never a form
> field, in any state.** It is set once, programmatically, inside the `PageAction` submit
> handler that causes the transition (§13.6) — never exposed via `fieldProps`, never
> re-admitted with `showFields`. Letting a user edit a stamp column directly breaks the
> guarantee that "who did this, and when" reflects what actually happened rather than what a
> form field said. This is exactly what `workflowFields`'s default-hide behavior exists to
> enforce — do not defeat it for a stamp column.

### 13.4 Add and Edit share their cards

When Add and Edit collect overlapping data, **resolve the same components at the resource
tier and list them in both contracts** (§3.1) rather than building a parallel set. Two
independently authored forms for the same data drift the moment one gets a field the other
doesn't; sharing makes drift structurally impossible.

A shared card is told what page it is on, never asks:

- the Add contract pins it to a step (`PropsAdjustItems: { step: 2 }`); the single-view Edit
  contract declares nothing and the card renders unconditionally (§13.6);
- the parts that genuinely differ get their own page-tier components — the Edit page's
  read-only identity card, or the wizard's mode selector.

**Edit states its fixed fields rather than offering them.** An identity field that cannot
change for the life of a record (which outlet a request is for, the date it was raised) is
rendered as a read-only detail row, not a disabled input — re-pointing it would silently
rewrite what an approver already read.

**Edit explains a locked record in-page.** The Edit URL is directly reachable, so a record
that has moved on since the link was opened must say why nothing here will save, in a banner
above the form, rather than failing at the sticky bar after the user has typed.

**State-adaptive submission controls matrix in Edit:**

| Entry State (`Progress`) | Intent toggle | Resubmission commentary | Button label |
|---|---|---|---|
| `DRAFT` | "Save as Draft" (**defaults ON**) | Hidden when draft ON; shown when draft OFF | "Save Draft" / "Submit" |
| `REVISION_REQUIRED` | Omitted entirely | Unconditional textarea | "Resubmit Request" |

### 13.5 `pageState` — record fields vs control fields

A form collects two different kinds of value, and they are stored differently:

| | Written with | Reaches the backend | Examples |
|---|---|---|---|
| **Record field** | `setField` / `setFields` | yes, in the payload | a real resource header — `OutletCode`, `ProgressSubmittedComment` |
| **Control field** | `setControlField` | **no** | page-only intent and working state — `isDraft`, `RestockMode`, `EditHydratedFor`, an allocation plan |

**Control fields as working surface.** The user's whole decision — which bins, how much from
each, which lines arrived — accumulates in control fields, which is what lets the sticky bar's
handler read the finished decision back and build the batch payload (§8.2).

**Multi-caller node hydration keying (`EditHydratedFor`).** When multiple components on an
Edit page invoke the same form composable (`useRestockEditForm`), track hydration using a
node-level control field rather than a local closure variable:
```javascript
const hydratedFor = () => text(pageState.getControlField?.(PARENT_NODE, 'EditHydratedFor'))
if (hydratedFor() !== text(parent.Code)) {
  pageState.setControlField(PARENT_NODE, 'EditHydratedFor', text(parent.Code))
  // hydrate child lines...
}
```
This prevents duplicate child-line seeding or wiping out in-progress edits across sibling cards.

**Child-line deduplication during hydration.** Normalize incoming lines by business key
(e.g. `SkuCode`) and prioritize active records over deactivated rows before writing to
`pageState`, eliminating duplicate lines in form steppers.

**Submission intent and comment precedence.** Place the non-advancing intent toggle ("Save as
draft") *before* the comment box, and hide the comment box when draft is toggled on (since
a private draft has no reviewer or reader yet).

**Stamps are written by the handler, under the hood.** `Progress`, `...At`, `...By` are set
in the submit handler that causes the transition, never exposed as fields (§13.3) — so a
submission cannot be back-dated or attributed to someone else. A save that is *not* a
submission (a draft) gets **no** stamp: leaving them empty is what lets a later real submit
record when it actually happened.

**The first content is the hydration point** on any page with no `Create`/`Update` to seed
the node (§5.5). It calls the page composable, which loads the record and its children and
writes them onto `pageState`. Preload every related resource the *later* steps need at that
same point, so step 2 doesn't issue a fetch per card as the user arrives.

### 13.6 Multi-step wizard navigation

> [!IMPORTANT]
> **Split into steps only for one of two reasons — not to make a form feel shorter.**
>
> 1. **Sequencing dependency**: a later step needs data collected in an earlier one before it
>    can render meaningfully (item entry can't happen until the outlet and mode are picked; a
>    review step can't summarize items that don't exist yet).
> 2. **Unrelated decisions**: two groups of fields ask the user to think about genuinely
>    different things (which outlet vs. which items vs. draft-or-submit), and combining them
>    onto one screen forces context-switching mid-form.
>
> If neither reason applies, it is one step, not several.

**The sticky bar drives the whole wizard.** Content cards stay pure inputs with no
navigation of their own — a card that navigated or submitted would double-fire against the
dispatcher and make a handler's veto unable to stop it. The bar is a `PageAction.js` with a
**`get actions()` getter**, re-evaluated live off `pageState.meta.currentStep`, mounting
framework back/next buttons — never a bespoke footer:

```javascript
// _ui/{Ui}/components/{Scope}/{Resource}/Add/PageAction.js
export default {
  get actions () {
    if (step() === 2) return ['back', 'next']
    if (step() === 3) return ['back', 'submit']
    return ['cancel', 'next']
  }
}
```

Document the flow as a table in the file's docblock — `step 1 outlet + mode → [Cancel]
[Continue]` — so the shape is readable without tracing the getter.

**A step is a screen, not a file.** Two or more contents may share one `step` — split the
step's blocks by job and list each in the contract (UI_CONTENT_SYSTEM §6). Step 4 of the
consumption wizard is `RestockOptions` (how the restock is routed) plus `RestockItems`
(what is in it), both at `step: 4`.

**Steps are declared by the contract, not the card.** Each card takes a `step` prop and
gates on it; the contract assigns it (§5.5). `step: null` means "no wizard, always render",
which is what lets one card serve a wizard Add and a single-view Edit:

```javascript
const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))
```

Gating on `currentStep === 2` directly hides the card forever on a single-view page, where
`meta.currentStep` stays at its initial `1` and no bar moves it.

**Single source of truth**: a wizard field reads and writes through `pageState` directly
(§13.5) — never a parallel local `ref` or mirrored map.

**A review step is read-only.** It re-renders the same projection an earlier step collected,
reusing the composable's aggregate rather than recomputing, so the numbers cannot drift from
what the handler will submit. A decision stays editable only beside the evidence it is made
against — restating it as a control on the review step lets the user change it without
seeing what they are changing it against.

**A review step may collapse a section only when it is a derived consequence, never the
decision itself.** The list the user is signing off on is always open — it is what they came
to confirm. A projection *downstream* of that decision (what the destination will hold
afterwards, including untouched lines) is a confirmation aid, not a second thing to approve,
and is collapsed by default behind an expansion item with a one-line summary. The scopes
differ accordingly: the decision list shows only what is changing; the consequence shows the
whole resulting picture.

> [!IMPORTANT]
> **Veto a step transition or a submission for one of three reasons.**
>
> 1. **Invalidity** — nothing selected where a selection is required, zero items, no
>    allocation made, a required identity field left blank. The form is incomplete.
> 2. **Staleness re-check** — the *same* permission or eligibility condition that gated the
>    FAB/route entry point (§8.1's `show` predicate), re-checked at submit because time has
>    passed and the session, the record's state, or the user's permissions could have changed
>    underneath them. This is not duplication — the FAB gate stops most users from ever
>    opening the flow; the submit-time re-check protects the minority for whom something
>    changed mid-flow.
> 3. **Irreversibility** — the action would contradict a consequence **already committed
>    elsewhere**. A rejection that reverses a record's lines cannot proceed once some of
>    those lines have been delivered: the stock has physically moved, and no reversal the
>    handler can write undoes it. This is not invalidity (the form is complete and correct)
>    and not staleness (no gate ever tested it) — it is a check that only a reversal or
>    cancellation handler needs, and only against downstream state.
>
> ```javascript
> if (active.some((row) => text(row.Progress) === 'DELIVERED')) {
>   return { valid: false, message: 'This request has delivered items and can no longer be rejected.' }
> }
> ```
>
> **Any handler that reverses, cancels or writes off** must ask what has already been
> consumed downstream before it runs — that is the whole content of reason 3.
>
> What a veto must **never** do is re-derive a check the entry gate exists to make and that
> has no plausible staleness window — vetoing on something permanently and irreversibly true
> when the page opened (a static config flag) adds nothing.

**Latch a value that describes how the record was entered, when the same action would change
the field the value is derived from.** A submit button's label ("Submit" vs. "Resubmit") is
captured **once**, in a closure variable set on first read — not recomputed live off
`pageState` — because `submit()` rewrites the same field the label reads, and a live read
flips the label mid-submission while the request is still in flight:

```javascript
// ✓ Captured once, from the state the page was entered in
let entryProgress = null
const enteredAsDraft = () => {
  if (entryProgress === null) {
    const current = String(record.value.Progress ?? '').trim()
    if (!current) return false   // still hydrating — not an answer, don't record it
    entryProgress = current
  }
  return entryProgress === 'DRAFT'
}
```

This is the one deliberate exception to §3.3's "never compute a modifier value eagerly"
rule — that rule is about values that should track the *live* record; this is for values
that must describe the record as it *was*, precisely because the wizard's own action is
about to change it.

**Label the primary button with the transition it performs, never "Save".** Sending the
record on is the point of the page. Which verb depends on the state the page was entered in
— a record that has never been submitted reads `Submit`, one that came back for changes
reads `Resubmit`, and calling a first submission "Resubmit" tells the user they have done
this before. A page with exactly one possible outcome uses a static label; one whose label
follows the record's state uses a getter (§11 rule 4).

---

## 14. Generation Checklist

Run this per new module. Each step cites the section that governs it.

1. **Read the workflow instructions for this module** (§0) — build exactly what they call
   for; do not default to a preset shape.
2. **Confirm the UI has a `_config/`** — `_ui/{Ui}/_config/config.js` + `config.md` exist
   before the first component (§10.3).
3. **Scaffold Layer 2** — `src/_resource/{Scope}/{Resource}/composables/use{Feature}.js`
   with the workflow vocabulary, its label/colour/icon functions, and the state predicates
   (§4.2, §4.4, §4.5). No Vue context.
4. **Scaffold the injection-relay UI Composable per page** —
   `_ui/{Ui}/composables/{Scope}/{Resource}/{Page}/use{Resource}Context.js` (§6.2).
5. **Build the Index page** — page header + whichever widgets the workflow's queues actually
   call for, ordered by urgency (§9.2); switcher gating (§9.3); work queues as
   `List<ViewName>` content (§7.1); no hand-written list resolvers before checking the list
   strategy's defaults (§9.4); row action clusters capped and state-keyed (§7.3).
6. **Build Add/Edit** — pick the form shape (§13.0); for a generated form let `_fields`
   generate the set (§13.1) and narrow only via `fields`/`showFields`/`hideFields`/
   `fieldProps` (§13.3); share cards between Add and Edit at the resource tier (§13.4);
   route intent through control fields and stamps through the handler (§13.5); wire
   `PageAction.js` if multi-step (§13.6).
7. **Build View** — start with the generic grid + `ViewColumn<Col>`; upgrade to
   business-concept cards only if §7.4's checklist says so, and give each the authoring
   contract in §7.5.
8. **Build any action route** — contract with an explicit title and `reload: false`, cards
   at the tier their reuse demands, hydration in the first content (§5.5); sticky bar owns
   navigation and submission (§8.2–§8.4).
9. **Apply the visual contract** — the UI's `cardClass` (§10.1), `gutter` for vertical and a
   declared `padding` for horizontal (§10.2), all three quiet states (§10.4), no hardcoded
   tokens (§10.3).
10. **Verify the import chain** — every `.vue` imports only UI Composables (§6.1); every UI
    Composable imports only Resource Composables + generic Core Composables; every Resource
    Composable imports only generic Core Composables. Zero store/service imports outside
    Layer 1.
11. **Verify leaf-only `inheritAttrs: false`** on any new nested component chain (§12.1).
12. Run `gitnexus_detect_changes()` before committing.

---

## 15. Troubleshooting

| Symptom | Cause |
|---|---|
| "Section / Content / Action Not Defined" card | No base and no `.vue` candidate. Check the folder is PascalCase with **no hyphens**, and that the file sits in the folder matching its paradigm (§2.1). |
| Override file ignored entirely | A `.vue` exists at the same tier — it wins and the `.js` is never read (§3). |
| A stray object value in the DOM (e.g. `[object Object]` on an attribute) | Missing `inheritAttrs: false` on the leaf component in a drill path (§12.1). |
| A modifier's value never updates | It was computed eagerly inside the modifier. Return a function-valued prop instead (§3.3). |
| A widget is permanently empty for a user who should see it | A permission read taken outside the `items` closure latched `false` before auth landed (§9.2). |
| The wizard's buttons never change past step 1 | `actions` was declared as a literal array instead of a getter (§11 rule 4). |
| A submit succeeds but shows no toast | The handler returned `successMessage`; a handler returns `successMsg` (§8.2). |
| An action button is silently always disabled | An `allowed()` map used an all-caps action name, which resolves to a key that can never match (§8.4). |
| Cancel leaves the user two history entries back | The handler navigated but didn't `return false`, so the built-in `goBack()` also ran (§8.2). |
| A relation reference is `undefined` in a list row | A record was spread somewhere upstream (§11 rule 1). |
| A predicate throws on a freshly created child row | An enriched relation carried `null`; normalize before the guard (§11 rule 2). |
| Per-view override never fires | The sheet's view `name` includes the `List` prefix. Use the bare bucket name (§7.1). |
| A per-view `.vue` override renders an empty list | It read only `props.items` and the rows arrived on `attrs` (§7.1). |
| A `Props<Identity>` block's `items`/`chip` is `undefined` inside the block function | The block was written as a static object. Only a **function** block is called with the live props bag (§5.2). |
| A `String` prop receives a closure | A function was put on one key instead of making the whole block a function (§5.2). |
| Page title/back arrow vanished after adding a section | `sections` replaces the base contract's array. Re-list the page header (§5). |
| A shared card is invisible on the Edit page | It gated on `currentStep === 2`; a single-view page never leaves step 1. Use the `step` prop (§13.6). |
| Form re-seeds defaults on every keystroke | Props allocated inline in the template (§11 rule 5). |
| A blank gap sits where a conditional card should be | The card used `v-show`; a section that renders nothing must `v-if` at its root (§10.4). |
| Two View cards showing different numbers for the same data | Both re-derived the grouped tree independently instead of sharing one UI Composable (§7.4). |
| A funnel segment and a row chip disagree about a state's colour | One of them picked its own colour instead of reading the resource's workflow vocabulary (§4.5). |
| An Index metric changes when the user switches list view | It counted `filteredRecords` instead of `records` (§9.2). |
| A user lands on an empty list with no pill highlighted | The default view was gated away and the active view was never corrected (§9.3). |
| A widget shows a wall of zeroes on a fresh tenant | It zero-filled instead of returning `[]` (§9.2). |
| A money widget shows a wall of `AED 0.00` on a fresh tenant | Its hide guard tested row `.length` instead of the amounts the cards print (§9.2 rule 2). |
| Row buttons push the record name into a multi-line wrap | The cluster exceeded three buttons (§7.3). |
| A UI Composable importing a store directly | Violates §6.1 — relay through a generic Core Composable instead. |
| A `.vue` component calling `inject()` directly | Violates §6.2 — move the injection into that resource's context composable. |
| Domain predicate duplicated across two `_ui/{Ui}/` trees for the same resource | Business logic was left in `_ui/` instead of `src/_resource/` — extract it (§4). |
| Row/card spacing ignores the page's `gutter` | A list-like component is hardcoding `q-gutter-y-*` or `q-mb-*` instead of taking the `gutter` token (§10.2). |
| A card looks subtly different from its neighbours | It hardcoded a shell class instead of reading the UI's `cardClass` (§10.1). |
| A manually mounted `_fields` control ignores its label or test hook | The value was passed as an attribute; `_fields` controls set `inheritAttrs: false` and read `config` ([`_fields/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/REGISTRY.md)). |
| A field type gains an alias or a prepared-props branch and one control doesn't follow it | That control deep-imports `_fields/{type}/Add.vue` instead of calling `resolveFieldComponent` (§2.4). |
| Cards in a grouped list sit at a different rhythm from the rest of the page | Spacing was put in `card-class`; it is appearance only, and spacing goes through the list's `gutter` prop (§10.1). |
| A control's tap size stops matching the rest of the UI after a token change | It hardcoded `min-width`/`min-height` instead of binding `tapTargetStyle` (§10.5). |
| Two cards on one page both carry an accent tint | Only the leading card that asks for an action may (§7.4). |
| A widget's colour for a state disagrees with the row chip beside it | The widget's `items` payload named its own colour instead of reading the vocabulary (§4.5). |
| A row shows a raw user code like `U0001` | A `*By` stamp holding a code was surfaced in a label/caption (§7.2). |
| A preset's suppressed slot renders anyway | The key was omitted rather than set to explicit `null`, so §9.4's inference filled it (§7.2). |

---

## Maintenance Rule

> [!IMPORTANT]
> Any change to the resolver model, the page-contract conventions, the Index widget rules,
> the form-shape decision, the View blueprint, or the visual contract MUST be reflected in:
> 1. This document.
> 2. [resource_ui_module_developer.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/resource_ui_module_developer.md) — its condensed checklist must stay in sync with §14 above; this is the one deliberate duplication in this guide's ecosystem.
> 3. [CORE_DOC_ROUTING.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_DOC_ROUTING.md) if the routing rule for resource-UI-module generation changes.
> 4. [AGENTS.md](file:///f:/LITTLE%20LEAP/AQL/AGENTS.md) if the Query Classification or Initialization Prompt Routing entries change.
>
> Ownership of the three catalogues this guide links rather than restates:
> - A `_fields` type, or the manual field-mounting contract →
>   [`_fields/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/REGISTRY.md).
> - A reusable Section/Content/app component, its props or its hide rule →
>   [`components/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md).
> - A UI's design tokens and their rationale → that UI's `_ui/{Ui}/_config/config.md`.
>
> A change to the three-layer boundary, the strict import chain, or the injection-relay
> pattern is owned by
> [UI_RESOURCE_DOMAIN_LOGIC.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md) —
> update it first, then sync this document's §4/§6 summaries to match.
