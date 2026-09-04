# 3-Layer UI — Content, Lists & the View Blueprint

> Part of **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**. Per-view list overrides, row presentation and ordering, row action clusters, and the View card blueprint.

---

## 7. Content — Lists, Rows, and the View Blueprint

Framework bases in `src/components/contents/` include `List.vue`, `View.vue`, `Create.vue`,
`Update.vue`, `FormRecord.vue`, `FormChild.vue`, `ViewRecord.vue`. Their full prop surfaces
are in [`components/REGISTRY.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/REGISTRY.md).
Resolution mirrors §3.

### 7.1 Per-active-view list overrides — `List<ViewName>`

When a list view is active, `contents/List.vue` sets its resolver identity to
``List${toPascalCase(activeViewName)}`` instead of plain `'List'`.

```
APP.Resources.ListViews  →  [{ "name": "Today", … }, { "name": "Overdue", … }]
                                      │
active view "Today"  ──►  content identity "ListToday"
                                      │
       _ui/{Ui}/components/{Scope}/{Resource}/Index/ListToday.vue    (Vue override)
       _ui/{Ui}/components/{Scope}/{Resource}/Index/ListToday.js     (JS modifier)
```

> [!IMPORTANT]
> The view's `name` in the sheet is the **bare bucket** (`"Today"`), not `"ListToday"`. A
> view named `"ListToday"` looks for `ListListToday` and matches nothing.

**Start with a `PropsList<ViewName>` block** (§5.3) and fall back to a file only when it
earns one — mounting a component as a prop value, or needing a template.

**A `.vue` per-view override must read rows from both places.** `items` arrives as a
declared prop from the resolver's final bag, but the override is also mounted with the
drilled attrs, and which of the two carries the rows depends on how far up the chain they
were set:

```javascript
const incoming = computed(() => (props.items?.length ? props.items : (attrs.items || [])))
```

**A view that unions two states divides, it does not tab.** When one queue is genuinely one
job to the person doing it — approved and partially-delivered are both "stock committed,
not yet at the outlet" — the list view unions them and the override restores the
distinction as a labelled divider (`SectionDividerLabel`) between two groups. Splitting
them into two pills makes the user check two lists to answer one question. When it does:

- **one consolidated empty state for the whole view**, not one per group — two "nothing here"
  cards stacked read as two failures instead of one clear queue. If one sub-list has no items,
  hide its section divider and space completely; if *all* sub-lists are empty, show a single
  clean empty-text box (`empty-text="Nothing awaiting delivery."`);
- **drop any per-row chip the divider now carries.** The divider already names the state; a
  chip repeating the heading on every row is noise. Keep what varies per row.

**The same rule applies inside a card.** A review step reporting a split outcome — what is
being committed versus what is being written off — renders two labelled lists, not one list
with a status column. A mobile row has no width to make that distinction legible, and the
two are different *kinds* of outcome (deferred work versus work that will never happen),
which a column of chips flattens into a detail.

### 7.2 List rows — presentation, ordering, and what a row says

Before writing a single resolver, check §9.4: the list strategy already infers
label/caption/chip/meta from the resource's headers and relations. Override only what the
inference gets wrong.

When a resource's queues do need presets, they follow one shape — a shared preset function
per view, exported from the resource's composable and applied as a function-valued
`Props<Identity>` block, so the same row reads identically wherever it is rendered:

```javascript
PropsListPendingApproval: (props) => awaitingApprovalPreset(props.items)
```

**Personal queue scoping vs. upline record access policies.** A personal work queue (such
as `"My Drafts"`) must filter rows down to the active `userId` (`user.value?.id`). While
`RecordAccessPolicy: OWNER_AND_UPLINE` permits managers to read subordinates' rows, drafts
are editable only by their author. Without explicit `userId` scoping, a manager's draft
queue becomes cluttered with un-editable drafts from other people.

**Queue-intent caption derivation matrix.** A row's caption should state the exact fact
explaining why the row sits in this specific queue, rather than a generic record summary:

| Work queue | Primary caption content | Secondary detail |
|---|---|---|
| **Drafts** | `Date` (creation date) | Requester's private draft context |
| **Pending Approval** | `RequestedUser` + `SubmittedComment` | Who asked and why |
| **Needs Revision** | `RevisionRequiredComment` | The reviewer's exact instructions to change |
| **Approved / In Fulfilment** | `Date` + `ApprovedBy` or `ApprovedComment` | Committed date and approver context |
| **Partially Delivered** | `Date` + `DeliveredComment` | Outstanding delivery note |
| **Delivered / History** | `Date` + `DeliveredBy` | Final completion timestamp and actor |
| **Rejected** | `RejectedComment` | Rejection rationale |

**Ordering is a work order, not a preference:**

| Queue type | Order | Why |
|---|---|---|
| Awaiting someone's action | **oldest first** | the longest wait is the most urgent |
| Settled / history | **newest first** | the most recent completion is the interesting one |

**A settled row drops the urgency chip.** A colour-coded age chip is a queue position; on a
delivered or rejected row the same age is history, and only the plain "how long ago"
caption survives. The chip's *weight* carries the same distinction one step earlier: a
queue row's age chip is **outlined** (`chipOutline: true`) so a screen of them reads as a
scale rather than a wall of solid colour, and a row that keeps a solid chip is carrying a
state, not an age.

> [!IMPORTANT]
> **A preset sets an unwanted slot to explicit `null` — it does not omit it.** §9.4's
> inference is a *baseline* that explicit props layer over, so an omitted key is not "off",
> it re-admits whatever the list strategy inferred for that resource. A preset that means
> "this row has no badge" must say so:
>
> ```javascript
> chip: (row) => ageLabel(daysSince(settledAt(row))),
> chipColor: (row) => ageColor(daysSince(settledAt(row))),
> chipOutline: true,
> meta: null, badge: null, metaLabel: null, metaCaption: null   // ✓ suppressed, not omitted
> ```
>
> This is also why a preset that *re-enables* a slot for one view passes `undefined` rather
> than deleting the key — `undefined` falls back to the base preset's own value.

**Sort and age through a resolver with a documented fallback, never a bare stamp column.**
Not every row carries every stamp (a record migrated in, or created before the stamp
existed). Sorting on the raw column sinks all of those to the end however old they are, so
the list shows "85 days" below "Yesterday" while claiming to be ordered by age. Resolve the
stamp, fall back to the record's own date, and use the *same* reader for the sort and for
the displayed age.

**Never surface an unresolved raw identifier code in a row.** Stamp columns are not uniform
about this: some `*By` columns store a display name, others store a database user code
(`U0001`). Check which before putting one in a label or caption — a raw code renders as an
opaque string nobody can read. When the stamp holds a code, prefer the fact the reader
actually needs (the reason, the age) and leave "who" to the View page, where it can be
resolved.

### 7.3 Mobile-first row action clusters

A row's `btn` slot is the one place a list becomes interactive. Six rules govern it:

**1. Mobile width constraint — maximum 3, preferred 2 buttons.** Most users navigate on
mobile devices. Each button competes with the row's own content for screen width; exceeding
3 buttons forces record labels into multi-line text wrapping and collides chips with
captions. The standard pair is **1 View navigation button + 1 primary contextual next action**.

**2. Supply the View button explicitly.** `abstract/List.vue` deliberately makes a row
non-clickable once it carries a `btn`, so a row with buttons never has an ambiguous tap
target. While correct in general, adding row action buttons turns off whole-row tap
navigation — always put an icon-only `View` button back explicitly (`icon="visibility"`).

**3. Key the cluster on the record's state, never the active view.** A modifier-mounted `btn`
component is mounted with `item` and nothing else — `useContentResolver` returns props, not
slots, so the cluster cannot be told which view it is in. That constraint produces the right
rule anyway: a record offers Approve because it is pending approval, not because the reader
happens to be looking at a particular pill, and a unioned view (§7.1) holds rows in two
states that must offer two different clusters in the same list:

```javascript
const ACTIONS_BY_PROGRESS = {
  [DRAFT]:             [],
  [PENDING_APPROVAL]:  ['Approve'],
  [APPROVED]:          ['MarkDelivered'],
  [PARTIALLY_DELIVERED]: ['Reallocate', 'MarkDelivered']
}
```

This is a **whitelist of interest, not a permission list** — `useAdditionalActions` still
decides which of them the signed-in user may see (§8.5). Everything omitted stays available
on the record's View page.

**4. Prohibit destructive and reason-requiring actions on list rows.** An inline row action
must be one tap, non-destructive, and either navigate or commit something trivially
reversible. Therefore:
- an action needing a **written reason** (reject, request revision) belongs on the record or
  action page, not one tap from a scrolling list;
- a **destructive** action (cancel, delete) is never placed on a row;
- an action where the user **must inspect items first** (submit, resubmit) is off the row
  — the button that opens the review form (Edit) is the one that belongs there.

**5. Inline Edit buttons require state and ownership gates.** Inline Edit is a CRUD route
dispatched locally. It must fail closed on missing IDs, verifying both state eligibility
and strict ownership (`CreatedBy === user.value?.id`).

**6. Dispatch CRUD yourself, delegate workflow.** Edit and View are CRUD routes: the cluster
navigates them directly. Everything else is a workflow action and goes through
`AdditionalActionsButtons`, which owns eligibility. Render them as loose siblings at one
visual scale, never in a `q-btn-group` — see [`_config/config.md` §3.5](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_ui/AQL/_config/config.md).

### 7.4 The View Blueprint — Business-Concept Card Grouping

`contents/ViewRecord.vue` — a generic key-value grid over every header, extensible per
column via `ViewColumn<Col>` — is the right default for a simple, mostly-flat resource. It
stops being the right tool the moment a resource's data has real relational shape: line
items, allocations, a workflow history. Forcing that shape into a flat key-value grid reads
as a data dump instead of a summary.

The alternative: **replace `ViewRecord` outright with custom cards, one per business
concept**, using the base-promotion path (§3.2 step 1.3).

**Applying the blueprint to a new module:**

1. Does the resource have line items, allocations, multi-step workflow, or more than one
   *kind* of related fact (not just more columns)? If not, stay on `ViewRecord` +
   `ViewColumn<Col>` overrides — less code, stays in sync with the schema automatically.
2. If yes, name one card per business concept the record represents. Do not create a card
   that is just "the rest of the columns."
3. Back every card with one page-scoped UI Composable (§6.2), never per-card ad-hoc
   computeds.
4. Build every card on the shared shell (§10.1) and the authoring contract in §7.5.

**Canonical View Card Stacking Order:**

```
1. Action Request Banner   (RevisionRequiredBanner — instruction, only rendered when action is needed)
2. Parent Identity Card    (RestockHeader — who, what, when, current state)
3. Content Summary Card    (Items — what was requested / entered)
4. Operational Breakdown   (AllocationDetails — source bins, where stock is coming from / going)
5. Workflow History Card   (Workflow — chronological timeline of actual events)
```

**One composable, so cards cannot disagree.** All cards inject the same page-scoped UI
Composable, which calls the resource's domain composable (§4) for any derived state, and
read *projections* of one derived tree rather than each re-deriving grouping logic. Two
cards reading the identical derived structure means "what was requested" and "where it's
coming from" can never drift apart on screen.

Four rules the recurring cards each carry:

- **The identity card drops blank rows rather than padding them with em dashes.** A
  detail card reads better short, and a `Note: —` row states nothing while looking like it
  does. The two facts that *identify* the record are shown even when unresolved.
- **The disposition card morphs by phase and explains empty phases.** Before a workflow
  commits anything, there is no source behind any line — the card states each line's position
  and says, in one banner ("Stock is allocated once approved"), when the source will exist.
  After approval, it swaps to detailed warehouse and storage bin rows. The phase test is a
  domain predicate, never a raw `Progress` comparison written in the card.
- **The history timeline is chronological event history, not a checklist.** Order by the
  recorded timestamp (`...At`), not by canonical state order, so a record that went out for
  revision and came back reads in the order it actually happened. Stages never reached are
  **absent, not greyed out.** Which column holds which stamp is a map in the page composable,
  because a stamp prefix and its resulting state genuinely differ (submitting stamps
  `ProgressSubmitted*` but moves the record to `PENDING_APPROVAL`).
- **Pass container gutter tokens to nested section cards.** Compound cards that render
  internal product cards must accept `gutter` from `pageProps.gutter` and space their
  internal children consistently with the outer page rhythm (§5.2).

**Where View cards go in the contract.** A business-concept card set is declared in
`sections`, with `contents: []` — the second named exception to §9.1's
sections-are-not-record-dependent rule, alongside header-adjacent metrics. The trade is
explicit: `sections` render outside `<AqlContentWrapper>`, so **each card self-guards its
own loading, empty and missing-record states** (§10.4) instead of inheriting the wrapper's.
That is why the shared page composable exposes `pending` — every card reads it.

**Order the stack by what the reader must do.** A card that asks for an action leads; cards
that report one follow. A card that renders nothing in most states costs nothing at the top
(§10.4's `v-if` rule), and putting the one instruction on the page below three summaries
buries it.

**That leading card is the one place a page may break the neutral shell.** Exactly one card
per page may carry the UI's accent tint and rail (`accentCardClass` / `accentBorderStyle`,
§10.3), and only the one that asks for an action rather than reporting one — the page is
otherwise uniformly neutral, which is what makes the colour mean something. Two accented
cards on one page means neither is emphasised, and an accented card that merely *reports*
spends the page's only emphasis on a statement. It still uses the standard row grammar and
stagger; only the tint differs, so it reads as emphasis rather than as a differently-built
card.

### 7.5 Custom card authoring contract

Every custom Section/Content card a module adds exposes the same surface, so a later tier
can retitle, retint or re-feed it without a `.vue` override:

```javascript
const props = defineProps({
  // Function-capable, resolved through evaluateProp — a modifier may make it
  // read off the record.
  title:   { type: [String, Function], default: 'Allocation Details' },
  // The tree to render. Defaults to the composable's own projection; supplied
  // only when a caller renders this card against something else.
  items:   { type: Array,  default: null },
  // Horizontal inset (§10.2). Vertical rhythm is the container's.
  padding: { type: String, default: 'sm' },
  // Rhythm BETWEEN this card's own children, when it renders several.
  gutter:  { type: String, default: 'xs' },

  // ── Optional, only when the card needs them ──────────────────────────────
  // The record to render against. Defaults to the injected one; supplied when a
  // caller renders this card for something other than the page's own record.
  record:  { type: Object, default: null },
  // Overrides a state-derived tint. Function-capable: (record, config) => 'positive'.
  color:   { type: [String, Function], default: null }
})
```

Those six are the whole surface. A card needing something outside it is either doing two
jobs or reaching for state its composable should be handing it — check both before adding a
seventh prop.

- **Heading**: `SectionDividerLabel` with the resolved title, so a stack of cards is
  scannable by heading alone.
- **`items` defaulting to `null`, not `[]`**: `null` means "use my own projection", `[]`
  means "a caller handed me nothing" — collapsing them makes the card un-narrowable.
- A card that renders **siblings inside itself** takes `gutter` explicitly from the page
  contract, because `.aql-page-body`'s gutter reaches the *section*, never its children.

**One step is not one card. Scope decides the split:** a control acting on **every row** on
the page gets its own card above them; a control acting on **one row** lives in that row's
card. A select-all, an auto-fill, a running "N of M" total and the setting that determines
what the rows even contain each act on the whole set, so each sits in a card of its own,
ahead of the list — putting them inside the first item's card says they belong to that item.
A step legitimately renders three cards when it asks three differently-scoped questions.

### 7.6 Form and field overrides

Within `Create`/`Update`, three further hierarchies resolve **only** under `_ui/` (no
framework fallback): `FormChild<ChildName>` (one child block), `FormRecord` (the primary
form), `FormField<Header>` (one column's control).

Field **visibility** follows a strict precedence chain — `showFields` > `hideFields` >
`workflowFields` — and `fields` fixes both the set and the order (§13.3).

---


---

⬑ Back to **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**.
