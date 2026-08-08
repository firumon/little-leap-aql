# AQL Action Subsystem — Customization & Overriding Guide (Initialization)

Use this document to initialize an AI agent session when the task involves creating,
customizing, overriding, or debugging **page-level actions**: the sticky form actions bar,
submit/reset/cancel buttons, floating action buttons (FABs), CRUD actions, workflow
triggers, or the submission lifecycle on any page (Index, Add, Edit, View, Action).

> [!IMPORTANT]
> **Scope Boundary**: This document covers the Action subsystem only — `Action.vue`,
> `useActionResolver.js`, everything under `FRONTENT/src/components/actions/`, and their
> `_ui/` overrides. Page chrome (Header/Filter/Switcher) belongs to
> [page_and_section_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_section_system.md);
> page bodies/forms belong to
> [content_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_customization.md)
> and [content_create_and_update_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_create_and_update_customization.md).
> Before writing any frontend code you MUST read
> [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md).

---

## 1. Read First

> [!IMPORTANT]
> Before implementing anything, read the full canonical doc:
> [AQL_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_ACTION_SYSTEM.md).
> It carries the complete prop tables for every action component, the resolution
> internals, the tenant override cookbook, and the loading-UX contract.

Codebase reference files:
* [Action.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/Action.vue) — the `AqlAction` placeholder.
* [useActionResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useActionResolver.js) — the resolver.
* [components/actions/](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/actions/) — all base action components.
* [Page.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/Page.vue) — where the subsystem is mounted.
* [usePageState.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/usePageState.js) — submission lifecycle; full API in [PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/PAGE_STATE.md).
* [custom.scss](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/css/custom.scss) — all action styling.

---

## 2. Architecture in One Screen

The Action subsystem is the third placeholder paradigm, structurally identical to Sections
and Contents but with its own resolver and base folder:

| Paradigm | Placeholder | Resolver | Base folder |
|----------|-------------|----------|-------------|
| Section | `Section.vue` | `useSectionResolver.js` | `components/sections/` |
| Content | `Content.vue` | `useContentResolver.js` | `components/contents/` |
| **Action** | **`Action.vue`** | **`useActionResolver.js`** | **`components/actions/`** |

**Mount point** — `src/pages/Page.vue`, after `AqlContentWrapper`, as a sibling of the
entrance `<Transition>` (never inside `.aql-page-body`, or the fixed FAB gets trapped by
the animation's CSS transform):
```html
<Action v-if="ready && pageProps.noActions !== true" action="PageAction" v-bind="pageProps" />
```

**Component tree**:
```
Action.vue (action="PageAction")
└── actions/PageAction.vue              ← owns the submission lifecycle
    ├── actions/FormActions.vue         ← add / edit / action pages (resolved)
    │   ├── Action → actions/FormActionReset.vue
    │   ├── Action → actions/FormActionSubmit.vue
    │   └── Action → actions/FormActionCancel.vue
    ├── actions/ResourceActions.vue     ← every other page (resolved); unified
    │   │                                 bottom-right FAB cluster (CRUD +
    │   │                                 AdditionalActions workflow/navigate)
    │   ├── Action → ResourceActionAdd / ResourceActionEdit /
    │   │            ResourceAction<Name>  (fallback base:
    │   │            actions/ResourceActionItem.vue — per-item 10-tier override)
    │   └── actions/ResourceActionsFab.vue  ← expandable menu when ≥2 items
    └── actions/ResourceReports.vue     ← every other page (resolved); report downloads

(ResourceActions renders AdditionalActions items too, but owns none of their
 logic — it folds in `useAdditionalActions().entriesFor(record)`. See Pattern 7)
```

The Action subsystem is decoupled from `sections` — it mounts on every resource page and does
not need a `'PageAction'` entry. Set `noActions: true` in a page contract or JS modifier to
suppress the `<Action>` mount. It does not affect the AdditionalActions dialog, which is
independent of `<Action>` entirely.

---

## 3. The 10-Tier Lookup Sequence

`useActionResolver.js` scans candidates in this order (first match wins), under
`src/_ui/[UiName]/components/`:

1. **Vue override** (resource + page): `.../[scope]/[Resource]/[page]/[Action].vue`
2. **JS modifier** (resource + page): `.../[scope]/[Resource]/[page]/[Action].js`
3. **Vue override** (resource): `.../[scope]/[Resource]/[Action].vue`
4. **JS modifier** (resource): `.../[scope]/[Resource]/[Action].js`
5. **Vue override** (page): `.../[scope]/[page]/[Action].vue`
6. **JS modifier** (page): `.../[scope]/[page]/[Action].js`
7. **Vue override** (scope-wide): `.../[scope]/[Action].vue`
8. **JS modifier** (scope-wide): `.../[scope]/[Action].js`
9. **Vue override** (ui-wide): `.../[Action].vue`
10. **JS modifier** (ui-wide): `.../[Action].js`

Base component lookup (before the scan): `_ui/[UiName]/components/actions/[Action].vue`,
then `FRONTENT/src/components/actions/[Action].vue`.

*Path segment rules (all segments are lowercased for registry lookup):*
- `[scope]` → lowercased as-is (e.g. `master`)
- `[Resource]` → `toPascalCase` first, then lowercased (`'purchase-orders'` → `PurchaseOrders` → **`purchaseorders`**)
- `[page]`, `[Action]`, `[UiName]` → lowercased as-is

*File names are case-insensitive* — the registry lowercases all keys at build time, so
`FormActionSubmit.vue` and `formactionsubmit.vue` resolve identically.

---

## 4. Customization Patterns

### Pattern 0: `Props<Identity>` from the page contract (no override file)
The cheapest option — address one action by name from `_ui/.../pages/.../[page].js`:
```javascript
export default {
  PropsAction:           { dense: true },              // broadcast: every action
  PropsFormActionSubmit: { label: 'Create Product' },  // just the submit button
  PropsPageAction:       { actions: ['cancel', 'submit'] }
}
```
Spread **flat** onto the action (`props.label`), and a `.js` modifier still wins over it.
Precedence: `drilled attrs → PropsAction → Props<Identity> → JS modifier`. Reach for a
modifier file when the value needs record/config context; use this for plain values.
Full contract: [AQL_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_PAGE_AND_SECTION_SYSTEM.md) §1.4.1.

### Pattern 1: JS Logic Modifier (change props, keep the template)
```javascript
// src/_ui/AQL/components/master/products/add/formactionsubmit.js
export default {
  label: (record) => record?.Status === 'Draft' ? 'Save Draft' : 'Create Product',
  color: 'accent',
  icon: 'cloud_upload'
}
```
The function form receives full context:
```javascript
export default (currentProps, { pageState, resourceRecord, resourceConfig }) => ({ ... })
```
Function-valued props are evaluated via `evaluateProp`, which passes **plain unwrapped
objects** `(record, config)`. Never call `.value` inside a closure prop.

### Pattern 2: Configure which buttons render
The `actions` array on `FormActions` is the supported way to change the button set —
prefer it over overriding the bar's template.
```javascript
// src/_ui/AQL/components/master/products/add/pageaction.js
export default { actions: ['cancel', 'submit'] }
```
| Entry | Resolves to | Base component |
|-------|-------------|----------------|
| `'reset'` | `FormActionReset` | `actions/FormActionReset.vue` |
| `'submit'` | `FormActionSubmit` | `actions/FormActionSubmit.vue` |
| `'cancel'` | `FormActionCancel` | `actions/FormActionCancel.vue` |
| `'draft'` | `FormActionDraft` | *none — supply it under `_ui/`* |

Only `FormAction*` buttons resolve here — `ResourceReports` is not mountable from
`actions` (reports belong to browse/view pages).

Default is `['reset', 'submit']`. Entries may also be objects: `{ name: 'submit', label: 'Publish' }`.
An unrecognised key emits `action(key)` from `FormActions` instead of `submit`/`reset`/`cancel`.

### Pattern 3: Vue Template Override
> [!IMPORTANT]
> **To prevent parent attributes from overriding your local properties, you MUST use
> `defineOptions({ inheritAttrs: false })` and bind `$attrs` BEFORE your overrides.**
> Never wrap an override in a bare `<div>` — it swallows clicks, badges, and permission props.

```html
<!-- src/_ui/AQL/components/master/products/add/formactionreset.vue -->
<template>
  <q-btn v-bind="$attrs" flat color="negative" label="Discard" icon="delete" @click="$emit('click')" />
</template>

<script setup>
defineOptions({ inheritAttrs: false })
defineEmits(['click'])
</script>
```

### Pattern 4: The unified action dispatcher (no template edits)
Every button routes through one function in `PageAction.vue`,
`handleAction(actionName)`. There is **no `beforeSubmit`** — a handler is looked up by
the action's own name, so one modifier export covers built-ins and custom keys alike:

| Handler source | Key | Built-in default if the handler returns nothing |
|---|---|---|
| declared prop | `submit` | `pageState.submit()` (or `pageState.run()` on an action page) |
| declared prop | `reset` | `onReset()` — silent discard + re-seed/re-hydrate |
| declared prop | `cancel` | `nav.goBack()` |
| `$attrs` | any custom key (`nextStep`, `saveDraft`, …) | `console.warn` when no handler is supplied |

Handler signature: `(actionName, ctx) => result`, `ctx = { pageState, resourceConfig, resourceRecord, nav, payload }`.
Handlers are awaited. Return values:

| Return | Effect |
|---|---|
| `false` or `{ valid: false, message }` | Abort; `message` is notified as an error |
| `Array` | Shorthand for `{ requests: [...] }` — dispatched via `pageState` |
| `Object` | Merged into the `pageState.submit()`/`run()` call options |
| `undefined` / `true` | Continue with the built-in default |

```javascript
// src/_ui/AQL/components/operation/purchaseorders/add/pageaction.js
export default {
  actions: ['cancel', 'saveDraft', 'submit'],   // adds a FormActionSaveDraft button

  submit: (name, { pageState }) => {            // veto — built-in submit never runs
    const node = pageState.state.nodes.get('PurchaseOrders')
    if (!node?.children?.length) return { valid: false, message: 'Add at least one item.' }
  },
  reset:  () => window.confirm('Discard all changes?'),
  saveDraft: (name, { pageState }) => ({        // custom key — dispatched via run()
    requests: pageState.build({ mode: 'draft' }),
    successMsg: 'Draft saved.'
  }),

  modifyPayload: (requests) => requests,
  successRoute: 'view',
  successMessage: 'Purchase order created.'
}
```
Available props: `submit`, `reset`, `cancel`, any custom action key, `modifyPayload`,
`successRoute`, `successMessage`, `onSubmitSuccess`, `onSubmitError`, `submitLabel`, `actions`.

> [!IMPORTANT]
> A custom action needs **both** halves: the key listed in `actions` (so a button renders)
> and a handler of the same name (so the click does something). Missing the handler logs
> `[PageAction] No action handler supplied for: <key>` and does nothing else.

### Pattern 5: The unified `ResourceActions` FAB cluster
One bottom-right cluster per non-form page, sourcing Add (`canWrite`), Edit
(`canUpdate` + record), **and** every eligible AdditionalActions item whenever a
record is in context. One item → standalone FAB; ≥2 → one expandable
`ResourceActionsFab` menu.

> [!IMPORTANT]
> The workflow half owns **no logic** here. `useAdditionalActions().entriesFor(record)`
> returns entries already gated (permissions + `visibleWhen`) with `run()` bound, and
> `ResourceActions` merely merges its resolver context into each one's props. Never
> re-derive eligibility in a component — see Pattern 7.

Every item resolves under its own action name with `ResourceActionItem` as base, so
each is customizable at all 10 tiers:

```javascript
// Suppress the whole cluster
// src/_ui/AQL/components/operation/outletvisits/resourceactions.js
export default { show: false }   // or { hide: true }; both accept a function

// Restyle / hide / repoint ONE item (e.g. the Approve workflow FAB)
// src/_ui/AQL/components/operation/purchaseorders/view/resourceactionapprove.js
export default {
  icon: 'verified',
  color: 'positive',
  label: (record) => record?.Progress === 'Resubmitted' ? 'Re-Approve' : 'Approve',
  // hide: true,                          // self-hide just this item
  // handler: ({ nav, pageState }) => …   // REPLACES the default click behaviour
}
```
Item names: `ResourceActionAdd`, `ResourceActionEdit`, `ResourceAction<Name>`
(PascalCased action name, lowercased on disk — `resourceactionapprove.(vue|js)`).
A `.vue` item override must set `inheritAttrs: false`, bind `$attrs`, and emit
`click` for the container's default dispatch to keep working. The menu trigger is
overridable as `resourceactionsfab.(vue|js)`.

### Pattern 6: Report downloads (`ResourceReports`)
`PageAction` mounts `actions/ResourceReports.vue` on every non-form page (bottom-left
FAB), gated only by whether the resource has matching reports. It adapts itself:
with a record in context (View page) it shows `isRecordLevel` reports, without one
(Index page) it shows page-level reports.

```javascript
// Header dropdown instead of the floating FAB, resource-wide
// src/_ui/AQL/components/operation/outletpayments/resourcereports.js
export default { mode: 'toolbar' }   // 'fab' | 'toolbar' | 'card' | 'inline'

// Suppress, or steer, from a page contract / page JS modifier.
// noReports drops ONLY the report cluster; noActions drops the whole <Action> mount.
export default { noReports: true }   // or { reports: { mode: 'toolbar' } }
```

Styling shares `ResourceActions`' motion and elevation (`push glossy`,
`.aql-report-action-fab` `@extend`s `.aql-resource-action-fab`) but **not** its shape or
colour: the report FAB is a horizontal pill (icon + `label`, default `'Reports'`,
Quasar's own labelled-QFab geometry, not a CSS radius override) in `teal-7` with
white text. `card`/`inline` buttons carry
`.aql-form-action-btn` + `.aql-report-action-btn`. The pill and teal treatment are
exclusive to `ResourceReports` — never apply them to `ResourceActions`.

It is the **one deliberate exception** to "buttons never act on their own": a report
download never touches `pageState`, so it calls `useReports` directly rather than
emitting intent to `PageAction.handleAction()`. Keep it that way — do not add report
logic to the dispatcher, and do not fetch or notify from the component. See
[report_ui_development.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/report_ui_development.md).

### Pattern 7: Multi-record actions (`targets[]`) — the standalone subsystem
An `AdditionalActions` entry may carry `targets[]` alongside its own `fields[]`, letting
one action write several records (Postpone = stamp this visit **and** create the next).

> [!IMPORTANT]
> This does NOT use the 10-tier resolver or `components/actions/`. Files:
> `components/app/AdditionalActionsButtons.vue` (embeddable triggers),
> `components/app/AdditionalActionsDialog.vue` (ONE dialog, mounted in
> `MainLayout.vue`), `composables/resources/useAdditionalActions.js` (eligibility +
> dispatch intent), `additionalActionsPipeline.js` (mechanics),
> `additionalActionsSchema.js` (pure field builders), and `GAS/actionTargets.gs`. Full
> spec in [AQL_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_ACTION_SYSTEM.md) §7.

**Two dispatch paths — pick the right one.**

| | Popup | Batched |
|---|---|---|
| Call | `useAdditionalActions().runAction(action, record)` | `pageState.includeAdditionalAction(name, data)` |
| Use when | the record exists and the user fills the inputs | the action must ride **with** the page's own submission |
| Target | `record.Code` | a concrete code, or a `$ref` to a record this batch creates |

```javascript
// Create a visit AND stamp it, atomically, in one batch.
pageState.initResource('OutletVisits', { fields: { OutletCode, Date } })
pageState.includeAdditionalAction('Postpone', {
  Comment: 'Rescheduled',              // source field — SHORT authored name
  newVisit: { Date: '2026-01-04' }     // target field — nested bag (or 'newVisit.Date')
})
await pageState.submit()
```

Omit `code` and it resolves automatically: the node's own `code` when editing, else
`batchRef('<Resource>.latest.code')`. Queued actions are emitted **last** by
`defaultBuild`, which is what makes that `$ref` resolve — a `strategy.build` override must
append `additionalActionRequests()` itself. See
[PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/PAGE_STATE.md) §6.4a.

**The pipeline (`additionalActionsPipeline.js`).** Never hand-roll an `executeAction`
envelope, a field schema, a seed, or a payload bucket — every step is already a function
that resolves config/headers/options/user/transport internally:

```javascript
const {
  resolveAction, actionTitle, actionSubtitle, actionFieldGroups, createActionForm,
  validateActionForm, extractActionPayload, buildActionRequest,
  dispatchActionRequests, executeAdditionalAction
} = useAdditionalActionsPipeline(resourceName?)   // omit to follow the active route
```

Each step accepts an action **name or an already-normalized config**, so the dialog reuses
them without a second lookup. `useAdditionalActionsDialog` and
`usePageState.includeAdditionalAction` both run on these — a change to the wire format is
one edit, not three.

Non-negotiables when touching it:
* **`useResourceConfig.normalizeAction` is a key WHITELIST.** It rebuilds every action
  from named keys, so a new `AdditionalActions` key added to the JSON, the authoring UI
  and GAS will still be **silently dropped** before any component sees it unless it is
  also copied there. This is exactly how `targets` went missing while the FAB looked
  perfect. Add the key in *three* places: `actionManager.html`, `normalizeAction`, and
  whatever consumes it. (`targets` itself is passed through **as authored**, so keys
  *inside* a target — `when`, `code`, `mode` — ride along without a fourth edit. Anything
  at the ACTION level still needs all three.)
* **A target may be conditional — `when` (§7.4.1).** Single object or array (ANDed), ops
  exactly the `visibleWhen` set, one left operand per condition: `field` (this target's own
  input, literal column name) > `column` (source record) > `expression` (`from`/`value`
  grammar). False ⇒ the target is skipped **entirely**: no resolution, no sheet read, no
  validation, no write. Absent/empty ⇒ always runs, so every existing config is untouched.
  A malformed condition is **dropped**, and the target runs.
  - **Server decides, always.** `isActionTargetActive` (`actionTargets.gs`) runs in
    `executeActionTargets` pass 1 *before* `prepareActionTarget`. `isTargetActive`
    (`additionalActionsSchema.js`) is a client mirror for **validation only** — never let a
    component or composable use it to decide whether a target executes.
  - **The point is `required`.** `useAdditionalActions.validate()` skips `required` for
    fields on an inactive target: *"if you start filling this block, finish it"*, not
    *"you must fill this block"*. Marking the gating field `required` instead is the
    workaround `when` exists to replace.
  - **Render every target's inputs anyway.** A `field`-keyed gate is satisfied by typing
    into that very group; hiding it makes the condition unsatisfiable.
    `buildTargetFieldGroups` tags the group `hasCondition` instead.
  - **A skipped target is not addressable.** `$target.<key>.<Column>` on a skipped target
    fails the whole action with an explicit "SKIPPED by its when condition" message.
  - **Matched pair**: `evaluateActionTargetCondition` (GAS) ↔ `evaluateConditionOp`
    (`useResourceConfig.js`, shared with `visibleWhen`). Change one, change the other.
* **One dialog, never N.** Triggers render buttons only. A list rendering one trigger per
  row must not mount one dialog per row.
* **Dialog `title`/`subtitle` are record templates**, not expressions — `{Code}`,
  `{$outlet.Name}`. Record-only context, resolved by `resolveRecordTemplate`, client-side.
* **`type` = visible, `from`/`value` = seeded.** Both together = editable prefill.
* **Source fields derive** (`{column}{PascalCase(columnValue)}{name}`); **target fields are
  literal** column names.
* **Use `actionHeaderSuffix`, not `toPascalCase`** — the latter splits on `[- ]` only and
  diverges from GAS on underscored outcomes like `REVISION_REQUIRED`.
* **Targets come from the trusted config, never the client.** That is what lets them write
  under the action's own permission on the source resource.
* **The POPUP path never uses pageState.** Its `validationErrors` gate fires on the host
  page's nodes, and `ensureNode` collides with the page's own node for the same resource.
  The batched path is the deliberate exception and is `usePageState` by construction — it
  queues an envelope, it does not open the dialog.
* **`normalizeAdditionalActions` is module-scope in `useResourceConfig.js`**, so an
  arbitrary resource's actions can be resolved, not just the active route's. The key
  whitelist still lives inside it — that rule is unchanged.
* Controls render through `_fields/` — never hand-roll a `q-input` in the dialog.

### Pattern 8: Full container override
If you override `pageaction.vue` you must explicitly import and render `FormActions`
and/or `ResourceActions` yourself, and wire `@submit`/`@reset` to `pageState` — the base
container's lifecycle logic is not inherited.

---

## 5. Strict Rules

> [!CRITICAL]
> **Permissions**: gate every action at the container level (`PageAction` / `ResourceActions`)
> and drill down via props. Never render or enable an Add affordance without
> `permissions.canWrite`, or an Edit affordance without `permissions.canUpdate`. Use
> `allowed()` from `useResourceConfig` for workflow actions.

* **No `<style>` blocks in `components/actions/`.** All action CSS lives in
  `src/css/custom.scss` (`.aql-form-actions-*`, `.aql-form-action-btn`, `.aql-resource-action-*`) —
  ARCHITECTURE RULES §7. A scoped style cannot be inherited by a tenant `.vue` override,
  so it breaks the contract.
* **Buttons never act on their own.** Submit, Reset, and Cancel all just emit `click`;
  `PageAction.handleAction()` owns every behaviour. A button that navigates or dispatches
  by itself double-fires against the dispatcher and makes a handler's `false` veto useless.
* **Button styling is `push glossy` + `.aql-form-action-btn`.** `flat` and `unelevated`
  default to `false` on all three — Quasar's `flat`/`unelevated` each suppress the shadow
  `push glossy` renders, so turning either on opts that button out of the treatment.
  Differentiate Reset/Cancel from Submit via `color`, not flatness.
* **Date fields re-seed on Reset.** `app/Date.vue` watches `modelValue` (immediate) and
  emits today's `YYYY-MM-DD` whenever it goes empty, so `pageState` clearing a node on
  Reset leaves date inputs pre-filled. Don't re-add an `onMounted`-only default, and
  **keep the emit inside `nextTick`** — emitting synchronously on the immediate run
  re-enters Quasar's mask handling before the inner `<input>` exists and throws
  `Cannot read properties of null (reading 'selectionEnd')`. The empty check is repeated
  inside the tick so a value that arrived meanwhile is not clobbered.
* **Loading UX**: while `pageState.meta.submitting` is true, buttons are `:disable`d —
  **never** `:loading`. The single blocking indicator is the `q-inner-loading` overlay
  rendered by `AqlContentWrapper` over the content area.
* **Navigation**: use `useResourceNav` (`goTo` / `goBack`). Direct `router.push()` is forbidden.
* **Cancel override prop is `cancelHandler`, not `onCancel`** — Vue treats any `onXxx` prop
  as an emit listener and would silently bind `pageProps.onCancel`.
* **Folder is the contract**: a file under `actions/` resolves via `useActionResolver`, one
  under `sections/` via `useSectionResolver`. Never mix them.
* **Never bypass the resolvers** to hardcode an action component into a page.

---

## 6. Strict Maintenance Rule

> [!IMPORTANT]
> **Documentation Sync Requirement**: Any modification, refactor, or addition to the Action
> subsystem (new component under `components/actions/`, changed scan order, changed
> `actions` array contract, changed loading UX) MUST be accompanied by updates to:
> 1. The canonical doc: [AQL_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_ACTION_SYSTEM.md)
> 2. This initialization prompt: [action_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/action_customization.md)
> 3. The component registry: [components/REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md)
