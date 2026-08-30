# usePageState — Page-Level Form State

`FRONTENT/src/composables/resources/pageState/`

One instance per page. Created and provided in `Page.vue`, injected by every
Header / Content / Action section beneath it. It holds what the user is building
and turns it into a GAS batch.

> **Read §5 and §5A before writing a page.** It describes the one mistake this system
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

**Readers** take the address first: `useNode('Outlets')`,
`useNode('OutletVisits', 'next')`, `hasNode(...)`, `removeNode(...)`.

**Mutations take it LAST, and both halves are optional** — the arguments the
mutation is about come first, then `resource`, then `role`:

```js
setRecord('Date', v)                              // page's primaryKey, role '$default'
setRecord('Date', v, 'OutletVisits')              // named resource, role '$default'
setRecord('Date', v, 'OutletVisits', 'next')      // named resource and role
```

Omitting the resource is the normal case on a form page: the page's own resource
is `state.primaryKey`, so it never has to be repeated.

Accessors are named for the SLOT they address, so a call says which half of the node it
touches. `controls` and `actions` are keyed by NAME; `records` and `children` by INDEX,
and each of those has a `use*Index` mapping a column value to its position:

| Slot | get / set / use | index map |
|---|---|---|
| `record` | `getRecord(key?, …)` | — |
| `records` | `getRecords(index, key?, …)`, `getRecordRows(…)` | `useRecordsIndex(key, …)` |
| `children` | `getChildren(child, index, key?, …)`, `getChildRows(child, …)` | `useChildrenIndex(child, key, …)` |
| `controls` | `getControls(name, fallback?, …)` | — |
| `actions` | `getActions(actionName, path?, …)` | — |

`records` and `children` return the whole row when `key` is null; `record` returns the
whole record object. `actions` takes a DOT PATH into the queued action's data
(`'fields.Comment'`) and returns the whole `data` object when it is null — §15.2.

A resource may also be a `ref` or a getter, so a component whose resource changes
on navigation binds once at setup and stays correct. `{ resource, role }` is
accepted wherever a reader takes an address.

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

## 5. The Unified Node Transport Structure

**Every Layer 2 domain builder returns a Node Object, or an array of Node Objects. Nothing
else.** No envelope, no `{ valid, nodes, permissions }` wrapper, no constructor helpers. A
Node is a plain JavaScript object that carries everything the page needs to know about one
write: its data, its working controls, its action stamps, its reactive derivations, its
security gate and its secondary re-reads.

```js
{
  resource: 'OutletRestocks',      // required — the sheet this node writes
  role: '$default',                // optional — second half of the address (§3.2)
  code: 'OR001',                   // optional — a string or a $ref; present = update
  record: { OutletCode: 'OL1' },   // the parent header fields
  children: [                      // a composite write
    { resource: 'OutletRestockItems', records: [{ SKU: 'S1', Quantity: 3 }] }
  ],
  // or, for a bulk write of one resource:
  // many: true, records: [ ... ]
  controls: [{ header: 'direct', value: true }],
  actions: [{ action: 'Approve', code: '$ref:OutletRestocks.latest.code', data: { fields: {} } }],
  derive: [{ on: { control: 'direct' }, handler: (value, pageState) => { } }],
  permissions: { create: 'You are not allowed to create a restock request.' },
  reload: ['WarehouseStorages'],
  successMsg: 'Restock request submitted.'
}
```

Combining builders is plain array work:

```js
return [restockNode, ...movementNodes].filter(Boolean)
```

`applyNodes` (§10) is the only door these come through. It accepts one node or an array.

### 5.1 `permissions` — the gate travels with the node

`{ [action]: 'message shown when the user does not have it' }`, checked against **this
node's own resource**. `applyNodes` calls `resourceConfig.allowed(action, node.resource)`
for each entry; the first gap notifies with that message and aborts the whole batch. A
half-applied submission is worse than none.

```js
permissions: {
  create: 'You are not allowed to create a restock request.',
  approve: 'You are not allowed to approve a direct restock.'
}
```

Layer 3 no longer calls `allowed(...)` before submitting. The node it hands over already
says what it needs and what to say when the answer is no.

### 5.2 `actions` — the address is inherited

An entry is a pure domain model; the `executeAction` wire request is built at `build()`
time, after every node write, so a `$ref` to a record this batch creates resolves.

```js
actions: [{
  action: 'Complete',            // or actionConfig: { action, column, columnValue }
  column: 'Progress',
  columnValue: 'COMPLETED',
  code: textOrRef(visitCode),    // omit for the page's own record
  data: {
    fields: { RespondDate: today },             // -> payload.fields
    targets: { nextVisit: { Date: nextDate } }  // -> payload.targetFields, omitted when empty
  }
}]
```

`resource` and `role` are **inherited from the node** when the entry leaves them out. The
dedupe key defaults to `resource#role::action::code`, which is unique per target row, so a
per-row batch of stamps never collapses into one stamp.

### 5.3 `controls` — working state, seeded with the data

`[{ header, value }]` or `{ header: value }`. Both are seeded into the node's controls
scoped by `resource` and `role`, so a toggle the builder decided and a toggle the user
flips read back through the same `getControls(header, fallback, resource, role)`.

### 5.4 `derive` — the UI reads nodes, nothing else

The domain declares WHAT depends on what; pageState does the writing. Handlers run
immediately on registration and on every change (`deep`); pass `immediate: false` /
`deep: false` to opt out. Entries are keyed by their address, so hydrating twice REPLACES
the writer rather than stacking two on one column.

| `on` | Watches |
|---|---|
| `{ record: 'Field' }` | one column of the record |
| `{ record: true }` (or `{}`) | the whole record |
| `{ records: true }` | a many-node's rows |
| `{ children: 'ChildResource' }` | that child bucket's rows |
| `{ children: true }` | every child bucket |
| `{ control: 'header' }` | a control |
| `{ action: 'ActionName' }` | a queued action's `data` |

Each accepts `resource` and `role` to address another node; without them it reads the node
the entry travelled on. `field: 'X'` is the older spelling of `record: 'X'` and still works.

```js
derive: [{
  on: { resource: 'InvoiceItems', records: true },
  handler: (rows, pageState) => pageState.setRecord('Subtotal',
    rows.reduce((total, row) => total + Number(row.Total || 0), 0), 'Invoices')
}]
```

### 5.5 `reload` cleans itself

List the secondary sheets whose balances this write changes. **A resource the batch itself
writes is stripped automatically** — GAS returns a written resource in the same response,
so asking for it back is a wasted round trip. A node may safely name its own resource; it
simply will not survive into `state.reload`.

### 5.6 `successMsg` and `outcome`

Optional. Whichever node sets them last wins, and `applyNodes` hands them back, so the
page says what the domain decided without restating it:

```js
const applied = pageState.applyNodes(buildRestockChainNodes(inputs))
if (applied.valid === false) return false
return { successMsg: applied.successMsg }
```

`outcome` is for a chain that also decides where the user lands — `{ message, resource,
slug }`. Never promise a position in the batch; name the RESOURCE (§12.4).

### 5.7 A builder that cannot build

Return the veto as a one-element list, so callers can spread any builder's result
unconditionally:

```js
if (!outletCode) return [{ valid: false, message: 'Select an outlet before submitting.' }]
```

`applyNodes` notifies with that message and returns `{ valid: false, message }` without
writing anything.

### 5.8 Ledger nodes and action targets

Two rules about who builds what, both learned in `OutletConsumptions/Add`.

**A ledger node is built by the ledger, not by its caller.** Call
`stockMovementsNode(items, options)` or `outletMovementsNode(items, options)` and push the
result. They return one complete node with its records, its permissions and its storage
reload already on it, or `null` when the item list is empty — an empty bulk is not "no
movement", it is a round trip asking GAS to recalculate every balance on the strength of
nothing.

**A record a workflow action already declares as a TARGET is not a second node.** The
`OutletVisits` `Complete` action declares a `nextVisit` target, so closing a visit and
planning its successor is one action:

```js
data: {
  fields: { Comment },
  targets: { nextVisit: { Date, ProgressPlannedComment } }
}
```

Screens edit that in place with `pageState.useActions(...)` and `pageState.setActions(...)`.
Build a standalone create node for the same record ONLY when no action is carrying it —
queuing both writes the record twice.

**Address a field by its DERIVED header, not by its authored name.** The action schema
derives a field's storage header from the action's column and outcome, so the `Comment`
authored on `OutletVisits.Complete` (`column: 'Progress'`, `columnValue: 'COMPLETED'`)
lives on the entry as `ProgressCompletedComment`:

```js
pageState.useActions('Complete', 'fields.ProgressCompletedComment')   // ✔ the real address
pageState.useActions('Complete', 'fields.Comment')                    // ✘ writes a stray key
```

The short authored name is accepted when SEEDING (`includeAdditionalAction`), which is why
it looks right and fails quietly — it never becomes a readable address.

**A target must be supplied on every re-queue.** `includeAdditionalAction` replaces the
entry and re-seeds it from the config, so a target left out falls back to its configured
default (`"value": "$date:30"`) and queues a record nobody asked for. Supply it explicitly,
blank when nothing is planned, and address it flat — the seeder reads a target value at
`<targetKey>.<Column>`, so a nested `{ targets: {...} }` bag is ignored:

```js
pageState.includeAdditionalAction('Complete', {
  ProgressCompletedComment: comment,
  nextVisit: planning ? { Date, ProgressPlannedComment } : { Date: '', ProgressPlannedComment: '' }
}, { resource: 'OutletVisits', code })
```

---

## 5A. The mistake to avoid

**`OutletConsumptions/Add` is the worked example — of what went wrong, and of the
fix.** It used to keep a 552-line feature composable,
`_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard.js`, that
every step card imported. **That file has been deleted**; the cards now bind straight to
`pageState` and take their domain answers from Layer 2. Read what follows as the reason.

The wizard writes across six resources. Its pageState looked like this at the
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

### 5A.1 What to do instead

| The user is entering… | Put it in |
|---|---|
| A column on the resource being written | `record` (`setRecord`) |
| Line items of that resource | `children` (`addChild`) |
| Many rows of one resource | `records` (`addRecord`) |
| Another resource entirely | **another node** (`initResource` / `setResource`) |
| The same resource, twice | another node with a **role** |
| A wizard-only input, no column | `controls` (`setControls`) |
| Whether a resource is written at all | **the node's existence** (`removeNode`) |

That last row is worth reading twice. Do not store `completeVisit: true`. Create
or remove the `OutletVisits:complete` node. The node's presence *is* the boolean,
and it cannot drift from what is actually submitted.

**A control that mirrors rows a node already holds is the same bug wearing a different
hat.** `RestockRows` above was written and read only inside the wizard, while the submit
read the restock node's children — so every quantity typed on step 4 was discarded. If a
control's value could be spelled as a record, a child or a node's existence, spell it that
way. `controls` is for what the sheet has no column for: a toggle, a selection over rows
that already exist, a price override.

**And a figure the domain can compute is not page state at all.** The wizard held a second
call to `calculateConsumptionInvoice` so step 3 could show a total. It should ask Layer 2
for a fully-priced node instead and bind to the columns on it — see
UI_RESOURCE_DOMAIN_LOGIC.md §9.7.

### 5A.2 The `{ requests }` escape hatch

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

### `setRecord` / `setRecord`

```js
pageState.setRecord('OutletCode', 'OUT00001')                       // primary node
pageState.setRecord(null, { Date: '2026-08-27', Status: 'Active' }) // whole record
pageState.setRecord('Date', v, 'OutletVisits', 'next')              // another node
```

Creates the node if missing.

### `useRecord`

A record column as a writable computed, so a template can `v-model` it:

```js
const outletCode = pageState.useRecord('OutletCode')                // primary node
const nextDate = pageState.useRecord('Date', 'OutletVisits', 'next')
```

```vue
<component :is="SelectField" v-model="outletCode" header="OutletCode" />
```

Signature is `(key = null, resource?, role?)`; `key` null gives the whole record. The
read never creates a node; the write does, so a `v-model` bound before `initResource` has
run cannot land in the blank node `useNode` hands back (§9) and be silently lost.
**Never `v-model` `useNode(...).record.value.X`** — that is the loss this exists to
prevent.

### Children and many-rows, one row at a time

```js
const items = pageState.useNode('OutletConsumptions').children('OutletConsumptionItems')
const bySku = pageState.useChildrenIndex('OutletConsumptionItems', 'SKU')

const qty = pageState.useChildren('OutletConsumptionItems', () => bySku.value.CK3, 'Qty')
qty.value = 4

const returns = pageState.useRecordsIndex('SKU', 'OutletReturns')
pageState.useRecords(() => returns.value.CK3, 'Qty', 'OutletReturns').value = 2
```

`index` may be a **getter**, so a binding made once keeps pointing at the right row after
rows are added or removed. Reads never create a node.

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

A child row is **plain data** — `{ SKU, Qty }`. The `{ _action, data }` envelope is the
GAS wire format and is put on by `build()`, never held in state. `_action` survives as one
optional flat key, set only by `setChildAction`, because a soft delete is user intent that
cannot be re-derived.

```js
pageState.addChild('OutletConsumptionItems', { SKU: 'CK3-01', Qty: 3 })   // ⇒ the new index
pageState.updateChild('OutletConsumptionItems', 0, { Qty: 5 })
pageState.setChildAction('OutletConsumptionItems', 0, 'deactivate')
pageState.removeChild('OutletConsumptionItems', 0)

// A parent other than the page's own:
pageState.addChild('OutletRestockItems', row, 'OutletRestocks')
pageState.addChild('OutletRestockItems', row, 'OutletRestocks', null, { action: 'update' })
```

`updateChild` merges `data` only. To soft-delete a persisted row use
`setChildAction(..., 'deactivate')` — that is what GAS expects.

### Many-rows

```js
const i = pageState.addRecord({ SKU: 'CK3-01', QtyChange: -3 }, 'OutletMovements')
pageState.updateRecord(i, { QtyChange: -4 }, 'OutletMovements')
pageState.removeRecord(i, 'OutletMovements')
```

`addRecord` sets `many = true` automatically.

## 8. API — controls

Controls hold anything that is **not** a column on a resource: wizard toggles,
selections over existing records, UI bookkeeping. They never reach GAS.

### Page-level (`state.controls`)

```js
pageState.setControls('NextVisitDays', 21)
pageState.getControls('NextVisitDays', 14)      // 14 is the fallback; default null
const days = pageState.useControls('NextVisitDays', 14)   // writable computed
```

`useControls` returns a writable computed, so a template can bind it directly:

```vue
<q-input v-model="days" type="number" />
```

**Page controls outlive every node.** That is the reason they exist. If
`NextVisitDays` lived on the `OutletVisits:next` node, `removeNode` would destroy
the number the user typed, and re-ticking the toggle would lose it.

> [!CAUTION]
> **A control is never a copy of something a node already holds.** Mirroring the rows a
> card edits into a control — a `CountRows` beside the children that ARE the count — gives
> the page two sources of truth that drift. Bind the card to the node. See
> UI_RESOURCE_DOMAIN_LOGIC.md §9.8 for the wizard lifecycle this belongs to.

### Node-scoped

Pass a resource (and role) as the 3rd and 4th arguments:

```js
pageState.setControls('Note', 'text', 'OutletVisits', 'next')
pageState.getControls('Note', '',     'OutletVisits', 'next')
pageState.useControls('Note', '',     'OutletVisits', 'next')
```

Signature is uniform: `(name, value|fallback, resource?, role?)`.
Writes create the node; **reads never do**.

`setControlField` / `getControlField` — the old resource-first pair — were
**deleted on 2026-08-27**. Every caller moved to `setControls` / `getControls`,
which already had the address-last shape. A missing control now reads as the
fallback (`null` by default) rather than `undefined`.

The accessors were renamed after their slot on **2026-08-28**: `setField`/`setFields` →
`setRecord`, `useField` → `useRecord`, `setControl` → `setControls`, and the child and
many-row families gained the matching `getChildren`/`getRecords` names.

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

### 12.2 What is still Layer 2's job at submit time

Ledger rows derived from the final state (`OutletMovements`), tax rows, `executeAction` on
records that already exist, and the permission map. Those are not user input and do not
belong in nodes the user edits — but they still travel as node payloads.

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

**Conditional node lifecycle** — the node's existence is the boolean (§5A.1):

```js
ready ({ pageState }) {
  watch(() => pageState.getControls('isRestocking'), (on) => {
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
  pageState.setControls('isRestocking', true)
}
```

**Reacting to a different record** — `ready` does not re-run when only
`:code` changes, so watch it here:

```js
ready ({ pageState, resourceRecord, routeInfo }) {
  watch(() => routeInfo.value.code, () => {
    if (resourceRecord.record.value) pageState.load(resourceRecord.record.value, 'Outlets')
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
    pageState.setRecord('Subtotal',
      rows.reduce((s, r) => s + r.data.Qty * r.data.Price, 0), 'Invoices')
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

Keyed by `resource::actionName`, so queuing twice **updates** the entry rather
than running the action twice.

### 15.1 Reading and writing a queued action

`getActions` / `setActions` / `useActions` address a queued action the same way every
other slot is addressed — by name, then an optional path, then the resource and role:

```js
pageState.getActions('Complete')                        // the whole data object, or null
pageState.getActions('Complete', 'fields.ProgressCompletedComment')   // one address

pageState.setActions('Complete', 'fields.ProgressCompletedComment', 'Done on site')
pageState.setActions('Complete', 'targets.nextVisit.Date', '2026-09-05')
pageState.setActions('Complete', { fields: { Comment: 'Done' } })   // replace the data
pageState.setActions('Complete', null)                              // remove the action
```

The path is a dot address into the entry's `data` — `fields.<DerivedHeader>` (§5.8, NOT the
short authored name),
`targets.<targetKey>.<Column>`, or `columnValue`. Missing branches are created on
write, so a target's first field does not need the bag seeded first. Writing a path
when nothing is queued yet queues the action first, so a form can start empty.

`useActions` is the writable computed, for `v-model` straight onto one field:

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

## 20. Related

- `UI_RESOURCE_DOMAIN_LOGIC.md` — layers, and what belongs in Layer 2
- `UI_ACTION_SYSTEM.md` — AdditionalActions, both paths
- `UI_CREATE_AND_UPDATE_SYSTEM.md` — the generic form pages
- `UI_PAGE_AND_SECTION_SYSTEM.md` — page contracts and resolution
- `CORE_ARCHITECTURE_RULES.md` — `$ref` transport rules
