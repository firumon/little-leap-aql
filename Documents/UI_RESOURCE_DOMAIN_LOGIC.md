# 3-Layer UI — Resource Domain Logic System

The canonical, self-contained spec for `FRONTENT/src/_resource/**/*` — the UI-agnostic
business/workflow logic layer in the **3-Layer UI Architecture** — and the strict one-way import boundary that connects it to
the UI presentation layer (`_ui/`). Referenced by
[UI_MODULE_DEVELOPER_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md),
which covers UI-side generation; this document owns everything about the domain layer
itself and the boundary rules around it.

---

## 1. Purpose

Core business rules, state transitions, and workflow logic belong to the resource domain
itself (Layer 2) — never inside a `_ui/{Ui}/` presentation folder (Layer 3) — so that every UI a resource might
render under, whichever `CustomUIName` it carries, consumes the exact same underlying
workflow logic. A resource's "what can this record do right now, and why" has exactly one
answer, computed in exactly one place, regardless of how many different UIs display it.

---

## 2. The 3-Layer UI Architecture & Import Boundary

```
src/components/, src/composables/, src/pages/        Layer 1 — Core System Infrastructure
                                                       ALL app-wide, resource-agnostic
                                                       features and functionality — not
                                                       limited to any fixed list. MUST NEVER
                                                       hardcode a resource or scope name.

src/_resource/{Scope}/{Resource}/                     Layer 2 — Resource Domain & Business Logic
├─ composables/use{Feature}.js                        Workflow vocabulary, state-transition
├─ utils/                                              predicates, gate rules, payload/request
└─ (payload builders, workflow aggregates, …)          builders. UI-agnostic, pure, no Vue
                                                       context (no inject/ref). Single source of
                                                       truth for "what can this record do right
                                                       now" — identical for every UI that reads it.

src/components/{sections,contents,actions}/           Layer 3 — UI Presentation
src/_ui/{Ui}/**  (one folder per UI name)              Templates, layout, styling, and
                                                       PRESENTATION-ONLY composables that call
                                                       INTO Layer 2 — never re-derive domain logic.
```

### 2.1 One-way import direction, no exceptions

- Layer 3 (`_ui/{Ui}/**`) may import Layer 2 (`src/_resource/**`) and Layer 1.
- Layer 2 may import only generic Layer 1 utilities (`src/utils/`, generic Core
  Composables) — never a store or service directly, never anything under `_ui/`.
- Layer 1 never imports anything resource-specific from Layer 2 or 3.

### 2.2 No per-UI override of domain logic

If one UI genuinely needs different business behavior for a resource than another UI does,
that difference is modeled as **data or configuration** (a sheet-driven flag, a threshold,
a `Relations`/`UIFields` value) — never as a second code path in `src/_resource/`. The
domain layer is 100% shared across every UI scope, by design; this is what makes "any UI
layer consumes the exact same underlying workflow logic" true rather than aspirational.

---

## 3. What Belongs in `src/_resource/`

Everything that answers "what can this record do right now, and why":

- **Progress/workflow vocabularies** — state constants, color/icon/label maps.
- **State-transition predicates** — e.g. an "is this record still editable" gate, an
  "is this the terminal state" check.
- **Stateful workflow aggregates** that back a wizard/action page — allocation plans,
  delivery selections, anything that needs to accumulate state across a multi-step flow
  before it becomes a request.
- **Payload/request builders** — batch-request shaping and any sign/direction conventions
  for the underlying data mutation.

### 3.1 What does NOT belong here

- Anything that renders — no Vue templates, no component definitions.
- Anything that calls `inject()` or holds a component-lifecycle-bound `ref()`.
- Anything that formats for display only (a row preset, a sort order for a specific list
  view) — that is presentation, and belongs in a UI Composable (§4) instead.
- Anything that imports a Pinia store or a service module directly.

### 3.2 Accessing resource config — self-identified, never route-dependent

> [!IMPORTANT]
> A resource's domain composables know **their own resource name** — it never comes from
> the route, and it is never passed in by a caller.

`useResourceConfig(resourceNameOverride)` (`src/composables/resources/useResourceConfig.js`)
already supports exactly this: when called with an explicit name, it resolves that
resource's config from the auth store's resource list directly — headers, `UIFields`,
`AdditionalActions`, `permissions`, `allowed()` — with **no dependency on the current
route**. Route-based resolution only happens when the argument is omitted, which a
Resource Composable must never do.

Each `src/_resource/{Scope}/{Resource}/` composable hardcodes its own resource name as a
module-level constant and calls `useResourceConfig()` with that literal whenever it needs
config or permissions:

```javascript
// src/_resource/Operation/OutletRestocks/composables/useRestockProgress.js
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'

const RESOURCE_NAME = 'OutletRestocks'   // this composable IS OutletRestocks — always

export function canApprove (record) {
  const { allowed } = useResourceConfig(RESOURCE_NAME)
  return allowed('approve') && record?.Progress === 'PENDING_APPROVAL'
}
```

This is why every Layer 2 function's signature is `(record)` or `(records)` **only** —
never `(record, config)`. The composable is not a generic function waiting to be told
which resource it's for; it already knows. This has two consequences:

- **A UI Composable never fetches or threads config through to a domain call.** It reads
  the record (via the injection relay, §6.1) and passes only that.
- **Multi-resource logic is composed by importing multiple named domain modules**, not by
  parameterizing one function over different configs:

  ```javascript
  import * as OutletRestocks from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'
  import * as OutletVisits from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'

  const canApproveEither = OutletRestocks.canApprove(record) || OutletVisits.canApprove(record)
  ```

This also means a domain function is always correct regardless of which resource's page
it's called from — a sibling/parent record from another resource, displayed inside a
different resource's card, still resolves its own true config, because nothing here ever
asked the route.

### 3.3 One vocabulary per resource — never a second copy

> [!IMPORTANT]
> A resource's progress/workflow vocabulary (state → label/color/icon) is defined **once**,
> in one Layer 2 composable. Every other file that needs a state's label, color, or icon —
> including a View-page composable that also needs a couple of item-row-level states the
> main vocabulary doesn't cover — imports and extends the one definition. It never
> redefines its own parallel copy, even a "kept in step with" one with a comment promising
> to update both. A comment promising two files stay in sync is the tell that they should
> have been one file with an import between them; the promise is the thing that eventually
> breaks, silently, when only one side gets updated.

```javascript
// ✓ One definition, extended — not duplicated
// src/_resource/{Scope}/{Resource}/composables/use{Feature}Progress.js
export const PROGRESS_META = { DRAFT: { label: 'Draft', color: 'grey', icon: 'edit' }, /* … */ }

// A caller needing extra, narrower states (e.g. item-row states a View card also shows)
// imports and spreads over the one source, never restates the shared entries:
export const ITEM_ROW_META = { ...PROGRESS_META, ALLOCATED: { label: 'Allocated', color: 'positive', icon: 'inventory' } }
```

---

## 4. What Stays in `_ui/{Ui}/composables/`

Presentation-only helpers that assemble **display** from a Layer-2 predicate, but are not
themselves a business rule:

- List row presets that call a Layer-2 predicate to filter/sort, then shape the result for
  the list component.
- Per-view sort/format functions.
- The **injection-relay composable** (§6) — owns `inject()`, calls into Layer 2 for
  derived values, exposes both to components.

---

## 5. Shape

Named pure exports (importable from page contracts and JS modifiers, which run outside
component `setup()`), plus a `use{Feature}()` wrapper for setup-context callers. Every
export takes `record`/`records` only — never `config` — per §3.2:

```javascript
// src/_resource/{Scope}/{Resource}/composables/use{Feature}Progress.js
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'

const RESOURCE_NAME = '{Resource}'   // this composable IS {Resource} — always

export function isEditable (record) {
  return record?.Progress === 'DRAFT' || record?.Progress === 'REVISION_REQUIRED'
}

export function canApprove (record) {
  const { allowed } = useResourceConfig(RESOURCE_NAME)
  return allowed('approve') && record?.Progress === 'PENDING_APPROVAL'
}

export function use{Feature}Progress () {
  return { isEditable, canApprove }
}
```

```javascript
// _ui/{Ui}/composables/{Scope}/{Resource}/use{Feature}RowPresets.js
import { isEditable } from 'src/_resource/{Scope}/{Resource}/composables/use{Feature}Progress'

export function editablePreset (items) {
  return items.filter((row) => isEditable(row))
}
```

---

## 6. The Strict Import Chain

> [!IMPORTANT]
> **Enforced one-way dependency chain — zero layer-bypassing:**
> ```
> UI Component (.vue)
>    │  imports ONLY UI Composables — never inject() directly, never a Core Composable,
>    │  never a service/store
>    ▼
> UI Composable (_ui/{Ui}/composables/{Scope}/{Resource}/{Page}/)
>    │  owns inject() (the context relay, §6.1) + presentation assembly
>    │  imports Resource Composables + generic Core Composables (identity, navigation)
>    ▼
> Resource Composable (src/_resource/{Scope}/{Resource}/)
>    │  domain/workflow logic, UI-agnostic, pure
>    │  imports only generic Core Composables — never a store/service directly
>    ▼
> Core Composables (src/composables/)
>    │  generic identity/navigation reads, resolvers — resource-agnostic
>    ▼
> Stores / Infrastructure (Pinia stores, services)
> ```

### Rules per layer

- **UI Components** (`.vue` files under `_ui/{Ui}/components/`) import **only** UI
  Composables. No direct generic Core Composable call, no direct `inject('resourceRecord')`
  — every one of those is relayed through a UI Composable, with zero exceptions, even for
  generic identity/navigation reads that carry no resource content.
- **UI Composables** may import Resource Composables and generic Core Composables. They
  must never import a Pinia store or a service module directly.
- **Resource Composables** contain only domain logic. They must never import a store or
  service directly, and must never import anything under `_ui/`.
- Page contracts and JS modifiers are **exempt from the "no direct inject" clause** — they
  already receive `{ pageState, resourceRecord, resourceConfig }` as function parameters
  from the resolver (they run outside any component's `setup()` and never called `inject()`
  to begin with). They still may only import UI/Resource Composables.

### 6.1 The injection-relay pattern

One **UI Composable per page** (Index/Add/Edit/View/action-route) owns every `inject()`
call that page's components need. Every `.vue` component under that page's `_ui/` tree
calls it instead of injecting directly:

```
_ui/{Ui}/composables/{Scope}/{Resource}/{Page}/use{Resource}Context.js
_ui/{Ui}/components/{Scope}/{Resource}/{Page}/{SomeCard}.vue
```

```javascript
// _ui/{Ui}/composables/{Scope}/{Resource}/{Page}/use{Resource}Context.js
import { inject, computed } from 'vue'

export function use{Resource}Context () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const pageState      = inject('pageState', null)

  return {
    record:  computed(() => resourceRecord?.record?.value || null),
    config:  computed(() => resourceConfig?.config?.value || null),
    pageState
  }
}
```

```html
<!-- _ui/{Ui}/components/{Scope}/{Resource}/{Page}/{SomeCard}.vue -->
<script setup>
import { use{Resource}Context } from 'src/_ui/{Ui}/composables/{Scope}/{Resource}/{Page}/use{Resource}Context'
defineOptions({ name: '{Resource}{Page}{SomeCard}' })
const { record } = use{Resource}Context()
</script>
```

A resource-wide helper that has no page-specific injection needs may live directly under
`_ui/{Ui}/composables/{Scope}/{Resource}/`, outside the page-scoped subfolder — that
subfolder is specifically for the injection relay and anything that depends on it.

> [!NOTE]
> **A composable that injects context and is shared by every card on one page still
> belongs in that page's subfolder** (`.../{Resource}/{Page}/`), even though it looks
> "resource-wide" because several sibling components import it. The test is not "how many
> components use this" — it is **which pages PROVIDE the context it injects**.
> `resourceRecord`/`resourceConfig`/`pageState` are only ever provided per page, so a
> composable that injects is page-scoped **when one page provides its context**. A file
> matching this shape but sitting directly under `{Scope}/{Resource}/` for a single page
> predates this rule and should be moved the next time that module is touched, not left as
> a second accepted shape.
>
> When **two or more pages provide the same context shape and resolve the same
> components**, the composable is not page-scoped and moves up the placement ladder
> (§6.2) to the tier those shared components already sit at. `Approve.js` and
> `Reallocate.js` are the worked example: both resolve the same four content cards, which
> live at the resource tier precisely so neither page owns them
> ([UI_MODULE_DEVELOPER_GUIDE.md §3.1](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md)).
> A `.vue` file has exactly one import line per composable, so forcing a page-scoped copy
> of the composable would have forced a copy of all four cards too — reintroducing the
> exact drift shared placement exists to prevent.

### 6.2 Placement ladder for UI Composables

A UI Composable sits at **the same tier as the most general component that imports it** —
never higher, never lower. This is the composable-side mirror of the component tier rule
([UI_MODULE_DEVELOPER_GUIDE.md §3.1](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md)),
"share by placement, not by copying":

| Consumers | Folder |
|---|---|
| One page of one resource | `_ui/{Ui}/composables/{Scope}/{Resource}/{Page}/` |
| Two or more pages of one resource | `_ui/{Ui}/composables/{Scope}/{Resource}/` |
| Two or more resources in one feature family | `_ui/{Ui}/composables/{Scope}/{Feature}/` |
| Every resource in a scope | `_ui/{Ui}/composables/{Scope}/` |

The ladder is forced by the module system rather than by taste: a `.vue` file has one
import line per composable, so a composable placed BELOW the tier of a component that
imports it cannot be reached without copying that component. Placing it ABOVE its true
tier is the opposite error — it advertises a shared contract that only one page honours,
and the next page to sit at that tier inherits assumptions it never agreed to.

> [!IMPORTANT]
> This ladder governs **Layer 3 only**. A Resource Composable is always
> `src/_resource/{Scope}/{Resource}/` regardless of how many resources read it — logic
> spanning two resources is composed by importing two domain modules from the UI side
> (§3.2), never by promoting a domain file to a shared folder.

---

## 7. Import-Boundary Self-Check

Verify for every new file:

- [ ] Every `.vue` under `_ui/` imports only UI Composables — no `inject()`, no Core
      Composable import outside a UI Composable file.
- [ ] Every UI Composable imports only Resource Composables + generic Core Composables —
      no store, no service.
- [ ] Every Resource Composable (`src/_resource/**`) imports only generic Core
      Composables — no store, no service, nothing under `_ui/`.
- [ ] No `src/_resource/**` file imports anything under `_ui/`.

---

## 8. How the Domain Layer Actually Gets Built

The three-layer boundary (§2) describes the finished shape. It says nothing about the
order things get written in — because most of the time, the domain layer does not exist
yet when work starts. This section is about that: what to do while a resource's business
logic is still being discovered, not just after it's known.

### 8.1 The common case: UI work comes first, domain logic is discovered along the way

Most tasks arrive as "build/update the UI for X," with no upfront resource specification.
There is no `src/_resource/{Scope}/{Resource}/` to read from yet. That is normal, not a
gap to apologize for.

While doing that work, **classify every piece of logic as it's written**, before deciding
where the file goes:

- Is this about *how something looks or is arranged on screen* (a card layout, a color, a
  list preset, which fields show)? → UI. It belongs under `_ui/{Ui}/`.
- Is this about *what the record can do, or what state it's in* (is it editable, is it
  approved, what happens when it's submitted)? → Domain. It belongs under
  `src/_resource/{Scope}/{Resource}/`.

Route each piece to its correct layer **the moment it's written** — never park business
logic inside a `_ui/` file "temporarily" with a plan to move it later. A predicate written
once in the right place is available to every future UI immediately; a predicate written
in the wrong place and moved later means finding and fixing every place that came to
depend on the wrong location in between.

### 8.2 The less common case: the domain is specified upfront

Sometimes a developer hands over a resource's complete business workflow before any UI
work starts — every state, every transition, every rule. When that happens, build the
domain layer first (as Step 1 of the guide's Generation Checklist, §14, already assumes),
then build the UI on top of it. This is the same layering, just encountered in
the opposite order — the classification in §8.1 still applies to anything the domain spec
didn't anticipate and that turns up while building the UI.

### 8.3 By the end of a module's UI, its domain layer is done and packed

Once a resource's Index/Add/Edit/View are complete, the classification work in §8.1 has
already produced a full `src/_resource/{Scope}/{Resource}/` — every predicate, every
workflow rule, every payload builder that resource's UI needed. Treat that as **packed**:
a complete, coherent, reusable unit, not a leftover pile of helpers.

> [!IMPORTANT]
> **A sibling UI built afterward — a new page for the same resource, a second UI name, a
> related feature — reads the packed domain layer as-is. It does not rebuild, re-derive,
> or duplicate any of it.** That is the entire point of §2's boundary: one resource, one
> business logic layer, read by as many UIs as ever need it.

### 8.4 Further enhancement stays allowed, without breaking existing consumers

A resource's domain layer is never frozen. A later task may add a new predicate, a new
workflow state, a new payload builder — the same classification from §8.1 applies to that
new work too. The constraint is only that existing consumers keep working:

- Adding a new export is always safe.
- Changing an existing export's behavior or signature is not, unless every current caller
  is checked first — run `gitnexus_impact` on the symbol before changing it (per
  `AGENTS.md`), and update every caller the impact analysis surfaces.
- Never rename a domain export with find-and-replace; use the project's rename tooling so
  every `_ui/` caller stays correctly wired.

### 8.5 A module built before this document is not evidence the rule is wrong

The three-layer boundary, the strict import chain, and the injection-relay pattern (§§2,
6, 6.1) are the target shape for every module going forward. A module built before this
document existed will not fully match it — its domain logic may sit under `_ui/{Ui}/
composables/` instead of `src/_resource/`, and its `.vue` components may call `inject()`
or a Core Composable directly in many places instead of routing through one page-scoped
context composable. That is expected, not a sign the rule doesn't hold: the rule did not
exist yet when that module was written.

Bringing an existing module into line with this document is the retroactive-migration
work already noted in §2's placement rule and §8.4's "further enhancement" — a deliberate,
tracked task, not something a new feature request on that module should silently take on
as a side effect. Do not treat a pre-existing module's divergence as license to write new
code the same way; every new file still follows §§2–7 in full, in whatever module it's
added to.

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
   │  Builds secondary node payloads (using batchRef for symbolic foreign keys)
   │  Returns standardized envelope
   ▼
Layer 3 (UI Presentation)
   │  Receives unified { valid, nodes, permissions, successMsg }
   │  Gates execution with resourceConfig.allowed(result.permissions)
   │  Hands nodes to pageState.applyNodes(), then returns { successMsg }
   │  pageState.build() assembles the batch for atomic GAS execution
```

**Why this rule is absolute:**
- **Zero UI Schema Invention**: Presentation components (`_ui/`, `PageAction.js`, `.vue`) must NEVER handcraft backend table rows, default column values, or business calculation formulas for secondary resources.
- **Single Source of Truth**: The domain logic for creating or updating Resource B lives exclusively in Resource B's own Layer 2 files, reused identically whether triggered by the Resource B standalone UI or an automated chain from Resource A.
- **Atomicity via GAS Batching**: All operations across the entire chain are bundled into a single batch array and committed atomically in one server round trip.

---

### 9.2 The Universal Return Envelope

Every domain payload builder participating in a chain must return a standardized envelope object:

```javascript
{
  valid: boolean,        // false if internal domain validation or business constraints fail
  nodes: Array,          // pageState NODE PAYLOADS, ready for pageState.applyNodes()
  permissions: Object,   // Aggregated map of required permissions across the entire chain
  message?: string,      // Failure or validation error message if valid === false
  successMsg?: string    // Optional user-facing success toast message
}
```

> [!IMPORTANT]
> **`nodes`, never `requests`.** A builder returns node payloads and lets `pageState.build()`
> turn them into GAS requests. Returning ready-made request envelopes forces Layer 3 into
> `run({ requests })`, which skips `build()` and makes every node on the page inert —
> validation sees nothing, drafts save nothing, `snapshot()` shows nothing. See
> [UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md) §5 and §5.2.

#### Envelope Field Specification

| Field | Type | Purpose |
|---|---|---|
| `valid` | `boolean` | `true` if all business invariants, allocations, and constraints pass; `false` otherwise. |
| `nodes` | `Array<NodePayload>` | Ordered node payloads ready for `pageState.applyNodes()`. |
| `permissions` | `Object` | Permission requirements dictionary combining all resources touched by the chain (e.g. `{ Orders: 'create', Invoices: 'create' }`). |
| `message` | `string` (optional) | Human-readable explanation when `valid === false`. Displayed to the user as a validation error toast or banner. |
| `successMsg` | `string` (optional) | Standardized completion toast text returned upon successful submission. |

#### The node payload shape

`src/composables/resources/nodePayloads.js` is the Layer 1 counterpart of
`resourceRequests.js`. Build every payload through it rather than writing the object
by hand:

| Helper | Writes | Becomes |
|---|---|---|
| `createNode(resource, record, reload?, payload?)` | one new row | `create` |
| `updateNode(resource, code, record, reload?, role?)` | one existing row | `update` |
| `bulkNode(resource, records, reload?)` | many rows of one resource | `bulk` |
| `compositeNode({ resource, code?, record, children, reload? })` | a header plus its line items | `compositeSave` |
| `actionNode(resource, code, actionConfig, fields, { key?, reload? })` | a workflow stamp on an existing row | `executeAction` |
| `reloadNode(resources)` | nothing — a re-read only | folded into the batch's trailing `get` |

#### `derive` — keeping a column in step after hydration

A node payload may carry `derive: [{ on, handler }]`. `on` ADDRESSES a reactive slice of
the tree; `handler(value, pageState)` writes the result back. The domain keeps the rule,
pageState does the writing, and the UI reads the node — never a figure the builder
returned on the side.

```js
deriveNode('OutletConsumptionInvoices', [derive(
  { resource: 'OutletConsumptionInvoiceItems', records: true },
  (rows, pageState) => pageState.setFields('OutletConsumptionInvoices', {
    Subtotal: rows.reduce((total, row) => total + Number(row.data.Total || 0), 0)
  })
)])
```

`on` takes one of: `{ resource, role?, children: 'X' }`, `{ resource, records: true }`,
`{ resource, field: 'X' }`, `{ resource }` (the whole record), or `{ control: 'X' }`.
Entries are keyed by that address, so re-hydrating REPLACES rather than stacking a second
writer on one column. See UI_PAGE_STATE.md §12.4.

#### Two addressing rules that decide the shape

1. **A node is addressed by `resource` plus `role`.** Several roleless payloads for one
   resource collapse onto a single address. A batch writing SEVERAL rows of one resource
   therefore uses `bulkNode` with a `Code` on each record, or gives each `updateNode` its
   own `role` (the record's own code is a good role name).
2. **A queued action is keyed by `key`.** `actionNode` defaults to
   `resource::action::code`, which is already unique per row. Only pass an explicit `key`
   when two different stamps of the same action target the same row.

---

### 9.3 Chaining & Composition Pattern

When a primary domain builder invokes secondary domain builders:

1. **Child Builder Invocation**: The primary builder invokes the secondary domain builder function with the relevant subset of input data.
2. **Early Exit on Failure**: If any child builder returns `valid: false`, the parent immediately halts further processing and bubbles the child's error envelope upward.
3. **Strict Node Ordering**: Parent nodes MUST appear in the `nodes` array before any child nodes that depend on them or reference their generated identifiers. `pageState` gives each address a build slot the first time it appears, so the array's order is the batch's order.
4. **Permission Merging (Union)**: The parent merges all child `permissions` dictionaries into its own permissions map, ensuring Layer 3 can perform a comprehensive, single-gate check.

```javascript
// src/_resource/Operation/Audits/composables/useAuditPayload.js
import { buildRestockChainNodes } from 'src/_resource/Operation/Restocks/composables/useRestockPayload'
import { reloadNode, updateNode } from 'src/composables/resources/nodePayloads'

const RESOURCE_NAME = 'Audits'

export function buildAuditCompletionChainNodes ({ auditRecord, discrepancies, actor, notes }) {
  if (!auditRecord?.Code) {
    return { valid: false, nodes: [], permissions: {}, message: 'Audit code is missing.' }
  }
  if (!discrepancies?.length) {
    return { valid: false, nodes: [], permissions: {}, message: 'No audit discrepancy lines provided.' }
  }

  const nodes = [updateNode(RESOURCE_NAME, auditRecord.Code, {
    Status: 'COMPLETED',
    CompletedBy: actor,
    Notes: notes || ''
  }, [RESOURCE_NAME])]

  let permissions = { [RESOURCE_NAME]: 'update' }

  const restockItems = discrepancies.filter((d) => d.variance < 0)
  if (restockItems.length > 0) {
    const restock = buildRestockChainNodes({ sourceAuditCode: auditRecord.Code, items: restockItems, actor })
    if (!restock.valid) {
      return { valid: false, nodes: [], permissions: {}, message: `Restock chain validation failed: ${restock.message}` }
    }
    nodes.push(...restock.nodes)
    permissions = { ...permissions, ...restock.permissions }
  }

  nodes.push(reloadNode(['WarehouseStorages']))

  return {
    valid: true,
    nodes,
    permissions,
    successMsg: 'Audit completed and restock movements generated successfully.'
  }
}
```

Layer 3 then stays a thin adapter:

```javascript
// _ui/AQL/components/Operation/Audits/Complete/PageAction.js
submit: () => {
  const result = buildAuditCompletionChainNodes({ ... })
  if (!result.valid) return { valid: false, message: result.message }
  if (resourceConfig?.allowed(result.permissions) !== true) {
    return { valid: false, message: 'You are not allowed to complete this audit.' }
  }

  pageState.applyNodes(result.nodes)
  return { successMsg: result.successMsg }
}
```

**A builder must not return a node for a record the PAGE already owns.** `applyNodes`
replaces what it writes, so a payload naming the page's own form node would wipe the
fields the user typed. A standalone Add wizard's builder returns only the EXTRA nodes and
exposes its column decisions as a fields helper the page applies to its own node — see
`restockCreateFields` / `buildRestockCreateChainNodes`.

---

### 9.4 Symbolic ID Linking (`batchRef`)

When creating a new parent record alongside dependent child or sibling records within the same batch trip, the parent ID or Code is not yet known on the client.

Chain payload builders MUST use symbolic reference objects created via `batchRef()`:

```javascript
import { batchRef } from 'src/utils/appHelpers'
import { bulkNode } from 'src/composables/resources/nodePayloads'

// Child rows linking to a parent created earlier in the same batch
bulkNode('StockMovements', items.map((item) => ({
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
bulkNode('StockMovements', rows, ['WarehouseStorages'])
```

Use `reloadNode(['WarehouseStorages', 'StockMovements'])` for a re-read that belongs to no
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
4. **Node payloads, not requests**: builders import `src/composables/resources/nodePayloads`, never `resourceRequests`. A builder that reaches for a request envelope is building a batch Layer 3 cannot validate.
5. **Never build another resource's payload.** A builder writes nodes for the resource it OWNS, plus that resource's own composite children. Every other resource in the chain is reached by calling ITS domain builder and splicing the returned `nodes` — never by hand-writing its columns. A resource's own child relations (`OutletConsumptionItems`, `PurchaseOrderItems`) are the exception: they ride in `children` of their parent's composite.
6. **No positional promises**: never return "the code is at index N of the response". Name the RESOURCE and let the caller resolve the position off `pageState.build()` — a node that ships nothing is skipped, so positions are not knowable at build time.
7. **Allowed Dependencies**:
   - Generic utilities from `src/utils/appHelpers` (e.g. `batchRef`, `batchRefList`, formatting helpers).
   - The node payload builders in `src/composables/resources/nodePayloads`.
   - Sibling Layer 2 domain composables / payload builders.

---

## 10. The Resource Domain Composition Cascade

Sections 2–9 govern one resource's domain module. This section governs how two of them meet.

### 10.1 The linear cascade (X -> Y -> Z)

> [!IMPORTANT]
> **Every resource gets its own Layer 2 module — including child relations, ledgers and
> configuration entities.** `OutletOperatingRules` and `OutletStorages` are resources, not
> columns of `Outlets`. A resource whose only job is to configure another one still owns
> its own `src/_resource/{Scope}/{Resource}/composables/` module, because that is where its
> defaults, its index and its vocabulary belong.

**Ledgers are resources, not side effects.** `StockMovements` and `OutletMovements` own
their sign rule, their `ReferenceType` vocabulary and their default storage. Five modules
used to restate them — three separate definitions of the string `'OutletRestock'` alone.
Every writer now calls `stockMovementRow` / `outletMovementRow`, so a row that would
credit a warehouse for a deduction cannot be written by getting a sign wrong at a call
site. The direction is a NAME (`OUT_OF_WAREHOUSE`, `ONTO_THE_SHELF`), never a bare `-1`.

**A child relation earns its own module when something OUTSIDE its parent needs it.**
`OutletConsumptionInvoiceItems` does: its row projection was defined in
`OutletConsumptions`, which does not own it. `PurchaseOrderItems` does not — its rows are
built only inside its parent's own `compositeSave`, and a module there would be an empty
folder adding an import hop.

> [!WARNING]
> **Do not split a child's PROGRESS vocabulary out of its parent.** `OutletRestockItems`
> extends `OutletRestocks`' `PROGRESS_META` rather than restating it, because a View card
> renders both on one screen and `DELIVERED` must look identical in each. Moving the item
> states to their own module either breaks that fusion or forces a circular import — the
> exact two-files-kept-in-sync problem §3.3 forbids. `OutletDeliveries` already reads them
> through the parent, which is correct delegation.

Downstream resources consume upstream domain modules **in series**, never by reaching past
one to the raw store:

```
OutletOperatingRules ─┐
                      ├─▶ Outlets ─▶ OutletVisits / OutletConsumptions / OutletRestocks
PriceLists ───────────┘             / OutletConsumptionInvoices ─▶ every _ui/ page
OutletStorages ─────────────────────▶ restock, consumption and delivery wizards
```

A **bypass link** is any of these, and all three are violations:

- A composable reading a parent's raw rows out of the data store when the parent's domain
  module already answers the question (`useVisitCadence` scanning `OutletOperatingRules`
  rows itself, instead of asking the rules domain).
- A hardcoded fallback constant standing in for a configured default (`|| 30`, `|| 14`).
- A UI composable re-deriving a value the cascade already computed, because the enriched
  entity did not carry it.

The tell is always the same as §3.3's: two files that must be kept in step by a promise
rather than by an import.

### 10.2 Defaults come from `DefaultValues`, never from a literal

> [!IMPORTANT]
> A resource default is CONFIGURATION. It is read through
> `useResourceConfig(RESOURCE_NAME).defaultValues` — i.e. from
> `APP.Resources.DefaultValues[RESOURCE_NAME]` — and never written as a number in a
> frontend file. Retuning a cadence, a due window or a credit ceiling is a sheet change.

The resource that OWNS the field owns the default. `OutletOperatingRules` resolves
`VisitFrequencyDays` and `InvoiceDueDays`; `Outlets` and `OutletConsumptionInvoices` read
the resolved value from it and state no fallback of their own.

An unconfigured term resolves to `0` / `''`, meaning **"unknown"** — every consumer
declines to act on it (does not band, does not schedule, does not price) rather than
inventing a value. A resolved default never lies about provenance either: `hasRules`
reports whether a ROW exists, so an outlet running on the configured default is still shown
as unconfigured while displaying the effective number.

```javascript
// ✗ a literal fallback compiled into a consumer
visitFrequencyDays: Number(rule?.VisitFrequencyDays) || 30

// ✓ the owning resource resolves it from its own configured DefaultValues
const { defaultValues } = useResourceConfig('OutletOperatingRules')
```

### 10.3 Non-destructive entity travel

> [!IMPORTANT]
> An enricher **decorates**, it never narrows. Spread the source row FIRST, then add derived
> keys beside it. A Layer 2 composable must never return a cherry-picked subset of an entity
> it was handed — Layer 3 decides what to render; Layer 2 decides what is true.

```javascript
// ✗ destructive — every column not listed here is lost to every downstream consumer
return { code: row.Code, name: row.Name }

// ✓ non-destructive — the raw row survives, derived keys ride alongside it
return { ...row, code: row.Code, name: row.Name || '', effectiveTerm, _raw: row }
```

Narrowing does not save memory (the source rows are already in the store, and the
projection holds a reference to them either way). What it does is force the next consumer
that needs an omitted attribute to re-derive it from the store — a parallel, slightly
different copy of the same entity, which is the split-brain UI this rule exists to prevent.

Corollaries:

- An enriched entity carries its joined relations as enriched objects
  (`outlet.operatingRule`, `outlet.priceList`), not just the two or three fields the first
  consumer happened to need.
- Reactivity travels with the object. An enricher returns a plain projection of reactive
  sources inside a `computed()`; it must not snapshot values into a `ref` that then stops
  tracking.
- `_raw` / `_rule` back-references stay on the entity, so a consumer can always reach the
  untouched source row.

### 10.4 Pre-indexing standards — O(1) at 100k rows

> [!IMPORTANT]
> No `.find()` or `.filter()` over a record set **inside a loop, a render pass, or a
> per-row getter**. Build the index once, outside the loop, in the domain module that owns
> the data; every lookup after that is a `Map` read.

A nested scan is O(N x M) and — worse in a reactive app — reruns on every invalidation. At
140 outlets x 3,500 storage rows x a full SKU catalogue, a per-keystroke recompute of a
wizard's quantity column is measured in scans of the whole sheet.

The owning resource publishes the indexes; consumers read them:

| Index | Shape | Answers |
|---|---|---|
| Single key | `Map<Code, entity>` | "the record for this code" |
| Grouping | `Map<ParentCode, row[]>` | "this parent's rows" |
| Composite / multi-dimensional | `Map<OutletCode, Map<SkuCode, qty>>` | "this outlet's stock of this SKU" |
| Reverse composite | `Map<SkuCode, Map<OutletCode, qty>>` | "who holds this SKU" |
| Rollup | `Map<Code, total>` | "this outlet's total units" |

Rules:

- **One pass builds every index.** `indexOutletStock(rows)` returns all five lookups from a
  single `forEach`, not five passes.
- **Sum into an index, never assign.** A SKU can occupy several named storages at one
  outlet; assignment lets the last row silently win.
- **The index belongs to the resource that owns the rows.** `OutletStorages` publishes the
  stock index; `Outlets`, the restock wizard and the consumption wizard consume it. Two
  modules indexing the same sheet is the same drift §3.3 forbids, paid for twice.
- **Offer the shape the call site needs.** A `Map` for lookups, a plain
  `{ [key]: value }` object where render loops already use bracket access — both projected
  from the ONE index, never rebuilt.
- **Pure builder + shared reactive wrapper.** The builder takes plain rows so a
  `PageAction.js` outside setup can index a payload; `defineSharedComposable` memoizes the
  reactive index so the pass runs once per app per data change (CORE_ARCHITECTURE_RULES §6).

### 10.6 Proactive domain elevation & future feature discovery

Most missing domain logic is not discovered while building the domain layer. It is
discovered in Layer 3, mid-page, when a card needs a number nobody has computed yet — an
SKU details page wanting outlet-wise stock distribution, a product page wanting "which
warehouses hold this", a dashboard wanting a rollup no aggregate publishes.

> [!IMPORTANT]
> **A missing Layer 2 capability is never solved by writing the math in Layer 3.** Not
> "temporarily", not "just this once for this card", not inside a `computed()` in a UI
> composable. The moment a page needs a domain helper, aggregation, or cross-resource
> projection that Layer 2 does not have, that helper is a Layer 2 gap — and it gets filled
> in Layer 2.

**The protocol, in order:**

1. **Detect.** Classify the piece of logic as §8.1 requires. If the answer is "what is true
   about this record / these records" rather than "how is it arranged on screen", it is
   domain — even when only one card will ever read it today.
2. **Locate the owner.** The capability belongs to the resource that OWNS the rows it reads,
   not to the resource whose page discovered the need. "Which outlets hold this SKU" is an
   `OutletStorages` question asked by an SKU page; it lives in `OutletStorages`.
3. **Notify and confirm.** Tell the user what is missing, which resource module it belongs
   to, and what shape it will take. **Wait for confirmation before implementing it.** A new
   Layer 2 export is a shared contract every future UI inherits — it is not a private detail
   of the page that prompted it, and it is not the page author's call alone.
4. **Implement in Layer 2, to the full invariant set.** Pure builders taking plain rows, a
   `defineSharedComposable` reactive wrapper, O(1) pre-indexed lookups (§10.4),
   non-destructive enrichment (§10.3), configured defaults (§10.2), one vocabulary (§3.3).
   A helper elevated in a hurry that skips the indexing rule is a second bottleneck wearing
   the right folder name.
5. **Consume it from Layer 3.** The page that discovered the gap now reads the shared
   capability, exactly as every later page will.

**Worked example — the SKU details page's outlet stock distribution.** The page wants, for
one SKU: which outlets hold it, how much each holds, and the estate total. Written in the
page, that is a `.filter()` over `OutletStorages` per outlet row — the exact
`O(N x M)` scan §10.4 forbids, and a second implementation of a sum `OutletStorages`
already owns. Elevated, it is `stockBySkuAndOutlet` and `totalStockBySku` on
`useOutletStorageResource` — already built by the same single pass that serves the restock
wizard, read here as one `Map` lookup, and available to the next page that asks without
anybody writing anything.

**What this is NOT.** It is not permission to move presentation into Layer 2. A sort order
for one list view, a label format, a card's column choice — those stay in `_ui/` (§4). The
test is unchanged: if a second UI would need the same answer to be correct, it is domain;
if a second UI would reasonably want a different answer, it is presentation.

### 10.5 Cascade self-check

- [ ] Every resource touched — including child relations and config entities — has its own
      `src/_resource/{Scope}/{Resource}/composables/` module.
- [ ] No numeric or string fallback constant stands in for a `DefaultValues` entry.
- [ ] No composable reads a parent resource's raw rows when that parent's domain module
      answers the question.
- [ ] Every enricher spreads its source row before adding derived keys, and returns
      `_raw`.
- [ ] No `.find()` / `.filter()` over a record set runs inside a loop or a per-row getter.
- [ ] Every index is built in one pass, by the resource that owns the rows.
- [ ] No domain helper discovered during Layer 3 work was inlined there — it was raised
      with the user and implemented in the owning resource's Layer 2 module (§10.6).

---

## Maintenance Rule

> [!IMPORTANT]
> Any change to the three-layer boundary, the strict import chain, the injection-relay
> pattern, or the Domain Payload Chain Architecture MUST be reflected in:
> 1. This document.
> 2. [UI_MODULE_DEVELOPER_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md) if its condensed summary of this system needs to change.
> 3. [resource_ui_module_developer.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/resource_ui_module_developer.md) if its execution checklist references the changed rule.

