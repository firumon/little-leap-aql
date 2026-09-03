# Dashboard Widgets Registry

Pure, stateless presentation widgets. Every prop is already resolved — a widget never
evaluates a closure, injects a context, or reads a store. See [README.md](./README.md)
for the layering rules.

Rule: update this file whenever a widget is added or its prop contract changes.

| Widget | Purpose | Props | Section wrapper |
|---|---|---|---|
| `MetricCards` | Counter cards grid — big number, small unit, uppercase label. | `{ items: Array }` | `sections/MetricCards.vue` |
| `LinearProgress` | Labelled progress bars with percent readout and value/target line. | `{ items: Array }` | `sections/LinearProgress.vue` |
| `Gauge` | Radial `QCircularProgress` dials with centre readout, label, caption. | `{ items: Array, size: String ('96px'), thickness: Number (0.18) }` | `sections/Gauge.vue` |
| `AgeingBuckets` | Fixed-scale ageing bands — count, band label, caption. | `{ items: Array }` | `sections/AgeingBuckets.vue` |
| `WorkflowFunnel` | One proportional stacked bar across workflow stages, plus legend. | `{ items: Array }` | `sections/WorkflowFunnel.vue` |
| `DistributionBars` | Ranked single-series category bars with an optional dimension toggle. | `{ items: Array, color: String ('primary'), maxBars: Number (8), cardClass: [String,Array,Object], rowStaggerMs: Number (40) }` | `sections/DistributionBars.vue` |
| `MultiSeriesBars` | N rows × M series — one bar per series in every row, on one shared scale. Two layouts: a bar per line, or every series end to end on one track. | `{ items: Array, series: Array, layout: String ('stacked'), max: [Number,String] (null), maxRows: Number (12), cardClass: [String,Array,Object], rowStaggerMs: Number (40) }` | `sections/DualDistributionBars.vue` |
| `WorkList` | A short, clickable list of records placed among an Index page's widgets — states WHICH records, where a counter can only state how many. Composes `components/app/AppList.vue`; pagination is force-disabled. Emits `row-click`; it never navigates. | `{ items: Array, hiddenCount: Number (0), itemKey: [String,Function] ('Code'), layout/content/metaLayout: Array, label/caption/metaLabel/metaCaption/chip/badge/btn: [String,Function,Object], chipColor/badgeColor/icon/iconColor/highlightColor: [String,Function], chipOutline: Boolean (false), dense: Boolean (true) }` | `sections/WorkList.vue` |

---

## `MetricCards`

`items: [{ label, number, unit, color }]`

A card is dropped when it has neither a `number` nor a `label`. Column spans are chosen
by total count (1→`col-12`, 2→`col-6`, 3→`col-4`, 4→`col-6`, 5→`col-4`×3 + `col-6`×2,
6+→`col-4`) so the last line is never a lonely stub. `color` is resolved by
`resolveCssColor` into `--aql-metric-color`.

```js
items: [
  { label: 'Overdue Visits', number: 7, color: 'negative' },
  { label: 'Today Visits', number: 12, color: 'primary' }
]
```

## `LinearProgress`

`items: [{ label, value, max, unit, color }]`

`max > 0` makes the bar `(value / max) * 100`. With no usable `max`, `value` **is** the
percentage — a figure in `(0..1]` is read as a fraction and scaled ×100. Everything is
clamped to 0..100. Below the bar: the progress figure left, the target right.

```js
items: [{ label: 'Visit Fulfilment', value: 14, max: 25, unit: 'visits', color: 'positive' }]
```

## `Gauge`

`items: [{ label, caption, value, max, color, display }]`

Same value/max normalization as `LinearProgress` — the two must never disagree about
what a pair means. `display` defaults to the rounded percentage. `label`, `caption` and
`display` route through `abstract/Renderable.js`, so slots `label` / `caption` /
`display` replace them.

```js
items: [{ label: 'Completed Today', value: 18, max: 22, color: 'positive' }]
```

## `AgeingBuckets`

`items: [{ label, count, caption, color }]`

Empty bands are **kept and dimmed**, not dropped — the bands are a fixed scale, and
"0 in 7+ days" is the reassuring half of the reading. A bucket with no label is dropped.
The widget renders nothing when every count is zero.

```js
items: [
  { label: '0-2 days', count: 4, color: 'positive' },
  { label: '3-6 days', count: 2, color: 'warning' },
  { label: '7+ days', count: 0, color: 'negative', caption: 'escalate' }
]
```

## `WorkflowFunnel`

`items: [{ label, count, color, icon }]`

Zero-count stages are **dropped** — an invisible segment still costs a legend row.
Segment width is its share of the total; each segment carries a tooltip.

```js
items: [
  { label: 'Planned', count: 30, color: 'primary', icon: 'event_available' },
  { label: 'Completed', count: 18, color: 'positive', icon: 'task_alt' }
]
```

## `DistributionBars`

`items` takes either shape:

- flat — `[{ label, count }]` → one group, no selector
- grouped — `[{ key, label, items: [{ label, count }] }]` → a `q-btn-toggle` per group

Bars scale against the **largest** bar in the active group, so the shape uses the full
width. The `share` beside each count is measured against the group **total** — the two
answer different questions. Bars cap at `maxBars`, and the tail becomes one
`+ N more` caption line.

```js
items: [
  { key: 'province', label: 'Province', items: [{ label: 'Bali', count: 42 }] },
  { key: 'city', label: 'City', items: [{ label: 'Denpasar', count: 20 }] }
]
```

## `MultiSeriesBars`

```
items:  [{ label, values: { [seriesKey]: Number } }]   // flat { label, seriesKey: n } also works
series: [{ key, label, color, trackColor }]
```

Handles **N rows × M series** — N users/categories/departments, each drawing M bars.
Rows with no label, or with every series at zero, are dropped. Rows cap at `maxRows` with
a `+ N more` line. The legend is omitted for a single series.

### `layout`

| Value | Shape | Denominator |
|---|---|---|
| `'stacked'` (default) | One bar per series, each on its own line. | The largest single value in the set — so one bar is comparable to the same bar a few rows down. |
| `'inline'` | Every series end to end on **one** track, read as a whole made of parts. | The largest row **total** — segments share a track, so scaling them against the largest single value would let a row sum past 100% and overflow. |

`max` overrides the denominator in either layout. Both share **one** denominator across
the whole card: bars that each scaled to their own peak would look equal while standing
for different counts. Inline segments carry a per-series tooltip and reuse the
`.aql-funnel__*` track, so its grey remainder shows how far short of the peak a row falls.

```js
series: [
  { key: 'yesterday', label: 'Yesterday', color: 'primary' },
  { key: 'today', label: 'Today', color: 'positive' }
],
items: [
  { label: 'Andi', values: { yesterday: 6, today: 9 } },
  { label: 'Budi', values: { yesterday: 4, today: 3 } }
]
```

---

## `WorkList`

`items: [ …record objects… ]` — already sliced by the wrapper. This widget draws what it
is handed and computes no window of its own.

The only interactive widget in this folder. It stays pure by emitting `row-click` with
the row object and letting the section wrapper decide where that goes — navigation needs
`useResourceNav`, which is a composable and may not be imported here.

Row cells are forwarded verbatim to `abstract/List.vue`, which routes each one through
`abstract/Renderable.js`. So `label`, `caption`, `chip`, `badge`, `metaLabel`,
`metaCaption` and `btn` are typed `[String, Function, Object]` — an Object is a whole
component for that cell. `chipColor`, `icon`, `iconColor` and `highlightColor` resolve
directly and stay narrowly typed on purpose. These are PER-ROW resolvers called as
`fn(row)`, not `(record, config)` closures — the widget still evaluates nothing itself.

`hiddenCount` renders one `+ N more` caption under the list. The wrapper supplies it;
the widget never decides what was left out.

```js
items: [{ Code: 'LED-004', Name: 'Delta', Type: 'Outlet' }],
hiddenCount: 2,
label: (lead) => lead.Name,
caption: (lead) => lead.Type
```
