# AQL Custom UI Guide

The canonical, production-ready reference for customizing AQL's frontend under
`FRONTENT/src/_ui/`. Everything a tenant can change — a whole page, one section, one
content block, one action button, one field control — is changed here, without touching
a framework file.

This document is the **operational** guide: where a file goes, what it must contain, and
which layer wins. The subsystem specs it complements:

| Subsystem | Canonical spec |
|---|---|
| Pages & Sections | [AQL_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_PAGE_AND_SECTION_SYSTEM.md) |
| Contents | [AQL_CONTENT_CUSTOMIZATION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_CONTENT_CUSTOMIZATION_SYSTEM.md) |
| Actions | [AQL_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_ACTION_SYSTEM.md) |
| Create / Update forms | [AQL_CREATE_AND_UPDATE_CONTENT_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_CREATE_AND_UPDATE_CONTENT_SYSTEM.md) |
| View content | [AQL_VIEW_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_VIEW_SYSTEM.md) |
| Page state / submission | [PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/PAGE_STATE.md) |
| Reusable component prop surface | [AQL_RENDERABLE_CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_RENDERABLE_CONTRACT.md) |

---

## 1. The Model in One Picture

Every resource page is assembled at runtime from **placeholders**. A placeholder is a
generic component that is told *what* it stands for and resolves *which* component
actually renders through a registry scan.

```
vue-router
   │
   └─ src/pages/Page.vue ──── usePageResolver ──┬─ base page contract   src/pages/{Scope}/{page}.js
                                                └─ page override scan   _ui/{Ui}/pages/…            (§4)
        │
        ├─ <ResourceBreadcrumb />                       always, never overridable via _ui
        │
        ├─ .aql-page-body
        │     ├─ <Section section="PageHeader"  v-bind="pageProps" />   → useSectionResolver  (§5)
        │     ├─ <Section section="…"           v-bind="pageProps" />
        │     └─ <AqlContentWrapper>
        │           └─ <Content content="List"  v-bind="pageProps" />   → useContentResolver (§6)
        │
        └─ <Action action="PageAction" v-bind="pageProps" />            → useActionResolver  (§7)
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

## 2. Folder Layout & the `uiName`

```
FRONTENT/src/_ui/
└─ AQL/                      ← the {UiName}; PascalCase folder
   ├─ components/            ← placeholder overrides ONLY (§2.2)
   │  ├─ sections/           ← tenant-wide generic BASE sections   (§5.1a)
   │  ├─ contents/           ← tenant-wide generic BASE contents   (§6.1a)
   │  ├─ actions/            ← tenant-wide generic BASE actions    (§7.1a)
   │  ├─ {Scope}/                                     e.g. Operation, Master
   │  │  ├─ {Resource}/                               e.g. OutletVisits
   │  │  │  ├─ {page}/                                e.g. Index, View, Add, Edit
   │  │  │  │  └─ {Placeholder}.vue | .js
   │  │  │  └─ {Placeholder}.vue | .js
   │  │  └─ {Placeholder}.vue | .js
   │  └─ {Placeholder}.vue | .js
   ├─ composables/           ← ALL shared helper logic (§2.2)
   │  └─ {Scope}/
   │     └─ {Resource}/
   │        └─ use{Feature}.js
   └─ pages/                 ← page contracts & full-page overrides (§4)
      ├─ {Scope}/
      │  ├─ {Resource}/
      │  │  └─ {page}.vue | {page}.js
      │  └─ {page}.vue | {page}.js
      └─ {page}.vue | {page}.js
```

`{UiName}` comes from `APP.Resources.CustomUIName` for the resource, exposed as
`resourceConfig.customUIName` and **defaults to `'AQL'`** when the column is blank. So
`_ui/AQL/` is always scanned — it is the framework's default client, not a special-case
tenant. A second tenant is a sibling folder (`_ui/Heilung/`) plus a `CustomUIName` value
in the sheet; no code change.

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
| `{Placeholder}` | section / content / action name | lowercased as-is | `PageHeader` → `pageheader` |

`{page}` is the **canonical** page name resolved by `useRouteConfig`: `'index'`, `'view'`,
`'add'`, `'edit'`, `'action'`, or a custom sub-route slug.

### 2.2 Helper logic belongs in `composables/`, not `components/`

> [!IMPORTANT]
> **`_ui/{Ui}/components/` holds placeholder overrides and nothing else.** Every piece
> of shared helper logic — the vocabulary of a domain, derived formatters, row presets,
> gate predicates — goes in `_ui/{Ui}/composables/{Scope}/{Resource}/use{Feature}.js`.
> A loose `.js` file dropped into a component folder is a layering mistake, even though
> the resolver tolerates it.

The resolver *does* tolerate it: a file under `_ui/` whose name matches no placeholder is
indexed by the Vite glob but never resolved, so a stray helper is functionally harmless.
That is exactly why the rule has to be explicit rather than enforced — nothing breaks,
the folder just stops meaning anything. Once `components/` mixes overrides with helpers,
"is this file a resolution target?" can only be answered by knowing every placeholder
name by heart.

```
_ui/AQL/
├─ composables/Operation/OutletVisits/
│  └─ useVisitProgress.js       ← progress vocabulary, delay maths, row presets
└─ components/Operation/OutletVisits/
   ├─ VisitDetails.vue          ← resolves as the VisitDetails section
   └─ Index/
      └─ ListToday.vue          ← resolves as the ListToday per-view content
```

**Naming and shape.** The file is `use<Feature>.js` and should export a matching
`use<Feature>()` function, so the name is not a lie. But note what consumes these
helpers: page contracts (`pages/.../Index.js`) and JS modifiers are evaluated **outside
any component setup**, so they cannot call a composable that injects context or holds
reactive state. The workable shape is therefore:

```javascript
// _ui/AQL/composables/Operation/OutletVisits/useVisitProgress.js

// Named PURE exports — importable from a page contract or a JS modifier.
export function progressColor (row) { /* … */ }
export function respondDelayDays (row) { /* … */ }

// Composable shape for setup-context callers. Same functions, one import.
export function useVisitProgress () {
  return { progressColor, respondDelayDays }
}
```

Reach for `inject()`/`ref()` inside one of these only when every caller is a component.
Prefer pure functions of a record: they are testable without mounting anything, and they
stay usable from the page contract.

---

## 3. The 10-Tier Lookup

Identical in shape for all three resolvers. **First match wins, most specific first.**
`{P}` is the lowercased placeholder name.

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
`.js` is never read. To keep the base template *and* change props, use only the `.js`.

### 3.1 Two-step resolution

Every resolver runs the same two steps:

**Step 1 — find the BASE component:**

1. `_ui/{ui}/components/{sections|contents|actions}/{P}.vue` — tenant-wide generic base.
2. `src/components/{sections|contents|actions}/{P}.vue` — framework default base.
3. Otherwise, **the first `.vue` candidate from the 10-tier list is promoted to base.**
4. Otherwise, the caller-supplied `defaultComponent` (e.g. `contents/List.vue` passes
   `AppList`; `PageAction.vue` passes `FormActions`/`ResourceActions`).
5. Otherwise, the placeholder renders its "… Not Defined" warning card, naming the
   placeholder, page, resource and scope.

Step 1.3 is what lets you invent a **brand-new** placeholder with no framework base at
all: drop `_ui/AQL/components/Operation/OutletVisits/VisitDetails.vue`, list
`'VisitDetails'` in the page's `sections`, and it renders. No registration anywhere.

**Step 2 — scan the 10 tiers** for an override or modifier of that base.

### 3.2 Vue override vs JS modifier

| | Vue override (`.vue`) | JS modifier (`.js`) |
|---|---|---|
| Effect | **Replaces** the base component's template entirely | **Keeps** the base component, changes the props fed to it |
| Receives | `finalProps` unmodified, readable via `$attrs` | `(currentProps, ctx)` and returns a props object |
| Use when | The layout itself is wrong | Only labels / colours / data / visibility are wrong |
| Precedence | Wins over a `.js` at the same tier | Final layer of the props merge (§8) |

A JS modifier exports **either** a plain object **or** a function:

```javascript
// _ui/AQL/components/Master/Products/PageHeader.js
// ctx = { pageState, resourceRecord, resourceConfig } — the RAW injected objects,
// so read through .record.value / .config.value here.
export default (currentProps, { pageState, resourceRecord, resourceConfig }) => ({
  // A FUNCTION-valued prop is re-evaluated per render by the receiving component
  // through evaluateProp — which is how a modifier stays reactive. See §3.3.
  title: (record) => `Product: ${record?.Name || 'Unnamed'}`,
  chipColor: 'accent'
})
```

```javascript
// Plain object form — static, no context needed.
export default { title: 'Product Catalogue', reload: false }
```

> [!IMPORTANT]
> **A modifier function is evaluated ONCE per resolve, not per render.** The resolver
> caches its returned object and re-runs it only when a lookup key (`{P}`, page, scope,
> resource, uiName) changes. If a value must track the record, return it as a
> **function-valued prop** — never compute it eagerly inside the modifier.
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

### 3.3 `evaluateProp` — the closure contract

Customizable props are typed `[Type, Function]`, and the receiving component resolves
them through `evaluateProp(value, resourceRecord, resourceConfig)`:

```javascript
export function evaluateProp (val, resourceRecord, resourceConfig) {
  if (typeof val !== 'function') return val
  return val(resourceRecord?.record?.value ?? null, resourceConfig?.config?.value ?? null)
}
```

So a closure receives **plain unwrapped objects**:

```javascript
title: (record, config) => `${config?.name}: ${record?.Code}`   // ✓
title: (record) => record.value.Code                            // ✗ never call .value
```

`evaluateProp` is exported from `useSectionResolver.js` and re-exported from
`useActionResolver.js` / `useContentResolver.js`, so import it from whichever resolver
matches the component's folder.

> [!NOTE]
> **Per-item list resolvers are NOT `evaluateProp` props.** `label`, `caption`, `chip`,
> `chipColor`, `highlightColor`, `btn` on `List`/`AppList` are `(item) => value`
> resolvers, forwarded untouched to `abstract/List.vue` and called once per row. Do not
> route them through `evaluateProp`.

---

## 4. Overriding a Whole Page

`usePageResolver` loads the base page contract `src/pages/{Scope}/{page}.js`, then scans
**6** page candidates (first match wins):

| # | Path under `_ui/{ui}/pages/` | Type |
|---|---|---|
| 1 | `{scope}/{resource}/{page}.vue` | Full Vue override |
| 2 | `{scope}/{resource}/{page}.js` | JS modifier |
| 3 | `{scope}/{page}.vue` | Scope-wide Vue override |
| 4 | `{scope}/{page}.js` | Scope-wide JS modifier |
| 5 | `{page}.vue` | UI-wide Vue override |
| 6 | `{page}.js` | UI-wide JS modifier |

**`meta.page` → base-contract filename:** `'resource-page'` → `resource.js`,
`'record-page'` → `record.js`, anything else → `{page}.js`.

### 4.1 Page JS modifier — the preferred tool

A page modifier declares *which* placeholders render and hands each its props. This is
how nearly all page customization should be done.

```javascript
// _ui/AQL/pages/Operation/OutletVisits/Index.js
export default {
  sections: ['PageHeader', 'MetricCards', 'LinearProgress', 'FilterInput', 'ListSwitcher'],
  contents: ['List']
}
```

```javascript
// Function form — receives the merged baseProps (rcProps + base contract).
export default (baseProps) => ({
  sections: baseProps.loading ? ['PageHeader'] : ['PageHeader', 'ListSwitcher'],
  contents: ['List']
})
```

> [!IMPORTANT]
> **`sections` and `contents` REPLACE the base contract's arrays; they do not extend
> them.** Omitting `'PageHeader'` drops the page title and back arrow. Always re-list
> everything you still want.
>
> The function form is invoked **inside the `pageProps` computed**, so it re-evaluates on
> every reactive read. Keep it pure and cheap — no side effects, no fetching. Unlike
> section/content/action modifiers it receives only `baseProps`; there is no `ctx`.

**`sections` vs `contents`:**

| | `sections` | `contents` |
|---|---|---|
| Rendered | directly inside `.aql-page-body` | inside `<AqlContentWrapper>` |
| Resolver | `useSectionResolver` | `useContentResolver` |
| Gating | none — mounts immediately | wrapper handles loading spinner, "Record not found", empty dataset, and the submission overlay |
| Use for | page chrome: header, metrics, filter, switcher | the page body: list, form, detail blocks |

A section therefore **must carry its own loading / missing-record guard**. An empty or
absent `contents` array skips the wrapper entirely.

### 4.2 Page contract props

`pageProps` is one flat object `v-bind`-ed onto **every** placeholder on the page:

| Prop | Type | Description |
|---|---|---|
| `page` | String | `'index'` \| `'view'` \| `'add'` \| `'edit'` \| `'action'` \| custom slug |
| `scope` | String | `'master'`, `'operation'`, `'accounts'`, … |
| `resource` | String | resource slug from the route (`'outlet-visits'`) |
| `uiName` | String | resolved `customUIName`, default `'AQL'` |
| `gutter` | String | Quasar spacing token for the page's vertical gutter (default `'xs'`) |
| `pageClass` | String | extra classes on the `q-page` root |
| `contentPadding` | String | Quasar padding token on `<AqlContentWrapper>` (default `'sm'`) |
| `contentClass` | String | extra classes on `<AqlContentWrapper>` |
| `loading` | Boolean | record/list loading, already **unwrapped** |
| `noActions` | Boolean | `true` suppresses the whole `<Action action="PageAction">` mount |
| `noReports` | Boolean | `true` suppresses only the report cluster, keeping the CRUD FABs |

Anything else a contract exports rides along as an extra prop and reaches every
placeholder through `$attrs` — which is exactly the problem `Props<Identity>` solves.

> [!IMPORTANT]
> **`pageProps` carries no form state.** Form values, validation, saving/submitting flags
> and every save/submit handler live in `usePageState`, injected as `'pageState'`.

### 4.3 Full-page Vue override — the last resort

`_ui/{ui}/pages/{scope}/{resource}/{page}.vue` replaces the page body outright: the
section/content layout is bypassed and the component is mounted with
`v-bind="pageProps"`. `ResourceBreadcrumb`, the `PageAction` cluster and `ActionDialog`
still render (they sit outside the overridden branch).

Prefer a page JS modifier plus custom sections. A full override loses every tier of
downstream overridability at once, so use it only when the page is genuinely not a
sequence of stacked blocks.

---

## 5. Sections — Page Chrome

Framework bases in `src/components/sections/`: `PageHeader.vue`, `FilterInput.vue`,
`ListSwitcher.vue`, `ListSwitcherItem.vue`, `MetricCards.vue`, `LinearProgress.vue`.

### 5.1 Resolution

1. `_ui/{ui}/components/sections/{P}.vue` — tenant-wide generic base.
2. `src/components/sections/{P}.vue` — framework base.
3. First `.vue` from the 10 tiers, promoted to base (this is the new-section path).
4. → 10-tier override scan (§3).

`useSectionResolver` injects `resourceConfig`, `resourceRecord` and `pageState`
internally so it can pass them to modifier functions. A section that needs them in its
own template must still inject them itself.

### 5.2 Authoring a section component

```html
<template>
  <!-- Guard: a Section renders OUTSIDE AqlContentWrapper, so it inherits no gating. -->
  <q-card v-if="record" flat bordered class="aql-my-card q-mx-sm">
    <q-card-section>{{ finalTitle }}</q-card-section>
  </q-card>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'

// 1. inheritAttrs: false is MANDATORY — see the drilling note in §8.
defineOptions({ name: 'OutletVisitsVisitDetails', inheritAttrs: false })

// 2. Every customizable prop accepts Function as well as its raw type.
const props = defineProps({
  title: { type: [String, Function], default: 'Visit Details' },
  color: { type: [String, Function], default: null }
})

// 3. Inject the page contexts, always with a null default.
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const pageState      = inject('pageState', null)

function evalProp (val) { return evaluateProp(val, resourceRecord, resourceConfig) }

// 4. Resolve closures in computeds, never inline in the template.
const finalTitle = computed(() => evalProp(props.title))
const record     = computed(() => resourceRecord?.record?.value || null)
</script>
```

Checklist for any new section, content or action component:

- [ ] `defineOptions({ name, inheritAttrs: false })`
- [ ] Customizable props typed `[Type, Function]`, resolved through `evaluateProp`
- [ ] Contexts injected with `null` defaults; never fetch — read `resourceRecord`
- [ ] **No `<style>` block** — see §10
- [ ] Navigate via `useResourceNav().goTo(...)`, never a raw `router.push`
- [ ] Never spread an enriched record (§9)
- [ ] Guard on loading / missing record if it is a Section
- [ ] File in the folder matching its paradigm

### 5.3 The enriched record

`resourceRecord.record` / `.records` hand out **cached reactive objects built entirely
from `Object.defineProperty` getters** — no own data properties:

| Key shape | Example | `enumerable` | Resolves to |
|---|---|---|---|
| Sheet header | `Code`, `OutletCode`, `Progress` | `true` | live value from the data store |
| `$<parentSingular>` | `$outlet`, `$warehouse` | **`false`** | the enriched parent record |
| `$<ChildResource>` | `$OutletVisitItems` | **`false`** | array of enriched child records |
| `_Parents` / `_Parent` | — | **`false`** | relation key list / keyed map |
| `_Children` / `_Child` | — | **`false`** | relation key list / keyed map |
| `_relation` | — | **`false`** | raw relation metadata |

This is why §9's no-spread rule exists.

---

## 6. Contents — The Page Body

Framework bases in `src/components/contents/`: `List.vue`, `View.vue`, `Create.vue`,
`Update.vue`, `FormRecord.vue`, `FormChild.vue`, `ViewRecord.vue`, `ViewChildren.vue`,
`ViewParent.vue`, `ViewAudit.vue`, `ViewChildCompact.vue`, `ViewRecordWithAudit.vue`.

Resolution mirrors §5.1 with `contents/` as the base folder, then the 10-tier scan.

### 6.1 Per-active-view list overrides — `List<ViewName>`

When a list view is active, `contents/List.vue` sets its resolver identity to
``List${toPascalCase(activeViewName)}`` instead of plain `'List'`. This is the single
most useful content override in the system.

```
APP.Resources.ListViews  →  [{ "name": "Today", … }, { "name": "Overdue", … }]
                                      │
active view "Today"  ──►  content identity "ListToday"
                                      │
       _ui/AQL/components/Operation/OutletVisits/Index/ListToday.vue    (Vue override)
       _ui/AQL/components/Operation/OutletVisits/Index/ListToday.js     (JS modifier)
```

> [!IMPORTANT]
> The view's `name` in the sheet is the **bare bucket** (`"Today"`), not `"ListToday"`.
> The `List` prefix is added by the resolver. A view named `"ListToday"` looks for
> `ListListToday` and matches nothing.

Both a `PropsList<ViewName>` block and a `List<ViewName>.js` modifier receive the live
props — including the already-filtered `items` — so either can reorder or re-present rows.
**Start with the page-contract block** (§8.3) and fall back to a file only when it earns
one:

```javascript
// _ui/AQL/pages/Operation/OutletVisits/Index.js — no per-view file needed
import { sortByDate } from 'src/_ui/AQL/composables/Operation/OutletVisits/useVisitProgress'

export default {
  contents: ['List'],
  PropsListCompleted: (props) => ({
    // Sorting returns a NEW ARRAY but carries the element references through, so the
    // enriched records keep their relation getters. Never map to copies. (§9)
    items: sortByDate(props.items, 'RespondDate', 'desc'),
    layout: ['label', 'caption'],
    content: [(ov) => ov.$outlet?.Name, (ov) => ov.ProgressCompletedComment]
  })
}
```

```javascript
// _ui/AQL/components/Operation/OutletVisits/Index/ListOverdue.js
// A file IS warranted here: `btn` is a component, which a value bag should not carry.
import VisitActionButtons from './VisitActionButtons.vue'

export default function (props) {
  return { items: sortByDate(props.items, 'Date', 'asc'), btn: VisitActionButtons }
}
```

A per-view **Vue** override receives the active view's records as `items` and must never
re-read `resourceRecord` (that would bypass the search term and the view filter).

Absent any `List<ViewName>` match, resolution falls through silently and `AppList`
renders with the header-derived defaults from `useListStrategy` — so a view needs an
override only when it wants something different.

### 6.2 Form and field overrides

Within `Create`/`Update`, three further hierarchies resolve **only** under `_ui/` (no
framework fallback):

| Override | Path | Scope |
|---|---|---|
| `FormChild<ChildName>` | `_ui/{ui}/components/{scope}/{resource}/formchild{child}.(vue\|js)` | one child block |
| `FormRecord` | `_ui/{ui}/components/{scope}/{resource}/formrecord.(vue\|js)` | the primary form |
| `FormField<Header>` | `_ui/{ui}/components/{scope}/{resource}/formfield{header}.(vue\|js)` | one column's control |

Field **visibility** inside a form follows a strict precedence chain —
`showFields` > `hideFields` > `workflowFields` — and `fields` fixes both the set and the
order:

```javascript
// _ui/AQL/pages/Operation/OutletVisits/Edit.js
export default {
  sections: ['PageHeader'],
  contents: ['Update'],
  PropsUpdate: {
    fields: ['Date', 'ProgressPlannedComment'],   // set AND order
    // ProgressPlannedComment ends in 'Comment', so the default workflowFields:'hide'
    // strips it. showFields is the highest-precedence switch and re-admits that ONE
    // field without turning every workflow-stamp column on.
    showFields: ['ProgressPlannedComment'],
    withChildren: false,
    fieldProps: { Date: { required: true, label: 'Visit Date' } }
  }
}
```

`fieldProps` merges **over** the base control props from `useFormFields`, so it is also
how you narrow a relation picker:

```javascript
fieldProps: { OutletCode: { options: availableOutletOptions.value } }
```

Read `crossRefOptions` from `useFormFields(resourceName)` and **filter** it rather than
rebuilding the list — the `Relations.labelHeader` rendering (`Name (Code)`, parent paths,
templates) lives there and a hand-rolled list drifts the moment that config changes.

> [!NOTE]
> **Content overrides do not control field rendering.** How a *field type* looks is
> `src/components/_fields/<type>/{Add,Edit,View}.vue`, resolved by
> `resolveFieldComponent(type, mode)` — changing it affects every resource. How *one
> column of one resource* looks is a `FormField<Header>` / `ViewColumn<Col>` override.

---

## 7. Actions — Dispatch & FABs

Framework bases in `src/components/actions/`: `PageAction.vue`, `FormActions.vue`,
`FormActionSubmit.vue`, `FormActionReset.vue`, `FormActionCancel.vue`,
`ResourceActions.vue`, `ResourceActionItem.vue`, `ResourceActionsFab.vue`,
`ResourceReports.vue`.

`Page.vue` mounts exactly one `<Action action="PageAction" v-bind="pageProps" />` on every
resource page, gated only by `noActions !== true`. It is **not** driven by the `sections`
array, so a page contract never declares it.

`PageAction` then picks the live cluster:

* `add` / `edit` / `action` → `FormActions` (the sticky bottom bar)
* everything else → `ResourceActions` (the CRUD + workflow FAB cluster) **and**
  `ResourceReports`

Every level is mounted through `useActionResolver`, so each is independently overridable
at all 10 tiers.

> [!IMPORTANT]
> **`useActionResolver`'s `finalProps` is a computed, not a snapshot.** Section and
> content resolvers assign their merged props inside the watch callback, which re-runs
> only on a lookup-key change — freezing every other prop at first resolve. Action props
> change constantly without touching a lookup key (a submit button enabling, a label
> switching on record status), so the action resolver recomputes over the live props and
> caches only the JS-modifier result.

### 7.1 The three most common action overrides

**Gate or restyle one FAB item.** Each `AdditionalActions` entry and each CRUD button
resolves under its **own** action name with `ResourceActionItem` as the fallback base:

```javascript
// _ui/AQL/components/Operation/OutletVisits/ResourceActionEdit.js
import { isPlanned } from 'src/_ui/AQL/composables/Operation/OutletVisits/useVisitProgress'

export default {
  // Function-valued so evaluateProp re-runs it per render — a cached boolean would
  // latch at first resolve and stay stale after an action settles the record.
  show: (record) => isPlanned(record),
  label: 'Edit Visit'
}
```

`show: false` / `hide: true` suppress an item; `handler: (ctx) => …` with
`ctx = { record, config, pageState, nav }` **replaces** its click behaviour outright.
Names follow the config: a `Postpone` action resolves as `resourceactionpostpone.(vue|js)`.

**Change the sticky bar's buttons, or veto a submission.** The container owns both:

```javascript
// _ui/AQL/components/Operation/PurchaseOrders/Add/PageAction.js
export default {
  actions: ['cancel', 'submit'],                  // replaces the default ['reset','submit']
  submit: (name, { pageState }) => {
    const node = pageState.state.nodes.get('PurchaseOrders')
    if (!node?.children?.length) return { valid: false, message: 'Add at least one item.' }
  },
  successRoute: 'view',
  successMessage: 'Purchase order created.'
}
```

Every button routes through one dispatcher, `handleAction(name, payload)`, which looks a
handler up **by the action's own name**. A handler returning `false` or
`{ valid: false }` aborts; an array becomes `{ requests: [...] }`; an object is merged
into the `pageState` call options; `undefined` continues with the default. Handlers are
`async`-aware.

A custom key needs **both** an entry in `actions` (which renders `FormAction<Key>`) and a
handler exported from the same `pageaction.js`. Supply the button as
`_ui/.../formaction<key>.vue`. Without a handler the button renders and logs
`[PageAction] No action handler supplied for: <key>`.

**Disable a single button conditionally:**

```javascript
// _ui/AQL/components/Operation/OutletVisits/Edit/FormActionSubmit.js
import { isPlanned } from 'src/_ui/AQL/composables/Operation/OutletVisits/useVisitProgress'
export default { disabled: (record) => !isPlanned(record), label: 'Save Visit' }
```

> [!IMPORTANT]
> The cancel-override prop is `cancelHandler`, **not** `onCancel`. Vue treats any `onXxx`
> prop as an emit listener, which would silently bind `pageProps.onCancel` and
> double-navigate.

### 7.2 Workflow eligibility is not yours to re-derive

`AdditionalActions` gating — permissions, `visibleWhen`, `only`/`exclude`, and
navigate-vs-mutate dispatch — lives in
`composables/resources/useAdditionalActions.js`; request mechanics live in
`additionalActionsPipeline.js`. `ResourceActions`, `AdditionalActionsButtons`, custom list
rows and `usePageState` all ask those two. A component that re-derives eligibility drifts
from the config contract.

Ordering is the **one** thing a consumer may decide locally — it is presentation:

```javascript
const { actionsFor, runAction } = useAdditionalActions('OutletVisits')
const ordered = computed(() =>
  actionsFor(props.item, { only: ['Complete', 'Postpone', 'Cancel'] })
    .sort(byEscalationOrder)
)
```

### 7.3 Suppression gates

| Gate | Effect |
|---|---|
| `noActions: true` | drops the entire `<Action>` mount — bar and both FAB clusters |
| `noReports: true` | drops only the report cluster; CRUD FABs stay |
| `reports: { mode: 'toolbar' }` | keeps reports but relocates them |
| `resourceactions.js` → `{ show: false }` | drops the CRUD/workflow cluster only |

`noActions` does **not** suppress the `AdditionalActionsDialog` — that is mounted in
`MainLayout.vue`, independent of `<Action>`, so an `AdditionalActionsButtons` trigger
elsewhere on the page keeps working.

---

## 8. `Props<Identity>` — Targeted Props

`Page.vue` binds one flat `pageProps` to **every** placeholder, and each placeholder
drills `$attrs` down to whatever it mounts. That is a single global namespace: a `title`
meant for `PageHeader` also lands on `FilterInput` and `List`.

`Props<Identity>` carves targeted namespaces out of that same flat bag. Any layer that
contributes props — a base contract, a page modifier, a placeholder JS modifier — may
declare them:

```javascript
// _ui/AQL/pages/Operation/OutletVisits/Index.js
export default {
  sections: ['PageHeader', 'MetricCards', 'FilterInput', 'ListSwitcher'],
  contents: ['List'],

  PropsSection:    { dense: true },               // broadcast: every section
  PropsContent:    { flat: true },                // broadcast: every content
  PropsAction:     { dense: true },               // broadcast: every action
  PropsPageHeader: { title: "Today's Visits" },   // just PageHeader
  PropsList:       { layout: ['label'] },         // just the List content
  PropsListToday:  { perPage: 50 }                // just the per-view ListToday hop
}
```

**The block is spread FLAT onto the target.** `ListToday` reads `props.perPage` — never
`props.PropsListToday.perPage`.

| Kind | Broadcast key | Identity source | Resolver |
|---|---|---|---|
| Section | `PropsSection` | the `sections:` entry | `useSectionResolver` |
| Content | `PropsContent` | the `contents:` entry | `useContentResolver` |
| Action | `PropsAction` | the `action` prop | `useActionResolver` |

### 8.1 Precedence

Applied in each resolver's `finalProps`, later wins:

```
drilled $attrs  →  Props<Kind> broadcast  →  Props<Identity>  →  JS modifier
```

The JS modifier stays final, matching every other override in the system: a
`pageheader.js` beats a `PropsPageHeader` block declared by the page.

### 8.2 Rules

* **Keys are never stripped once consumed.** Every `Props*` key keeps riding `$attrs` all
  the way down, so a component nested three levels deep can still claim its own block.
  `ListToday` legitimately receives `PropsPageHeader` and ignores it. This makes the merge
  idempotent.
* **Key matching is case-insensitive** — `PropsListToday` and `propslisttoday` both hit.
* **A block may be a function** — `PropsList: (props) => ({ perPage: props.dense ? 50 : 25 })`
  — evaluated with the live props bag.
* **Non-object blocks are ignored**, arrays included, so a stray string can never be
  spread onto a component.
* **Nested identities work at any depth**, because each resolver claims only its own key.
* Helper: `resolvePlaceholderProps` in
  [`src/utils/placeholderProps.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/placeholderProps.js).
  It returns `null` when nothing matches, so resolvers hand back the original object and
  preserve prop identity across unrelated re-renders.

> [!IMPORTANT]
> **Drilling makes `inheritAttrs: false` mandatory for any component with a DOM root in a
> drill path.** `Props*` blocks are objects; with attribute fallthrough on, Vue writes them
> onto the root element as `propspageheader="[object Object]"`. If a component legitimately
> needs `class`/`style` from callers, re-bind `$attrs.class` / `$attrs.style` explicitly on
> the root (see `abstract/List.vue`).

> [!NOTE]
> **`ListSwitcher` exception.** The per-item keys `item`, `active`, `label`, `icon` and
> `color` are derived per item by `ListSwitcher` and layered *on top of* the resolver
> output, so a `PropsListSwitcherItem` block cannot override them — the switcher-wide
> resolver cannot see individual items. Use `ListSwitcher`'s own `label`/`icon` function
> props, which receive the item.

### 8.3 Prefer a `Props<Identity>` block over a standalone `.js` modifier file

> [!IMPORTANT]
> **A plain prop bag does not need its own file.** If a customization is only *values* —
> labels, colours, layout arrays, per-item resolver functions, sorted `items` — declare it
> as a `Props<Identity>` block in the page contract. Create a `{Placeholder}.js` modifier
> only when the file earns its existence.

The two are functionally near-identical: both land as props, and both accept function
values. What differs is where the knowledge lives. Five sibling `List<View>.js` files
answer "how does this page's list behave?" only if you open all five; one page contract
answers it at a glance.

**Use a `Props<Identity>` block when** the customization is a value bag, and especially
when several sibling identities share one shape:

```javascript
// _ui/AQL/pages/Operation/OutletVisits/Index.js
import { settledPreset, tomorrowPreset }
  from 'src/_ui/AQL/composables/Operation/OutletVisits/useVisitProgress'

export default {
  sections: ['PageHeader', 'MetricCards', 'FilterInput', 'ListSwitcher'],
  contents: ['List'],

  // A FUNCTION block, so it is evaluated with the live props bag and receives the
  // active view's already-filtered `items` — which is what lets it re-sort them.
  // A static object could not see the rows.
  PropsListTomorrow:  (props) => tomorrowPreset(props.items),
  PropsListCompleted: (props) => settledPreset(props.items),
  PropsListPostponed: (props) => settledPreset(props.items),
  PropsListCancelled: (props) => settledPreset(props.items)
}
```

**Create a `{Placeholder}.js` modifier file when** it brings something a page contract
cannot or should not:

| Reason | Example |
|---|---|
| It mounts a **component** as a prop value | `ListOverdue.js` supplying `btn: VisitActionButtons` |
| It needs the modifier **context** | `(props, { pageState, resourceRecord, resourceConfig }) => …` |
| It must apply **across pages** of a resource, or scope-wide | `ResourceActionEdit.js` at tier 4 gates the Edit FAB on every page |
| It must **outrank** a `Props<Identity>` block declared by the page | see the precedence chain in §8.1 |

A `.vue` override is a third, separate case: it replaces the template, so it is never
interchangeable with either of the above.

> [!NOTE]
> **A `Props<Identity>` block cannot suppress a default by omission.** `contents/List.vue`
> layers explicit props *over* the `useListStrategy` baseline, which supplies
> `chip` / `metaLabel` / `metaCaption` / `highlight` defaults. Omitting a key lets the
> strategy default through; only an explicit `null` (or `[]` for `metaLayout`) removes it.
> A preset that wants a bare two-line row has to say so:
> ```javascript
> { layout: ['label', 'caption'], metaLayout: [], chip: null, badge: null,
>   metaLabel: null, metaCaption: null, highlight: false }
> ```

### 8.4 The div-wrap trap

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

Binding `$attrs` **first** is what lets your explicit props win while everything else
passes through.

---

## 9. Reactivity Contracts

These four rules are the ones that break silently.

**1. Never spread an enriched record.** Object spread, `Object.assign({}, record)` and
`JSON.parse(JSON.stringify(record))` copy **enumerable own properties only**. Every
relation getter is non-enumerable, so a spread yields the header fields and **no
`$outlet`, no `_Parents`** — and `item.$outlet?.Name` degrades to `undefined` with nothing
to trace. The spread also snapshots the header getters into plain values, so the copy goes
stale after a background sync.

```javascript
out.push({ ...row, overdueDays: days })   // ✗ strips getters, freezes values
row.overdueDays = days; out.push(row)     // ✓ keeps the enriched reference
```

`Array.prototype.filter` / `sort` are safe — they carry references through. Only
*copying* breaks the contract. A derived property assigned this way lands on the shared
cached record, so namespace such keys to the feature and treat them as display-only.

**2. Modifier functions run once; function-valued props run per render.** See §3.2.

**3. Never allocate props inline in a template.** A literal `:fields="['A','B']"` builds a
new array every render, and `FormRecord` watches `fields`/`defaultValues` **by reference**
— a fresh identity re-runs its resolvers and default-seeding on every keystroke. Hoist to
a module constant, or use a `computed` when the value is genuinely data-derived (a
computed's identity changes only when its dependencies do).

**4. Watch on primitives, never on array literals.** `watch` compares a getter's result
with `Object.is`, so a getter returning a fresh array re-fires on every reactive read.
Every resolver keys its scan on a joined string for exactly this reason.

---

## 10. Styling Contract

* **No `<style>` block in any resolver-backed component** — `sections/`, `contents/`,
  `actions/`, `abstract/`, and every `_ui/` override of one. These are override targets: a
  tenant `.vue` override cannot inherit a scoped style, so scoped CSS silently breaks the
  override contract.
* Shared rules go in
  [`src/css/custom.scss`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/css/custom.scss) as a
  named class. Existing families: `.aql-form-actions-*`, `.aql-resource-action-*`,
  `.aql-report-action-*`, `.aql-list-switcher*`, `.aql-detail-*`, `.aql-metrics*`,
  `.aql-linear-progress*`, `.aql-visit-*`, `.breadcrumb-bar` / `.crumb*`.
* **Quasar-first.** Use Quasar components and flex/spacing utilities; reach for custom CSS
  only when Quasar is genuinely insufficient. Reuse an existing class family before adding
  one — `.aql-detail-grid` / `.aql-detail-line` / `.aql-detail-key` / `.aql-detail-val`
  already give you a label/value grid.
* **A custom detail section should be indistinguishable from a framework one.** Copy the
  grammar of [`contents/ViewRecord.vue`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/ViewRecord.vue)
  rather than inventing a shell:

  ```html
  <SectionDividerLabel :label="finalTitle" />

  <q-card flat bordered class="page-card aql-premium-gradient-card">
    <q-card-section>
      <div class="aql-detail-grid">
        <div class="aql-detail-line items-center aql-detail-row" :style="rowDelay(i)">
          <span class="aql-detail-key">Label</span>
          <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
            Value
          </span>
        </div>
      </div>
    </q-card-section>
  </q-card>
  ```

  `rowDelay(i)` is `{ animationDelay: `${i * 40}ms` }` — the same 40ms cadence, so stacked
  cards animate in step. A bespoke gradient, avatar column or hover-lift is what makes a
  custom section read as blurry and off-grid next to its neighbours; the shared shell also
  means a theme change reaches it for free.
* **Dynamic colours go through a CSS custom property**, not per-colour class variants:
  resolve with `resolveCssColor()` from `src/utils/colorHelpers.js`, write it inline as
  `--aql-<feature>-color`, and derive every layer with `color-mix()`. This is what lets a
  prop accept a Quasar brand name, a palette name (`teal-7`) **and** a raw hex.
* **No `QTable` for record lists** — horizontal scroll on mobile. Use stacked `QCard` /
  `QList` / `AppList`.
* Every animation must honour `@media (prefers-reduced-motion: reduce)`.
* Vertical rhythm belongs to `.aql-page-body` (`q-gutter-y-{gutter}`). A section adds a
  horizontal inset (`q-px-sm`/`q-mx-sm`) only — no `q-py-*`, no `full-width` on its root.

---

## 11. Worked Example — the OutletVisits Custom UI

The complete surface of one heavily customized resource, as a map of which tool was used
for what.

```
_ui/AQL/
├─ composables/Operation/OutletVisits/
│  └─ useVisitProgress.js    ALL shared logic — progress vocabulary, delay/countdown
│                            maths, and the row presets the page contract consumes
├─ pages/Operation/OutletVisits/
│  ├─ Index.js               page contract — sections + contents, and PropsList<View>
│  │                         blocks for all five browse-only views
│  ├─ View.js                page contract — three custom sections replace the generic
│  │                         View content; PropsOutletDetails / PropsVisitDetails /
│  │                         PropsRecentVisits configure them
│  └─ Edit.js                page contract — PropsUpdate restricts the editable fields
└─ components/Operation/OutletVisits/
   ├─ OutletDetails.vue      NEW section — promoted to base, no framework equivalent
   ├─ VisitDetails.vue       NEW section
   ├─ RecentVisits.vue       NEW section
   ├─ ResourceActionAdd.vue  action override — popup form instead of the _add route
   ├─ ResourceActionEdit.js  action modifier — show only while PLANNED
   ├─ Edit/
   │  └─ FormActionSubmit.js action modifier — disable Save unless PLANNED
   └─ Index/
      ├─ MetricCards.js      section modifier — overdue / today counters
      ├─ LinearProgress.js   section modifier — today's completion bar
      ├─ ListToday.vue       per-view override — grouped template, with row actions
      ├─ ListOverdue.js      per-view modifier — sorted, mounts `btn` (a component)
      └─ VisitActionButtons.vue   page-private row cluster (not a placeholder)
```

Note what is **not** there: no `visitProgress.js` beside the components (§2.2), and no
`ListTomorrow.js` / `ListUpcomings.js` / `ListCompleted.js` / `ListPostponed.js` /
`ListCancelled.js`. Those five were value bags, so they live in `Index.js` as
`PropsList<View>` blocks (§8.3). Only `ListToday` (a template) and `ListOverdue` (mounts a
component as `btn`) still earn a file.

Reading the map:

* **New page blocks** → new Sections listed in a page contract's `sections`. No
  registration, no framework file: step 1.3 of §3.1 promotes the `.vue` to base.
* **A row's presentation per list view** → a `PropsList<ViewName>` block in the page
  contract. A file only when it brings a template or a component-valued prop (§8.3).
* **Whether a row offers workflow actions** → presence of a `btn` prop. The browse-only
  views simply omit it, and `contents/List.vue`'s default click handler navigates to the
  View page.
* **Whether a CRUD button is offered** → a `resourceaction<name>.js` returning a
  function-valued `show`.
* **Whether a write is possible** → a `formactionsubmit.js` returning a function-valued
  `disabled`. Hiding the entry point is UX; disabling the submit is the rule.
* **Which fields a form exposes** → `PropsUpdate` / `PropsCreate` on the page contract,
  using `fields` + `showFields`, not a form override.
* **Anything two overrides both need** → a composable under `_ui/AQL/composables/`.
* **How a custom section should look** → reuse the framework detail-card grammar:
  `SectionDividerLabel` + `page-card aql-premium-gradient-card` + the `.aql-detail-grid` /
  `.aql-detail-line` / `.aql-detail-key` / `.aql-detail-val` / `.aql-detail-row` rows that
  `contents/ViewRecord.vue` uses, with its 40ms stagger. A bespoke card shell is what makes
  a custom section read as misaligned next to a framework one (§10).

---

## 12. Troubleshooting

| Symptom | Cause |
|---|---|
| "Section / Content / Action Not Defined" card | No base and no `.vue` candidate. Check the folder is PascalCase with **no hyphens**, and that the file sits in the folder matching its paradigm. |
| Override file ignored entirely | A `.vue` exists at the same tier — it wins and the `.js` is never read. Or the resource folder is hyphenated (`outlet-visits/` instead of `OutletVisits/`). |
| `propspageheader="[object Object]"` in the DOM | Missing `inheritAttrs: false` on a component in the drill path (§8). |
| A modifier's value never updates | It was computed eagerly inside the modifier. Return a function-valued prop instead (§3.2). |
| `item.$outlet` is `undefined` in a list row | A record was spread somewhere upstream (§9 rule 1). |
| Per-view override never fires | The sheet's view `name` includes the `List` prefix. Use the bare bucket name (§6.1). |
| A `Props<Identity>` block's `items`/`chip` is `undefined` inside the block function | The block was written as a static object. Only a **function** block is called with the live props bag (§8.3). |
| A chip / meta value still shows after a `Props` block "removed" it | The key was omitted rather than set to `null`. Explicit props layer *over* the `useListStrategy` baseline; omission lets the default through (§8.3). |
| A custom section looks blurry or misaligned beside a framework card | It built its own card shell instead of reusing `page-card aql-premium-gradient-card` + the `.aql-detail-*` row grammar (§10). |
| Page title / back arrow vanished after adding a section | `sections` replaces the base contract's array. Re-list `'PageHeader'` (§4.1). |
| Form re-seeds defaults on every keystroke | Props allocated inline in the template (§9 rule 3). |
| FAB trapped at the end of the content flow | Something applied a CSS `transform` to an ancestor of the `q-page-sticky` root — a transformed ancestor becomes the containing block for `position: fixed` descendants. Animate an inner wrapper instead. |

---

## 13. Strict Maintenance Rule

> [!IMPORTANT]
> Any change to the `_ui/` resolution model — scan order, path transformation, the
> `Props<Identity>` merge, a new placeholder paradigm, or the base-folder set — MUST be
> reflected in:
> 1. This document.
> 2. The affected subsystem spec ([AQL_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_PAGE_AND_SECTION_SYSTEM.md) / [AQL_CONTENT_CUSTOMIZATION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_CONTENT_CUSTOMIZATION_SYSTEM.md) / [AQL_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_ACTION_SYSTEM.md)).
> 3. The matching initialization prompt under [References/Prompt Library/Initialization/](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/).
> 4. [FRONTENT/src/components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md) when a framework base component is added or removed.
