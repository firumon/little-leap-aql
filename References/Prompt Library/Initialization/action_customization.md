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
└── actions/PageAction.vue          ← owns the submission lifecycle
    ├── actions/FormActions.vue     ← add / edit / action pages (resolved)
    │   ├── Action → actions/FormActionReset.vue
    │   ├── Action → actions/FormActionSubmit.vue
    │   └── Action → actions/FormActionCancel.vue
    └── actions/CrudActions.vue     ← every other page (resolved)
        ├── sections/AddFab.vue          ┐ still Sections —
        ├── sections/EditFab.vue         │ resolved via
        └── sections/CrudActionsFab.vue  ┘ useSectionResolver
```

The Action subsystem is decoupled from `sections` — it mounts on every resource page and does
not need a `'PageAction'` entry. Set `noActions: true` in a page contract or JS modifier to
suppress both `<Action>` and the workflow `ActionDialog`.

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

### Pattern 5: Suppress CRUD FABs
```javascript
// src/_ui/AQL/components/operation/outletvisits/crudactions.js
export default { show: false }   // or { hide: true }; both accept a function
```

### Pattern 6: Full container override
If you override `pageaction.vue` you must explicitly import and render `FormActions`
and/or `CrudActions` yourself, and wire `@submit`/`@reset` to `pageState` — the base
container's lifecycle logic is not inherited.

---

## 5. Strict Rules

> [!CRITICAL]
> **Permissions**: gate every action at the container level (`PageAction` / `CrudActions`)
> and drill down via props. Never render or enable an Add affordance without
> `permissions.canWrite`, or an Edit affordance without `permissions.canUpdate`. Use
> `allowed()` from `useResourceConfig` for workflow actions.

* **No `<style>` blocks in `components/actions/`.** All action CSS lives in
  `src/css/custom.scss` (`.aql-form-actions-*`, `.aql-form-action-btn`, `.aql-crud-action-*`) —
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
