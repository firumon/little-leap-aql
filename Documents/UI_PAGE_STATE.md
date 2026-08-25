# usePageState — Centralized Page-Level Form-State Composable

> **Canonical reference for `FRONTENT/src/composables/resources/usePageState.js`.**
> Any developer or AI agent working on a resource page (form, input collection,
> API preparation, submit) **MUST** read this doc and **MUST** use this composable.
> See the **Maintenance Rule** at the end: changes to the composable require changes to this doc.

---

## 1. What this composable is for

`usePageState` is the **single source of truth** for a resource page's entire
form/input lifecycle:

1. **Collect** user input (form fields, line-item grids, workflow-action inputs).
2. **Hold** it in one shared reactive state while the user moves between steps/sections.
3. **Prepare** an API-compatible request from that state (the AQL canonical envelope).
4. **Send** it through the resource IO store (single transport).
5. **Return** the server response to the caller.

It is designed for the new page architecture, where a page is split into
**Header / Content / Action** sections:
- **Content** renders the form and binds inputs.
- **Action** renders submit / save-draft / workflow buttons.
- Both share **one live reactive instance**, so an edit in Content is instantly
  visible to Action (e.g. enabling/disabling the submit button, live summary).

It is **not outlet-specific**. Outlets, Procurement, Accounts, HR, and any
future module all use the same composable.

---

## 2. Why it exists (the problem it removes)

Historically, temp form state was stored inconsistently across the codebase:
some flows kept it in composable refs, some kept the *entire* form in
page/component-local refs, and several flows hand-rolled request objects instead
of using the centralized builders. That produced drift, duplicate logic, and
sections that could not communicate reactively.

This composable replaces all of that with one contract. The research behind it
is in:
- `Documents/OUTLET_INPUT_TO_API_DATA_FLOW.md` (per-resource, with `file:line` citations)
- `Documents/OUTLET_DATA_FLOW_ANALYSIS.md`

---

## 3. Architecture position

| Concern | Where                                                                                |
|---|--------------------------------------------------------------------------------------|
| The composable | `FRONTENT/src/composables/resources/usePageState.js`                                 |
| localStorage draft persistence (§10) | `FRONTENT/src/composables/resources/usePageStateDraft.js`      |
| Provided at | `FRONTENT/src/pages/Page.vue` (alongside `resourceConfig` / `resourceRecord`)        |
| Injected by | Header / Content / Action sections via `inject('pageState')`                         |
| Generic request builders | defined inline in `usePageState.js` (SSoT)                                           |
| `$ref` helpers (`batchRef`/`batchRefList`/`isBatchRef`/`textOrRef`/`normalizeCodeOrRef`) | `FRONTENT/src/utils/appHelpers.js` (stateless utils, re-exported by `usePageState`)  |
| Dispatch transport | `useResourceIoStore().runBatchRequests` (Pinia, `FRONTENT/src/stores/resourceIo.js`) |

Legendary file `outletOperationsBatch.js` still exists as a **legacy** home for
outlet-specific builders + `OUTLET_ACTIONS`. New code must NOT reach for it for
the generic builders — import them from `usePageState` (or `appHelpers` for the
`$ref` helpers). Full migration of the legacy file is deferred.

---

## 4. The state model

```js
state = reactive({
  primaryKey: null,          // the primary resource name (first initResource)
  nodes: new Map(),          // uid -> node   (NOT keyed by resource name)
  index: {},                 // resourceName -> { role: uid }   (the addressing layer)
  pendingActions: []         // queued executeAction envelopes (§6.4a)
})

// a node (created under the hood by initResource / load).
// It carries NO `identifier` field — the node's identity IS its Map key;
// `useNode(...).identifier` surfaces that uid.
{
  resource,                  // e.g. 'OutletConsumptions'
  code,                      // existing record code when editing, else null
  many,                      // true => this resource is a list (bulk), not a single record
  record: {},                // THE user-input object (v-model target)
  children: [],              // composite child rows: [{ resource, records:[{ _action, data }] }]
  records: [],               // many:true entries of THIS resource: [{ _action, data }]
  controls: [],              // field schema: [{ name, codeType? }] (seeds options)
  options: {},               // per-field option lists (seeded from controls)
  action                     // workflow action trigger (string key or {action,column,columnValue})
}
```

**Mutability rule:** `record`, `children`, `records`, `action` are **mutable reactive**
state and are `v-model` targets. `options` is a **`computed`** — derived lazily and
memoized, so it costs nothing until a template actually reads it. Never assign to `options`.

### 4.1 Encapsulation contract (what is private vs public)

The shape above is an **implementation detail**. Consumers must not reach into it.

**PRIVATE — may change without touching any consumer:**

- `state.nodes` (uid-keyed) and `state.index` (`resource -> role -> uid`) —
  **the keying scheme is not part of the contract**. It has already changed once
  (from resource-name keys to uid + index) with **zero consumer edits**; that is
  the guarantee this section exists to provide.
- The node object shape — `resource` / `record` / `children` / `records` /
  `controls` / `code` / `many` / `action` / `options`.
- The child bucket layout — `{ resource, records }`.
- `state.pendingActions` and its entry shape `{ key, resource, actionName, request }`
  — read it through `additionalActionRequests()`, write it through
  `includeAdditionalAction()` / `excludeAdditionalAction()` (§6.4a).

**PUBLIC — a data contract you may rely on:**

- The child row entry `{ _action, data }`, where `data` is the record body the
  child form renders and `_action` is `'create' | 'update' | 'deactivate'`.
  This is the interchange format between `usePageState` and `FormChild`, and it
  is also what `defaultBuild` ships to GAS, so it is deliberately not hidden.
  Read it freely; **write it only** via `updateChild` (patches `data`) and
  `setChildAction` (sets `_action`).

**The two rules that follow from this:**

| Direction | Do | Never |
|---|---|---|
| **Read** node state | `useNode(resource, role?)` (§6.5), `hasNode(resource, role?)` | `state.nodes.get(...)`, `state.index[...]`, `node.children.find(...)` |
| **Write** node state | the mutations in §6.4 | assigning into a node or a child row (`row._action = …`) |

> `state` is still on the returned object for debugging and because
> `strategy.validate(node, state)` receives it. **It is not a consumer API** —
> treat it as private.

### 4.2 Addressing: multiple nodes per resource, by ROLE

One resource may hold several nodes. Outlet-consumption needs two `Outlet-Visits`
(complete the current visit, schedule the next) and two `OutletReturns` (create
new, update pre-existing). Each is addressed by a **role**:

```js
// create
initResource('OutletVisits', { code: visitCode })                          // role '$default'
initResource({ resource: 'OutletVisits', role: 'next' }, { fields: {…} })

// read
useNode('OutletVisits')            // the $default node
useNode('OutletVisits', 'next')    // the scheduled-visit node

// write — every mutation accepts the same object target, so none of them
// needed a new `role` parameter
setField({ resource: 'OutletVisits', role: 'next' }, 'Date', v)
```

Addressing by a bare resource name means role `$default`, so **every existing
call site is unchanged**.

#### Why roles are names, not ordinals

A positional `useNode(resource, idx)` would be simpler, but it breaks on this
workflow. Both `Outlet-Visits` nodes are created *conditionally*
([useOutletConsumption.js:708-712](../FRONTENT/src/composables/operation/outlets/useOutletConsumption.js)):

| `completeVisit` ticked? | idx 0 | idx 1 |
|---|---|---|
| yes | complete-visit | next-visit |
| no | **next-visit** | — |

So `idx` depends on whether the user ticked *a different checkbox*. The failure is
silent: an out-of-range index resolves to `emptyNode`, which is a valid node, so
`build()` ships an empty payload instead of raising. `OutletReturns` has the same
shape (create is gated on `returnRows.length`, update on `applyReturnsToInvoice`).

Named roles survive conditional creation and reordering, and
`useNode('OutletVisits', 'next')` states its intent at the call site.

#### The invariant that keeps the two structures honest

`nodes` and `index` must never disagree — a uid in `index` with no entry in
`nodes` resolves to `emptyNode` and silently builds an empty payload. All
mutation of both funnels through exactly two private helpers:

- `attachNode(name, role, node)` — the only writer. Re-attaching an existing
  `(resource, role)` deletes the previous node first, so a re-init cannot orphan
  an unreachable entry in `nodes`.
- `detachAll()` — the only clearer, used by both `reset()` and
  `resetForResource()`.

Invariant to assert if you touch this: `state.nodes.size` equals the total number
of uids across `state.index`.

---

## 5. MANDATORY usage rules (contract)

For **every** resource page that collects input or submits data:

1. **User input collection** → store it in the injected `usePageState` node via the
   §6.4 mutations. Do **NOT** keep form state in component-local `ref`s or page
   `data`, and do **NOT** write into the node directly.
2. **Section Content** → read state **only** through `useNode(key)` (§6.5) — it
   returns the node plus `record` / `exists` / `identifier` / `options` /
   `validation` / `children`. Do **NOT** touch `state.nodes` (see §4.1).
3. **Section Action** → call `submit()` / `saveDraft()` / `run()` on the **same
   injected instance**, and queue workflow actions with `includeAdditionalAction()`
   (§6.4a). Do **NOT** build request objects by hand.
4. **Generating API-compatible data** → happens **under the hood** via `build()`.
   You call a friendly mutation/trigger; the composable assembles the canonical
   envelope. Do **NOT** call `resourceIoStore.createResourceRecord` / `resourceUpdateRequest`
   with an inline payload from a page or component.
5. **Using the response** → triggers **return** `{ success, response, code }`.
   Read it from the call site (or pass `onSuccess`). Do not rely on side-channel state.

Violations of (1), (3), (4) are architecture-layer violations (see `Documents/CORE_ARCHITECTURE_RULES.md`).

---

## 6. How to use it (consumer guide)

### 6.1 Provide — already wired in `Page.vue`

```js
import { usePageState } from 'src/composables/resources/usePageState'
// inside <script setup> of Page.vue:
const pageState = usePageState()      // pass a per-resource `strategy` when one exists
provide('pageState', pageState)
```

### 6.2 Inject — in any Header / Content / Action section

```js
import { inject } from 'vue'
const pageState = inject('pageState')
```

### 6.3 Initialize a resource node (under the hood)

```js
// create flow
pageState.initResource('OutletConsumptions', {
  many: false,
  fields: { OutletCode: 'OUT-001', Date: todayISO() }
})

// edit flow — hydrate an existing record into the node
pageState.initResource('OutletConsumptions', { code: existing.Code })
pageState.load('OutletConsumptions', existing)   // fills node.record from the server row
```

### 6.4 Mutations (all friendly, no manual `state.nodes.set`)

| Function | Purpose |
|---|---|
| `initResource(resource, { role, code, many, fields, action, isPrimaryKey, reset })` | create a node under `role` (default `$default`); re-init of the same `(resource, role)` replaces it |
| `hasNode(resource, role?)` | imperative existence check — **the replacement for `state.nodes.has(...)`** (use `useNode(...).exists` when a computed/template needs it reactively) |
| `hasNodes` | `computed<boolean>` — whether ANY node is attached (`state.nodes.size > 0`), i.e. "this page's form state is initialized". Node-count only, resource-agnostic: it is for containers that must distinguish an initialized form page from an uninitialized one without knowing the resource (see `PageAction.vue`'s `FormActions` gate). For a SPECIFIC node use `useNode(resource).exists` |
| `load(resource, rawRecord)` | hydrate an existing server record into the node |
| `setField(resource, field, value)` / `setFields(resource, patch)` | set header/body fields |
| `setControlField(resource, header, value)` / `getControlField(resource, header)` | non-schema / wizard-only fields — kept out of `record` so they never reach the payload |
| `addChild(resource, childResource, row, { action })` | add a composite child row |
| `updateChild(resource, childResource, index, patch)` | patch a child row's `data` (**does not touch `_action`**) |
| `setChildAction(resource, childResource, index, action)` | set a child row's `_action` — soft-delete (`'deactivate'`) or restore (`'update'`). Returns the entry, or `null` if the index is stale |
| `removeChild(resource, childResource, index)` | drop a child row (hard splice) |
| `addRecord(resource, row, { action })` | add a `many:true` entry (returns index) |
| `updateRecord(resource, index, patch)` | patch a `many` entry |
| `removeRecord(resource, index)` | drop a `many` entry |
| `selectOption(resource, field, value)` | write the user's chosen code value into `record` |

> **Every mutation's first argument is a node *target*,** not just a resource name:
> a string, a `ref`, a getter, or `{ resource, role }` (§4.2). That is why none of
> them needed a separate `role` parameter —
> `setField({ resource: 'OutletVisits', role: 'next' }, 'Date', v)` works, and a
> bare `'OutletVisits'` means role `$default`.

> `selectOption` writes the **chosen** value into `record`; the available
> **choices** are the read-only `options` computed — you never mutate `options`.

> **Removing a child row — pick the right one.** A row the user added in this
> session (`_action: 'create'`, no `Code`) should be **spliced** with
> `removeChild`. A row hydrated from the server (`_action: 'update'` with a
> `Code`) must be **soft-deleted** with `setChildAction(..., 'deactivate')`: it
> stays in the bucket so the payload still carries it, and GAS matches on the
> `Code` to deactivate the row. Splicing it instead would simply omit it, leaving
> the server record untouched. `FormChild.vue` implements exactly this split in
> `remove()`, and `restore()` reverses it with `setChildAction(..., 'update')`.

### 6.4a Queuing a workflow action into the batch

| Function | Purpose |
|---|---|
| `includeAdditionalAction(actionName, data?, { resource, role, code, record, outcome }?)` | build an `executeAction` envelope for one `AdditionalActions` entry and queue it onto the next `build()` / `submit()`. Returns the request, or `null` when the action is unknown or is a `navigate` action |
| `excludeAdditionalAction(actionName?, { resource }?)` | drop one queued action, or **all** of them when the name is omitted |
| `additionalActionRequests()` | the queued envelopes in call order — `defaultBuild` appends these itself; a `strategy.build` override **must** append them explicitly |

This is the **batched** half of the AdditionalActions subsystem. The popup half
(`useAdditionalActions` → `AdditionalActionsDialog`) dispatches on its own, immediately,
against a record that already exists. This one exists for the case the popup cannot
express: *create a record **and** run a workflow action on it, in one batch*.

```javascript
// Stamp an EXISTING record — the node's own `code` is used automatically.
pageState.initResource('OutletVisits', { code: visit.Code })
pageState.includeAdditionalAction('Postpone', { Comment: 'Outlet closed' })

// Create a record AND action it — the code becomes a $ref into this same batch.
pageState.initResource('OutletVisits', { fields: { OutletCode, Date } })
pageState.includeAdditionalAction('Postpone', {
  Comment: 'Rescheduled',                    // source field, short authored name
  newVisit: { Date: '2026-01-04' }           // target field, nested bag
})
await pageState.submit()
```

**Code resolution**, in order: an explicit `code` option (a string **or** a
`batchRef(...)` `$ref`) → the addressed node's `code` → `batchRef('<Resource>.latest.code')`.
That last fallback is what makes create-then-action a single atomic batch, and it is why
queued actions are emitted **after** every node request (§7).

**Value addressing** for `data` is the pipeline's, not this composable's: a source field
answers to its short authored name or its derived header; a target field to
`'<targetKey>.<Column>'` or a nested `{ targetKey: { Column } }` bag. Anything omitted
falls back to the field's configured `from`/`value` seed. Full table:
[UI_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_ACTION_SYSTEM.md) §7.0.1.

> Queuing an action **never creates a node** — the lookup is read-only, so an otherwise
> empty page does not start building a create request for the resource. Calling
> `includeAdditionalAction` twice for the same `(resource, action)` **replaces** the
> queued envelope rather than running the action twice. `reset()` / `resetForResource()`
> clear the queue along with the nodes.

### 6.5 `useNode(resource, role?)` — THE read accessor

**This is the only supported way to observe node state.** Reaching into
`state.nodes` or `state.index` is a contract violation (§4.1).

Signature: **`useNode(resource, role = '$default')`**.

`resource` accepts a **string, a `ref`, a getter, or `{ resource, role }`**. Use a
getter in any component whose active resource changes on navigation (`Create.vue`,
`Update.vue`, `FormChild.vue`) — you bind **once** in `setup` and it stays
correct across route changes:

```js
// static resource, default role
const { node, record, options, validation } = pageState.useNode('OutletConsumptions')

// dynamic resource — follows resourceName across navigations
const primary = pageState.useNode(() => resourceName.value)
const primaryRecord = computed(() => primary.record.value || {})

// a specific role — see §4.2
const nextVisit = pageState.useNode('OutletVisits', 'next')
```

Returns:

| Key | Type | What it is |
|---|---|---|
| `node` | `computed` | the reactive node (falls back to a stable empty node) |
| `exists` | `computed<boolean>` | whether the node has been initialized — reactive form of `hasNode` |
| `record` | `computed` | the user-input header/body; the `v-model` target |
| `identifier` | `computed<string>` | the node's uid (its Map key). Changes when the node is **replaced** (`initResource`/`reset`), **not** when a field is edited — key one-shot hydration off this so a reset re-seeds from the server |
| `options` | `computed` | `{ [fieldName]: [...] }`, auto-derived from `controls` + the `getOptions` strategy |
| `validation` | `computed` | array of `{ field, message }` |
| `children(childResource)` | `(res) => computed` | child rows as `{ _action, data }` entries; `childResource` also accepts a string/ref/getter |

```js
// template:
//   <q-input v-model="record.OutletCode" />
//   <q-select :options="options.SKUCode" v-model="record.SKUCode" />
//   <span v-if="validation.length">…errors…</span>

// child rows (replaces reaching into node.children)
const rows = primary.children(() => childName.value)
const visible = computed(() => rows.value.filter(r => r._action !== 'deactivate'))
```

Because a missing node resolves to the empty node, **every returned computed is
safe to read before `initResource` has run** — consumers never need optional
chaining on the node itself. Entry identity within `children()` is stable across
reads, so `rows.value.indexOf(row)` is a valid row→index lookup.

### 6.6 Triggers + response (the under-the-hood lifecycle)

Every trigger funnels through an internal `run()` that does
**state → build → `resourceIoStore.runBatchRequests` → return `{ success, response, code }`**.

```js
// Submit (final)
const { success, response, code } = await pageState.submit()
if (success) { /* code = new parent code (batchResultCode) */ }

// Save draft
await pageState.saveDraft()

// Workflow action — QUEUE it (§6.4a), then submit; there is no standalone
// `pageState.executeAction()` trigger.
pageState.includeAdditionalAction('Postpone', { Comment: 'Outlet closed' })
await pageState.submit()

// With callbacks / quiet mode:
await pageState.submit({
  notify: true,                       // default; shows $q.notify
  onSuccess: ({ response, code }) => nav.goTo('index'),
  successMsg: 'Consumption saved.'
})
```

All triggers return `{ success: boolean, response, code }` so the caller owns the response.

### 6.7 Strategy (resource-specific overrides)

`usePageState(strategy)` accepts an optional `strategy` for bespoke payloads:

```js
{
  controls(resource)        -> [{ name, codeType? }]   // field schema; codeType -> auto options
  getOptions(codeType, node) -> [{ label, value }]      // option lists for XxxCode columns
  hydrate(node, raw, ctx)   -> void                     // custom load of server record into node
  build(ctx)                -> [request]                // override generic request assembly
  validate(node, state)     -> [{ field, message }]     // per-node validation
}
```

Any omitted piece falls back to the built-in generic behavior (see §7).

---

## 7. Generic request lifecycle (`build` → send → response)

`build()` (or `strategy.build`) walks `state.nodes` **in insertion order** and
produces canonical requests. Insertion order is the contract: it is what lets a
later request consume an earlier one's `$ref`.

**Rule for every request builder in this composable:** the `resource` on a built
request is always **`node.resource`** — never the Map key, and never the caller's
argument. `includeAdditionalAction` obeys the same rule from the other direction: it
resolves the node target first and passes that resolved NAME to the pipeline, so a
`ref`/getter/`{ resource, role }` argument never reaches the wire.

The other two candidates are both wrong:

- the **Map key** is an opaque uid (§4), never a resource name;
- the **caller's argument** may be a `ref`, a getter, or `{ resource, role }`,
  since the accessors explicitly accept those — passing one straight through
  would put a *function* or an *object* where GAS expects a resource name;
- **`node.resource`** is the only one that always names the GAS resource.

The default mapping:

| Node shape | Produces |
|---|---|
| `many: true` with `records` | `resourceBulkRequest(resource, records)` (plain rows) |
| `children.length` (composite) | `compositeSaveRequest({ resource, code?, data, children:[{ resource, records:[{ _action, data }] }] })` |
| single record + `code` | `resourceUpdateRequest(resource, code, record)` |
| single record, no `code` | `resourceCreateRequest(resource, record)` |
| queued via `includeAdditionalAction` | the pipeline's `executeAction` envelope, appended **after** every node request |

After every node has been walked, `defaultBuild` appends
`additionalActionRequests()` — the envelopes queued by `includeAdditionalAction`
(§6.4a). **Last is the contract**, not an accident: a queued action whose code is
`batchRef('OutletVisits.latest.code')` only resolves if the row it names has already been
created earlier in the same batch. A `strategy.build` override replaces `defaultBuild`
entirely and must therefore append `additionalActionRequests()` itself, or its page
silently drops every queued action.

All requests use the canonical envelope (`buildCanonicalRequest` in
`GasApiService.js`). `$ref` linking for sequential batches is supported via
`batchRef('Resource.latest.code')` (never stringified on the front-end).
Dispatch is always `resourceIoStore.runBatchRequests(requests)`.

---

## 8. Exported surface (single source of truth)

From `usePageState.js` you may import:

- **Composable + DI:** `usePageState` (provided via `provide('pageState', pageState)` and injected via `inject('pageState')`)
- **Read accessors:** `useNode(resource, role?)` (§6.5), `hasNode(resource, role?)`,
  `getControlField(resource, header, role?)`, `snapshot()`
- **Mutations:** see the full table in §6.4 — including `setChildAction`, the only
  supported way to set a child row's `_action`
- **Workflow actions in the batch:** `includeAdditionalAction`,
  `excludeAdditionalAction`, `additionalActionRequests` (§6.4a). The envelope itself is
  built by `additionalActionsPipeline`, so no executeAction wire knowledge lives here.
- **Generic builders:** `compositeSaveRequest`, `resourceCreateRequest`,
  `resourceUpdateRequest`, `resourceBulkRequest`, `resourceGetRequest`, `executeActionRequest`
- **Response helpers:** `responseFailed`, `failureMessage`, `batchResultCode`
- **Low-level dispatch:** `run({ requests, build, mode, onSuccess, reload, notify, successMsg })` —
  the same validate/build/dispatch/notify lifecycle `submit()`/`saveDraft()`
  funnel through, exposed directly for callers (e.g. `PageAction.vue`) that need
  to run a caller-built request array (already `modifyPayload`-transformed)
  through the standard lifecycle without going through `build()`.
- **`$ref` helpers (re-exported from `appHelpers`):** `batchRef`, `batchRefList`, `isBatchRef`, `textOrRef`, `normalizeCodeOrRef`
- **Draft persistence (§10):** `draftKey`, `persistDraft`, `restoreDraft`, `clearDraft`

The `$ref` helpers live canonically in `FRONTENT/src/utils/appHelpers.js`
(stateless utilities). Import them from `appHelpers` directly when you only need
the helper and not the composable.

---

## 9. Reactivity notes

- `state.nodes` is a `reactive(new Map())` and `state.index` a reactive plain
  object. Map `.get`/`.set`/`.delete`/iteration and nested-key writes on `index`
  are all tracked, so everything `useNode` derives is fully reactive — including a
  node that does not exist yet, so a component may bind before `initResource` runs.
- **Do not read `state.nodes` or `state.index` from a consumer** (§4.1) — go
  through `useNode` / `hasNode`. This is what let the keying change from
  resource-name to uid+index with zero consumer edits.
- `useNode` resolves `resource -> role -> uid -> node`, so it stays correct when a
  node is replaced (the uid changes, the address does not).
- Pass a **getter** to `useNode` when the resource is dynamic; a plain string
  snapshots the name at `setup` time and will go stale on navigation.
- `options` is a `computed`: lazy (only computed when read) + memoized — no cost on
  initial load for unused option lists.
- Guard against binding before a node exists: `useNode(key)` returns a stable empty
  node as a fallback, but prefer initializing nodes early (in `setup`/`onMounted`).
- `snapshot()` returns a plain deep copy keyed by the **readable address**
  (`'Outlets'`, `'OutletVisits:next'`), rebuilt from `index` — not by raw uid,
  which would make a debug snapshot useless. Note it cannot just
  `JSON.stringify(state.nodes)`: a `Map` has no enumerable own properties, so that
  silently yields `{}`.

---

## 10. Draft persistence (localStorage)

Every form/add/edit page auto-saves what the user has typed into `localStorage`
and restores it on the next visit. This exists for the accidental reload: a
pull-to-refresh on a phone, a tab crash, a logout in the middle of a long wizard.

The storage layer lives in
`FRONTENT/src/composables/resources/usePageStateDraft.js`. It owns the key, the
debounce, and the restore-once lifecycle. It never touches node internals — the
two functions that know the node shape (`serializeDraft` / `applyDraft`) stay in
`usePageState.js`, so the encapsulation contract in §4.1 still holds. Sections
(`FormRecord`, `FormChild`, `PageAction`, `_ui/` components) know nothing about
storage; they keep talking to `pageState` only.

### 10.1 The storage key

Derived from the route, so it is deterministic and cannot collide:

| Page | Key |
|---|---|
| Add / create | `aql_<Resource>_Add` — e.g. `aql_OutletRestocks_Add` |
| Edit / update | `aql_<Resource>_Edit_<Code>` — e.g. `aql_OutletRestocks_Edit_REC001` |
| Action route | `aql_<Resource>_<Action>` , plus `_<Code>` when the route carries one |
| Custom sub-route | `aql_<Resource>_<PageSlug>` , plus `_<Code>` when the route carries one |

`index` and `view` pages collect no input, so they get **no key and no draft**.
The action/sub-route name is folded through `toPascalCase`, exactly like every
other `_ui/` path segment, so `mark-delivered` keys as `MarkDelivered`.

The `_<Code>` suffix on action and custom pages is deliberate: the same action on
two different records must not share one draft.

### 10.2 What is saved

Per node (addressed by `resource` + `role`, §4.2): `record`, `children`,
`records`, `code`, `many`, and the `{ header, value }` half of `controls`. Page
level: `primaryKey` and `meta.currentStep`, so a wizard reopens on the step the
user left.

Deliberately **not** saved:

- transient meta — `saving`, `submitting`, `loading`, `stepping`,
  `formActionsHeight`, `validationErrors`;
- the `{ name, codeType }` half of `controls`, which `strategy.controls` re-seeds
  on every `initResource`;
- `state.pendingActions` — a queued `$ref` into a batch that no longer exists is
  worse than nothing.

Writes are debounced by 300 ms, so fast typing does not thrash storage. A state
with no data at all is never written, which is what stops the blank form left
behind by `reset()` or a successful submit from burying a real draft.

### 10.3 Restore order

The initialization flow is unchanged — default values, `strategy.controls`, and
server hydration (`load` / `hydrate`) all run **first**. Only then is the draft
laid on top:

1. The page mounts and `Create.vue` / `Update.vue` calls `initResource`.
2. On a record page, `Update.vue` hydrates the server row (`pageState.load`).
3. Once the page has settled — which on a record page means a node now carries
   the route's `code` — the stored draft is **not** applied on its own. A
   confirmation dialog asks the user first (§10.3.1). Settling earlier and
   restoring would simply be overwritten by the hydration that follows.
4. On **Restore**, fields are written **in place** into the existing `node.record` object, and
   `children` / `records` are spliced into the existing arrays. The node is never
   replaced, so `v-model` bindings, `FormChild` rows and `identifier`-keyed
   one-shot hydration all keep working, and every restored row is a live reactive
   proxy.

A node the draft carries but the page has not created (a conditional workflow
node, §4.2) is created by the restore.

#### 10.3.1 The confirmation prompt

When a readable draft exists for the active key, `usePageStateDraft` opens a
Quasar `Dialog` — **"Restore Unsaved Draft?"**, persistent, with a primary
**Restore** button and a flat negative **Discard** button.

- **Restore** — the draft is applied and auto-save resumes.
- **Discard** — the draft is removed from storage and the user carries on with
  the clean / server-hydrated form. The blank state is not written straight back
  (the `holdsAfterClear` baseline covers this), and the user is not asked again.

The prompt is asked **at most once per key settlement**, and never when there is
no valid draft in storage. Auto-save stays shut until the user answers, so
edits made while the dialog is open cannot bury the stored draft. If the route
key changes while the dialog is open, the answer is ignored.

This is entirely inside the composable. Pages, sections and content components
configure nothing and render no dialog of their own — it works everywhere
`usePageState` is used.

If the stored value is corrupt or unparseable, it is discarded, a warning is
logged, and the page carries on with the freshly initialized form.

### 10.4 Clearing

| Event | Draft |
|---|---|
| `submit()` / `run()` **succeeds** | cleared automatically |
| `submit()` / `run()` **fails** (server or network) | **kept** — the user must not lose their work |
| The user hits Reset in `PageAction` | cleared |
| The user hits Cancel in `PageAction` | cleared — leaving without saving discards the draft too. Not applied when `FormActionCancel`'s `cancelHandler` escape hatch fully replaces the built-in `cancel` case. |
| Logout | **kept** — `clearAllClientStorage` (`IndexedDbService.js`) preserves every `aql_` key across its full-storage wipe |
| Tenant switch / full storage cleanse | cleared, along with everything else |

Drafts are never tied to the auth session. Every key starts with `aql_` and
survives a logout on purpose, so a user can come back later and finish.

### 10.5 Opting out

Persistence is on by default. Any of these turns it off for one page:

```js
// a page contract (pages/{scope}/{page}.js or a _ui/ override)
export default { persist: false }

// a resource strategy passed to usePageState
usePageState({ persist: false })
```

`Page.vue` forwards `pageProps.persist` into the composable, so the page-contract
switch works from the same place every other page prop is authored.

### 10.6 Manual control

| Function | Purpose |
|---|---|
| `draftKey` | `computed<string>` — the active key, `''` when this page has none |
| `persistDraft()` | write the current state now, skipping the debounce |
| `restoreDraft(key?)` | re-apply a stored draft on demand |
| `clearDraft(key?)` | remove the stored draft |

> **Naming note:** the manual save is `persistDraft()`, **not** `saveDraft()`.
> `saveDraft()` is the long-standing (deprecated) *submit* trigger on this same
> object — reusing the name would silently send a form to the server where the
> caller expected a local write.

---

## 11. Maintenance rule (NON-NEGOTIABLE)

**Any change to `FRONTENT/src/composables/resources/usePageState.js` — its node
shape, exported functions, triggers, build mapping, or strategy contract — MUST
be reflected in this document.**

- If you add/remove/rename an exported function or mutation, update §6.4 / §8.
- If you change the node shape, update §4 — and check §4.1 still classifies every
  field correctly as private or public.
- If you change how `build()` maps nodes to requests, update §7.
- If you change what triggers return, update §6.6.
- If you change what `useNode` returns, update §6.5.
- If you change the draft key format, what is serialized, the restore order, or
  the opt-out switch, update §10 — and check `usePageStateDraft.js` and this doc
  still agree on the key table.

**Corollary — the encapsulation contract cuts both ways.** §4.1 is only true while
consumers actually honour it. Before landing a change to the node shape or the
`state.nodes` keying, confirm nothing has regressed to direct access:

```bash
rg -n "state\.nodes|state\.index|_action\s*=[^=]|\.children\s*\.\s*find|children\?\.find" FRONTENT/src/components FRONTENT/src/composables/resources --glob '!**/usePageState.js' --glob '!**/useCompositeForm.js'
```

This must return **nothing**. Any hit means a consumer has bypassed the API and
the "internals are free to change" guarantee no longer holds — fix the consumer
before changing the node shape.

Two deliberate exclusions, so the guard does not cry wolf:

- `_action\s*=[^=]` matches only **assignment**, not `_action === '…'`. Reading
  `_action` / `data` is legal (§4.1) — only writing is not.
- `useCompositeForm.js` (and its `useProduct*Form.js` callers) is a **separate**
  composable with its own `{ _action, data }` row model. It is not a
  `usePageState` consumer, so its direct mutations are out of scope here.

Keep this doc and the composable in lock-step. Treat the doc as part of the
composable's definition, not an afterthought.

---

## 12. Related documents

- `Documents/OUTLET_INPUT_TO_API_DATA_FLOW.md` — the research/discovery that drove this composable (per-resource temp-state map, worked examples, design implications §14).
- `Documents/OUTLET_DATA_FLOW_ANALYSIS.md` — per-resource data-flow breakdown + provide/inject proposal.
- `Documents/CORE_ARCHITECTURE_RULES.md` — frontend architecture rules (composables own business logic + payload prep; single source of truth; no manual reactivity).
- `AGENTS.md` / `CLAUDE.md` — startup + GitNexus protocol.
