# usePageState — Submitting & Layer 2 Payloads

> Part of **[usePageState — Page-Level Form State](UI_PAGE_STATE.md)**. Building the batch, `$ref` linking, Layer 2 payload rules, workflow actions and strategy overrides.

---

## 10. Submitting

### `build()` → request array

Walked in slot order, first match wins per node:

| The node has | Request |
|---|---|
| `many` and rows in `records` | `bulk` |
| entries in `children` | `compositeSave` (with `code` when set) |
| a `code` | `update` |
| any key in `record` | `create` |
| none of the above | skipped |

Then, in order: every entry in `state.actions` as `executeAction`, and finally
one `get` built from `state.reload`.

```
nodes → actions → get
```

Actions come after the nodes so a `$ref` naming a record this batch creates
resolves against a row that already exists. The `get` is last so it sees the
finished batch.

### `submit(options?)`

```js
const { success, response, code } = await pageState.submit({
  successMsg: 'Consumption recorded.',
  reload: ['OutletStorages'],
  onSuccess: ({ response, code }) => nav.goTo('view', { code })
})
```

Validates first (`validationErrors`), notifies on failure, dispatches, clears the
draft **only on success**, and returns `{ success, response, code }`.

### `run(options)`

The same lifecycle, lower level. `submit` is a thin wrapper. Pass `requests` to
bypass `build()` — see the warning in §5A.2.

### `applyNodes(nodes)`

THE way a domain builder's output reaches the page. Takes one Node Object or an array of
them (§5) and returns `{ valid, success, nodes, successMsg?, outcome? }`:

```js
const applied = pageState.applyNodes(buildRestockCancellationNodes(parent, rows, actor, reason))
if (applied.valid === false) return false
return { successMsg: applied.successMsg }
```

In order, it:

1. **Gates.** Every node's `permissions` is checked against its own resource. The first gap
   notifies and returns `{ valid: false, message }` — nothing is written.
2. **Merges.** Nodes sharing an address are collapsed, so builders can be concatenated
   without the later one replacing the earlier:
   ```js
   pageState.applyNodes([...allocation, ...cancellations])
   ```
3. **Mounts** `record`, `children`, `records` and `controls`.
4. **Hoists** `actions` (inheriting each node's resource and role) and registers `derive`.
5. **Cleans the re-read**, dropping any resource this batch already writes (§5.5).

Each merged address is written with `setResource` (replace). A node carrying only `actions`
or `reload` is hoisted WITHOUT attaching a node — an empty node ships nothing but would
still be validated.

**It replaces, so a builder must never return a node the page already owns.** On an Add
wizard the page holds the form node; its builder returns only the extra nodes.

### `setReload(names)`

```js
pageState.setReload(['OutletStorages', 'WarehouseStorages'])
```

Replaces `state.reload`. A per-call `run({ reload })` unions with it into a
single deduped `get` and leaves `state.reload` untouched.

**Cursors are not your job.** `runBatchRequests` collects every resource in the
batch, builds `lastUpdatedAtByResource` from local cache, and injects it into
every request. Never put `lastUpdatedAtByResource` or `lastUpdatedAtResources` in
anything you build — it would be overwritten.

## 11. `$ref` — linking records inside one batch

`batchRef(path)` returns `{ $ref: path }`. The frontend never resolves it; GAS
walks the whole request tree and resolves it before each sub-request.

```js
import { batchRef } from 'src/composables/resources/resourceRequests'

pageState.setResource({
  resource: 'OutletRestocks',
  record: {
    OutletConsumptionCode: batchRef('OutletConsumptions.latest.code'),
    OutletCode: 'OUT00001'
  }
})
```

Path grammar is `<Resource>.<property walk>` against a context GAS accumulates
as the batch runs:

| Path | Resolves to |
|---|---|
| `OutletConsumptions.latest.code` | code of the last consumption created |
| `OutletReturns.records.3.Code` | the 4th return row's code |
| `X.byCode.OC-0042.SomeColumn` | any column of a known row |

A `$ref` works anywhere in the tree — inside `record`, inside a child row's
`data`. Unresolvable paths **throw** server-side, so an ordering mistake fails
loudly.

`batchRefList(path, codes)` joins a `$ref` to codes you already hold, for a
column storing a separated list. GAS performs the join. It is currently used
nowhere — two docblocks in `useInvoicePayload.js` claim otherwise and are wrong.

## 12. Layer 2 payloads

A resource's Layer 2 builder returns **Node Objects** — the Unified Node Transport
Structure of §5 — never request envelopes and never a `{ valid, nodes, permissions }`
wrapper. That keeps one assembly path, and keeps validation, drafts and inspection working.
Full contract: `UI_RESOURCE_DOMAIN_LOGIC.md` §9.2.

Write them as plain object literals. There is no constructor module: `nodePayloads.js` was
deleted on 2026-08-29, `resourceRow` moved to
`src/composables/resources/useResourceConfig.js`, and `actionKeyFor` lives in
`src/composables/resources/pageState/usePageStateActions.js`.

```js
// _resource/Operation/OutletRestocks/composables/useRestockPayload.js
import { resourceRow } from 'src/composables/resources/useResourceConfig'

export function buildRestockChainNodes (rows, { outletCode, actorName, date }) {
  return [{
    resource: 'OutletRestocks',
    record: resourceRow('OutletRestocks', {
      Date: date, OutletCode: outletCode, RequestedUser: actorName,
      OutletConsumptionCode: batchRef('OutletConsumptions.latest.code'),
      Progress: 'PENDING_APPROVAL', Status: 'Active'
    }),
    children: [{
      resource: 'OutletRestockItems',
      records: rows.map((r) => ({ SKU: r.SKU, Quantity: r.Quantity, Status: 'Active' }))
    }],
    permissions: { create: 'You are not allowed to create a restock request.' },
    reload: ['OutletStorages'],
    successMsg: 'Restock request created.'
  }]
}
```

Hydrating is then one call (§10, `applyNodes`):

```js
pageState.applyNodes(buildRestockChainNodes(rows, context))
```

### 12.1 Addressing decides the shape

A node is addressed by `resource` plus `role`, so **several roleless payloads for one
resource collapse onto one address**. A batch writing several rows of one resource must
either set `many: true` with a `Code` on each record, or give each update node its own
`role` — the record's own code is a good role name:

```js
// N restock parents in one delivery run
{ resource: 'OutletRestocks', role: code, code: textOrRef(code), record: { Progress: next } }
```

Queued actions are keyed instead — see §5.2. `data.columnValue` overrides
`actionConfig.columnValue` for a multi-outcome action.

### 12.2 Derived nodes are LIVE, not a submit-time afterthought

**A node is re-derived on every user action — a toggle, a quantity, a step move — not at
submit.** Ledger rows (`StockMovements`, `OutletMovements`), tax rows and any other
node computed from what the user has entered must already stand in `pageState` while the
user is still editing. A screen watching the nodes has to see the warehouse leg move the
moment a quantity does; a batch that only agrees with itself at submit cannot be inspected,
previewed or trusted before it is sent.

Roughly: **98% of the work happens on each edit, ~2% on a step move, and as close to 0% at
submit as the flow allows.** Submit dispatches what is already there.

**Re-derive means UPDATE, not rebuild.** A builder handed the current state must not
regenerate what has not changed:

- **Stamps and actors stand.** If `ProgressApprovedAt` is already written, keep it —
  re-stamping walks the clock forward on every keystroke and re-dates a decision the user
  made minutes ago. Write a stamp only when it is missing, and blank it only when the step
  it records is switched off.
- **Only what MOVED is written.** Diff the computed fields against the row and write the
  difference. This is also what makes a `children` derive safe: nothing the handler writes
  depends on the quantity, so a quantity change settles in one pass instead of looping.
- **Address every derived node.** `resource` plus `role` is its identity, so re-applying
  REPLACES its rows instead of stacking a second set. A leg the routing no longer calls for
  is **removed** (`removeNode`), never left holding stale rows.

The shape is one Layer 2 entry point taking the live `pageState`, wired through `derive` so
the domain declares what depends on what:

```js
export function syncRestockInPageState (pageState) {
  syncRestockProgressInPageState(pageState)   // stamps kept, only moved columns written
  syncRestockLedgersInPageState(pageState)    // both legs replaced by address, or removed
}

export function restockProgressDerive () {
  const handler = (value, pageState) => syncRestockInPageState(pageState)
  return [
    { on: { control: 'direct' }, handler },
    { on: { control: 'deliver' }, handler },
    { on: { control: 'WarehouseCode' }, handler },
    // The lines matter as much as the toggles: the ledgers are built from their
    // quantities, so a `+` click that did not reach here would leave the legs behind.
    { on: { children: 'OutletRestockItems' }, handler }
  ]
}
```

What genuinely cannot be live still waits: `executeAction` on records that already exist,
and the permission map. Those are not user input and do not belong in nodes the user edits
— but they still travel as node payloads.

### 12.3 `derive` — the UI reads nodes, nothing else

Once nodes are applied, the page must read its numbers off the NODE, not off a figure the
builder handed back on the side. The full `on` grammar is in §5.4.

- `pageState.derive([...])` registers one directly, for a page with a rule of its own.
- Derivations live in a scope pageState owns, so registering from a submit handler —
  outside any component scope — does not leak. `reset()` and `resetForResource()` drop them.

This replaces the manual `watch` in a `ready()` hook shown in §14.

### 12.4 Never promise a position

A builder must not return "the code is at index N of the response". A node that ships
nothing is skipped by `build()`, so positions are not knowable when the envelope is made.
Name the RESOURCE and let the caller resolve it after hydration:

```js
const at = pageState.build().findIndex((request) => request.resource === outcome.resource)
```


```vue
<q-input v-model="comment" label="Reason" />
<q-input v-model="nextDate" type="date" label="Next visit" />

<script setup>
const comment  = pageState.useActions('Complete', 'fields.ProgressCompletedComment')
const nextDate = pageState.useActions('Complete', 'targets.nextVisit.Date')
</script>
```

Entries are addressed by `resource#role::actionName::code` (`actionKeyFor` in
`usePageStateActions.js`). An action queued for the page's own record leaves the code half
empty, which is why queuing it twice updates one entry; a node's `actions` entry keys on
the row's code, so a per-row batch of stamps stays apart. A read by name takes the page's
own entry when there is one, else the first per-row entry for that action.

### 15.2 `state.actions` holds domain models, not wire requests

Every entry is `{ key, resource, code, actionConfig, data, reload }`, whether it was
queued by `applyNodes` from a node's `actions` (§5.2) or by `includeAdditionalAction`. `includeAdditionalAction` still runs the action pipeline to
resolve the config, the field schema and the seeds, but keeps only the resolved
`{ actionConfig, data: { fields, targets } }`.

The `executeAction` envelope is built once, at `build()` time, by
`usePageStateBuild.additionalActionRequests()` passing each entry to
`executeActionRequest(resource, code, actionConfig, data)`. Entries are deduped by `key`,
and every entry's `reload` joins the batch's re-read.

So a queued action stays inspectable and draftable as plain state — `pageState.snapshot()`
shows the intent, not a compiled request — and the wire format lives in exactly one
place.

The AdditionalActions popup uses this same machinery, on a `pageState` of its
own: `useAdditionalActionsDialog` holds a `usePageState({}, { persist: false })`
instance, queues the action onto it, binds every dialog field through
`getActions` / `setActions`, and submits with `run({ notify: false })`. It never
calls `initResource`, so the instance has no nodes — `validationErrors` stays
empty and `build()` emits just the one `executeAction`. It must not share the
host page's instance, because `run()` would then gate the dialog on that page's
validation errors, and an index page has no `pageState` to share. Action-field
`required` checks still run through `pipeline.validateActionForm` before `run()`,
since `run()` validates nodes, not action data.

## 16. Strategy overrides

`usePageState(strategy, options)` — all keys optional.

| Key | Signature | Purpose |
|---|---|---|
| `controls` | `(resource) ⇒ [{ name, codeType }]` | Field schema; `codeType` drives option lists |
| `getOptions` | `(codeType, node) ⇒ [{ label, value }]` | Option lists |
| `hydrate` | `(node, raw, ctx)` | Load a server record into a node |
| `build` | `(ctx) ⇒ [request]` | Replace `defaultBuild`. **Must append `additionalActionRequests()` and the reload itself** |
| `validate` | `(node, state) ⇒ [{ field, message }]` | Per-node validation |
| `persist` | `false` | Opt out of drafts |

## 17. Validation

`validationErrors` is a computed **array** across every node — required headers
from the resource config, plus `strategy.validate`. `run()` blocks on it and
notifies with the first message.

`useNode(...).validation` is the same check scoped to one node.

Required headers are read **per node's own resource**, so a `StockMovements` row in a
restock batch is not held to `OutletRestocks`' columns. A node that builds no request is
not checked at all — it is not a form the user can fix.

This only works if the data is in nodes. See §5A.

## 18. Debugging

In dev, `window.pageState` is the live instance. It is deleted when the page
unmounts, so it is never stale.

```js
pageState.snapshot()                    // whole tree as plain JSON, readable addresses
pageState.state.nodes.size
pageState.state.index                   // resource → role → uid
pageState.build({ mode: 'submit' })     // what would be sent
pageState.validationErrors.value        // note .value — it is a computed
pageState.getControls('NextVisitDays')
```

`snapshot()` keys nodes by readable address (`OutletVisits:next`) and puts page
controls, actions and reload under `$page`. Prefer it over `state.nodes`, which
logs as opaque uid soup.

## 19. Rules

1. Never read `state.nodes` or `state.index`. Use `useNode` / `hasNode`.
2. Never assign into a node or a child row. Use the mutations.
3. Anything GAS stores goes in `record` / `children` / `records`. Never `controls`.
4. Whether a resource is written is the **node's existence**, not a boolean.
5. Roles are names, never positions.
6. Never build `lastUpdatedAtByResource`. The transport owns cursors.
7. `ready` must not be `async`.
8. Do not use `run({ requests })` to escape modelling.
9. A Layer 2 builder returns Node Objects, never `requests` (§5, §12).
10. Several rows of one resource are one `many: true` node, or one node per `role` — never
    several roleless nodes, which collapse onto one address.
11. A builder never hand-writes another resource's columns — it calls that resource's own
    builder and spreads the nodes it returns.
12. A derived column is declared with `derive`, not recomputed in the UI (§12.3).
13. **One representation.** No draft copy beside the payload. `build()` strips `_`-prefixed
    keys, so a row may carry frontend-only tags.
14. Layer 3 hands the nodes a builder returns to `applyNodes`. A rebuild driven by user

---

⬑ Back to **[usePageState — Page-Level Form State](UI_PAGE_STATE.md)**.
