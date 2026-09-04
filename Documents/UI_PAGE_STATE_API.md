# usePageState — API Reference

> Part of **[usePageState — Page-Level Form State](UI_PAGE_STATE.md)**. Reading and writing nodes, controls, `useNode`, validation and debugging.

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

    input belongs in the page's own component or `derive` — never in a watcher chain
    (CORE_ARCHITECTURE_RULES.md §6).
15. `controls` are only a UI switch, a value shared across nodes, or a node-level mode —
    never storage, never bookkeeping (§5B.5).
16. The permission gate lives in `applyNodes` and nowhere else. An entry point must be
    gated on the same permission its nodes demand (§5B.4).

## 20. Related

- `UI_RESOURCE_DOMAIN_LOGIC.md` — layers, and what belongs in Layer 2
- `UI_ACTION_SYSTEM.md` — AdditionalActions, both paths
- `UI_CREATE_AND_UPDATE_SYSTEM.md` — the generic form pages
- `UI_PAGE_AND_SECTION_SYSTEM.md` — page contracts and resolution
- `CORE_ARCHITECTURE_RULES.md` — `$ref` transport rules


---

⬑ Back to **[usePageState — Page-Level Form State](UI_PAGE_STATE.md)**.
