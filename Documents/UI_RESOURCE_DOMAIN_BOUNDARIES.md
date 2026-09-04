# Resource Domain — Import Chain & Construction

> Part of **[3-Layer UI — Resource Domain Logic System](UI_RESOURCE_DOMAIN_LOGIC.md)**. The strict import chain, the self-check, and how the domain layer actually gets built.

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

> [!IMPORTANT]
> **`pageState` needs no relay — inject it.** The relay earns its place when a page's cards
> need several injected handles wrapped into a settled shape. A card that only needs
> `pageState` calls `inject('pageState')` itself: the relay would add an import and a file
> for nothing, and a page relay with no other job attracts the state and arithmetic that
> belong on the node and in Layer 2. That is exactly how `OutletConsumptions/Add` grew a
> 552-line feature composable holding a second invoice calculation and a control array
> mirroring rows that already lived on a node. Both are gone; the step cards inject
> `pageState`, bind to the nodes, and call the Layer 2 builders directly.
>
> What the cards genuinely share is *addresses*, not state — node names, roles, control
> keys. Those go in a **plain constants module**
> (`.../{Resource}/{Page}/nodes.js`): no refs, no injects, no computeds, nothing that can
> drift from the nodes.

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


---

⬑ Back to **[3-Layer UI — Resource Domain Logic System](UI_RESOURCE_DOMAIN_LOGIC.md)**.
