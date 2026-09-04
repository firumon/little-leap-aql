# Action Subsystem — `PageAction.vue` & `FormActions.vue`

> Part of **[﻿# AQL Action System Guide](UI_ACTION_SYSTEM.md)**. The submission lifecycle component and the configurable action array.

---

### 3.1 `PageAction.vue`
Mounted by `Page.vue`. Decides which cluster is live:
* `add` / `edit` / `action` → `FormActions` (the sticky bar owns these pages entirely).
* everything else → `ResourceActions` (which applies its own permission/record/
  `visibleWhen` gating per item) **and** `ResourceReports` (which applies its own
  reports-exist gating).

**The two halves of the `FormActions` gate.** Route intent alone is not enough:

| Computed | Meaning | Gates |
|---|---|---|
| `isFormRoute` | `isAdd \|\| isEdit \|\| isAction` — this URL is a form page | `ResourceActions`, `ResourceReports` (both `!isFormRoute`) |
| `hasFormNodes` | `pageState.hasNodes` — the form state is initialized | — |
| `showFormActions` | **both** of the above | `FormActions` |

`showFormActions` and `!isFormRoute` are deliberately **not** inverses.
* `FormActions` needs BOTH halves, so the sticky bar cannot render over a form
  whose nodes have not been created yet — Submit there would build an empty batch.
* The two FAB clusters gate on `isFormRoute` only. Keying them off
  `!showFormActions` would flash Add/Edit FABs on top of an uninitialized form
  page, and would let anything that clears `pageState` on a browse page (a popup
  modal, for instance) suppress the background clusters. On an add/edit route with
  no nodes yet, **no** cluster renders.
* `hasFormNodes` falls back to `true` when `pageState` is not injected, or when the
  injected object predates `hasNodes` — a full `pageaction.vue` override or a
  non-standard provider keeps its previous behaviour.

`hasNodes` is exported by `usePageState` (`state.nodes.size > 0`); see
[UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md) §6.4. It is
node-count only — for a specific node use `useNode(resource).exists`.

All three clusters are mounted through `useActionResolver` (with the framework component as
`defaultComponent`), so each is independently overridable at any of the 10 tiers.

**Props** — every one is settable from a `pageaction.js` JS modifier:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `page` | `String` (required) | — | Canonical page name |
| `scope` / `resource` / `uiName` | `String` | `null` | Resolver context; falls back to injected `resourceConfig` |
| `actions` | `Array` | `null` | Forwarded to `FormActions`; `null` lets `FormActions`' own default apply |
| `reports` | `Boolean\|Object` | `true` | Report cluster on non-form pages. `false` suppresses it; an object is spread onto `ResourceReports` (e.g. `{ mode: 'toolbar' }`) |
| `noReports` | `Boolean` | `false` | Page-contract gate — suppresses only the report cluster, leaving the CRUD FABs (cf. `noActions`, which suppresses everything) |
| `submit` / `reset` / `cancel` | `Function` | `null` | Unified action handlers — see §3.1.1 |
| `modifyPayload` | `Function` | `null` | `(requests, ctx) => requests` payload interceptor |
| `successRoute` | `String\|Function` | `null` | `'view'` \| `'index'` \| `(code, ctx) => target` |
| `successMessage` | `String\|Function` | `''` | Notification text on success |
| `onSubmitSuccess` | `Function` | `null` | `({ response, code }, ctx) => void` — replaces default navigation |
| `onSubmitError` | `Function` | `null` | `(result, ctx) => void` |
| `submitLabel` | `String\|Function` | `null` | Overrides the derived label (`Create` / `Save` / action label) |

`ctx` is `{ pageState, resourceConfig, resourceRecord, nav }`.

#### 3.1.1 The unified action dispatcher

Every button in the bar — built-in or custom — routes through one function,
`handleAction(actionName, extraPayload)`. There is no per-action prop pipeline and no
`beforeSubmit`: a handler is simply looked up **by the action's own name**.

```
button click
   │
   ├─ resolveHandler(actionName)
   │     built-in key ('submit'|'reset'|'cancel') → props[actionName]
   │     custom key   ('nextStep', …)             → $attrs[actionName]
   │
   ├─ no handler AND not built-in → console.warn('[PageAction] No action handler supplied for:', name) → stop
   │
   ├─ handler? → result = await handler(actionName, ctx)      ctx = { pageState, resourceConfig, resourceRecord, nav, payload }
   │      result === false          → abort
   │      result.valid === false    → abort (notify result.message if present)
   │      Array                     → { requests: [...] }
   │      Object                    → merged into the pageState call options
   │      undefined | true          → continue with defaults
   │
   └─ built-in default
         submit → pageState.submit(options)  (or pageState.run() on an action page)
         reset  → onReset()
         cancel → nav.goBack()
         custom → pageState.run(options), but only when the handler returned
                  `requests` or `build`; otherwise the handler is assumed to have
                  done its own work
```

Handlers are `async`-aware — a returned promise is awaited before the built-in runs.
Returned options are merged **over** the defaults, except `onSuccess`, which is only
filled in when the handler did not supply one.

```javascript
// _ui/AQL/components/operation/purchaseorders/add/pageaction.js
export default {
  // Veto — the built-in pageState.submit() never runs
  submit: (name, { pageState }) => {
    const node = pageState.state.nodes.get('PurchaseOrders')
    if (!node?.children?.length) return { valid: false, message: 'Add at least one item.' }
  },

  // Confirm before discarding; returning false leaves the form untouched
  reset: () => window.confirm('Discard all changes?'),

  // Custom key — requires `actions: [..., 'nextStep', ...]` on FormActions.
  // Returning requests dispatches them through pageState.run().
  nextStep: (name, { pageState }) => [ /* …request objects… */ ]
}
```

A custom key listed in `actions` with **no** handler is a no-op plus a console warning —
the button still renders, so the misconfiguration is visible rather than silent.

> [!NOTE]
> A custom action key must be listed in `FormActions`' `actions` array to render a
> button, and its handler must be exported from a `pageaction.js` modifier (it reaches
> `PageAction` via `$attrs`, since only `submit`/`reset`/`cancel` are declared props).

**Wizard step actions (`next` / `back`).** Both have a dispatcher default —
`currentStep + 1` and `Math.max(1, currentStep - 1)` — so `actions: ['back', 'next']`
drives a multi-step page with no handler at all, and neither key warns when unhandled.
They are *not* declared props, so a page overrides them from a `pageaction.js` modifier
exactly like a custom key:

```javascript
next: (name, { pageState }) => {
  if (!pageState.getControls('OutletCode', null, 'Orders')) {
    return { valid: false, message: 'Select an outlet to continue.' }   // veto: step does not move
  }
  // return nothing → the built-in increment performs the move
}
```

> [!IMPORTANT]
> The step change lives in the **dispatcher**, not in `FormActionNext`/`FormActionBack`.
> A button that moved the step on click would have already advanced by the time an async
> handler's `{ valid: false }` resolved, making the veto useless — the same reason
> `FormActionCancel` reports intent instead of navigating. A handler that moves the step
> itself must therefore return `false` to suppress the built-in, or it will double-step.

**Reset semantics (`onReset`)** — a silent discard, no navigation and no notification:
* On `add`: `pageState.initResource(resource, { isPrimaryKey: true, reset: true })` swaps in
  a fresh record object. `FormRecord.vue` keys its default-seeding watch on that object's
  identity, so the resource's configured default values are re-seeded rather than leaving
  a blank form.
* On `edit` / `action`: additionally `pageState.load(original, resource)` re-hydrates the
  pristine server record (`resourceRecord` is never mutated by form input — only
  `pageState.node.record` is), so unsaved edits are discarded without losing originals.

> [!NOTE]
> `FormActions` deliberately does **not** receive `...attrs`. `pageProps` carries an
> `onCancel` (navigateBack) handler that Vue would bind as a `cancel` emit listener,
> double-navigating on top of `FormActionCancel`'s own `goBack()`.

### 3.2 `FormActions.vue` — the configurable action array
Renders the sticky bar chrome and one `<Action>` per entry in `actions`:

```html
<div class="aql-form-actions-spacer">
  <div class="aql-form-actions-bar shadow-up-3">
    <div class="aql-form-actions-content row items-center justify-end q-gutter-sm">
      <Action v-for="entry in resolvedActions" :key="entry.id" :action="entry.action" v-bind="entry.props" />
    </div>
  </div>
</div>
```

**Name mapping**: a short key is prefixed with `FormAction` and capitalised; an
already-qualified name passes through.

| `actions` entry | Resolved action name | Base component |
|-----------------|----------------------|----------------|
| `'submit'` | `FormActionSubmit` | `actions/FormActionSubmit.vue` |
| `'reset'` | `FormActionReset` | `actions/FormActionReset.vue` |
| `'cancel'` | `FormActionCancel` | `actions/FormActionCancel.vue` |
| `'next'` | `FormActionNext` | `actions/FormActionNext.vue` |
| `'back'` | `FormActionBack` | `actions/FormActionBack.vue` |
| `'FormActionNext'` | `FormActionNext` | same as above |

> [!NOTE]
> The bar hosts `FormAction*` buttons only — there are no non-`FormAction` aliases.
> In particular `ResourceReports` is **not** mountable from `actions`; reports are a
> browse/view-page affordance (see §3.5). Mount it directly with
> `<Action action="ResourceReports" … />` if a form page genuinely needs one.

**Props**:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `actions` | `Array` | `['reset', 'submit']` | Ordered button list, left → right. Entries are strings or `{ name, ...props }` objects |
| `page` / `scope` / `resource` / `uiName` | `String` | `null` | Resolver context passed to every button `<Action>` |
| `submitLabel` / `resetLabel` / `cancelLabel` | `String\|Function` | `'Save'` / `'Reset'` / `'Cancel'` | |
| `submitIcon` / `resetIcon` / `cancelIcon` | `String\|Function` | `'check'` / `'restart_alt'` / `'close'` | |
| `submitColor` / `resetColor` / `cancelColor` | `String\|Function` | `'primary'` / `'grey-7'` / `'grey-7'` | |
| `disabled` | `Boolean\|Function` | `false` | Submit-only gate (e.g. an action page awaiting an outcome) |
| `actionProps` | `Object` | `{}` | Extra props merged per key, e.g. `{ submit: { icon: 'send' } }` |

**Emits**: `submit`, `reset`, `cancel`, and `action(key)` for any unrecognised key.

**Prop merge order per button** (later wins):
`resolverContext` → per-key defaults → `actionProps[key]` → object-entry extras.

Common configurations:
```javascript
// Default — in-place reset next to submit
actions: ['reset', 'submit']

// Discard-and-leave instead of in-place reset
actions: ['cancel', 'submit']

// Multi-step wizard, driven by pageState.meta.currentStep. With no `next`/`back`
// handler the dispatcher's built-in step move runs, so this works as-is.
actions: ['back', 'next']

// Custom key, with a tenant-supplied FormActionDraft under _ui/
actions: ['cancel', 'draft', 'submit']

// Object entries for one-off prop tweaks
actions: ['reset', { name: 'submit', label: 'Publish', icon: 'send' }]
```


---

⬑ Back to **[﻿# AQL Action System Guide](UI_ACTION_SYSTEM.md)**.
