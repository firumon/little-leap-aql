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
| Provided at | `FRONTENT/src/pages/Page.vue` (alongside `resourceConfig` / `resourceRecord`)        |
| Injected by | Header / Content / Action sections via `inject('pageState')`                         |
| Generic request builders | defined inline in `usePageState.js` (SSoT)                                           |
| `$ref` helpers (`batchRef`/`isBatchRef`/`textOrRef`/`normalizeCodeOrRef`) | `FRONTENT/src/utils/appHelpers.js` (stateless utils, re-exported by `usePageState`)  |
| Dispatch transport | `useResourceIoStore().runBatchRequests` (Pinia, `FRONTENT/src/stores/resourceIo.js`) |

Legendary file `outletOperationsBatch.js` still exists as a **legacy** home for
outlet-specific builders + `OUTLET_ACTIONS`. New code must NOT reach for it for
the generic builders — import them from `usePageState` (or `appHelpers` for the
`$ref` helpers). Full migration of the legacy file is deferred.

---

## 4. The state model

```js
state = reactive({
  primaryKey: null,          // the primary resource key (first initResource)
  nodes: new Map()           // one node per resource, keyed by resource name
})

// a node (created under the hood by initResource / load):
{
  identifier,                // uid()
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

---

## 5. MANDATORY usage rules (contract)

For **every** resource page that collects input or submits data:

1. **User input collection** → store it in the injected `usePageState` node
   (`node.record`, `node.children`, `node.records`). Do **NOT** keep form state in
   component-local `ref`s or page `data`.
2. **Section Content** → bind inputs to the injected node
   (`v-model="node.record.FieldName"`), and use `useNode(key)` to get the node +
   its `options` + `validation` computed.
3. **Section Action** → call `submit()` / `saveDraft()` / `executeAction(...)` on
   the **same injected instance**. Do **NOT** build request objects by hand.
4. **Generating API-compatible data** → happens **under the hood** via `build()`.
   You call a friendly mutation/trigger; the composable assembles the canonical
   envelope. Do **NOT** call `resourceIoStore.createResourceRecord` / `resourceUpdateRequest`
   with an inline payload from a page or component.
5. **Using the response** → triggers **return** `{ success, response, code }`.
   Read it from the call site (or pass `onSuccess`). Do not rely on side-channel state.

Violations of (1), (3), (4) are architecture-layer violations (see `Documents/ARCHITECTURE RULES.md`).

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
| `initResource(resource, { code, many, fields, action })` | create a node (header + line-items shape) |
| `load(resource, rawRecord)` | hydrate an existing server record into the node |
| `setField(resource, field, value)` / `setFields(resource, patch)` | set header/body fields |
| `addChild(resource, childResource, row, { action })` | add a composite child row |
| `updateChild(resource, childResource, index, patch)` | patch a child row |
| `removeChild(resource, childResource, index)` | drop a child row |
| `addRecord(resource, row, { action })` | add a `many:true` entry (returns index) |
| `updateRecord(resource, index, patch)` | patch a `many` entry |
| `removeRecord(resource, index)` | drop a `many` entry |
| `setAction(resource, actionName)` | set the workflow action trigger |
| `selectOption(resource, field, value)` | write the user's chosen code value into `record` |

> `selectOption` writes the **chosen** value into `record`; the available
> **choices** are the read-only `options` computed — you never mutate `options`.

### 6.5 `useNode(key)` — per-section reactive access

```js
const { node, options, validation } = pageState.useNode('OutletConsumptions')
// template:
//   <q-input v-model="node.record.OutletCode" />
//   <q-select :options="options.SKUCode" v-model="node.record.SKUCode" />
//   <span v-if="validation.length">…errors…</span>
```

`node` is the reactive node, `options` is a `computed` map `{ [fieldName]: [...] }`
auto-derived from `controls` + the `getOptions` strategy, and `validation` is a
`computed` array of `{ field, message }`.

### 6.6 Triggers + response (the under-the-hood lifecycle)

Every trigger funnels through an internal `run()` that does
**state → build → `resourceIoStore.runBatchRequests` → return `{ success, response, code }`**.

```js
// Submit (final)
const { success, response, code } = await pageState.submit()
if (success) { /* code = new parent code (batchResultCode) */ }

// Save draft
await pageState.saveDraft()

// Workflow action on an existing record
await pageState.executeAction('OutletVisits', 'completeVisit', { Comment: 'Done' })

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
  actionConfigs             -> { actionKey: { action, column, columnValue } }  // for setAction(string)
  hydrate(node, raw, ctx)   -> void                     // custom load of server record into node
  build(ctx)                -> [request]                // override generic request assembly
  validate(node, state)     -> [{ field, message }]     // per-node validation
}
```

Any omitted piece falls back to the built-in generic behavior (see §7).

---

## 7. Generic request lifecycle (`build` → send → response)

`build()` (or `strategy.build`) walks `state.nodes` and produces canonical
requests. The default mapping:

| Node shape | Produces |
|---|---|
| `many: true` with `records` | `resourceBulkRequest(resource, records)` (plain rows) |
| `children.length` (composite) | `compositeSaveRequest({ resource, code?, data, children:[{ resource, records:[{ _action, data }] }] })` |
| single record + `code` | `resourceUpdateRequest(resource, code, record)` |
| single record, no `code` | `resourceCreateRequest(resource, record)` |
| `node.action` set | `executeActionRequest(resource, code, resolveActionConfig(action), {})` appended |

All requests use the canonical envelope (`buildCanonicalRequest` in
`GasApiService.js`). `$ref` linking for sequential batches is supported via
`batchRef('Resource.latest.code')` (never stringified on the front-end).
Dispatch is always `resourceIoStore.runBatchRequests(requests)`.

---

## 8. Exported surface (single source of truth)

From `usePageState.js` you may import:

- **Composable + DI:** `usePageState` (provided via `provide('pageState', pageState)` and injected via `inject('pageState')`)
- **Generic builders:** `compositeSaveRequest`, `resourceCreateRequest`,
  `resourceUpdateRequest`, `resourceBulkRequest`, `resourceGetRequest`, `executeActionRequest`
- **Response helpers:** `responseFailed`, `failureMessage`, `batchResultCode`
- **`$ref` helpers (re-exported from `appHelpers`):** `batchRef`, `isBatchRef`, `textOrRef`, `normalizeCodeOrRef`

The `$ref` helpers live canonically in `FRONTENT/src/utils/appHelpers.js`
(stateless utilities). Import them from `appHelpers` directly when you only need
the helper and not the composable.

---

## 9. Reactivity notes

- `state.nodes` is a `reactive(new Map())`. `.get`/`.set`/`.delete`/iteration are
  tracked, so a `v-for` over nodes and `v-model="useNode(key).record.X"` are reactive.
- Use `.get(key)`, **never** dot-access (`state.nodes.visit` is invalid for a Map).
- `options` is a `computed`: lazy (only computed when read) + memoized — no cost on
  initial load for unused option lists.
- Guard against binding before a node exists: `useNode(key)` returns a stable empty
  node as a fallback, but prefer initializing nodes early (in `setup`/`onMounted`).

---

## 10. Maintenance rule (NON-NEGOTIABLE)

**Any change to `FRONTENT/src/composables/resources/usePageState.js` — its node
shape, exported functions, triggers, build mapping, or strategy contract — MUST
be reflected in this document.**

- If you add/remove/rename an exported function or mutation, update §6.4 / §8.
- If you change the node shape, update §4.
- If you change how `build()` maps nodes to requests, update §7.
- If you change what triggers return, update §6.6.

Keep this doc and the composable in lock-step. Treat the doc as part of the
composable's definition, not an afterthought.

---

## 11. Related documents

- `Documents/OUTLET_INPUT_TO_API_DATA_FLOW.md` — the research/discovery that drove this composable (per-resource temp-state map, worked examples, design implications §14).
- `Documents/OUTLET_DATA_FLOW_ANALYSIS.md` — per-resource data-flow breakdown + provide/inject proposal.
- `Documents/ARCHITECTURE RULES.md` — frontend architecture rules (composables own business logic + payload prep; single source of truth; no manual reactivity).
- `AGENTS.md` / `CLAUDE.md` — startup + GitNexus protocol.
