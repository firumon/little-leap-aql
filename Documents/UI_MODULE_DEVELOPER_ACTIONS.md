# 3-Layer UI — Actions, Dispatch, Handlers & FABs

> Part of **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**. The common action overrides, the handler contract, permission gates and cross-resource chains.

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

    // 2. Invoke the Layer 2 Domain Payload Chain Builder, and hand its Node Objects
    //    straight to applyNodes. It gates on each node's own permissions, notifies on a
    //    refusal, and reports back what the domain decided to say.
    const applied = pageState.applyNodes(buildAuditCompletionChainNodes({
      auditRecord,
      discrepancies,
      actor: formRecord.ActorName,
      notes: formRecord.Notes
    }))
    if (applied.valid === false) return false

    return { successMsg: applied.successMsg }
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


---

⬑ Back to **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**.
