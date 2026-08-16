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
   │  Builds primary batch requests
   │  Directly calls Layer 2 Domain Builder for Resource B
   ▼
Layer 2 (Secondary Domain: Resource B)
   │  Validates business rules for Resource B
   │  Builds secondary batch requests (using batchRef for symbolic foreign keys)
   │  Returns standardized envelope
   ▼
Layer 3 (UI Presentation)
   │  Receives unified { valid, requests, permissions, successMsg }
   │  Gates execution with resourceConfig.allowed(result.permissions)
   │  Hands requests directly to pageState.submit() for atomic GAS execution
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
  requests: Array,       // Array of standard GAS batch requests (saveComposite, bulk, etc.)
  permissions: Object,   // Aggregated map of required permissions across the entire chain
  message?: string,      // Failure or validation error message if valid === false
  successMsg?: string    // Optional user-facing success toast message
}
```

#### Envelope Field Specification

| Field | Type | Purpose |
|---|---|---|
| `valid` | `boolean` | `true` if all business invariants, allocations, and constraints pass; `false` otherwise. |
| `requests` | `Array<Object>` | Complete, ordered array of GAS batch request objects ready for `pageState.submit()`. |
| `permissions` | `Object` | Permission requirements dictionary combining all resources touched by the chain (e.g. `{ Orders: 'create', Invoices: 'create' }`). |
| `message` | `string` (optional) | Human-readable explanation when `valid === false`. Displayed to the user as a validation error toast or banner. |
| `successMsg` | `string` (optional) | Standardized completion toast text returned upon successful submission. |

---

### 9.3 Chaining & Composition Pattern

When a primary domain builder invokes secondary domain builders:

1. **Child Builder Invocation**: The primary builder invokes the secondary domain builder function with the relevant subset of input data.
2. **Early Exit on Failure**: If any child builder returns `valid: false`, the parent immediately halts further processing and bubbles the child's error envelope upward.
3. **Strict Request Ordering**: Parent requests MUST appear in the `requests` array before any child requests that depend on them or reference their generated identifiers.
4. **Permission Merging (Union)**: The parent merges all child `permissions` dictionaries into its own permissions map, ensuring Layer 3 can perform a comprehensive, single-gate check.

```javascript
// src/_resource/Operation/Audits/composables/useAuditPayload.js
import { buildRestockChainRequests } from 'src/_resource/Operation/Restocks/composables/useRestockPayload'
import { resourceGetRequest } from 'src/composables/resources/usePageState'
import { batchRef } from 'src/utils/appHelpers'

const RESOURCE_NAME = 'Audits'

export function buildAuditCompletionChainRequests ({ auditRecord, discrepancies, actor, notes }) {
  // 1. Validate primary domain constraints
  if (!auditRecord?.Code) {
    return { valid: false, message: 'Audit code is missing.' }
  }
  if (!discrepancies?.length) {
    return { valid: false, message: 'No audit discrepancy lines provided.' }
  }

  // 2. Build primary resource batch request
  const primaryRequests = [
    {
      resource: RESOURCE_NAME,
      action: 'saveComposite',
      data: {
        record: {
          Code: auditRecord.Code,
          Status: 'COMPLETED',
          CompletedBy: actor,
          Notes: notes || ''
        }
      }
    }
  ]

  let aggregatedPermissions = {
    [RESOURCE_NAME]: 'update'
  }

  const allRequests = [...primaryRequests]

  // 3. Conditionally chain secondary domain builder(s) if restock is required
  const restockItems = discrepancies.filter((d) => d.variance < 0)
  if (restockItems.length > 0) {
    const restockResult = buildRestockChainRequests({
      sourceAuditCode: auditRecord.Code,
      items: restockItems,
      actor
    })

    // 4. Early exit on secondary domain validation failure
    if (!restockResult.valid) {
      return {
        valid: false,
        message: `Restock chain validation failed: ${restockResult.message}`
      }
    }

    // 5. Merge requests in strict dependency order & merge permissions
    allRequests.push(...restockResult.requests)
    aggregatedPermissions = {
      ...aggregatedPermissions,
      ...restockResult.permissions
    }
  }

  // 6. Include cache refresh requests in the same batch
  allRequests.push(resourceGetRequest(['WarehouseStorages', 'Audits']))

  return {
    valid: true,
    requests: allRequests,
    permissions: aggregatedPermissions,
    successMsg: 'Audit completed and restock movements generated successfully.'
  }
}
```

---

### 9.4 Symbolic ID Linking (`batchRef`)

When creating a new parent record alongside dependent child or sibling records within the same batch trip, the parent ID or Code is not yet known on the client.

Chain payload builders MUST use symbolic reference objects created via `batchRef()`:

```javascript
import { batchRef } from 'src/utils/appHelpers'

// Child record linking to parent created in an earlier request of the same batch
const childRequest = {
  resource: 'StockMovements',
  action: 'bulk',
  data: {
    rows: items.map((item) => ({
      ItemCode: item.ItemCode,
      Quantity: item.Quantity,
      ReferenceCode: batchRef('Restocks.latest.code'), // Backend resolves to newly generated parent code
      SourceType: 'RESTOCK'
    }))
  }
}
```

- Never split parent and child mutations into multiple network round trips solely to retrieve generated IDs.
- Never stringify or interpolate `$ref` objects into strings.

---

### 9.5 Post-Mutation Balance & Cache Refreshing

Any domain chain whose execution invalidates client-side cached aggregates (such as stock balances, account ledgers, parent status headers, or audit logs) MUST append the appropriate `resourceGetRequest` queries to the end of the `requests` array:

```javascript
import { resourceGetRequest } from 'src/composables/resources/usePageState'

// Appended to requests array
allRequests.push(resourceGetRequest(['WarehouseStorages', 'StockMovements']))
```

This guarantees that all related store caches and UI aggregates update in the exact same network round trip, preventing stale views or desynchronized UI screens.

---

### 9.6 Strict Guardrails for Domain Payload Builders

Every payload chain builder in Layer 2 must adhere to the following strict guardrails:

1. **Pure JavaScript Functions**: No Vue reactivity (`ref`, `reactive`, `computed`), no Vue lifecycle hooks, and no component injection (`inject()`).
2. **Deterministic Inputs**: All required records, form data, actor details, and configuration must be passed explicitly in the argument object.
3. **No Direct Store/Service Calls**: Domain payload builders never call Pinia stores or API services directly. They merely assemble and return the declarative request objects.
4. **Allowed Dependencies**:
   - Generic utilities from `src/utils/appHelpers` (e.g. `batchRef`, `batchRefList`, formatting helpers).
   - Standard batch request helpers from `src/composables/resources/usePageState` (e.g. `resourceGetRequest`).
   - Sibling Layer 2 domain composables / payload builders.

---

## Maintenance Rule

> [!IMPORTANT]
> Any change to the three-layer boundary, the strict import chain, the injection-relay
> pattern, or the Domain Payload Chain Architecture MUST be reflected in:
> 1. This document.
> 2. [UI_MODULE_DEVELOPER_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md) if its condensed summary of this system needs to change.
> 3. [resource_ui_module_developer.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/resource_ui_module_developer.md) if its execution checklist references the changed rule.

