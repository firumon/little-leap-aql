# 3-Layer UI — Resource Domain Logic System

The canonical, self-contained spec for `FRONTENT/src/_resource/**/*` — the UI-agnostic
business/workflow logic layer in the **3-Layer UI Architecture** — and the strict one-way import boundary that connects it to
the UI presentation layer (`_ui/`). Referenced by
[UI_MODULE_DEVELOPER_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md),
which covers UI-side generation; this document owns everything about the domain layer
itself and the boundary rules around it.

---

---

## Parts of this document

This document is split so each part stays readable on its own. The parts are canonical — this hub does not restate them.

| Part | Covers |
|---|---|
| [Resource Domain — Import Chain & Construction](UI_RESOURCE_DOMAIN_BOUNDARIES.md) | The strict import chain, the self-check, and how the domain layer actually gets built. |
| [Resource Domain — Payload Chain Architecture](UI_RESOURCE_DOMAIN_PAYLOAD_CHAINS.md) | Cross-resource mutations, the canonical envelope, and domain payload chains. |
| [Resource Domain — The Composition Cascade](UI_RESOURCE_DOMAIN_COMPOSITION.md) | How resource domain composables compose into a cascade. |




### Where each section lives

Section numbers are unchanged, so an existing `§N` reference still resolves — find it here.

| § | Section | File |
|---|---|---|
| §6 | The Strict Import Chain | [UI_RESOURCE_DOMAIN_BOUNDARIES.md](UI_RESOURCE_DOMAIN_BOUNDARIES.md) |
| §7 | Import-Boundary Self-Check | [UI_RESOURCE_DOMAIN_BOUNDARIES.md](UI_RESOURCE_DOMAIN_BOUNDARIES.md) |
| §8 | How the Domain Layer Actually Gets Built | [UI_RESOURCE_DOMAIN_BOUNDARIES.md](UI_RESOURCE_DOMAIN_BOUNDARIES.md) |
| §10 | The Resource Domain Composition Cascade | [UI_RESOURCE_DOMAIN_COMPOSITION.md](UI_RESOURCE_DOMAIN_COMPOSITION.md) |
| §9 | Domain Payload Chain Architecture | [UI_RESOURCE_DOMAIN_PAYLOAD_CHAINS.md](UI_RESOURCE_DOMAIN_PAYLOAD_CHAINS.md) |

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
- **Page initialization builders** — the blank draft a create page opens with. A `build<Resource>InitNodes`
  returns the opening Node, with its record, its `controls`, its `derive` entries and its
  `permissions`. Layer 3's `ready` hook calls `resetForResource` and then `applyNodes` on
  the result; it never lists the columns itself. Spec: [UI_PAGE_STATE_NODES.md §5.7A](UI_PAGE_STATE_NODES.md).
- **Node regeneration handlers** — the reshape a UI choice implies. When picking a source
  invoice must refill quantity, price and the flags that follow, that rewrite is domain
  logic: export it from Layer 2 and register it as a `derive` entry on the node. Layer 3
  writes only the one column the user chose. A secondary node (a ledger movement) is created
  and dropped the same way, because its existence IS the answer to "does this also write
  there". Spec: [UI_PAGE_STATE_NODES.md §5.7B–§5.7C](UI_PAGE_STATE_NODES.md).
- **The validation rule set** — `validate<Resource>Draft(record)`, returning why a record
  cannot be submitted or `''`. One rule set, asked by the page's submit handler AND by the
  create builder the headless paths use. Spec: [UI_PAGE_STATE_NODES.md §5.7D](UI_PAGE_STATE_NODES.md).

### 3.1 What does NOT belong here

- Anything that renders — no Vue templates, no component definitions.
- Anything that calls `inject()` or holds a component-lifecycle-bound `ref()`.
- Anything that formats for display only (a row preset, a sort order for a specific list
  view) — that is presentation, and belongs in a UI Composable (§4) instead.
- Anything that imports a **service** module directly.
- A **pure** builder or predicate must not reach a store — it takes `record`/`records` and
  answers from them, so a `PageAction.js` outside setup can call it.

> [!NOTE]
> **A resource INDEX is the exception, and the only one.** A module that publishes the
> enriched rows and lookups of the sheet it owns — `useSkuResource`,
> `usePriceListResource`, `useWarehouseResource`, `useInvoiceIndex` — reads
> `useDataStore()` behind `defineSharedComposable`, because "once per app, not once per
> consumer" (CORE_ARCHITECTURE_RULES §6) cannot be honoured anywhere else. The rule is one
> pure builder taking plain rows, plus a shared reactive wrapper that feeds it the store's
> rows (§10.4). What stays forbidden is a store read inside a payload builder or a
> predicate, where it would make the function untestable and unusable outside setup.

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
- The **form surface** — one stateless composable per resource that every card of a form
  reads and writes through: reads of the live node, one-column setters, no `ref()`, and a
  separate `use<Resource>FormSeed` owning the lifecycle for exactly one caller. It must not
  build option lists or any projection over a record set — those are memoized per call
  site and belong to the owning resource's Layer 2 module (§10.4). Spec:
  [UI_MODULE_DEVELOPER_FORM_ARCH.md §13.7](UI_MODULE_DEVELOPER_FORM_ARCH.md).

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

## Maintenance Rule

> [!IMPORTANT]
> Any change to the three-layer boundary, the strict import chain, the injection-relay
> pattern, or the Domain Payload Chain Architecture MUST be reflected in:
> 1. This document.
> 2. [UI_MODULE_DEVELOPER_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md) if its condensed summary of this system needs to change.
> 3. [resource_ui_module_developer.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/resource_ui_module_developer.md) if its execution checklist references the changed rule.
