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
3. **Architecture constraints** — [CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md).
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
- **Domain Payload Chains for Cross-Resource Mutations** — cross-resource side-effects (e.g. Order → Invoice, Audit → Restock) live exclusively in Layer 2 payload builders calling sibling domain builders. All builders must return the canonical envelope `{ valid, requests, permissions, message, successMsg }` ([UI_RESOURCE_DOMAIN_LOGIC.md §9](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md#9-domain-payload-chain-architecture)).
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
2. **The 4-Stage Index Hierarchy** (guide §9.1) — stack `sections` by descending urgency:
   - **Stage 1 (Urgent)**: `MetricCards` — open queues needing action right now (never all-time totals or finished records).
   - **Stage 2 (Pipeline Health)**: `LinearProgress` (fulfillment ratio with committed obligations denominator), `WorkflowFunnel` (in-flight moving stages only; exclude terminal states).
   - **Stage 3 (Backlog Risk)**: `AgeingBuckets` — time spent in bottleneck queues, permission-gated to the actor who can clear them, aged from queue entry stamp (`...SubmittedAt`).
   - **Stage 4 (Work Execution)**: `FilterInput`, `ListSwitcher`, and `List`.
   Every widget modifier returns `[]` — never zeroes — when there is nothing to say.
3. **Switcher & Combined Views** (guide §7.1, §9.3) — gate each pill on the action that view
   starts; fall back to ungated set if all are hidden; correct active view in a microtask.
   When combining related sub-queues in one view (e.g. Ready to Deliver + In-Progress), use
   `SectionDividerLabel`; if all sub-lists are empty, show a single clean empty-message box.
4. **Row Presentation & Scoping** (guide §7.2) — verify list strategy defaults before
   writing resolvers:
   - Personal queues ("My Drafts") filter rows down to active `userId` to avoid manager upline clutter.
   - Queue-intent captions: approver sees requester + submit note; revision queue sees reviewer changes; settled views see actor + timestamp. Suppress raw user codes (`U0001`).
   - Active queues sort oldest-first with outlined urgency chips; settled history sorts newest-first with plain elapsed time.
5. **Mobile-First Row Actions** (guide §7.3) — cap at **preferred 2, maximum 3 buttons**;
   always provide an explicit icon-only `View` button (`icon="visibility"`) because `btn`
   turns off normal row-click navigation; ban destructive or reason-requiring actions
   (Reject, Revise, Cancel) from list rows; check both state and record ownership for inline Edit.

---

## Step 5 — Build Add / Edit (guide §13)

1. **Pick the form shape first** (guide §13.0). Generated form (`contents: ['Create'|'Update']`)
   for flat schema columns; workflow form (bespoke cards) for derived trees/allocations.
   Handle conditional shortcuts (like Direct Restock) inside Add using control fields, shown
   only when matching infrastructure exists.
2. **Generated form**: narrow from `_fields`/`UIFields` via `fields`, `showFields`,
   `hideFields`, `fieldProps`. Never hand-assemble fields.
3. **Either shape**: every input is a `_fields` control resolved through
   `resolveFieldComponent(type, mode)` — labels, styles and test hooks travel in `config`.
4. **Share cards between Add and Edit** at the resource tier and list them in both contracts
   (guide §3.1, §13.4). Edit renders unchangeable facts (outlet, date) as read-only detail lines,
   shows a lock banner when opened for a settled record, and adapts submit options by state
   (drafts default "Save as draft" ON; returned records show resubmission comments). Suppress
   page header reload on transactional contracts (`PropsPageHeader: { reload: false }`).
5. **Route values correctly** (guide §13.5): real headers through `setRecord`; intent and
   working state through `setControls`; stamps written by submit handler only.
   Track multi-caller hydration in Edit via node control field `EditHydratedFor` and deduplicate
   child lines by SKU key during seeding. Place draft toggle before comment box.
6. **Multi-step wizards** (guide §13.6): step assignments via `Props<Component>: { step: N }`;
   sticky bar with `get actions()` getter; review step read-only with active choices open and
   downstream inventory projections closed; latch `entryProgress` for stable button labels.

---

## Step 6 — Build View (guide §7.4)

1. Default: `contents: ['View']` (generic grid) + `ViewColumn<Col>` overrides.
2. Upgrade to business-concept cards if the resource has line items, allocations, or workflow.
3. **Canonical 5-Tier View Card Stack**:
   - `1. Action Request Banner` (accented, only rendered when action is needed)
   - `2. Parent Identity Card` (flat details; omit blank rows)
   - `3. Content Summary Card` (what was requested)
   - `4. Operational Breakdown` (source bins; explanatory note before approval → concrete bin rows after approval)
   - `5. Workflow History Card` (chronological timeline by actual `...At` stamp; omit unreached steps)
4. Back all cards with **one** page UI Composable. Pass container spacing down via
   `(pageProps) => ({ gutter: pageProps.gutter })`.

---

## Step 7 — Build Any Action Route (guide §5.5, §8)

1. Contract at `pages/{Scope}/{Resource}/{ActionName}.js` with explicit `title`,
   `PropsPageHeader: { reload: false }`, and step table in docblock.
2. Shared allocation/review cards at the resource tier. Hydration in the first content component.
3. Sticky bar owns navigation and submission (guide §8.2–§8.5):
   - Zero UI Schema Invention: delegate cross-resource batch preparation to Layer 2 domain payload chain builder.
   - `PageAction.js` handler invokes chain builder, checks `!result.valid`, gates with `resourceConfig.allowed(result.permissions)`, and returns `{ requests: result.requests, successMsg: result.successMsg }`.
   - Validate downstream irreversibility: block rejection/reversal if child lines are already delivered.
   - Child-only action routes (`Reallocate`) isolate payloads and permissions to child lines and stock movements, without touching parent approval state.
   - Append `resourceGetRequest(['WarehouseStorages'])` to refresh stock cache in the same round trip.
   - Action `show` gates inspect live relation getters (`record?.$ChildItems`) where eligibility depends on child status.

---

## Step 8 — Apply the Visual Contract (guide §10)

- Every card binds `<q-card flat bordered :class="ui.cardClass">` via UI config relay —
  **never hardcode class strings or local `const ROW_STAGGER_MS = 40`**.
- Rows: `ui.detail*Class` and `rowDelay()` computed from `ui.rowStaggerMs`.
- Dynamic control grid partitioning: use `binColumnClass(count)` (1 item = `col-12`, 2 or 4 items = `col-6` (2+2), 3 or 5+ items = `col-4` (3+3)) to avoid stranded inputs.
- Hierarchical pickers: use 3-level tri-state trees with `indeterminate-value="null"`.
- Control stability: disable (rather than unmount) numerical allocation controls when covered, to prevent layout jumping mid-edit.
- Spacing: `pageProps.gutter` between sibling cards; declared `padding` for horizontal insets. Keep spacing out of `card-class`.
- Quiet states: skeleton inside card shell while loading; standard empty shell with descriptive caption; `v-if` at root when hiding. Banners use `q-banner`, not card shells.

---

## Step 9 — `inheritAttrs` Pass (guide §12.1)

Intermediate containers keep default `inheritAttrs: true`; leaf components explicitly configure
`inheritAttrs: false`/`true` based on DOM binding requirements.

---

## Step 10 — Self-Check, Verify & Commit

Import boundaries & Domain Chains (guide §6, [UI_RESOURCE_DOMAIN_LOGIC.md §9](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md#9-domain-payload-chain-architecture)):

- [ ] Every `.vue` under `_ui/` imports only UI Composables — zero `inject(` or Core Composable imports in `.vue` files.
- [ ] Every UI Composable imports only Resource Composables + generic Core Composables.
- [ ] Every Resource Composable (`src/_resource/**`) imports only generic Core Composables.
- [ ] Cross-resource mutations are encapsulated in Layer 2 Domain Payload Chains; zero secondary schema rows constructed in `_ui/` or `PageAction.js`.
- [ ] All Domain Payload Chain builders return the canonical envelope `{ valid, requests, permissions, message, successMsg }`.
- [ ] `PageAction.js` gates submissions using `resourceConfig.allowed(result.permissions)`.

Visual contract & tokens (guide §10):

- [ ] No hardcoded `ROW_STAGGER_MS = 40` or class strings in `.vue` files — all read `ui.cardClass` / `ui.rowStaggerMs`.
- [ ] Row action clusters have at most 3 (preferred 2) buttons, include an explicit View button, and omit destructive actions.
- [ ] Transactional wizard & edit contracts declare `PropsPageHeader: { reload: false }`.
- [ ] Grid partitioning splits 4 inputs into 2+2 (`col-6`) instead of 3+1.

Reactivity & Data (guide §11, §13):

- [ ] No enriched record is spread, cloned with `Object.assign`, or JSON stringified.
- [ ] Multi-component hydration in Edit tracks `EditHydratedFor` on node control fields.
- [ ] Child lines are deduplicated by SKU key during form seeding.
- [ ] Downstream checks block reversals once child lines are delivered.

Catalogues (guide §Maintenance Rule):

- [ ] A new `_fields` type → row added to `_fields/REGISTRY.md`.
- [ ] A new reusable Section/Content/app base → row added to `components/REGISTRY.md`.
- [ ] A new or changed design token → value in `_config/config.js`, rationale in `_config/config.md`.

Then:

- Run `gitnexus_impact` before editing any pre-existing symbol (per `AGENTS.md`).
- Run `gitnexus_detect_changes()` before committing.
