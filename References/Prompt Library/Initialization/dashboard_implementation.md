# Dashboard Items — Create, Change, Customize

## Scope boundary

This prompt is the one place to start for ANY dashboard item work:
- create one item, many items for one resource, or items for a whole topic that spans resources
- change an existing item
- change how an item looks for a tenant (`_ui` customization)

It does NOT cover:
- Building or changing a reusable widget base under `FRONTENT/src/components/widgets/abstract/`. For that, see [CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/CONTRACT.md). Adding a preset is covered here, in step 6.
- Summary cards on a resource's own Index page. Those belong to the resource UI module system.
- The engine itself (resolver, packing, motion). If you change the engine, see the Maintenance rule at the end.

Everything you need is in this file. Open the canonical docs only when this file sends you there.

---

## 1. What an item is

What the user sees on the dashboard is **one item**. It is built in layers, like boxes inside boxes:

```
Dashboard page ─> Tile ─> Frame ─> Widget ─> Base (+ Preset)
```

| Layer | File | Its job |
|---|---|---|
| **Widget** | `components/widgets/Widget.vue` | Draws the picture only. A **preset** (`components/widgets/<Preset>.js`) is a **base** (`widgets/abstract/<Base>.vue`) with some props already set, plus height hints. |
| **Frame** | `components/Frame.vue` | The card. It shows the title, subtitle, controls, caption and the error block. It holds the widget. |
| **Tile** | `components/Tile.vue` | Holds the Frame. It owns the loading cover, finds any `_ui` customization (a custom `.vue` or a `.js` modifier), and shows "Tile Not Defined" for a custom tile that has no widget. |
| **Dashboard page** | `pages/Dashboard.vue` + `pages/Dashboard/dashboard.js` | Scores, sorts and packs the tiles into 12-column rows. |

Short names used in this prompt only. Never use them in code, file names or variable names:

| Name | What it is | Where |
|---|---|---|
| **DBI** | One dashboard item. **Creating or changing an item means creating or changing a DBI.** The file name IS the item name. | `FRONTENT/src/_resource/<Scope>/<Resource>/Dashboard/<name>.js` |
| **DJS** | A data file. It prepares the facts about one topic. It knows nothing about the dashboard. Many DBIs share one DJS. | `FRONTENT/src/_resource/<Scope>/<Resource>/Data/use<Topic>Data.js` |
| **ARD** | The sheet cell `App.Resources` → `Dashboard` column. It is a JSON list of items, one list per resource. The public (tenant) sets it. | Live sheet, seeded from `GAS/syncAppResources.gs` |

A file whose name starts with `_` (like `Data/_shared.js`) is a helper, not an item. The engine skips it.

### Words people use

Users do not know AQL words. When they say any of these about the dashboard, they mean an **item** (one or more DBIs):

| They say | They mean |
|---|---|
| widget, card, tile, box, panel | an item |
| chart, graph, pie, bar, line, gauge | an item, with that kind of picture (the preset) |
| KPI, metric, stat, number, count, total, figure | an item with a one-number preset (`Metric…`) |
| report, summary, insight, analytics "on the dashboard" | one or more items |
| "all possible widgets for X" | the full set of items for topic X (see 2e) |

In AQL, "widget" means only the picture inside the card. Never take a user's "widget" to mean "build a new widget base". Build a new base only when the user clearly asks for a new kind of picture.

---

## 2. Step 0 — Understand the business FIRST (MUST)

You may not write one line of a DJS or a DBI until you understand the business of every resource the work touches. A tile that counts the wrong state looks right and lies to the user. This is the most important step in this prompt.

### 2a. What to read for each resource

1. **Its logic layer**: everything in `FRONTENT/src/_resource/<Scope>/<Resource>/`. That means its `composables/` (progress rules, state names, enrich helpers), `Data/` and `Dashboard/`.
2. **Its sheet entry in [GAS/syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs)**. Search for the resource's `Name:` block, then read:
   - `Scope` and parent/child links (`ParentCode`), which tell you master, operation or accounts
   - `UIFields`: the columns and their types
   - `RequiredHeaders` and `DefaultValues`: what every row always has
   - `AdditionalActions`: the workflow, meaning which state moves to which, and which `...At` / `...By` stamps each move writes
   - `ListViews`: the lists the resource already shows. These are strong hints about what people care about.
   - `Dashboard`: the items it already has, in order
3. **Any doc about the resource**: `Documents/WORKFLOW_OUTLET_OPERATIONS.md`, `Documents/WORKFLOW_PROCUREMENT.md`, and the matching `Documents/SHEET_*_STRUCTURE.md`. Search `Documents/` for the resource name.
4. **Existing DJS files** in that resource and in related resources, so you reuse a number and never count it twice.

### 2b. For a topic that spans resources

Some requests name a topic, not a resource. Example: "invoice items" touches Consumptions, Invoices and Payments.

1. List every resource in the topic, and read each one as in 2a.
2. Write down in plain words how they connect. Example:
   - Many consumptions make one invoice.
   - One invoice can have many payments.
   - When the payments add up to the amount due, the invoice is paid.
   - A small amount left over can be settled with a reason.
   If a link is not clear from the code, ask the user. Never guess.
3. Give each item a **home**. The home is the resource whose records the item counts. Examples:
   - "consumptions ready to invoice" → Consumptions
   - "outlets with money due" → Invoices
   - "payments this month" → Payments
4. Share data across resources. Never copy it. A DJS may import another resource's DJS or logic composable. This already happens: `LeadFollowUps/Data/useFollowUpCoverageData.js` imports `Master/Leads/composables/useLeadProgress`.

### 2c. For a small change

You do not need the full walk. You MUST understand the exact part you change: which column it reads, which state it counts, and what that state means in the workflow.

### 2d. Show your understanding before you build (one list, one round of answers)

Before any code, post one short note to the user:
- the resources involved, and what each one is for
- how they connect
- anything you could not find in code or docs, as a question
- the list of items you plan, **already sorted in the ARD order you propose for each resource** (section 7). For each item give: name, home resource, the question it answers, the preset, and which DJS it reads.
- the ideas you left out, and why

Show the list as a numbered table, one row per item, so the user can answer by number:

| # | Item | Home | Answers | Preset | Data from | New data needed? |
|---|---|---|---|---|---|---|

Then ask the user to say, for each item:
- **keep** it
- **drop** it
- **change** it (they say what: a different preset, question, text or size)
- **move** it (a new place in the order)
- and to name any item they want that is missing

Apply every answer. Show the final list and order again, and get a clear yes. Only then build everything, and finish by writing the ARD in `syncAppResources.gs`.

### 2e. "All possible items for X"

Think of ideas in this order, and cover each group:
1. **Needs action now**: waiting for approval, overdue, stuck too long, my drafts.
2. **How things stand**: open counts, the mix of states, who or where has the most.
3. **Speed and quality**: time between workflow steps, how many were rejected or changed.
4. **Trends**: per day or per month, and this month vs last month.

Use the workflow states and stamps from `AdditionalActions`, and the `ListViews`, as your idea source. Each list view is a hint about something people watch.

Keep the list lean. Every extra item lowers the share of every other item of that resource. Drop ideas that repeat another item, and ideas that no one would act on. Say which ones you dropped.

### 2f. Old or parked files

A resource may already have item files in an old shape. For example, files in `Data/` that are not `use<Topic>Data.js`, or a `compute(ctx)` shape. Its ARD seed may also name tiles that have no DBI.
- Read them for ideas and for business rules.
- Rebuild them in the shape in this prompt.
- Ask the user before you delete or rename any of them.

---

### 2g. When the data files are not enough

Often an item needs a fact that no DJS gives yet. You must then either **add to an existing DJS** (a new key, a new control) or **create a new DJS**. Never do either one silently. Never put the counting inside the DBI to avoid asking.

Before you touch any DJS, ask the user. For each data change, tell them:
- **What**: which DJS file, and which new key or control. Or the new file name and the topic it covers.
- **Why it is needed**: which items need it, and why no current key can give that number.
- **Why it matters**: what the user would miss without these items. Name the real business question.
- **Why this way**: why you add to that file instead of making a new one, or the other way round. A topic that already has a DJS gets its fact added there. A new topic gets its own file.
- **What it reads**: which sheets and columns, and whether it uses another resource's DJS or logic.

Make a strong, honest case, so the user can decide. If the user says no, drop or change the items that needed it, and say which ones.

You may ask this together with the item list in 2d, as one message. Build the data changes only after the user says yes.

## 3. Who owns which key

There are three kinds of keys. Put each key in its right place.

| Kind | Keys |
|---|---|
| **ARD only** (the sheet) | `name`, order in the list, `active`, `activeExcept`, `hideOnEmpty`, `source` (custom tiles) |
| **DBI only** (code) | `permission`, `auth`, `users`, `controls`, `data` |
| **DBI default, ARD may override** | `widget`, `size`, `multiplier`, `widgetProps` (the sheet shallow-merges over the DBI) |
| **Card text** | `title`, `subtitle`, `caption`. Order: a value inside DBI `data` wins, then ARD, then the DBI static value. |

- `permission`, `auth` and `users` in the sheet are ignored. Never write them there.
- Sheet `widgetProps` must be plain JSON, so it cannot hold functions. Functions like `valueFormat` live only in the DBI.
- Color is always a theme role name (`primary`, `positive`, `warning`, `negative`, `accent`, `secondary`). Never a hex code.

---

## 4. The DJS (data file)

Path: `_resource/<Scope>/<Resource>/Data/use<Topic>Data.js`. One file for each topic, like pipeline, intake or due dates. Not one file for each tile.

```javascript
/**
 * <What topic this prepares, in one line.>
 *
 * Reads:
 *   <Resource>: <Column>, <Column>, ...
 *
 * Exposes:
 *   loading   - true while <Resource> is loading and has no rows
 *   <key>     - <one line each>
 *   controls  - <list, or none>
 *
 * Controls:
 *   <name>: <type> picker, <what it changes>
 */

import { ref, computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { dataControl } from 'src/composables/data/useDataControls'

export default function use<Topic>Data () {
  const { rows, indexOf, isLoading, remember } = useRecord()
  const { topN, countAt, daysSince } = useDataContext()

  return remember('use<Topic>Data', () => {
    const loading = computed(() => isLoading('<Resource>') && rows('<Resource>').length === 0)
    const openCount = computed(() => rows('<Resource>').filter(isOpen).length)

    const groupBy = ref('Area')
    const byPlace = computed(() => {
      const counts = new Map()
      for (const [val, bucket] of indexOf('<Resource>', groupBy.value)) {
        const n = bucket.filter(isOpen).length
        if (n > 0) counts.set(val, n)
      }
      return topN(counts, 8)
    })

    const controls = [
      dataControl('groupBy', { type: 'plain', options: ['Area', 'City'], value: groupBy })
    ]

    return { loading, openCount, byPlace, groupBy, controls }
  })
}
```

Rules:
- **The JSDoc block is required.** Never delete it or shorten it. List every key it exposes, one line each.
- **Wrap it in `remember('use<Topic>Data', …)`.** Then every DBI that imports it shares ONE copy, and they also share the same control values.
- **Never import a store.** Rows come from `useRecord()` (`rows`, `indexOf`, `isLoading`). The user comes from `useAuth()` (`composables/core/useAuth.js`). Math comes from `useDataContext()`.
- **Group a whole table with `indexOf(resource, header)`**, not a scan. It is a cached Map from each value to its rows.
- **Every live value is a `computed`.** Expose the control refs, and expose a base count that no control can change (for the `empty` rule).
- **State names and rules come from the resource's own logic** (`composables/`, or `Data/_shared.js`, which re-exports them). Never type a state string twice.
- **Return only what a DBI reads.**

`useDataContext()` (`FRONTENT/src/composables/data/useDataContext.js`) gives pure helpers. They always take lists, never resource names:
`countBy`, `sumBy`, `topN(map, n)`, `mean`, `countAt(list, range, predicate, dateField)`, `inRange(value, range)`, `rangeLabel(range)`, `daysAgo(n)`, `daysSince(value)`, `hoursBetween(a, b)`, `progressOptions(list)`.
Range words: `$today`, `$thisMonth`, `$lastMonth`, `$last7Days`, `$last30Days`, `$last90Days`. These must stay the same as in `src/utils/tokenEvaluator.js`.

---

## 5. The DBI (the item)

Path: `_resource/<Scope>/<Resource>/Dashboard/<name>.js`. The file name is the item name. Matching is case-blind.

```javascript
/**
 * <What this tile is for, in one line.>
 *
 * Answers: <The question it answers on the dashboard?>
 *
 * Uses:
 *   - use<Topic>Data: byPlace, groupBy, openCount, loading, controls
 *
 * Controls: groupBy
 */

import { computed } from 'vue'
import use<Topic>Data from '../Data/use<Topic>Data'

export default (props) => {
  const d = use<Topic>Data()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], md: [6, 8, 12], lg: [4, 6, 8] },
    permission: { <Resource>: 'Read' },
    title: 'Open by place',
    widgetProps: { color: 'primary', valueFormat: (v) => `${v} open` },
    controls: d.controls.filter((c) => ['groupBy'].includes(c.name)),
    data: computed(() => ({
      items: d.byPlace.value,
      caption: `Open by ${d.groupBy.value}`,
      empty: d.openCount.value === 0,
      loading: d.loading.value
    }))
  }
}
```

### Every DBI key

| Key | Type | Default | What it does |
|---|---|---|---|
| `widget` | String | required | The preset name. Pick it in step 6. |
| `size` | Object | `{ xs: [12] }` | Allowed widths for each breakpoint (`xs sm md lg xl`), out of 12. The first is the default, the rest are fallbacks in order. A single number means one width. A breakpoint you leave out takes the value of the nearest smaller one. |
| `permission` | Object / String / Array | none (everyone) | `{ Invoices: 'Read', Payments: 'Read' }`: EVERY listed resource must pass. A string or array is checked against the home resource. `{ X: true }` means the user just has resource X. **List every resource the item reads.** |
| `auth` | Boolean | `false` | +3 to raw score. Use it for items about the logged-in user ("my drafts"). |
| `users` | Boolean | `false` | +5 to raw score. Use it for items about staff or users. |
| `multiplier` | Number | `1` | Score knob. It is clamped to 0–2, and 0 turns the tile off. Usually left to the ARD. |
| `title` / `subtitle` / `caption` | String | none | Fixed card text. If the text changes, put it in `data` instead. |
| `widgetProps` | Object | `{}` | Look props for the widget: `color`, `variant`, `max`, `target`, `dense`, `signed`, `valueFormat` (a function) and more. The full list for each base is in [WIDGETS.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/WIDGETS.md). |
| `controls` | Array | `[]` | Pick the exact control objects from the DJS. Never clone them. |
| `data` | `computed` | required | The live values. It must hold `loading`, `empty`, and every data key the widget needs. It may also hold `title`, `subtitle`, `caption`. |

Rules:
- A key is either static or inside `data`, never both.
- No `name` and no `source` keys. The file name is the name.
- `props` is a copy of the ARD item's `widgetProps`. The DBI runs **once** for each `resource::name` and the result is kept. A sheet change needs a page reload.
- Never import a store. Never return a fake zero row.
- Formatters are one-line inline arrows, like `valueFormat: (v) => v + ' days'`. Give it a helper only when it has many steps and is shared.
- Never give an item the same name as another file in that resource's `_ui` folder, like `ListSwitcher`. The modifier lookup is case-blind and would load the wrong file.

### The `empty` rule

`empty` answers one question: "does this item have anything to say?" It is decided by the **records only**. It must **never read a control value**. If it did, a tile could hide itself and take away the control the user needs to bring it back.

| Tile kind | `empty` when |
|---|---|
| One number (`MetricPlain`) | the value is 0 |
| Number + compare (`MetricDelta`, `MetricDeltaInverse`) | BOTH the value and the compare value are 0 |
| Delay / duration | there is nothing to measure in either period |
| Buckets, bars, lines | every bucket or point is 0: `!items.some((i) => i.value > 0)` |
| Plain list | the list is empty |
| Tile with a control | the base count is 0, never the filtered list |

A tile with `empty: true` still shows. It hides only if the ARD sets `hideOnEmpty: true`. Loading never hides a tile.

### Controls

Controls are fully working. The DJS owns the ref, and the DBI picks the control objects.
- Build one with `dataControl(name, { type, options, value: ref, ...rest })` from `src/composables/data/useDataControls.js`. Options can be strings or `{ label, value }`. The default type is `menu`. Any extra keys (`rest`) are passed to the field as its config.
- Types:
  - `plain`: a toggle for 2–4 short choices
  - `menu`: a dropdown for many choices or tight space
  - `chip`: chips
  - `select`: a compact select
  - Any unknown type becomes `menu`.
- Every DBI that imports the same DJS shares its controls. Change one, and they all change.
- A tile with controls is never narrower than `controlsMinSpan` (6) columns.
- Show what the control picked in `data` text, like a caption that says `Open by ${groupBy}`.

---

## 6. Picking the widget

Read [REGISTRY.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/REGISTRY.md) first. It is short and lists every preset with the data it needs. Then read the base's section in [WIDGETS.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/WIDGETS.md) for its exact data shape and props.

Data shapes at a glance:

| Shape | Presets (examples) |
|---|---|
| `value` (+ `compare`, `caption`) | `MetricPlain`, `MetricDelta`, `MetricDeltaInverse` |
| `value`, `max` (+ `target`, `zones`) | gauges, progress bars, waffles, bullets |
| `items: [{ label, value }]` | bars, donuts, strips, funnels, ageing, heat strip |
| `items: [{ label, value, caption }]` | `TopProductsList`, `LowStockList` |
| `items: [{ label, value, max }]` | `ActivityRings`, `TargetArches` |
| `items: [{ label, date, caption }]` | `EventTimeline`, `CompactTimeline` |
| `series: [{ name, items }]` | grouped, stacked and 100% bars |
| `points: [{ x, y }]` | lines, sparks, areas |
| `series: [{ name, points }]` | multi-line |
| `matrix: { rows, columns, values }` | `WeekRouteMatrix` |

Make the DJS match an existing shape exactly. Never bend a widget to fit your data.

Stop at the first step that works:
1. Use an existing preset as it is.
2. Use the same preset with different `widgetProps`.
3. Add a new preset. This is a small file `components/widgets/<Name>.js` with `{ base, props, minHeight, aspect?, rowHeight? }`. Add it to REGISTRY.md and WIDGETS.md in the same change.
4. Only if no base can draw it: propose a new base. It needs the user's yes and must follow CONTRACT.md in full.

Say in your report which step you stopped at.

Card height comes from the preset's hints:
- `rowHeight` means a list, so the height grows with the number of items
- `aspect` means a picture with a fixed shape
- otherwise the height is `minHeight`

---

## 7. The ARD (sheet entry) and the order

The standard ARD item is only the name:

```json
[{"name":"dueToday"},{"name":"overdue"},{"name":"byOutlet","hideOnEmpty":true}]
```

Every other key is an optional override (see section 3). Examples:

```json
[{"name":"openLeads","title":"All open leads","size":{"xs":[12],"md":[4,6]}}]
[{"name":"leadsByPlace","multiplier":1.5,"widgetProps":{"color":"secondary"}}]
[{"name":"revenueCard","widget":"RevenueCard","active":false,"activeExcept":["admin"]}]
```

- `active: false` turns the item off. `activeExcept` lists role ids that flip `active`.
- An ARD item with no matching DBI is a **custom tile**:
  - it has no data and no permission check
  - it never hides
  - its multiplier cap is 3
  - it needs a custom widget `.vue` (section 8), or it shows "Tile Not Defined"

### The order changes the score. Agree it with the user.

`score = bag × position × share × multiplier`
- **raw** (for each item) = permission verb weight × scope weight + bonus
  - Scope weights: master 1, operation 2, accounts 2.5. A child resource counts a flat 0.75.
  - Verb weights: `true` 1, Read or Delete 1.5, Update 2, Create or Write 3, any other action 2.5.
  - Bonus: `auth` +3, `users` +5.
  - An item that lists several resources adds up their weights.
- **bag** = the average raw score of that resource's visible items.
- **position** = the first item 1.9, sliding down to 0.1 for the last.
- **share** = 1/√n, where n is the number of the resource's visible items.
- After scoring, the user's `dashboardScoreCutoff` (from their designation) drops low scores. All items across all resources are then sorted by score.

So the place of an item in the list decides how high it sits on the page. Adding items to a resource lowers every item's share in it. Suggest an order in this way: first what needs action now, then how things stand, then history and trends. **The user confirms this order in the one note of step 2d, before you write anything.** For a change that moves an item's place, show the new order and get a yes.

### Where the ARD is written

Write it in [GAS/syncAppResources.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/syncAppResources.gs), in the `Dashboard:` key of the resource's block, next to its `ListViews`. That is the final step for the ARD.
- Use `JSON.stringify([...])` with one item per line, as the file already does.
- Never write `permission`, `auth` or `users` there.
- Never edit the live sheet by hand. Never push or deploy. The user runs the push and "Sync App Resources".
- An item missing from the seed works for no new tenant. It is not finished.

---

## 8. `_ui` customization (for a tenant)

The tenant's UI name comes from the `CustomUIName` column in `App.Resources`. The first resource that has it wins. If none has it, the name is `AQL`. All lookups are case-blind.

### 8a. Replace the whole card: a custom widget `.vue`

Path: `FRONTENT/src/_ui/<uiName>/components/widgets/<widget>.vue`. `<widget>` is the item's `widget` name.

It replaces the **Frame**, so it must draw its own title, controls and caption if it wants them. The Tile still puts the loading cover over it. It gets these props:
`title, subtitle, caption, controls, error, loading ({ inflight, state }), widget, widgetProps, data`
(`data` is the plain values, without `title`, `subtitle` or `caption`).

```vue
<template>
  <q-card flat bordered class="aql-widget-tile page-card">
    <div class="row items-center justify-between">
      <div class="text-subtitle2">{{ title }}</div>
      <Controls />
    </div>
    <Widget :name="widget" v-bind="{ ...widgetProps, ...data }" />
    <div v-if="caption" class="text-caption">{{ caption }}</div>
  </q-card>
</template>

<script setup>
import Widget from 'src/components/widgets/Widget.vue'
import { useDataControls } from 'src/composables/data/useDataControls'

const props = defineProps({
  title: String, subtitle: String, caption: String, controls: Array,
  error: String, loading: Object, widget: String, widgetProps: Object, data: Object
})
const { Controls } = useDataControls(() => props.controls)
</script>
```

- It may draw its own markup, use `<Widget :name>`, or use `<Widget :preset="{ base, props }" :base>`.
- Stretch to fill the cell. Use Quasar first. No `<style>` block (`CORE_ARCHITECTURE_RULES.md` §7).
- Because it matches by widget name, it changes **every** tile that uses that widget name for this tenant. To change one tile only, give that tile its own widget name in the ARD, or use a modifier instead.

### 8b. Change some props only: a `.js` modifier

The first path that exists wins:
1. `_ui/<uiName>/components/<scope>/<Resource>/dashboard/<name>.js`
2. `_ui/<uiName>/components/<scope>/<Resource>/<name>.js`
3. `_ui/<uiName>/components/<scope>/dashboard/<name>.js`, for every resource in that scope

`<name>` is the item name. It works with the standard Frame and with a custom widget.

It gets one flat object:
`{ title, subtitle, caption, widget, widgetProps, controls, data, error, name, resource, scope }`
Its result is merged over that object: `{ ...flat, ...yours }`.

```javascript
export default { title: 'Branch dues' }
```

```javascript
export default (p) => ({
  widgetProps: { ...p.widgetProps, color: p.data?.value > 100 ? 'negative' : 'primary' }
})
```

- Always spread `widgetProps` when you change one key, or you lose the rest.
- It can swap `widget` to another preset. It can set `error` to show the error block.
- It cannot change `loading`. The Tile owns it.

### 8c. Which tool to use

| Need | Use |
|---|---|
| Different text, order, size or color for all tenants | the DBI |
| Same, for this tenant only, with no code | the ARD |
| A formatter or a rule for one tenant | a `.js` modifier |
| A completely different card | a custom widget `.vue` |
| A tile that has no DBI at all | an ARD custom tile + a custom widget `.vue` |

---

## 9. Every surface an item touches

| Surface | File | When |
|---|---|---|
| DJS | `_resource/<Scope>/<Resource>/Data/use<Topic>Data.js` | new facts are needed |
| Shared rules | `Data/_shared.js` | two or more files share a rule |
| DBI | `_resource/<Scope>/<Resource>/Dashboard/<name>.js` | always |
| New preset | `components/widgets/<Name>.js` + REGISTRY.md + WIDGETS.md | step 6.3 only |
| ARD seed | `GAS/syncAppResources.gs` → `Dashboard:` | always |
| `_ui` files | `_ui/<uiName>/components/...` | customization only |
| Canonical docs | `Documents/FEATURE_DASHBOARD_ENGINE*.md` | only when a rule changes |

There is no index file and no registry for items. The engine finds every `Dashboard/*.js` by itself.

---

## 10. Rules that must not break

- Step 0 (the business) comes first, always.
- The JSDoc block on every DJS and DBI is required. When you change what an item does, update its block in the same edit.
- Core files (`src/composables/`, `src/utils/`, `src/stores/`, `src/services/`, `src/router/`, `src/components/`) are read-only unless the user says yes. Ask BEFORE you create any new file or exported function, with the audit quote from [AGENTS.md](file:///f:/LITTLE%20LEAP/AQL/AGENTS.md). A DJS or DBI file for the requested items counts as part of the approved plan from step 2d.
- Read [CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md) before any edit under `FRONTENT/`.
- A broken tile is always visible. Hide only a healthy tile that has nothing to say.
- No hidden features. Docs describe the present.
- Never push or deploy.

---

## 11. Verification

You have no proof until the tile is seen in the browser. Report what you changed, and what you did not check.

Whoever checks the dashboard at `:9000/dashboard` must:
1. **Count the tiles first.** An empty page shows zero problems.
2. Read the real numbers on each new tile, and check a few against the list views of that resource.
3. Change each control and see the tile follow it. The tile must not hide.
4. Confirm no tile shows "Tile Not Defined", "No widget: …" or "No base: …".
5. Check a phone width too.

Run `npm --prefix FRONTENT run build` when you add 10 or more files.

---

## Maintenance rule

When the engine changes (a new DBI key, a change to `ctx` or props, the score, the override order, or the `_ui` lookup), update `Documents/FEATURE_DASHBOARD_ENGINE*.md` AND this prompt in the same turn as the code.

If a gap in this prompt caused a mistake, tell the user, name the gap, and ask to fix it (the Documentation Gap rule in [AGENTS.md](file:///f:/LITTLE%20LEAP/AQL/AGENTS.md)).
