# usePageState — Page-Level Form State

`FRONTENT/src/composables/resources/pageState/`

One instance per page. Created and provided in `Page.vue`, injected by every
Header / Content / Action section beneath it. It holds what the user is building
and turns it into a GAS batch.

> **Read §5 and §5A before writing a page.** It describes the one mistake this system
> keeps attracting, and the whole API is shaped to avoid it.

---

---

## Parts of this document

This document is split so each part stays readable on its own. The parts are canonical — this hub does not restate them.

| Part | Covers |
|---|---|
| [usePageState — The Unified Node Transport Structure](UI_PAGE_STATE_NODES.md) | What a Node is, the mistake the whole API is shaped to avoid, and controls plus the permission gate. |
| [usePageState — API Reference](UI_PAGE_STATE_API.md) | Reading and writing nodes, controls, `useNode`, validation and debugging. |
| [usePageState — Submitting & Layer 2 Payloads](UI_PAGE_STATE_SUBMISSION.md) | Building the batch, `$ref` linking, Layer 2 payload rules, workflow actions and strategy overrides. |
| [usePageState — Drafts & the `ready` Hook](UI_PAGE_STATE_LIFECYCLE.md) | localStorage drafts and the page contract `ready(ctx)` hook. |




### Where each section lives

Section numbers are unchanged, so an existing `§N` reference still resolves — find it here.

| § | Section | File |
|---|---|---|
| §6 | API — nodes | [UI_PAGE_STATE_API.md](UI_PAGE_STATE_API.md) |
| §7 | API — writing a node | [UI_PAGE_STATE_API.md](UI_PAGE_STATE_API.md) |
| §8 | API — controls | [UI_PAGE_STATE_API.md](UI_PAGE_STATE_API.md) |
| §9 | Reading — `useNode` | [UI_PAGE_STATE_API.md](UI_PAGE_STATE_API.md) |
| §20 | Related | [UI_PAGE_STATE_API.md](UI_PAGE_STATE_API.md) |
| §13 | Drafts (localStorage) | [UI_PAGE_STATE_LIFECYCLE.md](UI_PAGE_STATE_LIFECYCLE.md) |
| §14 | `ready(ctx)` — the page contract hook | [UI_PAGE_STATE_LIFECYCLE.md](UI_PAGE_STATE_LIFECYCLE.md) |
| §15 | Workflow actions in the batch | [UI_PAGE_STATE_LIFECYCLE.md](UI_PAGE_STATE_LIFECYCLE.md) |
| §5 | The Unified Node Transport Structure | [UI_PAGE_STATE_NODES.md](UI_PAGE_STATE_NODES.md) |
| §5A | The mistake to avoid | [UI_PAGE_STATE_NODES.md](UI_PAGE_STATE_NODES.md) |
| §5B | Controls, binding and the permission gate | [UI_PAGE_STATE_NODES.md](UI_PAGE_STATE_NODES.md) |
| §10 | Submitting | [UI_PAGE_STATE_SUBMISSION.md](UI_PAGE_STATE_SUBMISSION.md) |
| §11 | `$ref` — linking records inside one batch | [UI_PAGE_STATE_SUBMISSION.md](UI_PAGE_STATE_SUBMISSION.md) |
| §12 | Layer 2 payloads | [UI_PAGE_STATE_SUBMISSION.md](UI_PAGE_STATE_SUBMISSION.md) |
| §16 | Strategy overrides | [UI_PAGE_STATE_SUBMISSION.md](UI_PAGE_STATE_SUBMISSION.md) |
| §17 | Validation | [UI_PAGE_STATE_SUBMISSION.md](UI_PAGE_STATE_SUBMISSION.md) |
| §18 | Debugging | [UI_PAGE_STATE_SUBMISSION.md](UI_PAGE_STATE_SUBMISSION.md) |
| §19 | Rules | [UI_PAGE_STATE_SUBMISSION.md](UI_PAGE_STATE_SUBMISSION.md) |

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
