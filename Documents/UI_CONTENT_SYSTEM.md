# AQL Content Layout & Customization System

This document is the complete reference guide for the AQL Content Customization System. It explains the `contents:` page contract, the `Content.vue` orchestrator, `useContentResolver.js` resolution rules, the built-in `List` content component, and how to create per-resource or per-active-view overrides without rewriting full HTML/Vue templates.

---

## 1. System Architecture

A resource page's Base Page contract (`src/pages/[scope]/[page].js`) declares which content components its body renders via a `contents: [...]` array:

```javascript
// src/pages/Master/index.js
export default {
  sections: ['PageHeader', 'FilterInput', 'PageAction'],
  contents: ['List'],
}
```

`Page.vue` (`FRONTENT/src/pages/Page.vue`) renders one [Content.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/Content.vue) per entry inside `AqlContentWrapper`, forwarding the full `pageProps` object (page, scope, resource, uiName, and all orchestrator state) as attributes:

```html
<Content
  v-for="content in contents"
  :key="content"
  :content="content"
  v-bind="pageProps"
/>
```

`Content.vue` is a thin orchestrator: it merges `$attrs` with the `content` identity into `preparedProps` and hands that to [useContentResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useContentResolver.js), which performs the actual lookup. While resolving it shows a spinner; if nothing matches it renders a "Content Not Defined" card naming the missing `content`/`page`/`resource`/`scope` combination.

### Registries (built once at startup via `import.meta.glob`)
- **Framework registry**: everything under `src/components/**/*.{vue,js}` (keyed by lowercase path, e.g. `components/contents/list.vue`).
- **Custom UI registry**: everything under `src/_ui/**/*.{vue,js}` (keyed by lowercase path, e.g. `_ui/aql/components/contents/list.vue` or `_ui/aql/components/master/products/index/list.vue`).

### Two-Step Resolution (mirrors the Section resolver, scoped to `contents/`)
1. **Locate the base content component**, in priority order:
   a. Custom UI generic content: `_ui/[uiName]/components/contents/[content].vue`
   b. Framework generic content: `components/contents/[content].vue` (e.g. `List.vue`)
   c. If neither exists, the first matching Vue override candidate from step 2 below is promoted to serve as the base.
   d. If still nothing, fall back to the caller-supplied `defaultComponent` (e.g. `List.vue` passes `AppList` so a JS modifier can still adjust its props even with no dedicated content file).
2. **Locate a page/resource/scope-level override or modifier** for that base — first match wins, most specific first:
   1. `_ui/[uiName]/components/[scope]/[resource]/[page]/[content].vue` (Vue override — resource + page specific)
   2. `_ui/[uiName]/components/[scope]/[resource]/[page]/[content].js` (JS modifier — resource + page specific)
   3. `_ui/[uiName]/components/[scope]/[resource]/[content].vue`
   4. `_ui/[uiName]/components/[scope]/[resource]/[content].js`
   5. `_ui/[uiName]/components/[scope]/[page]/[content].vue`
   6. `_ui/[uiName]/components/[scope]/[page]/[content].js`
   7. `_ui/[uiName]/components/[scope]/[content].vue`
   8. `_ui/[uiName]/components/[scope]/[content].js`
   9. `_ui/[uiName]/components/[content].vue`
   10. `_ui/[uiName]/components/[content].js`

Path segments are lowercased for lookup; `resource` (a slug, e.g. `stock-movements`) is PascalCased then lowercased (`stockmovements`) to match folder naming.

> [!IMPORTANT]
> **This normalization is enforced everywhere a resource slug feeds a glob-registry folder lookup**, not just in `useContentResolver.js` itself — both the `View` system (`ViewRecord.vue`'s `viewrecord.(vue|js)`, `ViewChildren.vue`'s `viewchild*.(vue|js)`, `ViewParent.vue`'s `viewparent*.(vue|js)`, and `useViewColumnResolver.js`'s `viewcolumn*.(vue|js)`) and the `Create`/`Update` system (`FormRecord.vue`, `Create.vue`, `Update.vue`, `FormChild.vue` — see [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md) §9) run every resource slug through `toPascalCase(slug).toLowerCase()` before building a candidate path. A kebab-case slug (`outlet-visits`) becomes `outletvisits`, never `outlet-visits` — hyphens never appear in a glob-registry key because folder names are PascalCase-derived. Resource **menu routes** (`ui.menus[].route`, e.g. `/operation/outlet-visits`) and URL params (`route.params.resourceSlug`) ARE genuinely kebab-case in production — confirmed against live seed data in `GAS/syncAppResources.gs` — which is exactly why this normalization step exists: it converts a real kebab-case slug into the PascalCase-derived glob key. `useResourceNav.js`'s `findScopeBySlug` and `useRouteConfig.js`'s `resourceConfig` fallback correspondingly strip hyphens (`.replace(/-/g, '')`) rather than assume PascalCase input, for the same reason.

### Custom Templates vs. JS Logic Modifiers
- **Vue Template Override (`.vue`)**: must contain a `<template>` block; **replaces the base content entirely**, and props flow through unmodified so the override can read `$attrs` directly.
- **JS Logic Modifier (`.js`)**: exports a default `(props, { pageState, resourceRecord, resourceConfig }) => modifiedProps` (or a plain object) that keeps the base content component but adjusts the props fed into it.

---

## 2. `List` — The Built-In List Content Component

[List.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/List.vue) (registered content name `List`, component name `ContentsList`) is the framework's default Index-page content. It:

1. Reads `resourceRecord.filteredRecords` (falling back to `resourceRecord.records`) and `resourceRecord.loading`, injected from the page.
2. Derives label/caption/meta/highlight/chip resolvers from [useListStrategy.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useListStrategy.js) (see §3) as its baseline (`strategyProps`).
3. Layers any explicitly-passed props on top (`explicitProps` — anything the caller set that isn't `undefined`), so a page contract or JS modifier can override any single strategy-derived value (`layout`, `label`, `chipColor`, etc.) without touching the rest.
4. Builds `preparedResolverProps` — the content-resolver identity used to find a per-active-view override — merging, **in priority order**: explicit `page`/`scope`/`resource`/`uiName` **props**, then the same as forwarded **attributes**, then `resourceConfig` context (`resourceConfig.page`, `.scope`, `.resourceSlug`, `.customUIName`), with `page` defaulting to `'index'`. This lets a manual `<List page="..." resource="..." />` usage override the ambient page/resource context, e.g. embedding a different resource's list inside a custom section.
5. Determines `content: 'List<ActiveViewName>'` (PascalCased) whenever a list view is active (see §4), otherwise plain `'List'`.
6. Feeds `preparedResolverProps` into `useContentResolver`, with [AppList.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/app/AppList.vue) as the `defaultComponent` fallback.
7. Renders either the resolved override component (when a view is active and a `List<ViewName>` match exists) or `AppList` directly with `finalProps` — gated on `activeViewName` specifically to avoid the resolver ever matching this file's own registered `List` content key and recursing into itself.
8. Handles item clicks: caller-supplied `onItemClick`, else navigation to a `record` sub-route when `target` is set, else the default `view` page.

> [!IMPORTANT]
> **Continuous props during view switches.** `useContentResolver` runs an **async** watcher and transiently resets its `finalProps` to `{}` while it scans for a `List<ViewName>` override. To prevent the list from momentarily rendering empty on every view change, `sanitizedResolvedProps` merges the synchronous `finalProps` baseline (which always carries the freshly-filtered `items` + strategy props) **under** the resolver's output: `{ ...finalProps.value, ...resolvedContentProps.value }`. The baseline keeps the list populated during the async gap; once resolution settles, the resolver's props (including any per-view JS-modifier changes) still win on top, so override behaviour is unchanged. Because `filteredRecords` is a synchronous computed off `activeViewName`, `items` already reflects the newly-selected view the instant the chip changes.

### List Props
Every prop defaults to `undefined` so `useListStrategy` stays authoritative unless explicitly overridden:
- **Data/behaviour**: `items`, `onItemClick`, `target`
- **Content-resolver identity** (override ambient context): `page`, `scope`, `resource`, `uiName`
- **List container**: `itemKey`, `emptyText`, `bordered`, `itemBordered`, `separator`, `dense`, `color`, `highlight`, `highlightColor`, `clickable`, `itemClass`, `align`
- **Leading icon/avatar**: `icon`, `iconColor`, `avatar`, `avatarLabel`, `avatarColor`, `avatarSize`
- **Main content**: `layout`, `content` (Array — column list; forwarded only when it's a real Array, since the same prop name also carries the content-resolver's string identity), `label`, `labelClass`, `caption`, `captionClass`
- **Meta side section**: `meta`, `metaLayout`, `metaColor`, `metaLabel`, `metaCaption`, `chip`, `chipColor`, `chipOutline`, `chipTextColor`, `badge`, `badgeColor`, `badgeTextColor`, `badgeOutline`
- **Row action**: `btn`, `btnColor`
- **Pagination**: `paginate` (Boolean, defaults to `true` in `abstract/List.vue`), `perPage` (Number, default `25`), `threshold` (Number, default `35`), `page` (Number, controlled current page synced with `resourceRecord.currentPage`)

Function-valued props (`label`, `caption`, `chipColor`, ...) are per-item resolvers — `(item) => value` — consumed by `abstract/List.vue` and forwarded untouched.

Pagination activates when `items.length > threshold` (35 by default). It renders Quasar `<q-pagination>` with `:max-pages="7"` and `boundary-numbers`, while keeping rows inside the existing `<TransitionGroup>` so pagination and filtering preserve row transitions. The active page is persisted per resource through `resourceRecord.currentPage`.

### Centralized List Transitions
List motion is defined once, centrally — no per-view/per-resource override touches it, and slot forwarding (`item`, `avatar`, `content`, `meta`, `btn`), the `click` emission, `itemKey` resolution, selection highlight, and loading/empty states are all untouched:
- **Item entrance / reorder** — `abstract/List.vue` renders its items branch through a `<TransitionGroup name="aql-list-item">` with **no `tag`** (Vue 3 renders no wrapper element, so `q-item`s stay direct children of `q-list` and separators/gutter are preserved). Items fade + slide up on load/filter and glide via FLIP `-move` transitions; leaving items are taken out of flow (`position: absolute`, contained by `q-list`'s `relative-position`) so neighbours settle without a layout jump. **On a view switch, the filtered `items` array changes while the list node stays mounted, so this same TransitionGroup animates the diff between the old and new view's records — no whole-list cross-fade is used.**
- All timing lives in `src/css/transitions.scss` (`.aql-list-item-*`), is kept in the 150–200ms range for snappiness, and is disabled under `prefers-reduced-motion`.

> [!IMPORTANT]
> **No outer `<Transition>` on `List.vue`.** An earlier `<Transition name="aql-list-fade" mode="out-in">` keyed by `activeViewName` was removed: `mode="out-in"` holds the incoming node until the outgoing one finishes leaving, which — combined with `useContentResolver`'s async view scan — could stall and unmount the list on a chip change, leaving it blank until reload. `contents/List.vue` now renders `<component :is>` **directly, unkeyed**, so the list node stays mounted across view switches and prop updates flow through continuously; item-level animation is delegated entirely to `abstract/List.vue`'s `<TransitionGroup>`.

### Example JS Logic Modifier (overrides two strategy-derived columns)
```javascript
// src/_ui/AQL/components/master/products/index/listInactive.js
export default function (props) {
  return {
    ...props,
    layout: ['label', 'caption'],
    content: ['Name', 'SkuCode']
  }
}
```

---

## 3. `useListStrategy` — Header-Driven Defaults

Derives label/caption/meta/highlight resolvers purely from a resource's headers, parent relations, and active list-view state, so `contents/List.vue` never needs per-resource conditionals:
- **Label**: own `Name` column → first parent relation with a `Name` column (borrowed, e.g. SKU → Product, with `Variant1..5` appended) → 2+ descriptive columns combined (`"h2 - h3"`) → single descriptive column → `Code`.
- **Caption**: multiple parent relations → join every parent's name/code with `•`; else whatever the label didn't consume, or a `Date`/`TransactionDate`/`CreatedAt` + `CreatedBy`/`UpdatedBy`/`User`/`Agent` pair once available.
- **Highlight / meta-chip**: tracks `Progress` → `Status` → `Type`. While a list view is active, that field is dropped from the chip (redundant with the selected view chip) in favor of a currency-formatted amount column, or — for resources with more than 7 headers — a quantity column; `highlight` still tracks the state column regardless.
- **Meta-label / meta-caption**: data-dense resources (>7 headers) surface an amount/quantity column as `metaLabel` and one more unused descriptive column as `metaCaption`.

See `FRONTENT/src/composables/resources/useListStrategy.js` for the exact header-priority tables.

---

## 4. Per-Active-View Overrides (`List<ActiveViewName>`)

When a list view is active (managed by `useListViews` — e.g. an "Approved" filter chip selected), `contents/List.vue` sets its content-resolver identity to `List${toPascalCase(activeViewName)}` (e.g. `ListApproved`) instead of plain `List`. This lets you fully swap or adjust the list rendering for one specific view without touching the default:

- **Generic override for all resources under this view name**: `src/components/contents/ListApproved.vue`
- **Tenant/resource-specific Vue override**: `src/_ui/[uiName]/components/[scope]/[resource]/[page]/ListApproved.vue`
- **Tenant/resource-specific JS modifier**: `src/_ui/[uiName]/components/[scope]/[resource]/[page]/ListApproved.js`

If no `List<ViewName>` match is found anywhere, resolution silently falls through — `contents/List.vue` still renders `AppList` with the default strategy-derived props, since the override lookup only affects the `content` identity string, not the fallback behaviour.

### 4.1 Targeting a per-view list with `Props<Identity>`

The per-view hop participates in the `Props<Identity>` system like any other placeholder, so a page can hand props to one view's list without a file at all:

```javascript
// _ui/AQL/pages/Operation/OutletVisits/Index.js
export default {
  contents: ['List'],
  PropsList:      { layout: 'list' },     // the default List content
  PropsListToday: { layout: 'grid' }      // only while the "Today" view is active
}
```

The block is spread flat — `ListToday` reads `props.layout`. A `ListToday.js` modifier still wins over `PropsListToday`. See [UI_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_AND_SECTION_SYSTEM.md) §1.4.1 for the full contract.

> [!NOTE]
> `contents/List.vue` builds its per-view resolver bag from `$attrs` **first**, then its own strategy/explicit props. Without that, `finalProps` was assembled from *declared* props only (see `explicitProps`) and every key an ancestor drilled down without a matching `defineProps` entry — including `PropsListToday` — was dropped before the per-view resolver ever ran.

---

> [!IMPORTANT]
> **Content overrides do not control field rendering.** Individual form controls and detail/table value cells are delegated to the base field subsystem at `src/components/_fields/<type>/{Add,Edit,View}.vue`, resolved through `resolveFieldComponent(type, mode)` — the content components hold no type branches. Changing how a *field type* looks means editing that type's SFC (which applies to every resource, in add/edit/view); changing how *one column of one resource* looks means a `FormField<Header>` / `ViewColumn<Col>` override. See [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md) §15 and [UI_VIEW_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_VIEW_SYSTEM.md) §4.

---

## 5. Other Page Configuration Schemas (View/Add/Edit/Action — via JS Modifiers)

The sections below describe the existing Section-level modifier contracts (`Details.js`, `Form.js`, `Content.js` at the page-orchestrator level) that remain unchanged by the `contents:` system above; they operate through `useSectionResolver.js` rather than `useContentResolver.js`.

### 5.1 View Page: Details Card (`Details.js`)
Custom JS logic modifier file created at `src/_ui/[UiName]/components/[scope]/[ResourceName]/View/Details.js`.

#### Details Card Schema (`Details.vue` Props)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `detailsConfig` | `object` | `{}` | Inner configuration for details card: `title`, `columns`, `fields`, `fieldLabels`. |

##### `detailsConfig` Configuration Object:
* `title` (string, default: `'Details'`): Header text.
* `columns` (number, default: `1`): Responsive columns grid (supports `1`, `2`, `3`).
* `fields` (string[]): Explicit list of fields in display order.
* `fieldLabels` (object): Key-value mapping of field headers to custom labels.

#### Example Details Modifier
```javascript
// src/_ui/AQL/components/master/Products/View/Details.js
export default function (props) {
  return {
    ...props,
    detailsConfig: {
      title: 'Product Specifications',
      columns: 2,
      fields: ['Name', 'SkuCode', 'Type', 'Price'],
      fieldLabels: {
        SkuCode: 'Stock Keeping Unit',
        Price: 'MSRP (USD)'
      }
    }
  }
}
```

---

### 5.2 Add, Edit, & Action Forms (`Form.js`)
Custom JS logic modifier file created at `src/_ui/[UiName]/components/[scope]/[ResourceName]/Add/Form.js`, `Edit/Form.js`, or `Action/Form.js`.

#### Form Configuration Schema (`Form.vue` Props)
| Parameter | Type | Default | Description |
|---|---|---|---|
| `formConfig` | `object` | `{}` | Inner configuration details for inputs: `flat`, `bordered`, `class`, `columns`, `hideFields`, `fieldConfigs`, `sections`. |

##### `formConfig` Configuration Object:
* `columns` (number, default: `1`): Default number of columns for fields.
* `hideFields` (string[]): Fields to hide.
* `sections` (object[]): Fields grouped in Collapsible or static sections.
* `fieldConfigs` (object): Specific field definitions.

##### Date Fields
Form inputs of type `'date'` render using [AppDate.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/shared/AppDate.vue) for masked typing and a custom calendar pop-up.

#### Example Form Modifier
```javascript
// src/_ui/AQL/components/master/Products/Add/Form.js
export default function (props) {
  return {
    ...props,
    formConfig: {
      columns: 2,
      hideFields: ['CreatedBy', 'ModifiedBy'],
      sections: [
        {
          title: 'General Info',
          fields: ['Name', 'SkuCode', 'Price'],
          columns: 2
        },
        {
          title: 'System Settings',
          fields: ['Status', 'TaxRate'],
          collapsible: true,
          collapsed: true
        }
      ],
      fieldConfigs: {
        Price: {
          label: 'Unit price (USD) *',
          placeholder: '0.00',
          type: 'number'
        }
      }
    }
  }
}
```

---

### 5.3 `Create` — The Built-In Create Content Component

[Create.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/contents/Create.vue) (registered content name `Create`, component name `ContentsCreate`) is the framework's default resource-creation content, resolved exactly like `List`/`View` via `contents: ['Create']`:

```javascript
// src/pages/Master/create.js
export default {
  sections: ['PageHeader', 'PageAction'],
  contents: ['Create'],
}
```

`Create` renders the primary resource's input form (`FormRecord`) plus one `FormChild` per eligible child resource (resources whose `ParentResource` equals the active resource) — never a parent-relation form. All input lands directly in the shared `pageState` reactive tree via `setField`/`setControlField`/`addChild`/`updateChild`; submit is owned entirely by `PageAction` sections. Both components follow a strict **zero-hardcoding contract** — every default label, class, colour, and behaviour is an overrideable prop — and a four-step field-visibility precedence chain: **`showFields` > `hideFields` > `workflowFields`** (with `Status` hidden + seeded `'Active'` by default). Non-schema "custom" fields are routed to `pageState.setControlField`/`node.controls`, never `node.record`.

**Full canonical reference — component anatomy, complete prop tables, the visibility precedence chain, `defaultValues`/`fieldProps` function resolution, the three independent override hierarchies (`FormChild<ChildName>`, `FormRecord`, `FormField<Header>` — `_ui/*` only, no framework fallback), whole-content `create.vue`/`create.js` and `update.vue`/`update.js` overrides, `Update.vue`'s hydration lifecycle, and child soft-deletion — lives in [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md).**

---

### 5.4 Order & Visibility Control in View Pages (`Content.js`)

At the page content orchestrator level (`View/Content.js`), a resource custom JS modifier can adjust:
- **`order`**: Array of sections (`'Details'`, `'Parent'`, `'Children'`, `'Audit'`) defining their layout sequence.
- **`hide`**: Array of sections to completely exclude from rendering.

#### Example Content Modifier
```javascript
// src/_ui/AQL/components/operation/OutletConsumptions/View/Content.js
export default function (props) {
  return {
    ...props,
    order: ['Children', 'Details', 'Parent'], // Render children grid first
    hide: ['Audit', 'Parent']                 // Exclude audit trail and parent link cards
  }
}
```
