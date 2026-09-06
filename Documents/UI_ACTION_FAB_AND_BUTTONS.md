# Action Subsystem — Buttons, FAB Cluster & Reports

> Part of **[﻿# AQL Action System Guide](UI_ACTION_SYSTEM.md)**. The button components, the unified `ResourceActions` FAB cluster, `ResourceReports`, and the tenant override cookbook.

---

### 3.3 The button components
All three share the same shape: `inheritAttrs: false`, `[String, Function]` prop types
evaluated through `evaluateProp`, and `pageState` injected for the in-flight state.

| Prop | Type | `FormActionSubmit` | `FormActionReset` | `FormActionCancel` |
|------|------|--------------------|-------------------|--------------------|
| `label` | `String\|Function` | `'Save'` | `'Reset'` | `'Cancel'` |
| `icon` | `String\|Function` | `'check'` | `'restart_alt'` | `'close'` |
| `color` | `String\|Function` | `'primary'` | `'grey-7'` | `'grey-7'` |
| `disabled` | `Boolean\|Function` | `false` | `false` | `false` |
| `flat` / `unelevated` | `Boolean` | `false` / `false` | `false` / `false` | `false` / `false` |
| `cancelHandler` | `Function` | — | — | `null` (local escape hatch, see below) |

**Emits**: `click`. **All three report intent upward** — `PageAction.handleAction()` owns
every behaviour, including `cancel` → `nav.goBack()`. A button must never navigate or
dispatch on its own: `cancel` doing so would pop two history entries per click and would
make a `cancel` handler returning `false` unable to veto the navigation.

`cancelHandler` exists only for standalone use outside `PageAction`. When supplied it
**replaces** the emit entirely, so the container never also navigates.

> [!IMPORTANT]
> The cancel override prop is named `cancelHandler`, **not** `onCancel`. Vue treats any
> `onXxx` prop as an emit listener, which would silently bind `pageProps.onCancel`.

#### Styling
All three render as `push glossy` Quasar buttons carrying `.aql-form-action-btn`
(`padding: 6px 18px`, `font-weight: 600`, `min-height: 40px`, `border-radius: 8px`,
`.q-icon { font-size: 20px }` — defined in `custom.scss`, scoped as `.q-btn.aql-form-action-btn`
so it outranks Quasar's equal-specificity rules regardless of load order).

> [!IMPORTANT]
> `flat` and `unelevated` both default to **`false`** on all three buttons. Quasar's
> `flat` and `unelevated` each suppress the shadow that `push glossy` renders, so leaving
> either one on would make the styling inert. Visual subordination of Reset/Cancel to
> Submit comes from `color` (`grey-7` vs `primary`), not from flatness. Setting
> `flat: true` via a modifier is still supported — it just opts that button out of the
> push/glossy treatment.

### 3.4 `ResourceActions.vue` — the unified FAB cluster
The single bottom-right action cluster on every non-form page (evolution of the former
`CrudActions.vue`, which it replaces along with `AddFab`/`EditFab`/`CrudActionsFab`).
It unifies **two action sources** into one responsive cluster, so resource pages never
grow multiple competing right-side FABs:

| Source | Entry | Gate | Default click behaviour |
|--------|-------|------|-------------------------|
| Permissions | `ResourceActionAdd` | `permissions.canWrite` | `nav.goTo('add')` |
| Permissions | `ResourceActionEdit` | `permissions.canUpdate` **and** a record in context | `nav.goTo('edit')` |
| `useAdditionalActions().entriesFor(record)` | `ResourceAction<Name>` (e.g. `ResourceActionPostpone`) | applied by the composable — record in context, `can<Action>` not explicitly `false`, `visibleWhen` satisfied | the entry's bound `run()` — `navigate` routes, `mutate` opens the shared dialog |

| Local `_ui/` files | `ResourceAction<Name>` discovered by `useLocalResourceActions` | the file's own `visibleWhen` / `show` / `hide`, evaluated against the record | `navigate` routes, else the file's `run` / `handler` |

**List order is fixed**: CRUD first, then sheet `AdditionalActions`, then local discovered
actions. See §3.4.1.

> [!IMPORTANT]
> **`ResourceActions` owns no workflow logic.** It calls `entriesFor(record)` and merges
> its resolver context into each returned entry's props — nothing more. Permission
> gating, `visibleWhen`, and navigate-vs-mutate dispatch live in
> `composables/resources/useAdditionalActions.js` (§7), shared with the embeddable
> `components/app/AdditionalActionsButtons.vue`. A component that re-derives eligibility
> will drift from the config contract.

**Layout** — driven by the number of visible entries:

| Entries | Renders |
|---------|---------|
| 0 | Nothing (no empty FAB ever floats) |
| 1 | One standalone round FAB (`push glossy`, the entry's own color) |
| ≥ 2 | One expandable `ResourceActionsFab` menu (`push glossy` three-dot trigger) hosting every entry as a staggered `q-fab-action` with an external pill label |

Never rendered on `add` / `edit` / `action` pages — `FormActions` owns those. `PageAction`
gates the mount, and the component re-checks internally so a direct
`<Action action="ResourceActions" />` mount obeys the same rule.

**Per-item 10-tier overridability.** Every entry is mounted through `<Action>` under its
own action name with `ResourceActionItem` as the `fallback` base (§1.3). Because the name
flows through the normal resolver, each item's icon, color, label, visibility, and click
behaviour is overridable at all 10 `_ui/` tiers as `resourceaction<name>.(vue|js)` —
e.g. `_ui/AQL/components/operation/purchaseorders/view/resourceactionapprove.js`.
A JS modifier can return presentation props (`icon`, `color`, `label`, `tooltip`,
function-valued via `evaluateProp`), self-hide the item (`show: false` / `hide: true`),
or replace its click behaviour outright with `handler: (ctx) => …`,
`ctx = { record, config, pageState, nav }` — `handler` REPLACES the `click` emit, the
per-item counterpart of `FormActionCancel`'s `cancelHandler`.

The menu trigger resolves the same way as `ResourceActionsFab`
(`resourceactionsfab.(vue|js)`), and the whole cluster as `ResourceActions`
(`resourceactions.(vue|js)`); a container modifier returning `show: false` / `hide: true`
(plain boolean or function) suppresses everything.

**Workflow dispatch.** `ResourceActions` never opens a dialog itself — it invokes the
`run()` the composable bound to each entry, which routes a `navigate` action or opens
the single dialog mounted in `MainLayout.vue`. `noActions: true` suppresses the whole
`<Action>` mount (and with it these FAB triggers), but the dialog is independent of
`<Action>`, so an `AdditionalActionsButtons` trigger elsewhere on the page keeps working.

The `.aql-resource-action-container` entrance animation is applied to an **inner wrapper**,
never to the `q-page-sticky` root — a CSS transform on a `position: fixed` ancestor turns
it into the containing block for its fixed descendants and breaks FAB positioning.

> [!NOTE]
> **Migration from `CrudActions`.** Override names moved: `crudactions.(vue|js)` →
> `resourceactions.(vue|js)`, `addfab`/`editfab` → `resourceactionadd`/`resourceactionedit`,
> `crudactionsfab` → `resourceactionsfab`. No tenant override under any of the old names
> exists in the repo, so the rename is behaviour-preserving. CSS classes renamed in step:
> `.aql-crud-action-*` → `.aql-resource-action-*`.

#### 3.4.1 Local action auto-discovery

`composables/resources/useLocalResourceActions.js` scans the same Vite `_ui/` module
registry the resolver uses and picks up every file named `ResourceAction*.{vue,js}` in the
two standard tiers:

| Tier | Path |
|------|------|
| 1 — page | `_ui/{ui}/components/{scope}/{resource}/{page}/resourceaction*.{vue,js}` |
| 2 — resource | `_ui/{ui}/components/{scope}/{resource}/resourceaction*.{vue,js}` |

`resourceactions.(vue\|js)` and `resourceactionsfab.(vue\|js)` are excluded — they are the
container and the menu trigger, not items. Tier 1 wins over tier 2, and `.vue` wins over
`.js` inside a tier, matching the resolver.

**Local precedence.** Local code always beats framework and sheet defaults:

* A file named after a CRUD item (`ResourceActionAdd`, `ResourceActionEdit`) overrides that
  item **in place** — the resolver already does this, and the position in the list does not
  move.
* A file named after a sheet `AdditionalActions` item (`ResourceActionApprove`) overrides
  that item **in place** the same way.
* Only a file whose name matches nothing already listed is appended, as a **local
  discovered action**.
* Nothing is ever listed twice.

**`.js` definition contract.** The default export is an object, or a
`(ctx) => object` where `ctx = { record, config, pageState, nav }`. It mirrors the sheet
`AdditionalAction` shape:

| Key | Meaning |
|-----|---------|
| `action` | Action name (defaults to the name in the file name) |
| `label` | Pill label (defaults to the file name, spaced) |
| `icon` / `color` | Defaults `'bolt'` / `'primary'` |
| `kind` | `'navigate'`, `'mutate'`, or a custom key |
| `navigate` | `{ target, scope, resourceSlug, pageSlug, query }`; `query` may be an object or `(record) => object` |
| `permission` / `permissions` | Access gate, checked with `resourceConfig.allowed()` |
| `visibleWhen` | Conditions, evaluated with `isActionVisible(action, record)` |
| `show` / `hide` | Boolean or `(record) => Boolean` |
| `run` / `handler` | `({ record, config, pageState, nav }) => void` — custom click behaviour |

`permission` (alias `permissions`) is passed straight to `allowed()` from
`useResourceConfig`, so it takes any of the three shapes that helper accepts:

| Shape | Example | Means |
|-------|---------|-------|
| String | `'create'` | that action on the **current** resource |
| Array | `['create', 'update']` | all of those actions on the current resource |
| Map | `{ OutletConsumptionInvoices: 'create' }` | that action on **another** resource; values may also be arrays, and every entry must pass (AND) |

Use the map form whenever the action writes a resource other than the page's own —
gating on the current resource would show a button the user cannot complete.

An item that fails `permission`, `visibleWhen`, `show`, or `hide` never reaches the cluster. On click,
`kind: 'navigate'` routes through `nav.goTo(target, { …params, query })`; otherwise `run`
or `handler` is invoked. Because the same file is also the JS modifier for its own action
name, its `icon`/`color`/`label`/`show`/`hide`/`handler` keys land on `ResourceActionItem`
through the normal 10-tier resolve as well.

**`.vue` action components.** A `ResourceAction<Name>.vue` file is mounted by the cluster
like any other item (`<Action :action="…" :fallback="ResourceActionItem" as-fab-action …>`).
It should render `<ResourceActionItem v-bind="$attrs" …>` for the shared push-glossy
styling, stagger animation and pill label, and may host its own dialogs and state around it
(see `_ui/AQL/components/Operation/OutletVisits/ResourceActionAdd.vue`). A `.vue` file
carries no definition object, so its label defaults to its own name.

### 3.5 `ResourceReports.vue`
Report downloads as a first-class action. `PageAction` mounts it on every **non-form**
page next to `ResourceActions`. The sticky form bar does **not** host it — `FormActions`
resolves `FormAction*` buttons only. It is directly mountable anywhere as
`<Action action="ResourceReports" mode="toolbar" />`.

**Context adaptation** — the record context decides which half of the registry shows:

| Record context | Reports shown |
|----------------|---------------|
| `record` prop, else injected `resourceRecord` is set (View page) | `isRecordLevel === true` |
| No record (Index / browse page) | `isRecordLevel !== true` |

**Modes**:

| `mode` | Renders |
|--------|---------|
| `'fab'` *(default)* | `q-page-sticky` + a **pill** `q-fab` (icon + `label`) with one `q-fab-action` per report |
| `'toolbar'` | Flat round `q-btn` opening a `q-menu` list — for a header/toolbar slot |
| `'card'` | Flat bordered card wrapping a row of buttons — for embedding in a page body |
| `'inline'` | Bare `push glossy` buttons, used when mounted inside the `FormActions` bar |

**Props** — all `[Type, Function]` and evaluated through `evaluateProp`:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `String\|Function` | `'fab'` | See the mode table above |
| `label` | `String\|Function` | `'Reports'` | Short label beside the icon — this is what gives the FAB its pill footprint |
| `record` | `Object\|Function` | `null` | Explicit record context; falls back to injected `resourceRecord` |
| `reports` | `Array\|Function` | `null` | Replaces the config-derived list, so a page action config can declare exactly which reports appear |
| `color` / `itemColor` | `String\|Function` | `'teal-7'` / `'teal-7'` | Distinct from the navy CRUD cluster without competing with it |
| `textColor` | `String\|Function` | `'white'` | Content colour on those solid surfaces |
| `icon` / `activeIcon` | `String\|Function` | `'picture_as_pdf'` / `'close'` | |
| `tooltip` | `String\|Function` | `'Download Reports'` | |
| `position` / `offset` | `String\|Function` / `Array\|Function` | `'bottom-left'` / `[18, 18]` | `q-page-sticky` placement in `fab` mode — bottom-**left** so it never collides with the bottom-right CRUD cluster |
| `show` / `hide` | `Boolean\|Function` | `true` / `false` | Same suppression contract as `ResourceActions` |
| `noReports` | `Boolean\|Function` | `false` | Page-contract gate, mirroring `noActions` — see below |
| `page` / `scope` / `resource` / `uiName` | `String` | `null` | Resolver context |

**The `noReports` gate.** `noActions: true` in a page contract or JS modifier suppresses
the entire `<Action>` mount from `Page.vue`. `noReports: true` is the narrower switch:
it drops only the report cluster and leaves the CRUD FABs in place. It is declared on
**both** `PageAction` (which also checks `$attrs.noReports`, so a full `pageaction.vue`
override or an intermediate wrapper cannot lose the gate) and `ResourceReports` itself
(so a direct `<Action action="ResourceReports" no-reports />` mount obeys it too).

```javascript
// _ui/AQL/pages/index.js — CRUD FABs stay, report FAB goes
export default { noReports: true }
```

> [!IMPORTANT]
> **`ResourceReports` is self-dispatching** — the one deliberate exception to
> "buttons never act on their own" (§3.3). Submit/Reset/Cancel emit intent because
> `PageAction.handleAction()` dispatches them through `pageState`; a report download
> never touches `pageState`. Routing it through the dispatcher would push report
> knowledge into the submission lifecycle, so it calls `useReports` directly. It
> therefore emits nothing and takes no `@`-handler from its container.

**Layer boundary**: the component is presentation only. Input-dialog state, dynamic
select preloading (`dataStore.loadResource` for `type: 'select'` inputs with a
`source`), progress notifications, and the Base64 → Blob download all live in
`useReports` (`src/composables/reports/useReports.js`) — see
[FEATURE_REPORTS_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_REPORTS_SYSTEM.md).

**Styling**: `push glossy` throughout, matching the `ResourceActions` cluster and the
`FormActions` bar buttons. `.aql-report-action-fab` `@extend`s `.aql-resource-action-fab`,
so both floating clusters share one shadow, hover-lift and press-scale — but the report
FAB takes a **horizontal pill** footprint — Quasar's own geometry for a labelled QFab,
not a CSS override (icon + short `label`)
rather than the CRUD cluster's round FAB, because reports are a utility affordance and
the label makes that legible without a hover. The `card`/`inline` buttons carry
`.aql-form-action-btn` for sticky-bar padding and weight, plus `.aql-report-action-btn`
for the same pill radius. Report-specific rules in `custom.scss` are
`.aql-report-action-{container,fab,item,btn,label,card,card-inner}`. No `<style>` block,
per §7 of ARCHITECTURE RULES.

> [!IMPORTANT]
> The pill treatment is **exclusive to `ResourceReports`**. `ResourceActions` and its FABs
> keep their round footprint and navy palette unchanged — the two clusters share motion
> and elevation, not shape or colour.

> [!NOTE]
> The legacy `components/Reports/ResourceReports.vue` is untouched and still works for
> every direct import in custom views and pages (`<ResourceReports :record="…" />`).
> It resolves its record from the route code via `useDataStore`; the action version
> uses the injected `resourceRecord` instead, which is what a resolver-backed
> component is supposed to do. New work should use the action.

---

## 4. Tenant Override Cookbook

All paths are under `FRONTENT/src/_ui/[UiName]/components/`. Remember `{Resource}` is the
**PascalCased-then-lowercased** slug.

**Swap Reset for Cancel on one resource's add page** — JS modifier on the container:
```javascript
// _ui/AQL/components/master/products/add/pageaction.js
export default {
  actions: ['cancel', 'submit']
}
```

**Rebrand the submit button across a whole scope**:
```javascript
// _ui/AQL/components/operation/formactionsubmit.js
export default {
  label: (record) => record?.Progress === 'Draft' ? 'Submit for Approval' : 'Save',
  color: 'accent',
  icon: 'send'
}
```

**Replace one button's template entirely**:
```html
<!-- _ui/AQL/components/master/products/add/formactionreset.vue -->
<template>
  <q-btn v-bind="$attrs" flat color="negative" label="Discard" icon="delete" @click="$emit('click')" />
</template>

<script setup>
defineOptions({ inheritAttrs: false })
defineEmits(['click'])
</script>
```

**Replace the whole bar** — `_ui/AQL/components/master/products/formactions.vue`. Your
override receives `page`/`scope`/`resource`/`uiName`/`submitLabel`/`disabled`/`actions`
and must emit `submit` / `reset` / `cancel` / `action(key)` for `PageAction` to dispatch.

**Add a custom action** — the key needs a button *and* a handler:
```javascript
// _ui/AQL/components/operation/purchaserequisitions/add/pageaction.js
export default {
  actions: ['cancel', 'saveDraft', 'submit'],           // renders FormActionSaveDraft
  saveDraft: (name, { pageState }) => {                  // dispatched via pageState.run()
    pageState.setRecord('Progress', 'DRAFT', 'PurchaseRequisitions')
    return { requests: pageState.build({ mode: 'draft' }), successMsg: 'Draft saved.' }
  }
}
```
Supply the button itself as `_ui/AQL/components/.../formactionsavedraft.vue` (or `.js` to
modify a base). Without a handler the button renders but only logs
`[PageAction] No action handler supplied for: saveDraft`.

**Hide the whole FAB cluster on a resource**:
```javascript
// _ui/AQL/components/operation/outletvisits/resourceactions.js
export default { show: false }
```

**Restyle one workflow action's FAB item** — the item resolves under its own name:
```javascript
// _ui/AQL/components/operation/purchaseorders/view/resourceactionapprove.js
export default {
  icon: 'verified',
  color: 'positive',
  label: (record) => record?.Progress === 'Resubmitted' ? 'Re-Approve' : 'Approve'
}
```

**Repoint one item's click behaviour** — `handler` replaces the container's default:
```javascript
// _ui/AQL/components/operation/outletrestocks/resourceactionedit.js
export default {
  handler: ({ nav }) => nav.goTo('record', { pageSlug: 'draft' })
}
```

**Replace one item's template entirely** — supply
`_ui/AQL/components/operation/purchaseorders/view/resourceactionapprove.vue` with
`inheritAttrs: false`, bind `$attrs`, and emit `click` (or honour the `handler` attr) so
the container's dispatch keeps working.

**Move report downloads into the page header instead of the floating FAB**:
```javascript
// _ui/AQL/components/operation/outletpayments/resourcereports.js
export default { mode: 'toolbar' }
```

**Show only one report, relabelled, on a resource's View page**:
```javascript
// _ui/AQL/components/operation/outletreturns/view/resourcereports.js
export default {
  reports: (record, config) =>
    (config?.reports || []).filter((r) => r.name === 'ReturnNote')
}
```

**Suppress reports on a page without touching `_ui/`** — a page contract or page JS
modifier prop, since `PageAction` declares both `reports` and `noReports`:
```javascript
// _ui/AQL/pages/index.js
export default { noReports: true }
// …or steer it instead of dropping it: { reports: { mode: 'toolbar' } }
```

**Intercept the submission lifecycle without touching any template**:
```javascript
// _ui/AQL/components/operation/purchaseorders/add/pageaction.js
export default {
  submit: (name, { pageState }) => {
    const node = pageState.state.nodes.get('PurchaseOrders')
    if (!node?.children?.length) return { valid: false, message: 'Add at least one item.' }
  },
  successRoute: 'view',
  successMessage: 'Purchase order created.'
}
```

> [!IMPORTANT]
> **Attribute fallthrough (the div-wrap trap).** Never wrap a `.vue` override in a bare
> `<div>` to stop fallthrough — it swallows clicks, badges, and permission props. Set
> `inheritAttrs: false` and bind `$attrs` **before** your custom properties.

---


---

⬑ Back to **[﻿# AQL Action System Guide](UI_ACTION_SYSTEM.md)**.

---

⬑ Back to **[﻿# AQL Action System Guide](UI_ACTION_SYSTEM.md)**.
