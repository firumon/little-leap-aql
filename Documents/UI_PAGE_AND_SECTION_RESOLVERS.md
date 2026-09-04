# Page & Section — The Resolvers

> Part of **[﻿# AQL Page and Section System Guide](UI_PAGE_AND_SECTION_SYSTEM.md)**. The page resolver, the section resolver, `Props<Identity>` targeted props, and page state.

---

### 1.3 The Page Resolver (`src/composables/resources/usePageResolver.js`)
Handles page-level route resolution and loading, and owns record loading (see §1.3.3). Form state and submission are **not** its concern — those belong to `usePageState` (see [UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md)), which `Page.vue` provides alongside it.

#### 1.3.0 Route signals (`useRouteConfig.js`)
Every route signal the resolver (and any component) consumes comes from `useRouteConfig()` — **never** from `useRoute()` directly:

| Signal | Source | Notes |
|--------|--------|-------|
| `scope` | `route.params.scope` | `operation` \| `master` \| `accounts`, defaults to `master` |
| `resourceSlug` | `route.params.resourceSlug` | kebab-case URL slug |
| `code` | `route.params.code` | record primary key on record-level routes |
| `pageSlug` | `route.params.pageSlug` | the sub-route segment of a `resource` / `record` route |
| `action` | `route.params.action` | the `:action` segment of `/{code}/_action/{action}` |
| `pageName` | `route.meta.page` | `index` \| `add` \| `view` \| `edit` \| `action` \| `resource` \| `record` |
| `level` | `route.meta.level` | `resource` \| `record` |

`pageSlug` and `action` are **separate signals**. `pageSlug` used to fall back to the action param, which made a deep link to `/_action/approve` indistinguishable from a custom sub-route; consumers that need the workflow action name (`Breadcrumb.vue`, `PageAction.vue`, `usePageResolver.js`) now read `action` explicitly.

Route names, `meta.page` values, and `useResourceNav`'s navigation targets are one vocabulary — `nav.goTo('record', { code, pageSlug })` pushes the route named `record`. The seven names above are the complete set; `goTo()` rejects anything else.

#### 1.3.1 Stage A — Base Page Contract (BP)
Loads `src/pages/[Scope]/[page].js`. This JS file sets the default sections and contents layout for the page.

**Special page key mapping** (route `meta.page` → BP filename):

| `meta.page` value | Canonical page key | BP file loaded |
|-------------------|--------------------|----------------|
| `'resource'` with a `:pageSlug` | `toPascalCase(pageSlug).toLowerCase()` | `[PageSlug].js`, falling back to `resource.js` |
| `'record'` with a `:pageSlug` | `toPascalCase(pageSlug).toLowerCase()` | `[PageSlug].js`, falling back to `record.js` |
| `'resource'` / `'record'` with no slug | `resource` / `record` | `resource.js` / `record.js` |
| `'action'` | `toPascalCase(action).toLowerCase()` | `[Action].js` — the `:action` route param, not `action.js` |
| anything else | `page` as-is | `[page].js` as-is |

All three custom-page keys (`action`, `resource` sub-route, `record` sub-route) are normalized the same way: `toPascalCase(slug).toLowerCase()`. PascalCase drops the hyphen so a multi-word slug (`my-custom-page`) can be authored as a PascalCase file/folder (`MyCustomPage`), and the trailing lowercase matches the Vite glob registry, which lowercases every indexed path.

Because the canonical key is what flows into `rcProps.page`, every downstream placeholder resolves under it too: a `resource` sub-route `/operation/outlets/my-custom-page` looks its sections/contents/actions up in `_ui/[Ui]/components/[Scope]/[Resource]/MyCustomPage/[Placeholder].vue` before falling back to the scope- and framework-level tiers.

**Stage A fallback**: the framework layer is not expected to ship an empty `pages/[Scope]/[CustomPage].js` for every slug an app invents. If the specific BP is missing on a `resource` / `record` sub-route, the resolver loads the route's generic contract (`resource.js` / `record.js`) instead, so its defaults (`PageHeader`, …) stay available. Both attempts appear in `checkedPaths`.

**BP export shape**: The BP can export either a plain object or a function. If it's a function, it receives the full `rcProps` (same shape as `pageProps` below) and must return an object of extra props to merge in:

```javascript
// Plain object (most common):
export default {
  sections: ['Header', 'Toolbar', 'Content', 'Action'],
  contents: []  // optional — sections rendered inside <AqlContentWrapper>
}

// Function form (dynamic, receives rcProps):
export default (rcProps) => ({
  sections: ['Header', rcProps.page === 'index' ? 'Toolbar' : 'Content', 'Action']
})
```

**`sections` vs `contents`**: `sections` drives the full rendering sequence. `visibleSectionsBeforeAction` is everything in `sections` except `'PageAction'`. The `contents` array (if provided) defines content names rendered *inside* `<AqlContentWrapper>`. If `contents` is empty or absent, the wrapper is skipped.

**`PageAction` and `sections`**: the Action subsystem is fully decoupled from the `sections` array. `Page.vue` mounts `<Action action="PageAction" />` on every resource page, gated only by `pageProps.noActions !== true`, so base contracts do **not** need to declare `'PageAction'`. `usePageResolver` still filters the name out of `visibleSectionsBeforeAction` so a contract that does list it (legacy or otherwise) never double-renders.

**Existing base contracts**:

| Scope | File | `sections` |
|-------|------|------------|
| `Master` | `index.js` | `['Header']` |
| `Master` | `record.js` / `view.js` / `add.js` / `edit.js` / `action.js` / `resource.js` | `['Header', 'Toolbar', 'Content', 'Action']` |
| `Operation` | `index.js` | `['Header', 'Toolbar']` |

#### 1.3.2 Stage B — Custom Page Override Scan (6 Candidates)
After loading the BP, `usePageResolver` scans `src/_ui/[UiName]/pages/` for custom overrides in this order (first match wins):

| Priority | Path | Type |
|----------|------|------|
| 1 (CC) | `_ui/{uiName}/pages/{scope}/{slug}/{page}.vue` | Full Vue override |
| 2 (CP) | `_ui/{uiName}/pages/{scope}/{slug}/{page}.js` | JS modifier |
| 3 (O2) | `_ui/{uiName}/pages/{scope}/{page}.vue` | Scope-wide Vue override |
| 4 (O3) | `_ui/{uiName}/pages/{scope}/{page}.js` | Scope-wide JS modifier |
| 5 (O4) | `_ui/{uiName}/pages/{page}.vue` | UI-wide Vue override |
| 6 (O5) | `_ui/{uiName}/pages/{page}.js` | UI-wide JS modifier |

- `{slug}` is normalized as **`toPascalCase(slug).toLowerCase()`** — the single rule every other resolver (`useContentResolver`, `useSectionResolver`, `useActionResolver`, `useViewColumnResolver`, `FormRecord.vue`, `ViewRecord.vue`) applies. A resource slug of `outlet-visits` becomes the key `outletvisits`, which matches a PascalCase folder `_ui/{uiName}/pages/{scope}/OutletVisits/` because the Vite glob registry lowercases every path at build time. **`_ui/` override folders must be named in PascalCase** — a raw hyphenated folder (`outlet-visits/`) will NOT resolve.
- A **Vue override** (`isVue: true`) replaces the entire page; the section layout is bypassed. It is mounted with `v-bind="pageProps"` and declares props normally — `export default function` has no meaning here.
- A **JS modifier** (`isVue: false`) supplies additional props to merge over `baseProps`. The section layout still runs with the modified `pageProps`.

  Both an **object** and a **function** export are accepted, exactly as for a base contract:

  ```javascript
  // _ui/AQL/pages/Operation/OutletVisits/Index.js

  // Object form — static contract
  export default {
    sections: ['PageHeader', 'MetricCards', 'FilterInput', 'ListSwitcher'],
    contents: ['List']
  }

  // Function form — receives the merged baseProps (rcProps + base contract)
  export default (baseProps) => ({
    sections: baseProps.loading ? ['PageHeader'] : ['PageHeader', 'ListSwitcher'],
    contents: ['List']
  })
  ```

  > [!IMPORTANT]
  > The function form is invoked **inside the `pageProps` computed**, so it re-evaluates on every reactive read. Keep it pure and cheap — no side effects, no fetching. Unlike section/content/action JS modifiers, it receives only `baseProps`; it is not handed a `{ pageState, resourceRecord, resourceConfig }` context object.

#### 1.3.3 Record Loading
`usePageResolver` calls `useRecord()` once and exposes it as `resourceRecord` (which `Page.vue` then `provide`s). A single watch, keyed on the primitive `resourceName|code|canonicalPage`, drives the reload strategy per page:

| Page | What loads |
|------|------------|
| `index` | `reload()` — the resource list |
| `view` | `reload()`, then `loadRelations()` for parents/children |
| `edit` (with a `code`) | `reload()` |
| `add` | nothing — no server read is needed |
| custom sub-route slug | nothing — the override page fetches what it needs itself |

The watch key is a template string, never an array literal: `watch` compares a getter's result with `Object.is`, so a fresh array would re-fire on every re-evaluation and re-request on each background sync.

##### The Enriched Record (and why you must never spread one)

Neither `resourceRecord.record` nor `resourceRecord.records` hands out raw sheet rows. Both run every row through `enrichRecord(resourceName, code, dataStore)` (`useRecord.js`), which returns a **cached, reactive object built entirely out of `Object.defineProperty` getters** — there are no own data properties on it at all:

| Key shape | Example | `enumerable` | Resolves to |
|-----------|---------|--------------|-------------|
| Sheet header | `Code`, `OutletCode`, `Progress` | `true` | Live value from the data store |
| `$<parentSingular>` | `$outlet`, `$warehouse` | **`false`** | The enriched parent record |
| `$<ChildResource>` | `$OutletVisitItems` | **`false`** | Array of enriched child records |
| `_Parents` / `_Parent` | — | **`false`** | Relation key list / keyed map |
| `_Children` / `_Child` | — | **`false`** | Relation key list / keyed map |
| `_relation` | — | **`false`** | Raw relation metadata |

> [!IMPORTANT]
> **Preserve the record reference. Never `{ ...record }`.**
>
> Object spread, `Object.assign({}, record)`, and `JSON.parse(JSON.stringify(record))` copy **enumerable own properties only**. Every relation getter in the table above is non-enumerable, so a spread silently produces an object with the header fields and **no `$outlet`, no `$parent`, no `$children`, no `_Parents`** — and `item.$outlet?.Name` quietly degrades to `undefined` with no error to trace. The spread also *snapshots* the header getters into plain values, so the copy stops tracking store updates and goes stale after a background sync.
>
> When a content or section component filters, sorts, or attaches a derived property, it must operate on the original references:
>
> ```javascript
> // ✗ Strips every relation getter and freezes the values
> out.push({ ...row, overdueDays: days })
>
> // ✓ Keeps the enriched reference intact
> row.overdueDays = days
> out.push(row)
> ```
>
> Filtering and sorting are safe as-is — `Array.prototype.filter`/`sort` carry references through. Only *copying* breaks the contract. Note that a derived property assigned this way lands on the shared cached record, so keep such keys namespaced to the feature and treat them as display-only.

> [!NOTE]
> This was previously split into a `usePageOrchestrator.js` middle layer, which also carried an action-page form (`actionForm`, `selectedOutcome`, `resolvedActionFields`, …). That path became unreachable once `canonicalPage` started resolving the `_action/:action` route to its **slug** rather than to `'action'`, and workflow actions moved to `ActionDialog` (see [UI_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_ACTION_SYSTEM.md)). The orchestrator has been removed; nothing replaced the action-form half because `ActionDialog` already owns it.

#### 1.3.4 The `pageProps` Contract
`pageProps` is the computed object assembled by `usePageResolver` and `v-bind`-ed onto every `<Section>` placeholder and any full page override. **Section authors must understand every prop in this object.**

| Prop | Type | Description |
|------|------|-------------|
| `page` | `String` | Canonical page name: `'index'`, `'view'`, `'add'`, `'edit'`, `'action'`, or custom action slug |
| `scope` | `String` | Route scope: `'master'`, `'operation'`, `'accounts'`, etc. |
| `resource` | `String` | Resource slug from route (e.g. `'currencies'`, `'purchase-orders'`) |
| `uiName` | `String` | Resolved `customUIName` from `APP.Resources` (defaults to `'AQL'`) |
| `gutter` | `String` | Quasar spacing token for the page's vertical gutter (default `'xs'`) |
| `pageClass` | `String` | Extra classes on the `q-page` root |
| `contentPadding` | `String` | Quasar padding token applied to `<AqlContentWrapper>` (default `'sm'`) |
| `contentClass` | `String` | Extra classes on `<AqlContentWrapper>` |
| `loading` | `Boolean` | Whether the resource record/list is loading (unwrapped — passing the ref itself trips Boolean prop validation downstream) |

> [!IMPORTANT]
> **`pageProps` carries no form state.** Form values, validation, saving/submitting flags and every save/submit handler live in `usePageState`, injected as `'pageState'` by the sections and content components that need them. Sections must not expect `parentForm`, `childGroups`, `onSave`, `onSubmit`, or the action-form keys here — they were removed with `usePageOrchestrator`.

> [!NOTE]
> **BP props are merged last.** The BP's exported object (or function return) is merged on top of the base `rcProps` above. This means a BP can add additional props (e.g. `sections`, `contents`, custom config keys) that sections can then access via `attrs`.

> [!IMPORTANT]
> `sectionPadding` (default `'sm'`) is also part of this contract. `Page.vue` uses it twice — as a `q-px-{sectionPadding}` **class** on each `<Section>` placeholder, and as a `:padding` **prop** — because the class is dropped by any section declaring `inheritAttrs: false`. See §1.3.5.

#### 1.3.5 Spacing Invariants (STRICT)

Canonical statement in [CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md) §7.1. What they mean for a section author:

**1 — Card gutter.** Every vertical gap between cards, lists or grouped blocks resolves from `pageProps.gutter`. A section reads it off `attrs` and spaces its own children with it:

```js
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
```

Vertical rhythm BETWEEN sections is not yours — `.aql-page-body` already carries `q-gutter-y-{gutter}`. A section root must therefore add no `q-py-*` and no `full-width`, or it stops stacking flush with its neighbours.

**2 — Single-layer edge padding.** The screen-edge-to-content gap must equal `sectionPadding` exactly once. `Page.vue` puts `q-px-{sectionPadding}` on the placeholder AND passes `padding` as a prop, and which one survives depends on your `inheritAttrs`:

* **`inheritAttrs: false`** (the normal case for a resolver leaf) — the placeholder's class is dropped. Apply the inset yourself, from the declared prop: `` :class="`q-px-${props.padding}`" ``.
* **fallthrough on** — the placeholder's class lands on your root. Add none of your own, or the page reads `sm + sm`.

Never both. And an invisible wrapper — no border, no background, no card — never pads children that already pad themselves.

**Verifying it.** Measure, do not eyeball. Two sections on the same page must report the same left edge:

```js
[...document.querySelectorAll('.aql-page-body > *')]
  .map(el => el.getBoundingClientRect().left)
```

### 1.4 The Section Resolver (`src/composables/resources/useSectionResolver.js`)
Resolves section-level components and options using a two-step lookup.

#### Registry Architecture
The resolver maintains **two Vite glob registries** built once at module load (before any component mounts):

| Registry | Source Glob | Key Format |
|----------|-------------|------------|
| `frameworkRegistry` | `../../components/**/*.{vue,js}` | `components/...` (lowercased) |
| `customUiRegistry` | `../../_ui/**/*.{vue,js}` | `_ui/...` (lowercased) |

Both registries lowercase all path keys on build. Lookup paths are also constructed in lowercase. **This means section file names are case-insensitive on any OS.** `Header.vue`, `header.vue`, and `HEADER.vue` all resolve to the same registry key.

#### Contexts Injected Internally
`useSectionResolver` **itself injects all three page contexts** (`resourceConfig`, `resourceRecord`, `pageState`) internally — so it can pass them to JS modifier functions. Sections that don't need these contexts in their template do not have to inject them again, though they should inject them for their own use when needed.

#### Step 1 — Base Section Resolution
Lookup order (first match wins):
1. `_ui/{uiName}/components/sections/{section}.vue` — client-specific generic base.
2. `components/sections/{section}.vue` — framework default base.

If neither exists, `Section.vue` renders the "Section Not Defined" card.

#### Step 2 — 10-Tier Override Scan (see §3)

### 1.4.1 Targeted Props — `Props<Identity>` Blocks

`Page.vue` binds one flat `pageProps` object to **every** placeholder, and each placeholder drills its `$attrs` down to whatever it mounts. That is a single global namespace: a `title` intended for `PageHeader` also lands on `FilterInput` and `List`.

`Props<Identity>` carves targeted namespaces out of that same flat bag. Any layer that can contribute props — a base contract, a page's `Index.js`, a JS modifier — may declare them:

```javascript
// _ui/AQL/pages/Operation/OutletVisits/Index.js
export default {
  sections: ['PageHeader', 'MetricCards', 'FilterInput', 'ListSwitcher'],
  contents: ['List'],

  PropsSection:    { dense: true },                  // broadcast: every section
  PropsContent:    { flat: true },                   // broadcast: every content
  PropsPageHeader: { title: "Today's Visits" },      // just PageHeader
  PropsList:       { layout: 'grid' },               // just the List content
  PropsListToday:  { layout: 'compact' }             // just the ListToday per-view list
}
```

**The block is spread flat onto the target.** `ListToday` reads `props.layout` — never `props.PropsListToday.layout`.

**Precedence** (later wins), applied in each resolver's `finalProps`:

```
drilled attrs → Props<Kind> broadcast → Props<Identity> → JS modifier
```

The JS modifier stays final, matching every other override in the system. A `PageHeader.js` modifier overrides a `PropsPageHeader` block declared by the page.

| Kind | Broadcast key | Identity source | Resolver |
|------|---------------|-----------------|----------|
| Section | `PropsSection` | the `sections:` entry | `useSectionResolver` |
| Content | `PropsContent` | the `contents:` entry | `useContentResolver` |
| Action  | `PropsAction`  | the `action` prop     | `useActionResolver` |

**Rules and mechanics:**

- **Keys are never stripped once consumed.** Every `Props*` key keeps riding the drilled `$attrs` all the way down, so a component nested three levels deep can still claim its own block. `ListToday` legitimately receives `$attrs.PropsPageHeader` and ignores it. This is expected, and it makes the merge idempotent.
- **Key matching is case-insensitive**, mirroring the resolvers' path lookup. `PropsListToday` and `propslisttoday` both hit.
- **A block may be a function** — `PropsList: (props) => ({ perPage: props.dense ? 50 : 25 })` — evaluated with the live props bag.
- **Non-object blocks are ignored**, arrays included, so a stray string can never be spread onto a component.
- **Nested identities work at any depth**, because each resolver only claims its own key. `PropsListToday` passes untouched through `Content` → `contents/List.vue` and is claimed by the per-view resolver hop inside it.
- Helper: [`src/utils/placeholderProps.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/placeholderProps.js) (`resolvePlaceholderProps`). It returns `null` when no block matches, so resolvers hand back the original props object and preserve prop identity across unrelated re-renders.

> [!IMPORTANT]
> **Drilling makes `inheritAttrs: false` mandatory for any component with a DOM root that sits in a drill path.** `Props*` blocks are objects; with attribute fallthrough enabled Vue writes them onto the root element as `propspageheader="[object Object]"`. Every `sections/`, `contents/` and `actions/` component already declares it (§2.1). `components/abstract/List.vue` declares it too, and re-binds `$attrs.class` / `$attrs.style` explicitly so callers keep styling the list.

> [!NOTE]
> **`ListSwitcher` exception.** The per-item keys `item`, `active`, `label`, `icon`, and `color` are derived per item by `ListSwitcher` itself and are layered *on top of* the resolver output, so a `PropsListSwitcherItem` block cannot override them — the switcher-wide resolver cannot see individual items. Customize them through `ListSwitcher`'s own `label` / `icon` function props, which receive the item. All other keys behave normally.

### 1.5 The Page State (`src/composables/resources/usePageState.js`)
Centralizes the reactive form state shared across the Header, Content, and Action sections. It is the single source of truth for input collection, request building, and submission on a resource page.

> For the complete API reference (node mutations, strategy contract, request builders, triggers, and validation), see the canonical document: [UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md).

**Key points for section authors:**
- `inject('pageState')` gives access to the full `usePageState` return value.
- Use `pageState.useNode(resourceName)` to get a per-section reactive `{ node, options, validation }` accessor.
- Call `pageState.submit()` from Action sections to validate, build, send, and notify.
- Standalone request builders (`compositeSaveRequest`, `resourceBulkRequest`, etc.) and response helpers (`responseFailed`, `failureMessage`, `batchResultCode`) are exported directly from `usePageState.js` and can be imported independently.

---


---

⬑ Back to **[﻿# AQL Page and Section System Guide](UI_PAGE_AND_SECTION_SYSTEM.md)**.
