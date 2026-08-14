---
name: AQL Resource UI Module Developer Agent
description: Specialized, machine-optimized initialization prompt for generating a complete resource UI module (Index, Add, Edit, View, action routes) end-to-end under FRONTENT/src/_ui/, or materially extending an existing one to cover a larger workflow.
---

# Scope Boundary

This prompt governs **generating or materially extending a whole resource UI module** —
Index, Add/Edit, View and any action routes together, for a resource with no `_ui/`
footprint yet, or one whose workflow has grown beyond what its current module covers. Build
exactly what the module's business workflow calls for (see Step 0).

**Not this prompt's job** — a task touching only one piece of an already-built module
(one field, one section, one action, one list view) resolves faster through the narrower
domain prompts. Read this prompt's directives below first; if Step 0 determines the task is
single-piece, defer immediately to the matching narrower prompt and stop reading here:

- One Content/List override → [content_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_customization.md)
- One Create/Update form change → [content_create_and_update_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_create_and_update_customization.md)
- One View column/card change → [view_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/view_customization.md)
- One Section (chrome, header, metric widget) → [page_and_section_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_section_system.md)
- One Action/FAB/sticky-bar change → [action_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/action_customization.md)
- A new reusable render component under `src/components/{abstract,app,contents,sections}/` → [renderable_contract.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/renderable_contract.md) (load additively)

## Required Pre-Reads

1. **Canonical spec**: [UI_MODULE_DEVELOPER_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md).
   - **For Full Module Generation**: Read in full as the authoritative hub.
   - **For Single-Piece Tasks or Context-Equipped Sessions**: Reference **only the matching sections** needed for that specific piece:
     - **Button / FAB / Sticky Action / Workflow Trigger**: Read §8 (*Actions — Dispatch, Handlers & FABs*) and [UI_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_ACTION_SYSTEM.md).
     - **Card Header / Page Chrome / Metric Widget**: Read §2, §5 (*Page Contracts & `Props<Identity>`*) and [UI_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_AND_SECTION_SYSTEM.md).
     - **List View / Row Presentation / Row Action**: Read §7.1–§7.3, §9.3–§9.4 and [UI_CONTENT_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CONTENT_SYSTEM.md).
     - **View Details / Business-Concept Card**: Read §7.4–§7.5 and [UI_VIEW_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_VIEW_SYSTEM.md).
     - **Create / Edit Form / Wizard Step**: Read §7.6, §11, [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md), and [UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md).
2. **Resource domain logic & import boundaries** — [UI_RESOURCE_DOMAIN_LOGIC.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md) — read in full before writing any `src/_resource/` file (Step 2) or any UI Composable (Step 3).
3. **Architecture constraints** — [CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md).
4. **The three catalogues** the guide links rather than restates. Read the one your step needs — never restate their contents in a module:
   - [`_fields/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/REGISTRY.md) — every implemented field type, and the contract for mounting one by hand (Step 5).
   - [`components/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md) — every reusable Section/Content/app base, its props and its hide rules (Step 4).
   - `_ui/{Ui}/_config/config.md` — that UI's design tokens and why they hold their values (Step 8). For the default UI: [`_ui/AQL/_config/config.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_ui/AQL/_config/config.md).
5. **Resource schema** — [SCHEMA_RESOURCE_COLUMNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SCHEMA_RESOURCE_COLUMNS.md) for `_fields`/`UIFields`/`Relations` structure.
6. **Page state** — [UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md) — mandatory for any Add/Edit/wizard/action page.
7. Subsystem specs as needed: [UI_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_AND_SECTION_SYSTEM.md), [UI_CONTENT_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CONTENT_SYSTEM.md), [UI_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_ACTION_SYSTEM.md), [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md), [UI_VIEW_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_VIEW_SYSTEM.md).

---

## Step 0 — Work Out What Is Being Asked

Before touching any file, decide what kind of request this is. Use this table:

| What the request looks like | What to do |
|---|---|
| A brand new module, or "build the whole X module" (Index + Add/Edit + View together) | This is a **FULL MODULE**. Read the whole guide. Do Steps 1–10 below, in order. |
| A single page, or one piece of a module that already exists (just the list, just the Edit form, just one button, just one card) | This is a **PARTIAL** task. Do NOT run the full pipeline. If the session is already equipped with context, reference **only the relevant guide section** above (or the narrower domain prompt) and execute directly. |
| The word "dashboard", or anything that sounds like a report/summary/chart over ALL TIME or a whole month | **STOP before building anything.** Per guide §9, an Index page shows only live/open queues — it is not a dashboard. A real dashboard belongs to the separate Dashboard system ([dashboard_implementation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/dashboard_implementation.md)). Ask the user which one they mean before doing anything. |
| Anything about a **list** (a table of records, a filter, a view tab) | Read only guide §7.1–§7.3 (per-view overrides, row presentation, row actions) and §9.4 (how a list already builds itself from the resource's fields). Do not rebuild the whole Index page for a list-only ask. |
| The request is missing pieces — e.g. it doesn't say what the Edit page should contain, or the workflow steps aren't clear | Do **not** guess. Ask the user and wait for their answer before writing any file. |

### How to ask, when something is unclear

Use simple, everyday words — as plain and clear as a storybook for a young child would use.
Short sentences. No jargon, no technical terms the user hasn't already used themselves. Ask
one clear question at a time, or a short list of at most two or three questions. Always wait
for the user's answer before continuing — never guess and move on. This applies any time a
piece of the request is missing, unclear, or could mean two different things.

### Step 0.1 — Read the Workflow (full-module path)

For a FULL MODULE task: read the business workflow given for this module and build exactly
what it calls for (guide §0). A flat toggle produces a lighter module (single-view form,
generic View grid, one domain composable); a multi-step/multi-actor workflow produces a
wizard-shaped Add, one or more action routes, and business-concept View cards. Both follow
the same steps below; a given module simply may not need every step's full weight.

---

## Step 1 — Confirm the UI Has a `_config/` (guide §10.3)

```
_ui/{UiName}/_config/config.js     tokens the components bind to
_ui/{UiName}/_config/config.md     what each token means and why
```

If the module resolves under a UI name with no `_config/`, create both **before the first
component**. A UI without one has no design system and every module built under it invents
its own. Copy the key set from `_ui/AQL/_config/config.js`; write that UI's own values and
its own rationale — never copy AQL's reasoning verbatim.

---

## Step 2 — Scaffold the Domain Layer (guide §4)

```
src/_resource/{Scope}/{Resource}/
├─ composables/use{Resource}Progress.js     workflow vocabulary, state predicates,
│                                            progressLabel/Color/Icon (guide §4.5)
├─ composables/use{Resource}Approval.js     (if the workflow needs one) stateful aggregate
├─ composables/use{Resource}Payload.js      batch-request builders
└─ utils/                                    resource-specific pure helpers
```

If the whole business workflow was given upfront, scaffold this layer completely before any
UI file. More often no such spec exists and the task reads as "build/update the UI." In that
case build UI and domain side by side: as each piece of logic gets written, classify it
first — is this about how something looks (UI), or what the record can do and what state it
is in (domain)? Route it immediately; never park business logic in a `_ui/` file
"temporarily." Full detail:
[UI_RESOURCE_DOMAIN_LOGIC.md §8](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md).

Rules, no exceptions:
- Named pure exports + a `use{Feature}()` wrapper (guide §2.2, §4.4). The pure half is what
  a page contract and a `PageAction.js` import; the wrapper is for setup-context callers.
- Every export takes `record`/`records` only — never `config`. Hardcode the resource's own
  name and call `useResourceConfig('{ThatName}')` internally for anything needing
  headers/permissions/`allowed()`.
- **One workflow vocabulary** — states, order, and their label/colour/icon — declared here
  and read by every widget, chip, badge and gate (guide §4.5).
- No `inject()`, no `ref()` unless every caller is inside a UI Composable.
- No import of a Pinia store, a service module, or anything under `_ui/`.

---

## Step 3 — Scaffold the Injection-Relay UI Composable, Per Page (guide §6.2)

One file, per resource **per page**, owns every `inject()` call that page's components need:

```
_ui/{Ui}/composables/{Scope}/{Resource}/{Page}/use{Resource}Context.js
```

Exposes `record`, `config`, `pageState` (as `computed`s over the injected refs), a `pending`
flag for the cards to self-guard on, the `ui` token bag relayed from
`_ui/{Ui}/composables/use{Ui}Config.js`, plus any presentation-only derived values that call
into Step 2's domain composables. Every `.vue` component under that page's `_ui/` tree
imports **this file only** — never `inject()` directly, never a Core Composable directly,
never `_config/config.js` directly (guide §10.1 shows the relay).

For a View page with business-concept cards, this is also the **one** composable every card
reads its projection from, so no two cards can independently re-derive the same tree and
disagree (guide §7.4).

---

## Step 4 — Build Index (guide §9)

1. `pages/{Scope}/{Resource}/Index.js` — `sections: ['PageHeader', …]`, `contents: ['List']`,
   with a docblock stating what the page answers and in what order (guide §5.5).
2. **Widgets** — whichever queue/ratio/pipeline/ageing reading the workflow's operational
   state actually needs. Check
   [`components/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md)
   for an existing base first; add a new **generic** base if none fits, never a bespoke
   one-off. Each is a JS modifier reading Step 2's domain composables. Every one of them:
   - `items` **function-valued** (a modifier resolves once and is cached);
   - returns `[]` — never zeroes — when there is nothing to say;
   - shares the page's **one row-eligibility predicate**;
   - counts from `records`, never `filteredRecords`;
   - is permission-gated on the action that clears its queue, with the permission read
     **inside** the closure.

   Live/open state only — never an all-time total, terminal-state running count, or calendar
   aggregate. Stack by descending urgency. Include a widget only when the workflow produces
   the data it would show. The exact ratio/state/threshold is a domain decision from Step 2,
   reasoned there, never invented in the widget file.
3. **Switcher** — gate each pill on the permission for the action that view starts; fall back
   to the ungated set if all are hidden; correct the active view when the default is gated
   away, deferred to a microtask (guide §9.3).
4. **Work queues** — `PropsList<ViewName>` blocks in the contract; a `List<ViewName>` file
   only when it mounts a component (`btn`) or needs a template. A `.vue` per-view override
   reads rows from **both** `props.items` and `attrs.items` (guide §7.1).
5. **Row presentation** — verify the list strategy's inferred defaults are actually wrong
   before writing any `label`/`caption`/`chip` resolver (guide §9.4). When presets are
   needed: queues awaiting action sort oldest-first with an urgency chip; settled views sort
   newest-first and drop the chip; sort and age through a resolver with a documented fallback
   (guide §7.2).
6. **Row actions** — at most one contextual workflow action beside the standing View/Edit
   pair; keyed on the record's own state, never the active view; supply the View button
   yourself; dispatch CRUD locally and delegate workflow to `AdditionalActionsButtons`
   (guide §7.3).

---

## Step 5 — Build Add / Edit (guide §13)

1. **Pick the form shape first** (guide §13.0). Is the primary input the resource's **own
   columns** (generated form → `contents: ['Create'|'Update']`) or a **derived tree** the
   schema cannot express — line items, allocations, a selection across child rows (workflow
   form → bespoke content cards)? Generated is the default; do not reach for bespoke cards
   to avoid narrowing a field set.
2. **Generated form**: do not hand-list fields. Confirm the form-fields composable generates
   the correct set from `_fields`/`UIFields`, then narrow only via `fields`, `showFields`,
   `hideFields`, `fieldProps` on `PropsCreate`/`PropsUpdate`.
3. **Either shape**: every input is a `_fields` control resolved through
   `resolveFieldComponent(type, mode)` — never a deep SFC import, never a raw Quasar control.
   Labels, styles and test hooks travel in `config`
   ([`_fields/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/REGISTRY.md)).
   If a type doesn't exist, add it there.
4. **Share cards between Add and Edit** at the resource tier and list them in both contracts
   (guide §3.1, §13.4) — never a parallel set. Edit states its fixed identity fields
   read-only, explains a locked record in a banner, and shows the intent control its entry
   state calls for (the non-advancing intent defaults ON).
5. **Route values correctly** (guide §13.5): real headers through `setField`; page-only
   intent and working state through `setControlField`; `Progress`/`...At`/`...By` stamps
   written by the submit handler only, never exposed as fields, and omitted entirely for a
   save that is not a submission.
6. **Multi-step** only for a sequencing dependency or genuinely unrelated decisions — never
   for tidiness (guide §13.6). Then: a `PageAction.js` with a `get actions()` getter keyed off
   `pageState.meta.currentStep`; the step declared by the **contract** as a `step` prop
   (`null` = always render) and never hardcoded in the card; wizard state in `pageState`
   only; the review step read-only; the primary button labelled with the transition it
   performs, latched to the entry state where submit would change what the label reads.

---

## Step 6 — Build View (guide §7.4)

1. Default: `contents: ['View']` (the generic key-value grid) + `ViewColumn<Col>` overrides
   for any field needing special rendering.
2. Upgrade to business-concept cards ONLY if the resource has line items, allocations,
   multi-step workflow, or more than one kind of related fact (guide §7.4's checklist).
3. If upgrading: one card per business concept, declared in `sections` with `contents: []`,
   all backed by **one** page-scoped UI Composable. Each card self-guards loading, empty and
   hidden states (guide §10.4), and follows the authoring contract in §7.5 —
   `SectionDividerLabel` heading, function-capable `title`, `items` defaulting to `null`,
   declared `padding`.
4. Order the stack by what the reader must do: a card that asks for an action leads; cards
   that report one follow.

---

## Step 7 — Build Any Action Route (guide §5.5, §8)

1. Contract at `pages/{Scope}/{Resource}/{ActionName}.js` — the file name is
   `toPascalCase(actionSlug)`, so `mark-delivered` → `MarkDelivered.js` (guide §2.1). Give it
   an explicit `title`, `reload: false`, and a docblock with the step table.
2. Cards at the tier their reuse demands (guide §3.1) — two routes collecting the same
   decision resolve one set at the resource tier.
3. **Hydration**: the route loads no record and usually has no `Create`/`Update`, so the
   page composable owns the fetch and the seeding, called from the **first content** the
   contract names.
4. Sticky bar owns navigation and submission (guide §8.2–§8.4): `get actions()`; handler
   returns `{ requests, successMsg, … }` — `successMsg`, not `successMessage`; cancel
   navigates explicitly and returns `false`; permission re-checked at submit with a
   lower-camel action name naming **every** resource the batch writes; a read appended for
   anything the batch invalidated. A brand-new bar button needs a `FormAction{Name}.vue`
   that emits only and disables (never spins) while in flight.

---

## Step 8 — Apply the Visual Contract (guide §10)

- Every card: `<q-card flat bordered :class="ui.cardClass">`, with `ui` relayed through the
  page context composable — never a hardcoded class string, no per-module variant, no
  display-vs-input pair.
- Rows: the UI's `detail*Class` grammar, and `rowDelay()` computed from `ui.rowStaggerMs` —
  never a local `ROW_STAGGER_MS`.
- Spacing: `pageProps.gutter` via `useAttrs()` between sibling surfaces; one declared
  `padding` prop (`q-px-{padding}`) for horizontal inset. Spacing *inside* a card (the
  empty/skeleton insets, a sub-block's separation) is sanctioned as written in guide §10.4 —
  the ban is on pushing one card away from the next. Never in `card-class`.
- All three quiet states on any self-guarding card: skeleton inside the shell while loading;
  the standard empty shell **with its caption line**; `v-if` at the root when the card
  contributes nothing. A fact *about* the surrounding cards is a `q-banner`, not a card.
- Icon-only controls bind `ui.tapTargetStyle` and carry an `aria-label` — a tooltip does not
  satisfy it, and `rowActionBtnProps` supplies neither. The flow-anchoring input is never
  `dense`. Chips carry state (a count per state is a legend and may be a chip); a running
  total the user is changing is text.
- At most one accented card per page, and only the leading one that asks for an action.

---

## Step 9 — `inheritAttrs` Pass (guide §12.1)

For every newly created nested component chain: intermediate containers keep default
`inheritAttrs` (props flow through untouched); only the leaf component explicitly sets
`inheritAttrs: false`/`true` based on its own DOM-binding needs. Do not blanket-apply
`inheritAttrs: false` to every component in the chain.

---

## Step 10 — Self-Check, Verify & Commit

Import boundaries (guide §6):

- [ ] Every `.vue` under `_ui/` imports only UI Composables — grep for `inject(` and any Core
      Composable import, and confirm none appear outside a UI Composable file.
- [ ] Every UI Composable imports only Resource Composables + generic Core Composables — no
      store, no service.
- [ ] Every Resource Composable (`src/_resource/**`) imports only generic Core Composables —
      no store, no service, nothing under `_ui/`.

Reactivity (guide §11):

- [ ] No enriched record is spread, `Object.assign`-copied or JSON round-tripped.
- [ ] Every enriched relation read is normalized before its first predicate.
- [ ] Every modifier value that must track the record is function-valued; every `actions` /
      `submitLabel` that must track state is a getter.
- [ ] No prop object or array is allocated inline in a template.

Catalogues (guide §Maintenance Rule):

- [ ] A new `_fields` type → row added to `_fields/REGISTRY.md`.
- [ ] A new reusable Section/Content/app base → row added to `components/REGISTRY.md`.
- [ ] A new or changed design token → value in `_config/config.js`, rationale in
      `_config/config.md`.

Then:

- Run `gitnexus_impact` before editing any pre-existing symbol (per `AGENTS.md`).
- Run `gitnexus_detect_changes()` before committing.
- Run `npm run build` only if the change is major/cross-cutting (≥10 files or equivalent).
