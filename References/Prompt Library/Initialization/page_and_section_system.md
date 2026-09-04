# AQL Page and Section System (Initialization)

This initialization prompt guides the creation, override, and customization of frontend pages and section components in the AQL repository. It establishes a dynamic layout model using `<Section>` placeholders, replacing all legacy `_common/` wrapper layouts.

> [!IMPORTANT]
> **Scope Boundary**: This document covers `Page.vue` orchestration plus developing new framework section components under `src/components/sections/` and implementing custom UI overrides/modifiers under `src/_ui/[UiName]/components/`.
> Before writing any frontend code, you MUST read the global architecture rules: [CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md).

> [!IMPORTANT]
> **Subsystem boundary — three placeholders, one override model.** Sections are only one of three paradigms. All share the identical 10-tier `_ui/` lookup described in §3; they differ only in base folder and identity prop.
>
> | Paradigm | Placeholder | Resolver | Base folder | Init prompt |
> |----------|-------------|----------|-------------|-------------|
> | Section | `Section.vue` | `useSectionResolver.js` | `components/sections/` | **this document** |
> | Content | `Content.vue` | `useContentResolver.js` | `components/contents/` | [content_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_customization.md) |
> | Action | `Action.vue` | `useActionResolver.js` | `components/actions/` | [action_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/action_customization.md) |
>
> **If the task touches the sticky form actions bar, submit/reset/cancel buttons, FABs, CRUD actions, or the submission lifecycle, STOP and load [action_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/action_customization.md) instead** — canonical spec: [UI_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_ACTION_SYSTEM.md). `PageAction` is **not** a Section.

---

> [!IMPORTANT]
> **Shared pure helpers live in `FRONTENT/src/utils/` — look there before writing one.**
>
> | File | Owns |
> |---|---|
> | [`dateHelpers.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/dateHelpers.js) | `parseAnyDate`, `startOfDay`/`endOfDay`, `startOfMonth`/`endOfMonth`, `toDateOnly`, `toDateTime24`, `addDays`/`addMonths`, `dayOfYear`, `isoWeek`, `daysFromToday`. Handles BOTH sheet storage shapes (epoch ms in audit columns, ISO strings in business date columns). **Never hand-roll date parsing or day maths.** |
> | [`sortHelpers.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/sortHelpers.js) | `sortByDate(items, column, direction)` — `column` may be a key or a reader function. Sorts without copying rows (a `{ ...row }` spread would strip the non-enumerable relation getters `$outlet` / `_Parents`); unparseable dates sink to the end in both directions. |
> | [`appHelpers.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/appHelpers.js) | String/identity helpers used by every resolver — `toPascalCase` and friends. |
> | [`colorHelpers.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/colorHelpers.js) | `resolveCssColor(value, fallback)` — Quasar brand names, Material palette names and raw CSS all resolve to one inline custom property. |
> | [`placeholderProps.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/utils/placeholderProps.js) | `resolvePlaceholderProps(props, identity, kind)` — the `Props<Identity>` merge. Call it in a resolver; never re-implement it inline. |
>
> **The rule this enforces**: a pure helper that is not resource knowledge belongs in `src/utils/`. It must NOT be duplicated into a `_ui/` composable, and a `_ui/` composable must NEVER import another resource's composable to borrow one — `_ui/**/OutletRestocks/**` reaching into `_ui/**/OutletVisits/**` is exactly the cross-resource dependency [CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md) §5 forbids. Promote the helper to `src/utils/` and re-export it from the composable if the old import path must keep working.

## 1. Architectural Overview & Context

> [!IMPORTANT]
> Before implementing anything, read the full canonical doc: [UI_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_AND_SECTION_SYSTEM.md). It contains the complete `pageProps` contract, BP schema, page override scan table, resolver internals, and `AqlContentWrapper` state logic — all of which are critical to getting this right.

> [!TIP]
> **Reach for `Props<Identity>` before writing an override file.** A page contract can address a single section/content/action by name — `PropsPageHeader: { title: '…' }` — without any file under `_ui/.../components/`. See §3.3 below and canonical doc §1.4.1.

* **Page Orchestrator (`src/pages/Page.vue`)**:
  - Dynamically resolved at runtime via `usePageResolver.js` (which also owns record loading via `useRecord`; form state lives in `usePageState.js`).
  - Always renders `<ResourceBreadcrumb />` unconditionally — it is outside the section system.
  - Mounts a full-page custom override (`resolvedPageComponent`) if matched under `src/_ui/` via a **6-candidate ordered scan** (see canonical doc §1.3.2).
  - Otherwise, falls back to rendering placeholders for visible parts:
    - Pre-Action Sections: `<Section>` per entry in `visibleSectionsBeforeAction` (such as `PageHeader`, `FilterInput`).
    - Body Contents: `<Content>` per entry in `contents`, wrapped inside `<AqlContentWrapper>` (state gate + submission overlay — see canonical doc §1.1).
    - Page Actions: `<Action v-if="ready && pageProps.noActions !== true" action="PageAction" />`, mounted **after** `AqlContentWrapper` and **outside** the animated `.aql-page-body` wrapper (a CSS transform on an ancestor would trap the fixed FAB). Owned by the Action subsystem.
  - The Action subsystem is decoupled from `sections` — base contracts do not need a `'PageAction'` entry; `usePageResolver` still filters the name out of `visibleSectionsBeforeAction` if one is present. `noActions: true` suppresses both `<Action>` and the `ActionDialog`.
  - All placeholders receive `pageProps` via `v-bind`, and each placeholder drills its `$attrs` down to whatever it mounts — so page props reach the deepest leaf. Use `Props<Identity>` (§3.3) to address one placeholder instead of all of them. See canonical doc §1.3.4 for the **full `pageProps` contract** (20+ props including `parentForm`, `childGroups`, `actionForm`, all event handlers).
  - A page's `_ui/.../[page].js` contract accepts **either an object or a function** export — `export default (baseProps) => ({ … })` is supported and returns props merged over `baseProps`. It runs inside the `pageProps` computed, so keep it pure and cheap. A `.vue` page override is a component, not a contract; `export default function` has no meaning there.
  - Contexts provided: `'resourceConfig'`, `'resourceRecord'`, and `'pageState'`.
* **Section Placeholder (`src/components/Section.vue`)**:
  - Automatically resolves which component to render via `useSectionResolver(preparedProps)`.
  - The resolver itself injects all three contexts internally for use by JS modifiers.
  - Renders custom Vue override, JS logic modifier + base section fallback, or a "Section Not Defined" warning.
  - `Content.vue` and `Action.vue` are byte-for-byte equivalents against `useContentResolver` / `useActionResolver` — same three states, same `preparedProps = { ...attrs, <identity> }` shape.
* **Page-Level Form State (`usePageState.js`)**:
  - Singleton page form-state provided at `Page.vue`.
  - Full API (node mutations, strategy, request builders, validation, triggers): [UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md).

---

## 2. Developing Section Components (Strict Guidelines)

When creating a new base section component inside `src/components/sections/` (e.g., `Toolbar.vue`, `FilterInput.vue`):

1. **Disable Attribute Fallthrough**: Enable manual attribute control using `inheritAttrs: false`.
   ```javascript
   defineOptions({ name: 'Sections[Name]', inheritAttrs: false })
   ```
2. **Inject Page Contexts**: Inject provided scopes rather than calling page hooks locally. Always include `null` defaults so sections don't throw if rendered outside `Page.vue` during testing.
   ```javascript
   const resourceConfig = inject('resourceConfig', null)
   const resourceRecord = inject('resourceRecord', null)
   const pageState      = inject('pageState', null)
   ```
3. **Compound Prop Typing**: Ensure styling/label props support closure functions — and add `Object` to every prop that renders caller-supplied content, so a `_ui/` JS modifier can hand over a component instead of a value.
   ```javascript
   const props = defineProps({
     label: { type: [String, Function, Object], default: '' }   // Object = component-valued
   })
   ```
   > [!IMPORTANT]
   > **Any section cell a tenant might want to replace MUST route through `abstract/Renderable.js`** rather than being interpolated directly into the template. A directly-interpolated prop is closed to customization and forces every tenant into a full `.vue` override. Read [UI_RENDERABLE_CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RENDERABLE_CONTRACT.md) and load [renderable_contract.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/renderable_contract.md) **before** writing the template of a new section. Bind `:item` to whatever object this section's resolvers expect — `Renderable` calls `value(item)`, so the contract holds for any resolver signature.
4. **Evaluate Closures**: Use the `evaluateProp` helper to compute final attributes dynamically (passing the record and config to closures):
   ```javascript
   import { evaluateProp } from 'src/composables/resources/useSectionResolver'
   const finalAttrs = computed(() => ({
     label: evaluateProp(props.label, resourceRecord, resourceConfig)
   }))
   ```
   > **Important**: `evaluateProp` unwraps Vue refs internally before calling the closure. Closure functions receive **plain objects** (`record`, `config`), not refs. Never call `.value` inside a closure prop.
5. **No `<style>` block**: Section components are override targets — a tenant `.vue` override cannot inherit scoped CSS. Put every rule in `src/css/custom.scss` under an `.aql-*` class family and consume it by name (ARCHITECTURE RULES §7).
6. **Document Props**: Always document the prop catalog and default behavior in `Documents/UI_PAGE_AND_SECTION_SYSTEM.md` §2.3, and log the component in `FRONTENT/src/components/REGISTRY.md`.

**Existing base sections**: `PageHeader`, `FilterInput`, `ListSwitcher` / `ListSwitcherItem`, `MetricCards` (dashboard stat counters — see canonical doc §2.4), and `LinearProgress` (completion progress bars from a `value`/`max` pair or a bare percentage, with `value` and `max` rendered at either end of the row below the bar — see canonical doc §2.5). Check these for reuse before adding a new one.

> [!TIP]
> `MetricCards` and `LinearProgress` share one contract worth copying for any new dashboard-style section:
> - Closure-typed props, evaluated through `evaluateProp`.
> - An `items` array with a single-item prop fallback used only when `items` resolves empty.
> - A **strict hide rule** (`v-if="items.length"`) so a partial config collapses the whole section instead of rendering an empty shell.
> - Dynamic colour via `resolveCssColor()`, written inline as a single `--aql-*-color` custom property that every layer derives from with `color-mix()`.
> - **No class/style escape-hatch props and no `full-width` on the root.** Restyling is a `.vue` override or a `custom.scss` rule, not a prop. Sections carry a horizontal inset (`q-px-sm`) only — vertical rhythm belongs to `.aql-page-body`, which `Page.vue` renders with `q-gutter-y-{pageProps.gutter}`, so a section that adds its own `q-py-*` double-spaces against its neighbours.

---

## 3. Section Customization & Overrides

Overrides reside under `src/_ui/[UiName]/components/`.

### 3.1 The 10-Tier Lookup Sequence
`useSectionResolver.js` scans candidates in this order (first match wins). `useContentResolver.js` and `useActionResolver.js` use the identical sequence with `[Content]` / `[Action]` substituted for `[Section]`:
1. **Vue override** (resource + page specific): `.../[scope]/[Resource]/[page]/[Section].vue`
2. **JS modifier** (resource + page specific): `.../[scope]/[Resource]/[page]/[Section].js`
3. **Vue override** (resource specific): `.../[scope]/[Resource]/[Section].vue`
4. **JS modifier** (resource specific): `.../[scope]/[Resource]/[Section].js`
5. **Vue override** (page specific): `.../[scope]/[page]/[Section].vue`
6. **JS modifier** (page specific): `.../[scope]/[page]/[Section].js`
7. **Vue override** (scope-wide): `.../[scope]/[Section].vue`
8. **JS modifier** (scope-wide): `.../[scope]/[Section].js`
9. **Vue override** (ui-wide fallback): `.../[Section].vue`
10. **JS modifier** (ui-wide fallback): `.../[Section].js`

*Path segment rules (all segments are lowercased for registry lookup):*
- `[scope]` → lowercased as-is (e.g. `master`)
- `[Resource]` → `toPascalCase` first, then lowercased (e.g. `'purchase-orders'` → `PurchaseOrders` → **`purchaseorders`**)
- `[page]`, `[Section]`, `[UiName]` → lowercased as-is

*File names are case-insensitive* — the registry lowercases all keys at build time, so `Header.vue` and `header.vue` resolve identically.*

### 3.2 Vue Overrides vs JS Modifiers
* **JS Modifiers (`.js`)**: Keep the base template but alter props.
  * *Signature*:
    ```javascript
    export default (currentProps, { pageState, resourceRecord, resourceConfig }) => ({
      title: (record) => `User: ${record?.Username}`
    })
    ```
* **Vue Overrides (`.vue`)**: Replaces the template completely.

### 3.3 Targeted Props — `Props<Identity>` (no file needed)

Before creating an override file, check whether a props block is enough. `Page.vue` binds one flat `pageProps` object to every placeholder, and each drills `$attrs` downward; `Props<Identity>` carves targeted namespaces out of that shared bag:

```javascript
// _ui/AQL/pages/Operation/OutletVisits/Index.js
export default {
  sections: ['PageHeader', 'FilterInput', 'ListSwitcher'],
  contents: ['List'],

  PropsSection:    { dense: true },                 // broadcast: every section
  PropsContent:    { flat: true },                  // broadcast: every content
  PropsPageHeader: { title: "Today's Visits" },     // just PageHeader
  PropsListToday:  { layout: 'grid' }               // just the ListToday per-view list
}
```

**Rules to hold to:**
- The block is spread **flat**: the target reads `props.title`, never `props.PropsPageHeader.title`.
- Precedence is `drilled attrs → Props<Kind> → Props<Identity> → JS modifier`. **The JS modifier is always final** — never write a `Props<Name>` block expecting it to beat a `.js` modifier.
- Broadcast keys are `PropsSection`, `PropsContent`, `PropsAction` — one per resolver family.
- Blocks are **never stripped**; unconsumed `Props*` keys keep drilling, so a deeply nested component can claim its own. Seeing `$attrs.PropsPageHeader` inside a list item is expected, not a bug.
- A block may be a function `(props) => ({ ... })`. Non-objects and arrays are ignored.
- Helper: `src/utils/placeholderProps.js` → `resolvePlaceholderProps(props, identity, kind)`. Call it in a resolver's `finalProps`; do not re-implement the merge inline at a bind site.

> [!IMPORTANT]
> **Any component with a DOM root that sits in a drill path MUST declare `inheritAttrs: false`.** `Props*` blocks are objects, so with fallthrough enabled Vue writes them onto the element as `propspageheader="[object Object]"`. If a component legitimately needs `class`/`style` fallthrough, re-bind `$attrs.class` / `$attrs.style` explicitly (see `components/abstract/List.vue`).

> [!NOTE]
> When adding a new nesting hop that resolves its own identity, build its resolver bag from `$attrs` **first**, then the local props. Rebuilding the bag from scratch silently severs the drill chain — this is exactly what `contents/List.vue` and `sections/ListSwitcher.vue` used to do.

### 3.3 Attribute Fallthrough in Vue Overrides (Strict)
To prevent property collisions when wrapping default components inside an override:
* **DO NOT** wrap the component in a raw `<div>` wrapper (this swallows back actions, badges, and reload events).
* **DO** specify `inheritAttrs: false` and explicitly bind `$attrs` **before** custom properties:
  ```html
  <template>
    <GenericHeaderPanel v-bind="$attrs" title="Custom Override Title" />
  </template>
  ```

---

## 4. Strict Maintenance Rule

> [!IMPORTANT]
> **Documentation Sync Requirement**: Any modifications, refactoring, or additions to the Page/Section system structure (such as expanding page overrides, adding custom Vue-based page customization logic, or rewriting record/resource page flows) MUST be accompanied by updates to:
> 1. The canonical doc: [UI_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_AND_SECTION_SYSTEM.md)
> 2. This initialization prompt: [page_and_section_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_section_system.md)
