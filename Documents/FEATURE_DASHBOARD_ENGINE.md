# Dashboard Engine

> Canonical guide for the sheet-driven dashboard engine.
> Replaces `FEATURE_DASHBOARD_GUIDE.md` and `FEATURE_DASHBOARD_WIDGETS.md`.

---

## §0 — Words and short forms

Here are the words we use. We explain each one before we use it anywhere else:

- **The Dashboard column**: The column named `Dashboard` in the `App.Resources` Google Sheet. It holds a list of items for each resource.
- **A dashboard item**: One item inside that cell list. It picks which widget to show, who can see it, and how it looks. We also call this **the sheet item**.
- **The data layer**: The JavaScript files that read rows and turn them into numbers.
- **An item descriptor**: One file inside `_resource/<Scope>/<Resource>/Data/`. It does the maths for one item. We also call this **the descriptor**.
- **A tile**: One card on the dashboard screen.
- **A widget**: The small visual component inside a tile that draws the pictures, bars, lines, or numbers.
- **The page contract**: The rules in `FRONTENT/src/pages/Dashboard/dashboard.js` that set the grid columns, gaps, and row heights.
- **The item key**: The unique ID of a tile, written as `resource::name`.

Here are the short forms used in this document:

| Short form | What it means |
|---|---|
| **ARD** | The `App.Resources` `Dashboard` sheet column. |
| **DBD** | The data layer — the descriptor files under `_resource/<Scope>/<Resource>/Data/`. |


**Short forms belong to this document only. They must NEVER appear in code, in a file name, in a folder name, or in a variable name. If you find one in the codebase, it is a bug — rename it.**

---

## §1 — The shape in one picture

```
+---------------------------+       +---------------------------+       +---------------------------+
|    ARD (Sheet Column)     | ----> |     DBD (Data Layer)      | ----> |     Tile on the Page      |
|  App.Resources.Dashboard  |       |   _resource/.../Data/     |       |        Widget.vue         |
+---------------------------+       +---------------------------+       +---------------------------+
```

Here is what each box owns:

- **ARD** picks WHICH items appear and how they LOOK.
- **DBD** says what each item MEANS and produces its DATA.
- **The tile** puts the two together and draws the widget.

**The sheet gives look props. The data layer gives data props. They never mix.**

---

## §2 — ARD, the Dashboard column

### Where it lives and how it travels

1. It lives in the Google Sheet named `App.Resources`. Each resource has one row. The column is named `Dashboard`.
2. The column is created in [setupAppSheets.gs:54](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L54).
3. The server reads the cell and turns it into JSON at [resourceRegistry.gs:227](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceRegistry.gs#L227) and [resourceRegistry.gs:1240](file:///f:/LITTLE%20LEAP/AQL/GAS/resourceRegistry.gs#L1240).
4. It arrives in the app inside the login data as `cfg.ui.dashboard`.

### The full key table for a sheet item

Each cell holds a JSON array of objects. Here are all the keys an object can have:

| Key | Type | Default | What it does |
|---|---|---|---|
| `name` | String | (Required) | The tile key. It must be unique inside that resource. It is also the name an override file uses. |
| `source` | String | `name` | The name of the data descriptor to read. Set this when two tiles share one descriptor. |
| `widget` | String | (Required) | The widget to draw. If missing, the engine skips the tile. |
| `permission` | String, Array, Object, Boolean | Shown to all | Who may see this tile. Decides who sees it, what tables to load, and the score. |
| `size` | Object | 12 on all screens | Width in columns for each screen size (`xs`, `sm`, `md`, `lg`, `xl`). |
| `active` | Boolean | `true` | Set to `false` to turn the tile off completely. The engine drops it before scoring. |
| `multiplier` | Number | `1` | A number from `0` to `2`. Multiplies the score to move the tile up or down. `0` turns the tile off. Numbers over `2` are cut to `2`. |
| `auth` | Boolean | `false` | Set to `true` when the tile is about the logged-in user's own work. |
| `users` | Boolean | `false` | Set to `true` when the tile shows numbers per person. |
| `props` | Object | `{}` | Visual look props sent straight to the widget. For example: `color` or `emptyText`. |
| `title` | String | `''` | Fixed card title from the sheet. If the descriptor computes a title, the descriptor wins. |
| `subtitle` | String | `''` | Small text under the title. |
| `caption` | String | `''` | Small text in the footer of the card. |

There is **no `empty` key** and **no colour key** on the sheet item. Colour is a role (such as `'primary'` or `'warning'`), never a hex code. A tile always renders, so an `empty` key is not needed.

### A real live cell: OutletRestocks

Here is the live four-item list for `OutletRestocks`:

```json
[
  {
    "name": "awaitingApproval",
    "widget": "MetricDelta",
    "permission": { "OutletRestocks": "Approve" },
    "size": { "xs": 12, "sm": 6, "md": 3 },
    "auth": false,
    "users": false,
    "title": "Waiting for approval",
    "caption": "Sitting in PENDING_APPROVAL"
  },
  {
    "name": "progressMix",
    "widget": "RingDonut",
    "permission": { "OutletRestocks": "Read" },
    "size": { "xs": 12, "md": 4 }
  },
  {
    "name": "topSkus",
    "widget": "TopProductsList",
    "permission": { "OutletRestocks": "Read", "OutletRestockItems": true },
    "size": { "xs": 12, "md": 4 },
    "props": { "color": "secondary" }
  },
  {
    "name": "restocksPerDay",
    "widget": "DailySalesLine",
    "permission": { "OutletRestocks": "Read" },
    "size": { "xs": 12, "md": 8 },
    "multiplier": 1.5
  }
]
```

### The join

**The join is `source`, falling back to `name`.** So many sheet items can share one descriptor. `name` is also the key a `_ui` override file is named after. Look at [DashboardIndex.vue:242](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/Dashboard/DashboardIndex.vue#L242).

---

## §3 — DBD, the data layer

### The folder tree

Here is the real folder tree for `OutletRestocks`:

```
FRONTENT/src/_resource/Operation/OutletRestocks/
├── Data/
│   ├── _shared.js
│   ├── approvalFunnel.js
│   ├── approvalWaitAgeing.js
│   ├── approvedNotDelivered.js
│   ├── awaitingApproval.js
│   ├── hoursToApprove.js
│   ├── last24Hours.js
│   ├── myDrafts.js
│   ├── progressMix.js
│   ├── requestedVsDelivered.js
│   ├── restocksPerDay.js
│   ├── topOutlets.js
│   └── topSkus.js
└── Dashboard/
    └── index.js
```

### Rule a) One file, one item

Each item descriptor lives in its own file under `Data/`. The file name is the item name. The file `topSkus.js` holds the descriptor for `topSkus`.

### Rule b) A leading underscore means a helper, not an item

A file starting with `_` is a helper, not an item. In the tree above, `_shared.js` is a helper. It holds values that two or more items must share, like `OPEN_FOR_DELIVERY` and `AGE_BUCKETS`.

This is very important. If `OPEN_FOR_DELIVERY` were written inside two different files, one file might get changed while the other is forgotten. Then the two items would disagree. Putting shared lists in `_shared.js` keeps them the same everywhere.

### Rule c) Dashboard/index.js is the assembler

Here are the nine lines of [Dashboard/index.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_resource/Operation/OutletRestocks/Dashboard/index.js):

```javascript
const modules = import.meta.glob('../Data/*.js', { eager: true })

// One file per item in ../Data. Files starting with _ are helpers, not items.
export const descriptors = Object.entries(modules)
  .filter(([path]) => !path.split('/').pop().startsWith('_'))
  .map(([, mod]) => mod.default)
  .filter((d) => d && d.name)

export default descriptors
```

Here is what it does in three sentences:
1. It reads every `.js` file in `../Data/` right away.
2. It drops any file whose name starts with an underscore `_`.
3. It keeps all exports that have a `name`.

**Adding an item is one new file. There is nothing to register.**

### The descriptor keys

| Key | Type | Required | What it does |
|---|---|---|---|
| `name` | String | **Yes** | The item name. Must match sheet `source` or `name`. |
| `title` | String | No | Default card title. The sheet can override this. |
| `subtitle` | String | No | Default subtitle text under the title. |
| `caption` | String | No | Default footer text at the bottom of the card. |
| `controls` | Array | No | Small input settings on the card. List of `{ name, type, value }`. |
| `options` | Function | No | A function `options(ctx)` that gives choices for select controls. |
| `compute` | Function | **Yes** | A function `compute(ctx)` that works out the numbers and returns data props or `null`. |

**A descriptor is DATA ONLY. No permission. No resource list. No size. No colour. Those all live on the sheet item.**

---

## §4 — The JSDoc block on every descriptor

### The reason and the rule

There is no registry and no index anywhere that says what a dashboard item is for. The file is the only place that can say it. So the block is required.

The block is written FOR A PERSON. An AI can read code and work out what it does. But a person opening the file cold cannot. The block tells that person what the item is, why it is here, and what it reads.

### The shape to follow

```javascript
/**
 * Short description — what this item does in one line.
 *
 * Answers: the question it answers on the dashboard?
 *
 * How the calculation works, rules used, and edge cases.
 *
 * Reads    Resource: Field1, Field2
 * Returns  what compute returns
 * Controls what controls exist, or none
 * Empty    returns null when ...
 */
```

### Real example: topSkus.js

Here is the exact block from [topSkus.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_resource/Operation/OutletRestocks/Data/topSkus.js):

```javascript
/**
 * Most restocked SKUs — the five items moving in the largest quantity.
 *
 * Answers: what are we actually shifting the most of?
 *
 * Quantity lives ONLY on the child rows, OutletRestockItems. The parent row has
 * none. Cancelled lines are dropped first by `liveLines` in `_shared.js`, so
 * both allocated and delivered quantity are counted, and abandoned lines are
 * not.
 *
 * Reads    OutletRestockItems: SKU, Quantity, Progress
 * Returns  items = top 5 SKUs, with a label and a total quantity
 * Controls none
 * Empty    returns null when there are no live lines
 */
```

Never delete one of these blocks. Never shorten one. This is a strict rule in [AGENTS.md](file:///f:/LITTLE%20LEAP/AQL/AGENTS.md) and [CLAUDE.md](file:///f:/LITTLE%20LEAP/AQL/CLAUDE.md).

---

## §5 — ctx, the toolbox

`ctx` is a small box of helpers handed to every `compute`, so no descriptor ever touches a store, and no two descriptors count days two different ways.

It is built in [useDashboardContext.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/dashboard/useDashboardContext.js).

### Full helper table

| Helper | What it gives back |
|---|---|
| `rows(resource)` | Returns all rows for that resource from the data store. |
| `controls` | Plain object holding the current values of the tile controls. |
| `user` | The logged-in user object from the auth store. |
| `userName` | The readable name of the user, such as "Firose Hussain". |
| `now` | The time right now in milliseconds (`Date.now()`). |
| `daysAgo(n)` | The start of the day `n` days ago, in milliseconds. |
| `daysSince(value)` | How many days have passed between `value` and now, as a number. |
| `hoursBetween(from, to)` | How many hours have passed between two dates, as a number. |
| `inRange(value, range)` | `true` if the date falls inside the given date range. |
| `rangeLabel(range)` | A clean word for the range, like `'last 30 days'` or `'today'`. |
| `countBy(list, field)` | A Map counting how many times each value appears in that field. |
| `sumBy(list, field, valueField)` | A Map summing `valueField` grouped by `field`. |
| `topN(map, n, labelFn)` | An array of the top `n` items sorted by highest value first. |
| `mean(numbers)` | The average of a list of numbers, or `null` if the list is empty. |
| `countAt(resource, range, predicate)` | The number of rows in that range that pass an optional test. |
| `nameOf(resource, code)` | Looks up a readable Name for a given Code in that resource table. |
| `progressOptions(resource)` | All unique Progress values in that table, shaped as `{ label, value }`. |

### Date range words

| Word token | What it covers |
|---|---|
| `$today` | Start of today to right now. |
| `$thisMonth` | Start of the current month to right now. |
| `$lastMonth` | Start of last month to start of this month. |
| `$last7Days` | Start of day 7 days ago to right now. |
| `$last30Days` | Start of day 30 days ago to right now. |
| `$last90Days` | Start of day 90 days ago to right now. |

**They are the same words utils/tokenEvaluator.js uses for list view filters. A dashboard item and a list filter must never mean two different things by $last30Days.**

A range can also be a plain pair of dates: `[from, to]`.

---

## §6 — Controls

A reader must not walk away thinking controls work. They do not.

Here is the honest truth about controls today:

| Step | What happens | Status | Where in code |
|---|---|---|---|
| 1. Descriptor declares controls with defaults | The descriptor writes `controls: [{ name, type, value }]` | **WORKS** | [topOutlets.js:5-8](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_resource/Operation/OutletRestocks/Data/topOutlets.js#L5-L8) |
| 2. Page reads defaults into an object | The page turns that list into key-value pairs | **WORKS** | [DashboardIndex.vue:189-191](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/Dashboard/DashboardIndex.vue#L189-L191) |
| 3. They reach compute as `ctx.controls` | The helper box hands them into `compute` | **WORKS** | [useDashboardContext.js:108](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/dashboard/useDashboardContext.js#L108) |
| 4. Tile draws an input the user can change | Tile draws read-only chip. No input, no `v-model`, no emit | **MISSING** | [Widget.vue:13-17](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/Widget.vue#L13-L17) |
| 5. Changing one re-runs that tile's compute | Re-running only one tile | **MISSING** | Nothing does this |

**So today ctx.controls always holds the default written in the descriptor. A control is a promise in the shape of the data, not a working knob.**

**`options` is dead code today.** `topOutlets` declares `options(ctx)` to feed the select dropdown. Nothing calls it. It was written for step 4, which was never built.

### Why it stopped

`compute` runs in the PAGE at [DashboardIndex.vue:192](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/Dashboard/DashboardIndex.vue#L192), not inside the tile. So one tile cannot re-run only its own compute.

Finishing controls means moving `compute` into the tile first. That work is listed in §12 of this document.

Until steps 4 and 5 exist, prefer an item with no controls. Do not add controls to a new item expecting them to work.

---

## §7 — Score, cutoff and sort

Every tile gets a score. The page sorts tiles by this score so the most important cards sit at the top.

### The formula

```
Score = (Σ permission weight × scope weight + user score) × multiplier
```

See [useDashboardScore.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/dashboard/useDashboardScore.js).

### Verb weights

| Verb | Weight |
|---|---|
| `true` (resource assigned, no action needed) | 1.0 |
| `Read` | 1.5 |
| `Delete` | 1.5 |
| `Update` | 2.0 |
| `Create` | 3.0 |
| `Write` | 3.0 |
| Any other action | 2.5 |

A prefix of `can` is stripped first. So `canRead` counts as `Read`.
When an item lists multiple actions (like `['Read', 'Approve']`), it takes the **biggest** verb weight, not the sum.

### Scope weights

| Scope | Weight |
|---|---|
| `master` | 1.0 |
| `operation` | 2.0 |
| `accounts` | 2.5 |

### Child tables

A table with a `parentResource` skips the scope and verb table. It adds a flat **0.75**. So a named child adds only a little. It can never outweigh the parent resource it belongs to. This is why `topSkus` scores 3.75 and leads, while the three tiles that name no child tie at 3.

### User bonuses

- `auth: true` adds **+3**.
- `users: true` adds **+5**.

Why `users` outweighs `auth`: The main dashboard is for comparing people and trends across the company. A person's own work belongs on the resource Index page instead.

### Multiplier

- If missing, it defaults to `1`.
- If `0` or less, the tile is dropped.
- Any value over `2` is cut down to `2`.

### Cutoff

The cutoff score is read from `auth.dashboardScoreCutoff` in [DashboardIndex.vue:170](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/Dashboard/DashboardIndex.vue#L170). Any tile with a score below the cutoff is dropped. If the cutoff is `0`, all tiles stay.

### Sorting

Tiles are sorted with the highest score first ([DashboardIndex.vue:224](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/Dashboard/DashboardIndex.vue#L224)). If two tiles tie, they keep their sheet order, because JavaScript sort is stable.

### Fully worked example: topSkus

Let us calculate the score for `topSkus`:

1. Sheet item permission is:
   `{ "OutletRestocks": "Read", "OutletRestockItems": true }`
2. `OutletRestocks`:
   - Action is `Read` -> weight `1.5`.
   - Scope is `operation` -> weight `2.0`.
   - Score: `1.5 × 2.0 = 3.0`.
3. `OutletRestockItems`:
   - It is a child table (`parentResource: "OutletRestocks"`).
   - Score: flat `0.75`.
4. Sum of resource scores: `3.0 + 0.75 = 3.75`.
5. User bonuses: `auth` is false (+0), `users` is false (+0).
6. Multiplier is missing, so it is `1`.
7. Final score: `(3.75 + 0) × 1 = 3.75`.

---

## §8 — The tile and the page contract

### The page contract

The page contract is in [dashboard.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/Dashboard/dashboard.js):

```javascript
export default {
  columns: 12,
  rowUnit: 40,
  gap: 12,
  pageClass: '',
  gridClass: ''
}
```

### The height rule

A card has a row span of `H`. It covers:
```
Height = H × rowUnit + (H - 1) × gap
```
In the default contract: `H × 40 + (H - 1) × 12`.

The grid uses CSS: `grid-auto-flow: row dense`.

### The size cascade

The largest named key at or below the screen wins, and keeps applying upward.

Example: `size: { xs: 12, md: 4 }`.
- On `xs`: 12 columns wide.
- On `sm`: 12 columns wide (inherits from `xs`).
- On `md`: 4 columns wide.
- On `lg`: 4 columns wide (inherits from `md`).
- On `xl`: 4 columns wide (inherits from `md`).

### The tile's four states

In [Widget.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/Widget.vue), a tile shows one of four states:

1. **Widget Not Defined**: The `widget` name does not match any widget component file.
2. **Dashboard Item Failed**: The descriptor `compute` threw an error. Only that one tile shows an error card; the other tiles keep working fine.
3. **Dashboard Item Not Defined**: The sheet item has no matching descriptor in the data layer.
4. **The widget's own empty look**: `compute` ran fine and returned `null`. The widget draws its own empty message and icon.

**A tile ALWAYS renders. Only active: false and multiplier: 0 remove one. Zero shows as zero. A failure shows a card. The dashboard never silently drops a tile.**

---

## §9 — The _ui override structure

### The folder tree

A tenant can customize dashboard files under `FRONTENT/src/_ui/<tenant>/`:

```
FRONTENT/src/_ui/<tenant>/
├── pages/
│   ├── dashboard.js
│   └── dashboard.vue
└── components/
    ├── widgets/
    │   └── <widgetName>.vue
    └── <scope>/<resource>/
        ├── dashboard/
        │   ├── <itemName>.vue
        │   └── <itemName>.js
        └── <itemName>.js
```

### The four lookups

1. **The page contract and page component**:
   Checked at [useDashboardResolver.js:49-50](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useDashboardResolver.js#L49-L50).
   - `_ui/<tenant>/pages/dashboard.js` bends the contract (such as columns or gap).
   - `_ui/<tenant>/pages/dashboard.vue` replaces the entire dashboard page.

2. **The base widget, found by WIDGET name**:
   Checked at [useWidgetResolver.js:78-86](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useWidgetResolver.js#L78-L86).
   - First: `_ui/<tenant>/components/widgets/<widgetName>.vue`.
   - Second: `components/widgets/<widgetName>.vue`.
   The tenant file is checked FIRST. That lets a tenant replace a base widget.

3. **The widget override, found by ITEM name**:
   Checked at [useWidgetResolver.js:110-116](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useWidgetResolver.js#L110-L116). Five tiers, checked in order:
   - `_ui/<tenant>/components/<scope>/<resource>/dashboard/<name>.vue`
   - `_ui/<tenant>/components/<scope>/<resource>/<name>.vue`
   - `_ui/<tenant>/components/<scope>/dashboard/<name>.vue`
   - `_ui/<tenant>/components/<scope>/<name>.vue`
   - `_ui/<tenant>/components/<name>.vue`

4. **The descriptor override, found by ITEM name**:
   Checked at [useDashboardItem.js:19-23](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/dashboard/useDashboardItem.js#L19-L23). Three tiers, checked in order:
   - `_ui/<tenant>/components/<scope>/<resource>/dashboard/<name>.js`
   - `_ui/<tenant>/components/<scope>/<resource>/<name>.js`
   - `_ui/<tenant>/components/<scope>/dashboard/<name>.js`

### Why 5 and 3 tiers differ

A descriptor is always owned by one resource. The two loosest tiers would buy nothing for a descriptor, so they stop after the resource and scope folders.

### The merge

In [useDashboardItem.js:44-56](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/dashboard/useDashboardItem.js#L44-L56), the tenant `.js` file exports a partial object. Only the keys it names replace the base keys.

`compute` is special: it is WRAPPED, not replaced. The base `compute` function arrives as `base`:

```javascript
export default {
  compute: (ctx, base) => ({ ...base(ctx), caption: 'Overridden caption' })
}
```

### Which tenant name is used

The app checks every resource in `auth.resources`. The first one with a `ui.customUIName` wins. If none has it, it uses `'AQL'`. Look at [useDashboardResolver.js:16-24](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useDashboardResolver.js#L16-L24).

### Naming clash warning

**Naming clash. The `<scope>/<resource>/<name>` tier reads the resource folder itself, which already holds files like `ResourceActionEdit.js` and `ListSwitcher.js`. Path matching is case-blind. So a dashboard item named `listSwitcher` would load `ListSwitcher.js` and treat a switcher file as a descriptor. Never give a dashboard item the same name as another file in that resource folder. Use the `Dashboard/` path when unsure.**

### Three steps to customize, easy to hard

1. Change the sheet: swap a widget or change size. No code needed.
2. Drop a `_ui` file: change words or wrap compute. Small code.
3. Write a new widget: build a brand new visual card. Real code.

---

## §10 — How to add a new dashboard item

Follow this 9-step recipe:

1. **Decide the question the tile answers.** Write it down first in simple words.
2. **Pick the widget.** Look at `FRONTENT/src/components/widgets/REGISTRY.md` to pick a preset, and `WIDGETS.md` beside it for the full detail. Check the data shape it needs (single value, items, series, or points).
3. **Create the file.** Place it at `FRONTENT/src/_resource/<Scope>/<Resource>/Data/<itemName>.js`. If the `Data/` folder does not exist, create it, and create `Dashboard/index.js` beside it with the nine assembler lines.
4. **Write the JSDoc block FIRST, before the code.** If you cannot say what the item is for in plain words, the item is not ready.
5. **Write the descriptor.** Include data keys only (`name`, `title`, `caption`, `compute`). Return `null` when there is nothing to show. Use `ctx` helpers; never import a store.
6. **Put anything shared into `_shared.js`.** If two items need the same status list, put it in `_shared.js`.
7. **Add the item to the sheet `Dashboard` cell.** Add the JSON object with `name`, `widget`, `size`, and `permission`.
8. **Check it on the page.** Count the tiles first. An empty page reports zero problems and looks like success. Check the numbers.
9. **Write the item into `GAS/syncAppResources.gs`.** Put it beside that resource's `ListViews`, so a new tenant gets the tile on setup.

### Full worked example: topSkus

Here is [topSkus.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_resource/Operation/OutletRestocks/Data/topSkus.js) complete:

```javascript
/**
 * Most restocked SKUs — the five items moving in the largest quantity.
 *
 * Answers: what are we actually shifting the most of?
 *
 * Quantity lives ONLY on the child rows, OutletRestockItems. The parent row has
 * none. Cancelled lines are dropped first by `liveLines` in `_shared.js`, so
 * both allocated and delivered quantity are counted, and abandoned lines are
 * not.
 *
 * Reads    OutletRestockItems: SKU, Quantity, Progress
 * Returns  items = top 5 SKUs, with a label and a total quantity
 * Controls none
 * Empty    returns null when there are no live lines
 */

import { liveLines } from './_shared'

export default {
  name: 'topSkus',
  title: 'Most restocked SKUs',
  caption: 'By quantity, delivered and allocated',

  compute (ctx) {
    const lines = liveLines(ctx)
    if (!lines.length) return null
    return { items: ctx.topN(ctx.sumBy(lines, 'SKU', 'Quantity'), 5) }
  }
}
```

Here is the line added to the `App.Resources` sheet cell for `OutletRestocks`:

```json
{
  "name": "topSkus",
  "widget": "TopProductsList",
  "permission": { "OutletRestocks": "Read", "OutletRestockItems": true },
  "size": { "xs": 12, "md": 4 },
  "props": { "color": "secondary" }
}
```

What the tile shows on the screen:
A `TopProductsList` card with the title "Most restocked SKUs". It shows the five SKUs with the highest total quantity, each with its name and total number.

---

## §11 — Rules that are settled. Do not reopen.

These rules are decided. Do not reopen them:

1. **Key lists for both sides**:
   - The sheet item holds look and gate keys: `name`, `source`, `widget`, `permission`, `size`, `active`, `multiplier`, `auth`, `users`, `props`, `title`, `subtitle`, `caption`.
   - The descriptor holds data keys only: `name`, `title`, `subtitle`, `caption`, `controls`, `options`, `compute`.
2. **The source join**: `source` falls back to `name`. Multiple sheet items can read from one data descriptor.
3. **A tile always renders**: Only `active: false` and `multiplier: 0` remove a tile. Zero shows as zero. Errors show as an error card.
4. **One file, one owner**: A `.vue` file replaces the widget look. A `.js` file changes the descriptor data.
5. **The size cascade**: The largest named key at or below the screen width wins, and keeps applying upward.
6. **Colour is a role**: Color is a role like `primary` or `warning`. Never a hex code. There is no tile colour key.
7. **Money formatting is not built in**: If a tenant needs currency symbols, a `_ui` override formats it.
8. **Dropped for good**: Dark mode, footer controls, saved per-user layouts, and the `empty` sheet key are permanently dropped.

---

## §12 — What is not built yet

Here are the exact things not built yet:

1. **Controls links 4 and 5**: Drawing editable input controls inside `Widget.vue`, and having user changes re-run only that tile's compute.
2. **`options` is never called**: Descriptors like `topOutlets` declare `options(ctx)` to populate dropdowns, but no code calls this function yet.
3. **Manage Dashboard sheet menu**: There is no admin menu dialog in Google Sheets to edit dashboard items. It is held on purpose because the form would need the 66 widget names and all descriptor names, which live in the Vue frontend where Apps Script cannot see them.
4. **Designation AccessRegion**: The Google Sheet column `AccessRegion` exists on Designations, and the server sends it as `auth.userDesignationAccessRegion`. But nothing in the app reads it yet.
