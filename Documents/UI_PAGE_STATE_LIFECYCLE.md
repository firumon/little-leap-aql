# usePageState — Drafts & the `ready` Hook

> Part of **[usePageState — Page-Level Form State](UI_PAGE_STATE.md)**. localStorage drafts and the page contract `ready(ctx)` hook.

---

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

---

⬑ Back to **[usePageState — Page-Level Form State](UI_PAGE_STATE.md)**.
