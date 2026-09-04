# 3-Layer UI — Resource UI Module Developer Guide

The canonical blueprint for generating a complete resource UI module — Index, Add, Edit,
View, and any action route it needs — under the **3-Layer UI Architecture** (`FRONTENT/src/_ui/`). This document plus a
module's business workflow specification is everything a developer, or an AI agent, needs
to produce a module.

It covers the resolver mechanics, folder layout, page contracts, page-by-page blueprints
and the generation rules directly. Three things it deliberately does **not** restate,
because they are catalogues that go stale the moment they are duplicated:

| Subsystem | Canonical spec |
|---|---|
| Implemented `_fields` types, and how to mount one by hand | [`_fields/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/REGISTRY.md) |
| Reusable component bases — every generic Section/Content/app component, its props and its hide rules | [`components/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md) |
| A UI's own design tokens — card shell, motion, spacing, tap targets | `_ui/{UiName}/_config/config.md` (e.g. [`_ui/AQL/_config/config.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_ui/AQL/_config/config.md)) |

Plus the subsystem specs this guide summarizes inline and links out to for full detail:

| Subsystem | Canonical spec |
|---|---|
| Resource domain logic, import boundaries & payload chains | [UI_RESOURCE_DOMAIN_LOGIC.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md) |
| Pages & Sections | [UI_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_AND_SECTION_SYSTEM.md) |
| Contents | [UI_CONTENT_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CONTENT_SYSTEM.md) |
| Actions | [UI_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_ACTION_SYSTEM.md) |
| Create / Update forms | [UI_CREATE_AND_UPDATE_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_CREATE_AND_UPDATE_SYSTEM.md) |
| View content | [UI_VIEW_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_VIEW_SYSTEM.md) |
| Page state / submission | [UI_PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_PAGE_STATE.md) |
| Resource schema (`_fields`, `Relations`) | [SCHEMA_RESOURCE_COLUMNS.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SCHEMA_RESOURCE_COLUMNS.md) |
| Architecture constraints | [CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md) |

---

---

## Parts of this document

This document is split so each part stays readable on its own. The parts are canonical — this hub does not restate them.

| Part | Covers |
|---|---|
| [3-Layer UI — Folder Layout & Naming](UI_MODULE_DEVELOPER_FOLDERS.md) | Path segments, where helper logic lives, resource-private sub-components, field control and whole-page overrides. |
| [3-Layer UI — The 10-Tier Lookup & Layer Boundary](UI_MODULE_DEVELOPER_LOOKUP.md) | Choosing a tier, two-step resolution, Vue override vs JS modifier, and correct business-logic placement. |
| [3-Layer UI — Page Contracts, Imports & Reactivity](UI_MODULE_DEVELOPER_CONTRACTS.md) | Page contracts and `Props<Identity>`, the strict import boundaries, reactivity rules and the prop-drilling chain. |
| [3-Layer UI — Content, Lists & the View Blueprint](UI_MODULE_DEVELOPER_LISTS.md) | Per-view list overrides, row presentation and ordering, row action clusters, and the View card blueprint. |
| [3-Layer UI — The Index Page & Operational Metrics](UI_MODULE_DEVELOPER_INDEX_PAGE.md) | The 4-stage Index hierarchy, the widgets, the work-queue switcher and dynamic lists. |
| [3-Layer UI — Actions, Dispatch, Handlers & FABs](UI_MODULE_DEVELOPER_ACTIONS.md) | The common action overrides, the handler contract, permission gates and cross-resource chains. |
| [3-Layer UI — Form Architecture](UI_MODULE_DEVELOPER_FORM_ARCH.md) | Choosing a form shape, what the form-fields composable derives, shared Add/Edit cards, record vs control fields, and wizard navigation. |
| [3-Layer UI — Visual Design Contract](UI_MODULE_DEVELOPER_VISUAL.md) | Card shells, row grammar, spacing, motion and quiet states. |




### Where each section lives

Section numbers are unchanged, so an existing `§N` reference still resolves — find it here.

| § | Section | File |
|---|---|---|
| §8 | Actions — Dispatch, Handlers & FABs | [UI_MODULE_DEVELOPER_ACTIONS.md](UI_MODULE_DEVELOPER_ACTIONS.md) |
| §5 | Page Contracts — `Props<Identity>` Targeted Props | [UI_MODULE_DEVELOPER_CONTRACTS.md](UI_MODULE_DEVELOPER_CONTRACTS.md) |
| §6 | Strict Import Boundaries | [UI_MODULE_DEVELOPER_CONTRACTS.md](UI_MODULE_DEVELOPER_CONTRACTS.md) |
| §11 | Reactivity Contracts | [UI_MODULE_DEVELOPER_CONTRACTS.md](UI_MODULE_DEVELOPER_CONTRACTS.md) |
| §12 | Prop Drilling Chain & Sub-Component Attribute Handling | [UI_MODULE_DEVELOPER_CONTRACTS.md](UI_MODULE_DEVELOPER_CONTRACTS.md) |
| §2 | Folder Layout & Naming | [UI_MODULE_DEVELOPER_FOLDERS.md](UI_MODULE_DEVELOPER_FOLDERS.md) |
| §13 | Form Architecture | [UI_MODULE_DEVELOPER_FORM_ARCH.md](UI_MODULE_DEVELOPER_FORM_ARCH.md) |
| §9 | Index Page & Operational Metrics | [UI_MODULE_DEVELOPER_INDEX_PAGE.md](UI_MODULE_DEVELOPER_INDEX_PAGE.md) |
| §7 | Content — Lists, Rows, and the View Blueprint | [UI_MODULE_DEVELOPER_LISTS.md](UI_MODULE_DEVELOPER_LISTS.md) |
| §3 | The 10-Tier Lookup | [UI_MODULE_DEVELOPER_LOOKUP.md](UI_MODULE_DEVELOPER_LOOKUP.md) |
| §4 | Correct Business Logic Placement — The 3-Layer UI Boundary | [UI_MODULE_DEVELOPER_LOOKUP.md](UI_MODULE_DEVELOPER_LOOKUP.md) |
| §10 | Visual Design Contract | [UI_MODULE_DEVELOPER_VISUAL.md](UI_MODULE_DEVELOPER_VISUAL.md) |

## 0. Build to the Workflow

> [!IMPORTANT]
> A module's shape is decided entirely by its business workflow instructions. This guide
> supplies every piece needed to build any resource UI module correctly; which pieces a
> given module actually uses depends on what that module's workflow calls for.

A flat toggle workflow needs a single-view form, a generic View grid, and one domain
composable. A multi-step, multi-actor workflow needs a wizard, action routes, several
stateful composables, and business-concept View cards. Both are produced by following this
guide against the workflow at hand. Apply the sections a module's workflow actually calls
for; skip the machinery it has no use for (a flat-toggle resource has no wizard step, so
§13.6 simply doesn't apply to it) — never build in complexity the workflow didn't ask for,
and never omit complexity it did ask for.

A module that starts out flat and later grows a second workflow branch, an approval step,
or a business-concept View card is not "upgrading tiers" — it is following the same guide
against its resource's now-larger workflow.

---

## 1. The Model in One Picture

Every resource page is assembled at runtime from **placeholders**. A placeholder is a
generic component that is told *what* it stands for and resolves *which* component
actually renders through a registry scan.

```
vue-router
   │
   └─ src/pages/Page.vue ──── usePageResolver ──┬─ base page contract   src/pages/{Scope}/{page}.js
                                                └─ page override scan   _ui/{Ui}/pages/…            (§2.5)
        │
        ├─ <ResourceBreadcrumb />                       always, never overridable via _ui
        │
        ├─ .aql-page-body
        │     ├─ <Section section="PageHeader"  v-bind="pageProps" />   → useSectionResolver
        │     ├─ <Section section="…"           v-bind="pageProps" />
        │     └─ <AqlContentWrapper>
        │           └─ <Content content="List"  v-bind="pageProps" />   → useContentResolver
        │
        └─ <Action action="PageAction" v-bind="pageProps" />            → useActionResolver
```

Three paradigms, three resolvers, three base folders — **one shared 10-tier `_ui/`
override model** (§3):

| Paradigm | Placeholder | Identity prop | Resolver | Framework base folder |
|---|---|---|---|---|
| Section | `components/Section.vue` (`AqlSection`) | `section` | `useSectionResolver.js` | `src/components/sections/` |
| Content | `components/Content.vue` (`AqlContent`) | `content` | `useContentResolver.js` | `src/components/contents/` |
| Action | `components/Action.vue` (`AqlAction`) | `action` | `useActionResolver.js` | `src/components/actions/` |

A file's **folder is its resolution contract**. A section placed in `actions/` resolves as
nothing. Never cross them.

---

## 14. Generation Checklist

Run this per new module. Each step cites the section that governs it.

1. **Read the workflow instructions for this module** (§0) — build exactly what they call
   for; do not default to a preset shape.
2. **Confirm the UI has a `_config/`** — `_ui/{Ui}/_config/config.js` + `config.md` exist
   before the first component (§10.3).
3. **Scaffold Layer 2** — `src/_resource/{Scope}/{Resource}/composables/use{Feature}.js`
   with the workflow vocabulary, its label/colour/icon functions, and the state predicates
   (§4.2, §4.4, §4.5). No Vue context.
4. **Scaffold the injection-relay UI Composable per page** —
   `_ui/{Ui}/composables/{Scope}/{Resource}/{Page}/use{Resource}Context.js` (§6.2).
5. **Build the Index page** — page header + whichever widgets the workflow's queues actually
   call for, ordered by urgency (§9.2); switcher gating (§9.3); work queues as
   `List<ViewName>` content (§7.1); no hand-written list resolvers before checking the list
   strategy's defaults (§9.4); row action clusters capped and state-keyed (§7.3).
6. **Build Add/Edit** — pick the form shape (§13.0); for a generated form let `_fields`
   generate the set (§13.1) and narrow only via `fields`/`showFields`/`hideFields`/
   `fieldProps` (§13.3); share cards between Add and Edit at the resource tier (§13.4);
   route intent through control fields and stamps through the handler (§13.5); wire
   `PageAction.js` if multi-step (§13.6).
7. **Build View** — start with the generic grid + `ViewColumn<Col>`; upgrade to
   business-concept cards only if §7.4's checklist says so, and give each the authoring
   contract in §7.5.
8. **Build any action route** — contract with an explicit title and `reload: false`, cards
   at the tier their reuse demands, hydration in the first content (§5.5); sticky bar owns
   navigation and submission (§8.2–§8.4).
9. **Apply the visual contract** — the UI's `cardClass` (§10.1), `gutter` for vertical and a
   declared `padding` for horizontal (§10.2), all three quiet states (§10.4), no hardcoded
   tokens (§10.3).
10. **Verify the import chain** — every `.vue` imports only UI Composables (§6.1); every UI
    Composable imports only Resource Composables + generic Core Composables; every Resource
    Composable imports only generic Core Composables. Zero store/service imports outside
    Layer 1.
11. **Verify leaf-only `inheritAttrs: false`** on any new nested component chain (§12.1).
12. Run `gitnexus_detect_changes()` before committing.

---

## 15. Troubleshooting

| Symptom | Cause |
|---|---|
| "Section / Content / Action Not Defined" card | No base and no `.vue` candidate. Check the folder is PascalCase with **no hyphens**, and that the file sits in the folder matching its paradigm (§2.1). |
| Override file ignored entirely | A `.vue` exists at the same tier — it wins and the `.js` is never read (§3). |
| A stray object value in the DOM (e.g. `[object Object]` on an attribute) | Missing `inheritAttrs: false` on the leaf component in a drill path (§12.1). |
| A modifier's value never updates | It was computed eagerly inside the modifier. Return a function-valued prop instead (§3.3). |
| A widget is permanently empty for a user who should see it | A permission read taken outside the `items` closure latched `false` before auth landed (§9.2). |
| The wizard's buttons never change past step 1 | `actions` was declared as a literal array instead of a getter (§11 rule 4). |
| A submit succeeds but shows no toast | The handler returned `successMessage`; a handler returns `successMsg` (§8.2). |
| An action button is silently always disabled | An `allowed()` map used an all-caps action name, which resolves to a key that can never match (§8.4). |
| Cancel leaves the user two history entries back | The handler navigated but didn't `return false`, so the built-in `goBack()` also ran (§8.2). |
| A relation reference is `undefined` in a list row | A record was spread somewhere upstream (§11 rule 1). |
| A predicate throws on a freshly created child row | An enriched relation carried `null`; normalize before the guard (§11 rule 2). |
| Per-view override never fires | The sheet's view `name` includes the `List` prefix. Use the bare bucket name (§7.1). |
| A per-view `.vue` override renders an empty list | It read only `props.items` and the rows arrived on `attrs` (§7.1). |
| A `Props<Identity>` block's `items`/`chip` is `undefined` inside the block function | The block was written as a static object. Only a **function** block is called with the live props bag (§5.2). |
| A `String` prop receives a closure | A function was put on one key instead of making the whole block a function (§5.2). |
| Page title/back arrow vanished after adding a section | `sections` replaces the base contract's array. Re-list the page header (§5). |
| A shared card is invisible on the Edit page | It gated on `currentStep === 2`; a single-view page never leaves step 1. Use the `step` prop (§13.6). |
| Form re-seeds defaults on every keystroke | Props allocated inline in the template (§11 rule 5). |
| A blank gap sits where a conditional card should be | The card used `v-show`; a section that renders nothing must `v-if` at its root (§10.4). |
| Two View cards showing different numbers for the same data | Both re-derived the grouped tree independently instead of sharing one UI Composable (§7.4). |
| A funnel segment and a row chip disagree about a state's colour | One of them picked its own colour instead of reading the resource's workflow vocabulary (§4.5). |
| An Index metric changes when the user switches list view | It counted `filteredRecords` instead of `records` (§9.2). |
| A user lands on an empty list with no pill highlighted | The default view was gated away and the active view was never corrected (§9.3). |
| A widget shows a wall of zeroes on a fresh tenant | It zero-filled instead of returning `[]` (§9.2). |
| A money widget shows a wall of `AED 0.00` on a fresh tenant | Its hide guard tested row `.length` instead of the amounts the cards print (§9.2 rule 2). |
| Row buttons push the record name into a multi-line wrap | The cluster exceeded three buttons (§7.3). |
| A UI Composable importing a store directly | Violates §6.1 — relay through a generic Core Composable instead. |
| A `.vue` component calling `inject()` directly | Violates §6.2 — move the injection into that resource's context composable. |
| Domain predicate duplicated across two `_ui/{Ui}/` trees for the same resource | Business logic was left in `_ui/` instead of `src/_resource/` — extract it (§4). |
| Row/card spacing ignores the page's `gutter` | A list-like component is hardcoding `q-gutter-y-*` or `q-mb-*` instead of taking the `gutter` token (§10.2). |
| A card looks subtly different from its neighbours | It hardcoded a shell class instead of reading the UI's `cardClass` (§10.1). |
| A manually mounted `_fields` control ignores its label or test hook | The value was passed as an attribute; `_fields` controls set `inheritAttrs: false` and read `config` ([`_fields/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/REGISTRY.md)). |
| A field type gains an alias or a prepared-props branch and one control doesn't follow it | That control deep-imports `_fields/{type}/Add.vue` instead of calling `resolveFieldComponent` (§2.4). |
| Cards in a grouped list sit at a different rhythm from the rest of the page | Spacing was put in `card-class`; it is appearance only, and spacing goes through the list's `gutter` prop (§10.1). |
| A control's tap size stops matching the rest of the UI after a token change | It hardcoded `min-width`/`min-height` instead of binding `tapTargetStyle` (§10.5). |
| Two cards on one page both carry an accent tint | Only the leading card that asks for an action may (§7.4). |
| A widget's colour for a state disagrees with the row chip beside it | The widget's `items` payload named its own colour instead of reading the vocabulary (§4.5). |
| A row shows a raw user code like `U0001` | A `*By` stamp holding a code was surfaced in a label/caption (§7.2). |
| A preset's suppressed slot renders anyway | The key was omitted rather than set to explicit `null`, so §9.4's inference filled it (§7.2). |

---

## Maintenance Rule

> [!IMPORTANT]
> Any change to the resolver model, the page-contract conventions, the Index widget rules,
> the form-shape decision, the View blueprint, or the visual contract MUST be reflected in:
> 1. This document.
> 2. [resource_ui_module_developer.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/resource_ui_module_developer.md) — its condensed checklist must stay in sync with §14 above; this is the one deliberate duplication in this guide's ecosystem.
> 3. [CORE_DOC_ROUTING.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_DOC_ROUTING.md) if the routing rule for resource-UI-module generation changes.
> 4. [AGENTS.md](file:///f:/LITTLE%20LEAP/AQL/AGENTS.md) if the Query Classification or Initialization Prompt Routing entries change.
>
> Ownership of the three catalogues this guide links rather than restates:
> - A `_fields` type, or the manual field-mounting contract →
>   [`_fields/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_fields/REGISTRY.md).
> - A reusable Section/Content/app component, its props or its hide rule →
>   [`components/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md).
> - A UI's design tokens and their rationale → that UI's `_ui/{Ui}/_config/config.md`.
>
> A change to the three-layer boundary, the strict import chain, or the injection-relay
> pattern is owned by
> [UI_RESOURCE_DOMAIN_LOGIC.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_RESOURCE_DOMAIN_LOGIC.md) —
> update it first, then sync this document's §4/§6 summaries to match.