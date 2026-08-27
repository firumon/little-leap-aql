# usePageState — Page-Level Form State

`FRONTENT/src/composables/resources/pageState/`

One instance per page. Created and provided in `Page.vue`, injected by every
Header / Content / Action section beneath it. It holds what the user is building
and turns it into a GAS batch.

> **Read §5 before writing a page.** It describes the one mistake this system
> keeps attracting, and the whole API is shaped to avoid it.

---

## 1. What it is for

A form page collects input across several resources and submits them as one
batch. `pageState` is the single place that input lives while the user works.

It answers four questions:

| Question | Answer |
|---|---|
| Where does user input live? | `state.nodes` — one node per resource being written |
| Where does page working state live? | `state.controls` — never sent to GAS |
| What gets submitted? | `build()` walks the nodes and produces requests |
| What survives a reload? | The draft, in `localStorage` |

## 2. Getting it

Already provided. Inject it:

```js
const pageState = inject('pageState')
```

In a page contract, it arrives as an argument — see §12.

## 3. The state model

```
pageState
├── state
│   ├── primaryKey  string|null              the page's main resource
│   ├── nodes       Map<uid, Node>           PRIVATE — never read directly
│   ├── index       { [res]: { [role]: uid } } PRIVATE — never read directly
│   ├── controls    [{ header, value }]      page working state, never sent
│   ├── actions     Entry[]                  queued executeAction envelopes
│   └── reload      string[]                 resources to re-read after the batch
├── meta            page-level UI flags (§4)
└── the API         (§6 onward)
```

### 3.1 The node

One node is one resource's contribution to the batch.

```
Node
├── resource  string              the GAS resource name
├── code      string|$ref|null    set ⇒ update, unset ⇒ create
├── many      boolean             true ⇒ this node is a bulk write
├── record    { [header]: value }     ▶ SHIPS — the header/body the user edits
├── children  Bucket[]                ▶ SHIPS — composite children
├── records   Row[]                   ▶ SHIPS when many:true
├── payload   { [key]: value }        ▶ SHIPS beside the record, request-level extras
├── controls  Control[]               ✕ NEVER SHIPS
└── options   { [field]: Option[] }   option lists, derived from codeType
```

`Bucket` is `{ resource, records: Row[] }`.
`Row` is `{ _action: 'create'|'update'|'deactivate', data: {…} }`.

`Row` is the one **public** data contract — FormChild renders it and
`build()` ships it. Read it freely; change it only through `updateChild`
(patches `data`) and `setChildAction` (sets `_action`).

### 3.2 Addressing — resource plus ROLE

Nodes are keyed by an opaque uid, not by resource name, so **one resource can
hold several nodes**. `index` maps `resource → role → uid`.

```
index
├── "OutletConsumptions"
│    └── "$default"  ──▶ node
└── "OutletVisits"
     ├── "complete"  ──▶ node        the visit being closed
     └── "next"      ──▶ node        the visit being scheduled
```

Roles are **names, never positions**. A workflow creates nodes conditionally, so
an ordinal would shift the moment a checkbox is unticked and silently resolve to
the wrong node.

Every accessor takes a target in any of three forms:

```js
useNode('Outlets')                                   // role '$default'
useNode('OutletVisits', 'next')                      // explicit role
setField({ resource: 'OutletVisits', role: 'next' }, 'Date', v)
```

A target may also be a `ref` or a getter, so a component whose resource changes
on navigation binds once at setup and stays correct.

### 3.3 Build order is a slot

Each address claims a slot the first time it appears and keeps it for the life of
the page. Re-initialising a node, or removing and re-adding one, returns it to
its original position.

This matters because request order is what makes `$ref` resolve (§9). Without
it, a user stepping backwards through a wizard could reorder the batch.

### 3.4 Private, by contract

`state.nodes` and `state.index` are private. The uid scheme is not part of the
contract.

- **Read** through `useNode()` / `hasNode()` / `getControl()`
- **Write** through the mutations in §6

A stale uid resolves to a blank node, which builds an empty payload instead of
raising. That is why direct access is banned.

## 4. `meta` — page-level UI flags

| Field | Type | Meaning |
|---|---|---|
| `currentStep` | number | Wizard step. Written by PageAction's `next`/`back`, read by every step card |
| `submitting` | boolean | Flipped by `run()` around every dispatch; FormAction buttons disable on it |
| `stepping` | boolean | Brief settle window around a step change, so the bar cannot be double-clicked |
| `saving` | boolean | Also flipped by `run()`. `AqlContentWrapper` dims the page on `submitting \|\| saving` |

That is the whole of `meta`. `loading`, `validationErrors` and `formActionsHeight`
were removed on 2026-08-27 — nothing had ever read them, and `meta.validationErrors`
was an empty object shadowing the real top-level `validationErrors` **array**.

Do not add a field here without a consumer. `meta` is for flags several sections
share; anything one page needs belongs in `state.controls` (§8).

---

## 5. The mistake to avoid

**Read `_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard.js`
as a warning, not a template.**

That wizard writes across six resources. Its pageState looks like this at the
final step, one click before submit:

```json
{
  "nodeCount": 1,
  "node": {
    "resource": "OutletConsumptions",
    "record": { "OutletCode": "OUT00001", "Date": "2026-08-26", … },
    "children": [],          ← empty
    "records":  []           ← empty
  },
  "controls": {
    "CountRows":    "ARRAY(28)",
    "RestockRows":  [ { "SKU": "CK3-01", "Quantity": 3 } ],
    "ReturnMeta":   {}, "PriceListCode": "PLC00001", …
  }
}
```

One node. 28 counted items and a fully-formed restock sitting in `controls` —
the bucket that never ships. Then `PageAction.submit` returns `{ requests }`,
which makes `run()` skip `build()` entirely and dispatch a batch assembled by a
423-line Layer 2 builder.

**Four things are lost by doing this:**

1. **Validation is blind.** `validationErrors` sees a record with six headers and
   nothing to complain about. It has no idea 28 rows are pending.
2. **Drafts save the wrong thing.** An opaque blob restores, but the nodes that
   would have described it never existed.
3. **Logic is duplicated.** `resolvePrice` exists twice — in the wizard and in
   `PageAction.js` — with a comment promising they stay in sync. What step 3
   displays and what step 6 bills are two code paths.
4. **State that decides writes exists nowhere.** `CompleteVisit` and
   `ScheduleNextVisit` render as ON but are never stored; they are
   `get(F.COMPLETE_VISIT, true)` defaults. A draft cannot capture an explicit
   "no", and two visit records depend on them.

### 5.1 What to do instead

| The user is entering… | Put it in |
|---|---|
| A column on the resource being written | `record` (`setField`) |
| Line items of that resource | `children` (`addChild`) |
| Many rows of one resource | `records` (`addRecord`) |
| Another resource entirely | **another node** (`initResource` / `setResource`) |
| The same resource, twice | another node with a **role** |
| A wizard-only input, no column | `controls` (`setControl`) |
| Whether a resource is written at all | **the node's existence** (`removeNode`) |

That last row is worth reading twice. Do not store `completeVisit: true`. Create
or remove the `OutletVisits:complete` node. The node's presence *is* the boolean,
and it cannot drift from what is actually submitted.

### 5.2 The `{ requests }` escape hatch

`run({ requests })` skips `build()`. It exists for callers that must apply a
`modifyPayload` interceptor. **Reaching for it makes every node on the page
inert.** If you find yourself using it because "the batch is too complex for
nodes", read §12 — that complexity belongs in a Layer 2 builder that returns
node-shaped payloads, not raw requests. No Layer 2 builder in `_resource/` uses it,
and none should.

---

## 6. API — nodes

### `initResource(resource, options?)`

Creates or replaces a node. Returns it.

```js
pageState.initResource('OutletConsumptions', {
  reset: true,                    // flush the previous page's nodes first
  fields: { Date: today(), Username: user.name, Status: 'Active' },
  isPrimaryKey: true
})

pageState.initResource('OutletVisits', { role: 'next' })
pageState.initResource('OutletMovements', { many: true })
pageState.initResource('Outlets', { code: 'OUT00001' })   // ⇒ update, not create
```

| Option | Meaning |
|---|---|
| `role` | Address under a role other than `$default` |
| `code` | Existing record code, or a `$ref`. Set ⇒ the node updates instead of creates |
| `many` | This node is a bulk write |
| `fields` | Seed values merged into `record` |
| `reset` | Flush every node first — use on page mount |
| `isPrimaryKey` | Force this resource to become `state.primaryKey` |

### `removeNode(resource, role?)` → boolean

Drops one node. Returns `false` for an unknown address, so it is safe to call
unconditionally.

```js
pageState.removeNode('OutletVisits', 'next')   // user unticked "schedule next"
```

Removing `OutletVisits:next` leaves `OutletVisits:complete` untouched. Queued
actions are **not** touched — call `excludeAdditionalAction` too if the action
should go with it.

### `hasNode(resource, role?)` / `hasNodes`

`hasNode` is imperative. `hasNodes` is a computed — true once any node exists.
Use `useNode(...).exists` when a template needs it reactively.

### `resetForResource(resource)` / `reset()`

`reset()` clears everything — nodes, controls, reload, actions, meta.
`resetForResource(name)` does the same, then sets `primaryKey`.

## 7. API — writing a node

### `setField` / `setFields`

```js
pageState.setField('OutletConsumptions', 'OutletCode', 'OUT00001')
pageState.setFields('OutletConsumptions', { Date: '2026-08-27', Status: 'Active' })
```

Creates the node if missing.

### `setResource` / `updateResource`

Writes a whole node-shaped object at once. `setResource` **replaces** — it clears
what the payload leaves out. `updateResource` **merges**.

Three call forms:

```js
pageState.setResource('OutletRestocks', payload)
pageState.setResource('OutletVisits', 'next', payload)
pageState.setResource(payload)          // payload carries .resource / .role
```

The third form is what `applyNodes` uses to hydrate a Layer 2 envelope (§10).

```js
pageState.setResource({
  resource: 'OutletRestocks',
  record: { OutletCode: 'OUT00001', Progress: 'PENDING_APPROVAL' },
  children: [{
    resource: 'OutletRestockItems',
    records: [{ SKU: 'CK3-01', Quantity: 3 }]      // bare rows are fine
  }],
  reload: ['OutletStorages'],                      // hoisted to state.reload
  actions: [executeActionEnvelope]                 // hoisted to state.actions
})
```

| Payload key | Behaviour |
|---|---|
| `record` | Merged; `setResource` first deletes keys the payload omits |
| `children` | Replaced (`setResource`) or merged per child resource (`updateResource`) |
| `records` | Replaced or appended. Non-empty implies `many: true` |
| `code`, `many` | Set when present |
| `controls` | Only touched when named. A replace drops the `{header,value}` half and keeps the `{name,codeType}` schema half |
| `reload` | **Hoisted** to `state.reload`, always additive, deduped |
| `actions` | **Hoisted** to `state.actions`, deduped by key |

**Hoisting is always additive**, even under `setResource`. Several nodes
contribute to one batch, so a later call must never wipe what an earlier one
asked for.

**Guard:** `many: true` together with `children` **throws**. `build()` would
drop the children silently, so it is rejected at the point of the mistake.

Rows may be `{ SKU: 'X', Qty: 3 }` or `{ _action: 'update', data: {…} }`. Both
normalise.

### Children

```js
pageState.addChild('OutletConsumptions', 'OutletConsumptionItems', { SKU: 'CK3-01', Qty: 3 })
pageState.updateChild('OutletConsumptions', 'OutletConsumptionItems', 0, { Qty: 5 })
pageState.setChildAction('OutletConsumptions', 'OutletConsumptionItems', 0, 'deactivate')
pageState.removeChild('OutletConsumptions', 'OutletConsumptionItems', 0)
```

`updateChild` merges `data` only. To soft-delete a persisted row use
`setChildAction(..., 'deactivate')` — that is what GAS expects.

### Many-rows

```js
const i = pageState.addRecord('OutletMovements', { SKU: 'CK3-01', QtyChange: -3 })
pageState.updateRecord('OutletMovements', i, { QtyChange: -4 })
pageState.removeRecord('OutletMovements', i)
```

`addRecord` sets `many = true` automatically.

## 8. API — controls

Controls hold anything that is **not** a column on a resource: wizard toggles,
selections over existing records, UI bookkeeping. They never reach GAS.

### Page-level (`state.controls`)

```js
pageState.setControl('NextVisitDays', 21)
pageState.getControl('NextVisitDays', 14)      // 14 is the fallback; default null
const days = pageState.useControl('NextVisitDays', 14)   // writable computed
```

`useControl` returns a writable computed, so a template can bind it directly:

```vue
<q-input v-model="days" type="number" />
```

**Page controls outlive every node.** That is the reason they exist. If
`NextVisitDays` lived on the `OutletVisits:next` node, `removeNode` would destroy
the number the user typed, and re-ticking the toggle would lose it.

### Node-scoped

Pass a resource (and role) as the 3rd and 4th arguments:

```js
pageState.setControl('Note', 'text', 'OutletVisits', 'next')
pageState.getControl('Note', '',     'OutletVisits', 'next')
pageState.useControl('Note', '',     'OutletVisits', 'next')
```

Signature is uniform: `(header, value|fallback, resource?, role?)`.
Writes create the node; **reads never do**.

`setControlField(resource, header, value, role?)` and
`getControlField(resource, header, role?)` are the older resource-first
equivalents. Both still work.

### Which to use

| State | Where |
|---|---|
| Survives node removal, or relates to no node | `state.controls` |
| Belongs to one specific node's editing session | node-scoped |
| Is a column GAS will store | **not a control** — `record` |

## 9. Reading — `useNode`

```js
const { node, record, exists, identifier, options, validation, children } =
  pageState.useNode('OutletConsumptions')
```

| Key | Type | Use |
|---|---|---|
| `node` | `Computed<Node>` | The whole node |
| `record` | `Computed<object>` | v-model target for the primary FormRecord |
| `exists` | `Computed<boolean>` | Reactive `hasNode` |
| `identifier` | `Computed<string>` | The node's uid. Changes when the node is **replaced**, not edited — key one-shot hydration off this |
| `options` | `Computed<object>` | Per-field option lists, lazy and memoized |
| `validation` | `Computed<Error[]>` | Required headers + `strategy.validate` for this node |
| `children(res)` | `() ⇒ Computed<Row[]>` | Child rows. Entry identity is stable, so `indexOf` works |

**`node` is always an object, never `null`.** A missing node resolves to a blank
one whose `record` is `{}`, `children` is `[]`, and so on — safe to read before
`initResource` has run and after `removeNode`. Each `useNode()` call gets its own
blank, so a `v-model` bound while the node is missing cannot leak into another.

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
bypass `build()` — see the warning in §5.2.

### `applyNodes(nodes)`

Hydrates a Layer 2 envelope. THE way a domain builder's output reaches the page:

```js
const result = buildRestockCancellationNodes(parent, rows, actor, reason)
if (!result.valid) return { valid: false, message: result.message }
pageState.applyNodes(result.nodes)
return { successMsg: result.successMsg }
```

Payloads sharing an address are merged first, so several builders' output can be
concatenated without the later one replacing the earlier:

```js
pageState.applyNodes([...allocation.nodes, ...cancellations.nodes])
```

Each merged address is then written with `setResource` (replace). A payload carrying only
`actions` or `reload` is hoisted WITHOUT attaching a node — an empty node ships nothing but
would still be validated.

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

A resource's Layer 2 builder returns the envelope
`{ valid, nodes, permissions, message?, successMsg? }`, where `nodes` are **node-shaped
payloads**, not request envelopes. That keeps one assembly path, and keeps validation,
drafts and inspection working. Full contract: `UI_RESOURCE_DOMAIN_LOGIC.md` §9.2.

Build them with `src/composables/resources/nodePayloads` — `createNode`, `updateNode`,
`bulkNode`, `compositeNode`, `actionNode`, `reloadNode` — never by hand.

```js
// _resource/Operation/OutletRestocks/composables/useRestockPayload.js
import { bulkNode, compositeNode } from 'src/composables/resources/nodePayloads'

export function buildRestockChainNodes (rows, { outletCode, actorName, date }) {
  return {
    valid: true,
    nodes: [compositeNode({
      resource: 'OutletRestocks',
      record: {
        Date: date, OutletCode: outletCode, RequestedUser: actorName,
        OutletConsumptionCode: batchRef('OutletConsumptions.latest.code'),
        Progress: 'PENDING_APPROVAL', Status: 'Active'
      },
      children: [{
        resource: 'OutletRestockItems',
        records: rows.map(r => ({ SKU: r.SKU, Quantity: r.Quantity, Status: 'Active' }))
      }],
      reload: ['OutletStorages']
    })],
    permissions: { OutletRestocks: 'create', OutletRestockItems: 'create' },
    successMsg: 'Restock request created.'
  }
}
```

Hydrating is then one call (§6, `applyNodes`):

```js
pageState.applyNodes(envelope.nodes)
```

### 12.1 Addressing decides the shape

A node is addressed by `resource` plus `role`, so **several roleless payloads for one
resource collapse onto one address**. A batch writing several rows of one resource must
either use `bulkNode` with a `Code` on each record, or give each `updateNode` its own
`role` — the record's own code is a good role name:

```js
// N restock parents in one delivery run
updateNode('OutletRestocks', code, { Progress: next }, ['OutletRestocks'], code)
```

Queued actions are keyed instead. `actionNode` defaults to `resource::action::code`, which
is unique per row, so a per-row batch of stamps survives the dedupe in §15.

### 12.2 What is still Layer 2's job at submit time

Ledger rows derived from the final state (`OutletMovements`), tax rows, `executeAction` on
records that already exist, and the permission map. Those are not user input and do not
belong in nodes the user edits — but they still travel as node payloads.

### 12.3 `derive` — the UI reads nodes, nothing else

Once an envelope is hydrated, the page must read its numbers off the NODE, not off a
figure the builder handed back on the side. When a column depends on other node state, the
domain declares the dependency and pageState does the writing:

```js
import { derive, deriveNode } from 'src/composables/resources/nodePayloads'

deriveNode('Invoices', [derive(
  { resource: 'InvoiceItems', records: true },
  (rows, pageState) => pageState.setFields('Invoices', {
    Subtotal: rows.reduce((total, row) => total + Number(row.data.Total || 0), 0)
  })
)])
```

| `on` | Watches |
|---|---|
| `{ resource, role?, children: 'X' }` | that child bucket's rows |
| `{ resource, records: true }` | a many-node's rows |
| `{ resource, field: 'X' }` | one column |
| `{ resource }` | the whole record |
| `{ control: 'X', resource?, role? }` | a control |

- Handlers run **immediately** on registration and on every change (`deep`). Pass
  `immediate: false` / `deep: false` to opt out.
- Entries are keyed by their address, so hydrating twice REPLACES the writer rather than
  stacking two on one column. Pass an explicit `key` for two derivations on one address.
- They live in a scope pageState owns, so registering from a submit handler — outside any
  component scope — does not leak. `reset()` and `resetForResource()` drop them all.
- `pageState.derive([...])` registers one directly, for a page with a rule of its own.

This replaces the manual `watch` in a `ready()` hook shown in §14.

### 12.4 Never promise a position

A builder must not return "the code is at index N of the response". A node that ships
nothing is skipped by `build()`, so positions are not knowable when the envelope is made.
Name the RESOURCE and let the caller resolve it after hydration:

```js
const at = pageState.build().findIndex((request) => request.resource === outcome.resource)
```

## 13. Drafts (localStorage)

Automatic. Debounced 300 ms. Key is derived from the route:

```
aql_<Resource>_Add
aql_<Resource>_Edit_<Code>
aql_<Resource>_<PageName>[_<Code>]
```

Index and view pages get no key.

Stored payload:

```json
{ "v": 1, "key": "…", "savedAt": 0,
  "primaryKey": "…", "currentStep": 1, "hasData": true,
  "nodes":    [ { "resource", "role", "code", "many", "record", "children", "records", "controls" } ],
  "controls": [ { "header", "value" } ],
  "actions":  [ { "key", "resource", "actionName", "request" } ],
  "reload":   [ "OutletStorages" ] }
```

- `controls`, `actions` and `reload` sit at the **top level**, so they restore
  even when the nodes they relate to do not exist yet.
- Restore is **additive** for those three and **replaces** nodes — a restore runs
  after the page has seeded its own defaults and must not wipe them.
- `hasData` counts nodes, controls and actions. `reload` alone never makes a
  blank page worth saving.
- Only `{ header, value }` controls are saved; the `{ name, codeType }` schema
  half is re-seeded by `strategy.controls`.
- The draft is cleared **only on a successful submit**. A failed request leaves
  the user's work in storage.

Manual control: `draftKey`, `persistDraft()`, `restoreDraft()`, `clearDraft()`.
Opt a page out with `persist: false` on its contract.

## 14. `ready(ctx)` — the page contract hook

A page contract may export `ready`. It runs **once per page**, in an
`effectScope` owned by `Page.vue`, as soon as the contract has actually landed.

```js
// _ui/AQL/pages/Operation/OutletConsumptions/Add.js
import { watch } from 'vue'

export default {
  sections: ['PageHeader'],
  contents: ['Context', 'StockCount', 'RestockOptions'],

  ready ({ pageState, resourceRecord, routeInfo }) {
    pageState.initResource('OutletConsumptions', {
      reset: true,
      fields: { Date: today(), Status: 'Active' }
    })
  }
}
```

`ctx` is `{ pageState, pageProps, resourceConfig, resourceRecord, routeInfo }`.

`routeInfo` is a computed carrying everything the page can know about where it
is — there is no `route`, because `ready` runs outside setup and could not call
`useRoute()` anyway:

| | |
|---|---|
| `scope`, `resourceSlug`, `resourceName` | which resource |
| `page` | resolved page key (`add`, `view`, a slug, an action) |
| `routeKind` | the raw `meta.page` (`index`, `add`, `view`, `edit`, `resource`, `record`, `action`) |
| `level` | `resource` or `record` |
| `code`, `pageSlug`, `action` | the route params that matter |
| `params` | all of them, raw |
| `query` | `?outletCode=…` and friends |
| `path`, `fullPath` | for logging and navigation decisions |
| `customUIName` | the active `_ui` layer |

### Why it exists

It is the only place with **page lifetime**. Step cards mount and unmount as the
user moves between steps — a `watch` registered in a card stops the moment that
card leaves the screen, which is usually right before submit reads its result.

`ready` also cannot go in the props-factory form of a contract
(`export default function () {}`), because that runs inside a `computed` and
would create a new watcher on every recompute.

### Use cases

**Conditional node lifecycle** — the node's existence is the boolean (§5.1):

```js
ready ({ pageState }) {
  watch(() => pageState.getControl('isRestocking'), (on) => {
    if (!on) return pageState.removeNode('OutletRestocks')
    pageState.setResource('OutletRestocks', null, buildRestockPayload(rows, ctx))
  })
}
```

**Seeding a page** — defaults, deep-link params, the primary node:

```js
ready ({ pageState, routeInfo }) {
  pageState.initResource('OutletConsumptions', {
    reset: true,
    fields: { OutletCode: routeInfo.value.query.outletCode || '', Date: today() }
  })
  pageState.setControl('isRestocking', true)
}
```

**Reacting to a different record** — `ready` does not re-run when only
`:code` changes, so watch it here:

```js
ready ({ pageState, resourceRecord, routeInfo }) {
  watch(() => routeInfo.value.code, () => {
    if (resourceRecord.record.value) pageState.load('Outlets', resourceRecord.record.value)
  }, { immediate: true })
}
```

Watch a **field** of `routeInfo`, not `routeInfo` itself — it returns a fresh
object on every recompute, so watching the whole thing fires far more than you
want.

**Keeping a derived column in step** — until a first-class derive exists:

```js
ready ({ pageState }) {
  const items = pageState.useNode('Invoices').children('InvoiceItems')
  watch(items, (rows) => {
    pageState.setField('Invoices', 'Subtotal',
      rows.reduce((s, r) => s + r.data.Qty * r.data.Price, 0))
  }, { deep: true })
}
```

**Declaring the batch tail** once, instead of at every submit site:

```js
ready ({ pageState }) {
  pageState.setReload(['OutletStorages', 'OutletVisits'])
}
```

**Anything needing teardown** — `onScopeDispose` fires when the page changes:

```js
ready () {
  const id = setInterval(refreshQueue, 30000)
  onScopeDispose(() => clearInterval(id))
}
```

### Rules

1. **`ready` must not be `async`.** `scope.run()` captures only effects created
   synchronously; a `watch` after an `await` escapes the scope and leaks
   forever. Dev mode warns if `ready` returns a promise. Start promises freely —
   just do not create effects inside their callbacks.
2. **It re-runs when the page changes**, not when the route changes and not when
   only `:code` changes. Use a `watch` inside for per-record behaviour.
3. **An override's `ready` replaces the base contract's**, same as every other
   contract key.
4. `ready` is stripped from `pageProps` before it is bound to children, so it
   never leaks into `$attrs`.

## 15. Workflow actions in the batch

`includeAdditionalAction` queues an `executeAction` into this page's own
submission, so a record and the action stamping it either both land or neither
does.

```js
pageState.includeAdditionalAction('Complete', { Comment: 'Done on site' }, {
  resource: 'OutletVisits',
  role: 'complete',
  code: 'OV26000051'          // omit ⇒ node's code, else batchRef('X.latest.code')
})

pageState.excludeAdditionalAction('Complete', { resource: 'OutletVisits' })
```

Keyed by `resource::actionName`, so queuing twice **updates** the envelope rather
than running the action twice.

Popup actions are a different path — `useAdditionalActions` dispatches
immediately against a record that already exists, and deliberately does not go
through `pageState`, because `run()` would gate it on the host page's validation
errors.

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

This only works if the data is in nodes. See §5.

## 18. Debugging

In dev, `window.pageState` is the live instance. It is deleted when the page
unmounts, so it is never stale.

```js
pageState.snapshot()                    // whole tree as plain JSON, readable addresses
pageState.state.nodes.size
pageState.state.index                   // resource → role → uid
pageState.build({ mode: 'submit' })     // what would be sent
pageState.validationErrors.value        // note .value — it is a computed
pageState.getControl('NextVisitDays')
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
9. A Layer 2 builder returns `nodes`, never `requests` (§12).
10. Several rows of one resource are one `bulkNode`, or one node per `role` — never
    several roleless nodes, which collapse onto one address.
11. A builder never hand-writes another resource's columns — it calls that resource's own
    builder and splices its `nodes`.
12. A derived column is declared with `derive`, not recomputed in the UI (§12.3).

## 20. Related

- `UI_RESOURCE_DOMAIN_LOGIC.md` — layers, and what belongs in Layer 2
- `UI_ACTION_SYSTEM.md` — AdditionalActions, both paths
- `UI_CREATE_AND_UPDATE_SYSTEM.md` — the generic form pages
- `UI_PAGE_AND_SECTION_SYSTEM.md` — page contracts and resolution
- `CORE_ARCHITECTURE_RULES.md` — `$ref` transport rules
