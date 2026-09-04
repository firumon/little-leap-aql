# usePageState — The Unified Node Transport Structure

> Part of **[usePageState — Page-Level Form State](UI_PAGE_STATE.md)**. What a Node is, the mistake the whole API is shaped to avoid, and controls plus the permission gate.

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

## 5B. Controls, binding and the permission gate

### 5B.4 The permission gate stays in `applyNodes`

`applyNodes` checks every node's `permissions` against that node's own resource and
notifies on the first gap, writing nothing (§5.1). That is true of a live rebuild too —
a node the user may not write must not silently enter the batch, and the moment it is
refused is the moment to say so.

So a live rebuild is only reached on a page the user is already entitled to be on. **If a
gate fires while the user is merely typing, the bug is upstream**: the entry point that
routed them here is not gated on the same permission the node demands. Fix the entry
point, never the gate.

### 5B.5 What `controls` are for — the whole list

A control is legitimate in exactly three cases:

1. **A UI switch** that enables or disables part of the screen, and has no column.
2. **One value shared by several nodes** — a `WarehouseCode` picked once and written into
   a restock node, its items, and a movement node.
3. **A node-level mode** that decides how the record, children or rows are *arranged* —
   "Direct Approval", "Instant Deliver". The control is the question; the node set is the
   answer, recomputed by `derive` or a watcher.

Anything else has a home: a column is `record`, a line is `children`, a bulk row is
`records`, and "is this resource written at all" is the node's existence (§5A.1).

**Bookkeeping controls are not one of the three.** A `HydratedFor` marker recording which
record the node was built for is asking a question the node already answers — compare
`useNode(...).code`. Do not add a control to remember something state already holds.

### 5B.6 Bind the node directly

Every slot has a writable computed, so a template `v-model`s the real state and the
rebuild follows from the write. There is no separate "apply" step for the user to forget.

```js
pageState.useRecord('ProgressApprovedComment')            // a column
pageState.useChildren('OutletRestockItems', () => i, 'Quantity')   // a line
pageState.useRecords(() => i, 'Quantity', 'StockMovements')        // a bulk row
pageState.useControls('DirectApproval', false, 'OutletRestocks')   // a mode
pageState.useActions('Complete', 'fields.ProgressCompletedComment')
```

---


---

⬑ Back to **[usePageState — Page-Level Form State](UI_PAGE_STATE.md)**.
