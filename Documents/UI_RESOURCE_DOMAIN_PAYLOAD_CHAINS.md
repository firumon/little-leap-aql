# Resource Domain — Payload Chain Architecture

> Part of **[3-Layer UI — Resource Domain Logic System](UI_RESOURCE_DOMAIN_LOGIC.md)**. Cross-resource mutations, the canonical envelope, and domain payload chains.

---

## 9. Domain Payload Chain Architecture

### 9.1 Definition & Purpose

In complex business workflows, mutations on a primary resource frequently trigger mutations across one or more related secondary resources (for example: an Order generating an Invoice, an Audit triggering Restock and StockMovement rows, or an Approval appending Status Logs).

Under the **3-Layer UI Architecture**, **Layer 2 (`src/_resource/{Scope}/{Resource}/`) is the sole owner of multi-resource mutation chains.**

```
Layer 3 (UI Presentation)
   │  PageAction.js collects user form inputs
   │  Calls top-level Layer 2 chain builder
   ▼
Layer 2 (Primary Domain: Resource A)
   │  Validates business rules for Resource A
   │  Builds primary NODE PAYLOADS
   │  Directly calls Layer 2 Domain Builder for Resource B
   ▼
Layer 2 (Secondary Domain: Resource B)
   │  Validates business rules for Resource B
   │  Builds secondary Node Objects (using batchRef for symbolic foreign keys)
   │  Returns Node Objects
   ▼
Layer 3 (UI Presentation)
   │  Hands the nodes straight to pageState.applyNodes()
   │  applyNodes gates on each node's own permissions, then mounts everything
   │  Returns { successMsg: applied.successMsg }
   │  pageState.build() assembles the batch for atomic GAS execution
```

**Why this rule is absolute:**
- **Zero UI Schema Invention**: Presentation components (`_ui/`, `PageAction.js`, `.vue`) must NEVER handcraft backend table rows, default column values, or business calculation formulas for secondary resources.
- **Single Source of Truth**: The domain logic for creating or updating Resource B lives exclusively in Resource B's own Layer 2 files, reused identically whether triggered by the Resource B standalone UI or an automated chain from Resource A.
- **Atomicity via GAS Batching**: All operations across the entire chain are bundled into a single batch array and committed atomically in one server round trip.
- **One return contract, no exceptions**: EVERY Layer 2 function that is exported and consumed across a layer boundary returns the Unified Node Transport Structure (§9.2, specified in `UI_PAGE_STATE.md` §5) — a Node Object or an array of them. The multi-resource chain builders AND the single-node builders (`restockNode`, `consumptionNode`, `returnsNode`, `invoiceNode`). Row helpers (`restockItemRow`, `returnRow`, `invoiceItemRow`) are the one exception: they are ROWS, not nodes, and Layer 3 hands them to `pageState.addChild()` / `addRecord()` directly.

---

### 9.2 The Unified Node Transport Structure

Every domain payload builder returns **pure Node Objects, or an array of them**. There is
no envelope, no `{ valid, nodes, permissions }` wrapper, and no constructor module —
`nodePayloads.js` was deleted on 2026-08-29.

**The full specification lives in
[UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md) §5** — node
properties, action shapes, the derive `on` grammar, permission messages and automatic
reload cleansing. Read it before writing a builder. In outline:

```javascript
{
  resource: 'OutletRestocks',      // required
  role: '$default',                // optional second half of the address
  code: 'OR001',                   // optional string or $ref; present = update
  record: { ... },                 // parent header fields
  children: [{ resource, records }],   // or many: true, records: [ ... ]
  controls: [{ header, value }],
  actions: [{ action, code, data: { fields, targets } }],
  derive: [{ on, handler }],
  permissions: { create: 'message shown when denied' },
  reload: ['WarehouseStorages'],
  successMsg: 'Restock request submitted.'
}
```

| Field | Type | Purpose |
|---|---|---|
| `resource` | `string` | The sheet this node writes. Required. |
| `role` | `string` | Second half of the address, so two nodes of one resource stay apart. |
| `code` | `string` \| `$ref` | Present means update; absent means create. |
| `record` | `Object` | The parent header fields, already sanitized by `resourceRow`. |
| `children` | `Array<{ resource, records }>` | A composite write. |
| `many` / `records` | `boolean` / `Array` | A bulk write of one resource. Never combine with `children`. |
| `controls` | `Array<{header,value}>` \| `Object` | Working state, seeded scoped to this node. |
| `actions` | `Array` | Workflow stamps. `resource` and `role` inherit from the node. |
| `derive` | `Array<{ on, handler }>` | Reactive rules pageState registers and runs. |
| `permissions` | `Object` | `{ action: 'message' }`, checked against **this node's** resource. |
| `reload` | `Array<string>` | Secondary sheets to re-read. Resources this batch writes are stripped. |
| `successMsg` / `outcome` | `string` / `Object` | What the page tells the user, and where it lands. |

A builder that cannot build returns the veto as a one-element list, so any caller can
spread its result unconditionally:

```javascript
if (!outletCode) return [{ valid: false, message: 'Select an outlet before submitting.' }]
```

> [!IMPORTANT]
> **Nodes, never `requests`.** A builder returns node objects and lets `pageState.build()`
> turn them into GAS requests. Returning ready-made request envelopes forces Layer 3 into
> `run({ requests })`, which skips `build()` and makes every node on the page inert —
> validation sees nothing, drafts save nothing, `snapshot()` shows nothing. See
> [UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md) §5A and §5A.2.

#### Where the old helpers went

| Was | Now |
|---|---|
| `createNode` / `updateNode` / `bulkNode` / `compositeNode` / `actionNode` / `reloadNode` | a plain object literal (§5 of `UI_PAGE_STATE.md`) |
| `nodeEnvelope` / `mergeEnvelopes` | an array, and `[...a, ...b]` |
| `derive(on, handler)` / `deriveNode` | `{ on, handler }` on the node's `derive` |
| `resourceRow(resource, ...sources)` | `src/composables/resources/useResourceConfig.js` |
| `actionKeyFor(resource, action, role, code)` | `src/composables/resources/pageState/usePageStateActions.js` |

### 9.3 Chaining & Composition Pattern

When a primary domain builder invokes secondary domain builders:

1. **Child Builder Invocation**: The primary builder invokes the secondary domain builder function with the relevant subset of input data.
2. **Early Exit on Failure**: If a child builder vetoes, the parent halts and bubbles that veto upward. Combining children is plain array work:

   ```js
   if (restock[0]?.valid === false) return restock
   return [...stockMovementNodes, ...outletMovementNodes]
   ```
3. **Strict Node Ordering**: Parent nodes MUST appear in the `nodes` array before any child nodes that depend on them or reference their generated identifiers. `pageState` gives each address a build slot the first time it appears, so the array's order is the batch's order.
4. **No permission merging**: each node already carries the gate for its own resource, so a chain never assembles a permission map. `applyNodes` checks every node before it writes any of them.

```javascript
// src/_resource/Operation/Audits/composables/useAuditPayload.js
import { buildRestockChainNodes } from 'src/_resource/Operation/Restocks/composables/useRestockPayload'

const RESOURCE_NAME = 'Audits'

export function buildAuditCompletionChainNodes ({ auditRecord, discrepancies, actor, notes }) {
  if (!auditRecord?.Code) {
    return [{ valid: false, message: 'Audit code is missing.' }]
  }
  if (!discrepancies?.length) {
    return [{ valid: false, message: 'No audit discrepancy lines provided.' }]
  }

  const nodes = [{
    resource: RESOURCE_NAME,
    code: textOrRef(auditRecord.Code),
    record: { Status: 'COMPLETED', CompletedBy: actor, Notes: notes || '' },
    permissions: { update: 'You are not allowed to complete this audit.' },
    successMsg: 'Audit completed and restock movements generated successfully.'
  }]

  const restockItems = discrepancies.filter((d) => d.variance < 0)
  if (restockItems.length > 0) {
    const restock = buildRestockChainNodes({ sourceAuditCode: auditRecord.Code, items: restockItems, actor })
    if (restock[0]?.valid === false) return restock
    nodes.push(...restock)
  }

  // A re-read that belongs to no node of its own.
  nodes.push({ resource: '$batch', reload: ['WarehouseStorages'] })

  return nodes
}
```

Layer 3 then stays a thin adapter:

```javascript
// _ui/AQL/components/Operation/Audits/Complete/PageAction.js
submit: () => {
  const applied = pageState.applyNodes(buildAuditCompletionChainNodes({ ... }))
  if (applied.valid === false) return false
  return { successMsg: applied.successMsg }
}
```

**A builder must not return a node for a record the PAGE already owns.** `applyNodes`
replaces what it writes, so a payload naming the page's own form node would wipe the
fields the user typed. A standalone Add wizard's builder returns only the EXTRA nodes and
exposes its column decisions as a fields helper the page applies to its own node — see
`restockCreateFields` / `buildRestockCreateChainNodes`.

---

### 9.7 Row Builders and Node Builders

A domain exposes TWO kinds of builder, and the split is not cosmetic.

**Row builders** — `consumptionItemRow`, `returnRow`, `restockItemRow`, `invoiceItemRow` —
return ONE plain sheet row. Nothing else: no `resource`, no bucket, no node keys.

**Node builders** — `consumptionNode`, `restockNode`, `invoiceNode`, `returnsNode` — return
one canonical pageState node and call the row builder for every child or record they carry:

```js
// composite: a header plus its lines
{ resource, record, children: [{ resource: CHILD, records: [...] }] }
// many: rows of one resource, no header
{ resource, many: true, records: [...] }
```

The signature is fixed, so a caller never has to guess which slot a value goes in:

```js
nodeBuilder(parent = {}, children = [], extra = {}, options = {})
rowBuilder(parent = {}, extra = {})
```

`parent` and `extra` are both merged into the record — `extra` is the caller's late
override, and unknown keys are dropped (below). `options` is NOT a record source: it
carries build switches such as `withDerive` and a `resolvePrice` override.

#### A node builder returns a DOMAIN-COMPLETE node

> [!IMPORTANT]
> Whatever a node builder returns must already be everything the domain knows. Layer 3
> hands it the answers a human gave — an outlet, a SKU, a quantity — and binds to the
> result. It never calculates a price, a tax, a total, a due date or a default progress,
> and it never patches a column the builder left blank.

Everything the domain can resolve from those answers is resolved INSIDE the builder:

| Kind | Examples |
|---|---|
| Session and clock | `Username`, `RequestedUser`, `Date` |
| Workflow seat | `Progress` (`PENDING_PAYMENT`, `PENDING_INVOICE_GENERATION`, `PENDING_APPROVAL`, `SUBMITTED`), `Status` |
| Cross-resource terms | `PriceListCode` from the outlet's operating rule, `DueDate` from its `InvoiceDueDays`, `OutletVisitCode` from today's planned visit |
| Money | every line's `Price`, `Total`, `Discount`, `TaxableAmount`, `TaxAmount`, `TaxCode`, and the header's `Subtotal`, `TotalTaxableAmount`, `TotalTaxAmount`, `TaxDetails` |

`invoiceNode` is the worked example. It is handed `{ SKU, Qty }` and nothing else, and it
resolves the outlet's price list, the due date its payment terms imply, and every priced
and taxed figure — through the SAME `calculateConsumptionInvoice` engine the submit uses,
so the bill on screen and the bill in the sheet are one calculation:

```js
// Layer 3 — the whole of it
pageState.setResource('OutletConsumptionInvoices', null, invoiceNode(
  { OutletCode, Date, Username },
  sold.map((row) => ({ SKU: row.SKU, Qty: row.Qty })),
  { PriceListCode, DiscountType, DiscountValue },
  { withDerive: true, resolvePrice }
))
```

A builder called with no children is a HEADER MERGE, not an empty bill: it must not write
zeroed totals over lines the node already carries.

#### `withDerive` — parent aggregates that follow the child rows

Resolving on build is only half of it. The user goes on editing rows after the node
lands, so a node builder whose parent carries aggregates attaches the rule that keeps
them in step, and Layer 3 does nothing but bind:

```js
export function invoiceNode (parent = {}, children = [], extra = {}, options = {}) {
  // … resolve and price …
  return {
    resource: INVOICES,
    record,
    ...(rows.length ? { children: [{ resource: INVOICE_ITEMS, records: rows }] } : {}),
    ...(options.withDerive === false
      ? {}
      : {
          derive: [derive(
            { resource: INVOICES, children: INVOICE_ITEMS },
            (childRows, pageState) => pageState.setRecord(null, sumItemFigures(childRows), INVOICES)
          )]
        })
  }
}
```

`pageState` watches that address DEEPLY, so adding a line, removing one, or editing a
figure on one re-runs the handler and the header totals move with it. Rows in a node are
always flat — pageState unwraps `{ _action, data }` on write — so a handler reads
`row.Total`, never `row.data.Total`.

Default it ON (`options.withDerive === false` is the only opt-out). A caller opts out for
a node it is building to READ rather than to edit, where a live writer on the record is
noise.

**Only attach a derive for a column the sheet actually has.** `pageState.setRecord` writes
straight onto the record without the header filter `resourceRow` applies, so a derived key
that is not a column rides into the GAS write. `OutletConsumptions`, `OutletRestocks` and
`OutletReturns` store no aggregate — their builders carry no `derive`, and that is correct,
not an omission.

#### Every row is sanitized against the sheet's headers

`resourceRow(resource, ...sources)` seeds `APP.Resources.DefaultValues`, merges the
caller's values left to right, then **drops every key the resource's `headers` do not
have** (`_action` survives — `build()` reads and strips it itself). A row builder is
written through it, never as a bare `Object.assign`.

This is what keeps a UI working field out of a record GAS will try to write. An `_edited`
flag, an `isManualReturn` marker or a stale `StorageName` reaches the row builder and
simply does not come out the other side, so no caller has to remember to strip it.

```js
// ✗ a working field rides into the sheet write
export function returnRow (parent, extra) {
  return Object.assign({}, seedOf(RESOURCE_NAME), parent, extra)
}

// ✓ unknown keys are dropped against the resource's own headers
export function returnRow (parent, extra) {
  const { user } = useAuth()
  return resourceRow(RESOURCE_NAME, { Username: user.value?.name || '' }, parent, extra)
}
```

A resource whose config has not landed yet has no headers to filter against, so the row
passes through unfiltered rather than coming back empty.

---

### 9.8 The wizard node lifecycle

A multi-step wizard holds its answers in `pageState` NODES from the first keystroke. The
four beats:

1. **Layer 3 initiates** the nodes through Layer 2 node builders — never by writing a
   node-shaped literal.
2. **UI components bind straight to the nodes.** `useChildren`, `useRecords`, `useRecord`.
   Controls are for state the sheet has no column for: a toggle, a selection over rows that
   already exist, a price override. A card renders a total by BINDING to the header column
   the builder's `derive` keeps current — never by summing the child rows in a `computed()`
   of its own (§9.7).
3. **A step transition purifies.** `PageAction.js` reads the node, drops the zero-quantity
   impurities the officer opened and left, passes the survivors back through the SAME Layer
   2 node builder, and re-applies the result. A sub-workflow whose rows all went to zero has
   its node removed, because a leg is written only when its node exists.
4. **Submit builds the batch** from what the nodes already say. It collects nothing new.

> [!CAUTION]
> **Anti-pattern — do not gather form input into loose controls or a side graph composable
> and derive everything at the end.** A `CountRows` control mirroring what a card already
> edits, or a `useXGraph.js` that rebuilds every node on each keystroke, gives the page two
> sources of truth. They drift the moment one of them is refactored, and the screen and the
> batch stop agreeing about what the user entered. The node IS the answer.

Step visibility follows the same source. A step is skipped when its question has no
subject, and that is read off the nodes:

```js
const STEP_VISIBLE = {
  3: () => invoiceAllowed() && soldItems().length > 0,
  4: () => restockItems().length > 0,
  5: () => returnItems().length > 0 || hasPendingReturns()
}
```

Validation on a transition is a **presence check**, not the full domain gate. "At least one
sold, restock or return item" is what step 2 asks; pricing and warehouse rules belong to the
steps that collect them, and the whole gate belongs to the submit.

---

### 9.4 Symbolic ID Linking (`batchRef`)

When creating a new parent record alongside dependent child or sibling records within the same batch trip, the parent ID or Code is not yet known on the client.

Chain payload builders MUST use symbolic reference objects created via `batchRef()`:

```javascript
import { batchRef } from 'src/utils/appHelpers'


// Child rows linking to a parent created earlier in the same batch
{ resource: 'StockMovements', many: true, records: items.map((item) => ({
  ItemCode: item.ItemCode,
  Quantity: item.Quantity,
  ReferenceCode: batchRef('Restocks.latest.code'),
  SourceType: 'RESTOCK'
})))
```

- Never split parent and child mutations into multiple network round trips solely to retrieve generated IDs.
- Never stringify or interpolate `$ref` objects into strings.

---

### 9.5 Post-Mutation Balance & Cache Refreshing

Any domain chain whose execution invalidates client-side cached aggregates (such as stock balances, account ledgers, parent status headers, or audit logs) MUST declare the resources to re-read.

Every node builder takes a `reload` argument, and `pageState` hoists it to the batch. It is
**always additive and deduped**, so several nodes may name the same resource and the batch
still ends in exactly one `get`:

```javascript
{ resource: 'StockMovements', many: true, records: rows, reload: ['WarehouseStorages'] }
```

Use `{ resource: '$batch', reload: ['WarehouseStorages', 'StockMovements'] }` for a re-read that belongs to no
particular node. It carries no body, so it hoists its list and never attaches a node.

> [!IMPORTANT]
> **Cursors are not a builder's job.** Never put `lastUpdatedAtByResource` or
> `lastUpdatedAtResources` in anything you build — `runBatchRequests` collects every
> resource in the batch and injects them, overwriting whatever was there.

---

### 9.6 Strict Guardrails for Domain Payload Builders

Every payload chain builder in Layer 2 must adhere to the following strict guardrails:

1. **Pure JavaScript Functions**: No Vue reactivity (`ref`, `reactive`, `computed`), no Vue lifecycle hooks, and no component injection (`inject()`).
2. **Deterministic Inputs**: All required records, form data, actor details, and configuration must be passed explicitly in the argument object.
3. **No Direct Store/Service Calls**: Domain payload builders never call Pinia stores or API services directly. They merely assemble and return the declarative node payloads.
4. **Node objects, not requests**: builders write plain Node Objects and never import `resourceRequests`. A builder that reaches for a request envelope is building a batch Layer 3 cannot validate.
5. **Never build another resource's payload.** A builder writes nodes for the resource it OWNS, plus that resource's own composite children. Every other resource in the chain is reached by calling ITS domain builder and splicing the returned `nodes` — never by hand-writing its columns. A resource's own child relations (`OutletConsumptionItems`, `PurchaseOrderItems`) are the exception: they ride in `children` of their parent's composite.
6. **No positional promises**: never return "the code is at index N of the response". Name the RESOURCE and let the caller resolve the position off `pageState.build()` — a node that ships nothing is skipped, so positions are not knowable at build time.
7. **A ledger module encapsulates its own row builder.** `StockMovements` and `OutletMovements` own the sign rule, the storage default and the reload their sheet needs. A calling module hands over the ITEM list and the reference, never a hand-built movement row: `stockMovementsNode(items, { warehouseCode, referenceCode, referenceType, direction, movementDate })` and `outletMovementsNode(items, { outletCode, referenceCode, referenceType, direction, movementDate })` return the complete, self-contained node — records built inside, `reload: ['WarehouseStorages']` / `['OutletStorages']` attached, permissions attached — or `null` when there is nothing to post. `stockMovementRow` / `outletMovementRow` stay exported only for the two chains that must decide a per-row sign or reference themselves (`OutletReturns`, the restock corrections); a new caller uses the node builder.
8. **Cheap, idempotent and total.** A builder is the ONLY thing that turns user input into
   sheet rows, and it may be called once at submit or repeatedly as the user works. The
   same inputs always give the same nodes, and a half-filled input gives a smaller node
   set rather than a throw.
9. **Return the COMPLETE row.** A builder hands back the finished sheet record — stamps,
   `Status`, derived columns and all — never a fragment for Layer 3 to finish. Layer 3
   does `applyNodes` and nothing else; the moment it has to add a column, that column's
   rule has escaped the domain.
10. **Allowed Dependencies**:
   - Generic utilities from `src/utils/appHelpers` (e.g. `batchRef`, `batchRefList`, formatting helpers).
   - `resourceRow` from `src/composables/resources/useResourceConfig`.
   - Sibling Layer 2 domain composables / payload builders.

### 9.6.1 The three-layer division at run time

| Layer | Owns | Never |
|---|---|---|
| 3 — page / cards | Collecting input, binding it to node slots, calling the builder and `applyNodes` | Shaping a row, stamping, deciding a column |
| 2 — `_resource/` | Turning inputs into COMPLETE nodes, every time it is asked | Touching `pageState`, Vue, or stores |
| 1 — pageState / transport | Holding nodes, validating, building requests | Knowing any resource's rules |

The loop is: **input → Layer 2 → node → `applyNodes` → the cards read the node back.**
Nothing in Layer 3 stands between the builder's output and the screen, so what the user
reviews is the batch itself.

---


---

⬑ Back to **[3-Layer UI — Resource Domain Logic System](UI_RESOURCE_DOMAIN_LOGIC.md)**.
