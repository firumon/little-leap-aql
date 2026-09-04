# Page & Section — The Built-In Metric Sections

> Part of **[﻿# AQL Page and Section System Guide](UI_PAGE_AND_SECTION_SYSTEM.md)**. MetricCards, LinearProgress, WorkflowFunnel, AgeingBuckets and DistributionBars.

---

### 2.4 `MetricCards` — Dashboard Stat Counters

```html
<Section section="MetricCards" :items="[...]" />
```

**Props catalog** — every prop accepts `Function`, evaluated through `evaluateProp`, so closures receive plain `(record, config)` objects (never refs).

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `title` | `[String, Function]` | `''` | Divider label above the row, rendered via `shared/SectionDividerLabel.vue`. Omitted when empty. |
| `items` | `[Array, Function]` | `null` | Metric array: `{ label, number, unit, color }`. **Each field may itself be a closure** and is evaluated with the same `(record, config)` signature. |
| `label` | `[String, Function]` | `''` | Single-metric fallback (see below). |
| `number` | `[Number, String, Function]` | `null` | Single-metric fallback. |
| `unit` | `[String, Function]` | `''` | Single-metric fallback. |
| `color` | `[String, Function]` | `'primary'` | Single-metric fallback. |

**Normalization & the strict hide rule.** The component computes one internal `metrics` array:
1. If `items` resolves to a non-empty array, each entry is normalized and entries carrying **neither** a `number` nor a `label` are dropped.
2. Otherwise the single-item props are normalized into a one-element array — but only if `number` or `label` produced a value.
3. If nothing survives, `metrics.length === 0` and the root `v-if` renders **nothing** — no empty shell, no divider. A page can therefore declare the section unconditionally and let data decide.

**Colour.** `color` accepts Quasar brand names (`negative`, `warning`, `primary`), Material palette names (`teal-7`), or raw CSS values (`#e11d48`, `rgb(...)`). It is resolved by `resolveCssColor()` from `src/utils/colorHelpers.js` and written to the card as the inline custom property `--aql-metric-color`; the gradient, border, accent rail, number, unit and shadow all derive from it via `color-mix()`. No per-colour class variants exist.

**Responsive grid.** The row **wraps**; it does not scroll. An off-screen metric is a metric nobody reads, and a card cluster is a summary rather than a list. `colClassFor(index, total)` picks each card's Quasar span by the TOTAL count, chosen so the last line is never a lonely stub:

| `items.length` | Spans |
|---|---|
| 1 | `col-12` |
| 2 | `col-6` |
| 3 | `col-4` |
| 4 | `col-6` (2 × 2, not 3 + 1) |
| 5 | `col-4` for the first three, `col-6` for the last two (3 + 2) |
| 6 or more | `col-4` throughout |

**Styling.** All rules are `.aql-metrics*` in [custom.scss](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/css/custom.scss) — the component carries no `<style>` block (ARCHITECTURE RULES §7). The row's gutter is its own (`--aql-metrics-gap`), and Quasar's `col-*` widths know nothing about it, so `.aql-metrics__row > .aql-metrics__card.col-6` / `.col-4` narrow each span by its share of the gap — without that, two `col-6` cards plus one gap exceed 100% and wrap onto separate lines. The label wraps to at most two lines (`line-clamp: 2`) instead of ellipsing, because a three-across row on a phone is ~104px and truncates most real labels. The hover lift honours `prefers-reduced-motion`.

**Spacing.** The row carries a horizontal inset (`q-px-sm`) only. Vertical rhythm belongs to `.aql-page-body`, which `Page.vue` renders with `q-gutter-y-{pageProps.gutter}` — so the section adds no `q-py-*` of its own and its root carries no `full-width`, letting it stack flush with neighbouring sections at the page's own gutter.

**`$attrs` is deliberately not spread onto the root** — `Page.vue` passes 20+ `pageProps` (including `onSubmit`/`onReset`) into every Section, and binding those to a plain `div` would register meaningless DOM listeners. The section exposes no class/style escape hatches either: restyling is a `.vue` override or a `custom.scss` rule, not a prop.

*Example — JS modifier (`_ui/AQL/components/operation/outletvisits/index/metriccards.js`)*:
```javascript
export default (currentProps, { resourceRecord }) => ({
  title: 'Today at a glance',
  items: (record, config) => [
    { label: 'Overdue',   number: resourceRecord?.items?.value?.filter(v => v.Overdue).length ?? 0, unit: 'visits', color: 'negative' },
    { label: 'Due today', number: resourceRecord?.items?.value?.filter(v => v.DueToday).length ?? 0, unit: 'visits', color: 'warning' },
    { label: 'Completed', number: config?.name ? 0 : 0, unit: 'visits', color: 'positive' }
  ]
})
```

*Example — single-metric form, hidden automatically when the record has no count*:
```html
<Section section="MetricCards" :number="(record) => record?.PendingCount" label="Pending" unit="items" color="warning" />
```

### 2.5 `LinearProgress` — Completion Progress Bars

```html
<Section section="LinearProgress" :items="[...]" />
```

Where `MetricCards` answers "how many?", `LinearProgress` answers "how far along?" — a labelled bar with a bold percentage readout above it, and the progress figure (`14 visits`) and its target (`25 visits`) sitting at either end of the row below it.

**Props catalog** — every prop accepts `Function`, evaluated through `evaluateProp`, so closures receive plain `(record, config)` objects (never refs).

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `title` | `[String, Function]` | `''` | Divider label above the row, rendered via `shared/SectionDividerLabel.vue`. Omitted when empty. |
| `items` | `[Array, Function]` | `null` | Progress array: `{ label, value, max, color, unit }`. **Each field may itself be a closure** and is evaluated with the same `(record, config)` signature. |
| `label` | `[String, Function]` | `''` | Single-item fallback — e.g. `"Today's Visit Completion"`. |
| `value` | `[Number, String, Function]` | `null` | Single-item fallback — the count when `max` is set, otherwise the percentage itself. Rendered below the bar, left. |
| `max` | `[Number, String, Function]` | `null` | Single-item fallback — the denominator, e.g. `25`. Omit to feed a percentage straight through `value`. Rendered below the bar, right. |
| `unit` | `[String, Function]` | `''` | Noun appended to both below-bar readouts, e.g. `'visits'`. |
| `color` | `[String, Function]` | `'primary'` | Bar/accent colour. |

**Percentage resolution.** `max` is what decides how `value` is read. Numeric inputs are coerced loosely (`'14'` and `14` behave identically — sheet-backed counts arrive as both):
1. `max` resolves to a number `> 0` → the bar uses `(value / max) * 100`, clamped to `0..100`.
2. No usable `max` → `value` **is** the percentage. A figure in `(0..1]` is read as a fraction and scaled (`0.56` → 56%, `1` → 100%); anything above `1` is already on the 0..100 scale. Clamped to `0..100`.
3. No numeric `value` at all → there is no percentage: the bold readout is omitted and the bar renders empty.

The displayed percent is rounded to at most one decimal (`1 / 3` → `33.3%`, never `33.33333%`).

**Below-bar readouts.** A `justify-between` row under the bar, derived — not configurable. There is no `caption` prop:
* **Left (`value`)** — `` `${value} ${unit}`.trim() `` with a usable `max` (`14 visits`, or `14` with no unit). Without a usable `max` the value is itself a percentage: a named unit still prints the raw figure (`56 visits`), while an unnamed one appends `%` directly — `56%`, never `56 %`. Omitted when `value` is absent.
  * In that unitless `%` case the readout prints the **resolved** percent, not the raw value, so it always agrees with the bar and the bold readout above: `value: 0.72` is scaled to `72%` and `value: 140` is clamped to `100%`.
* **Right (`max`)** — `` `${max} ${unit}`.trim() `` (`25 visits`, or `25`). `null` when `max` is absent or unusable, so nothing renders on the right.
* When only `max` renders, an empty `<span>` placeholder holds the left slot so the target stays hard right.
* Neither present → the whole row is skipped.

**Strict hide rule.** An item survives only if it carries a `label` **or** at least one of `value` / `max`. If nothing survives, the root `v-if` renders **nothing** — no empty shell, no divider. A page can therefore declare the section unconditionally and let data decide.

**Colour.** `color` accepts Quasar brand names (`positive`, `warning`, `primary`), Material palette names (`teal-7`), or raw CSS values (`#e11d48`, `rgb(...)`). It is resolved by `resolveCssColor()` from `src/utils/colorHelpers.js` and written to the card as the inline custom property `--aql-progress-color`. Because `QLinearProgress` paints its track and model from `currentColor`, `.aql-linear-progress__bar { color: var(--aql-progress-color) }` themes the whole bar — which is how the section accepts raw hex values that the component's own `color` prop could never take.

**Styling.** All rules are `.aql-linear-progress*` in [custom.scss](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/css/custom.scss) — the component carries no `<style>` block (ARCHITECTURE RULES §7). Cards are `col-12 col-sm`, so they stack full-width on mobile and sit side by side from the `sm` breakpoint up. The gradient, border, accent rail and percent readout all derive from `--aql-progress-color` via `color-mix()`; there is no hover transform, so nothing to gate behind `prefers-reduced-motion`. The below-bar row is pure Quasar (`row no-wrap items-center justify-between text-caption q-mt-xs`) — only the shared `tabular-nums` + muted-ink treatment on `.aql-linear-progress__val` / `__max` lives in SCSS, so both ends align digit-for-digit.

**Spacing.** Same contract as §2.4 — horizontal inset (`q-px-sm`) only, no `q-py-*`, no `full-width` on the root. Vertical rhythm comes from `.aql-page-body`'s `q-gutter-y-{pageProps.gutter}`.

**`$attrs` is deliberately not spread onto the root** — same reasoning as §2.4, and likewise no class/style props: restyle with a `.vue` override or a `custom.scss` rule.

*Example — single bar driven off the record*:
```html
<Section
  section="LinearProgress"
  label="Today's Visit Completion"
  :value="(record) => record?.CompletedVisits"
  :max="(record) => record?.PlannedVisits"
  unit="visits"
  color="positive"
/>
```

*Example — JS modifier producing a row of bars (`_ui/AQL/components/operation/outletvisits/index/linearprogress.js`)*:
```javascript
export default (currentProps, { resourceRecord }) => ({
  title: 'Completion',
  items: () => {
    const visits = resourceRecord?.items?.value ?? []
    return [
      { label: 'Today',     value: visits.filter(v => v.DueToday && v.Done).length, max: visits.filter(v => v.DueToday).length, unit: 'visits', color: 'positive' },
      // No `max` — `value` is the percentage itself (0.72 → 72%), and only the
      // left readout renders, as `72%`
      { label: 'This week', value: 0.72, color: '#6366f1' }
    ]
  }
})
```

### 2.6 `WorkflowFunnel` — Proportional Pipeline Bar

```html
<Section section="WorkflowFunnel" :items="[...]" />
```

Where `MetricCards` answers "how many?" and `LinearProgress` answers "how far along?", `WorkflowFunnel` answers **"where is the work sitting?"** — one stacked horizontal bar across a workflow's states, with a legend naming each. The point of the stacked form is that each state is read RELATIVE to the others, so a pile-up at one stage is visible as a shape rather than as numbers the reader must compare by hand.

Entirely state-agnostic: the states, their order, their colours and their counts all arrive as `items`, so the same section renders an approval, delivery or production workflow. Projecting records to counts is the calling resource's job — see `_ui/AQL/components/Operation/OutletRestocks/Index/WorkflowFunnel.js`.

**Props catalog** — every prop accepts `Function`, evaluated through `evaluateProp` with the `(record, config)` signature.

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `title` | `[String, Function]` | `''` | Divider label above the bar, via `shared/SectionDividerLabel.vue`. Omitted when empty. |
| `items` | `[Array, Function]` | `null` | Segment array: `{ label, count, color, icon }`, in pipeline order. **Each field may itself be a closure.** |

**Normalization & the strict hide rule.** Counts are coerced loosely and anything non-positive is treated as `0`. **Zero-count states are dropped**, not rendered at 0%: an invisible segment still takes a legend row, and a legend of empty states buries the ones that matter. The root `v-if="segments.length && total > 0"` then renders **nothing** when no segment survives — a zero-width bar has nothing to be proportional to. Each surviving segment's width is `count / total`, and its tooltip states the count and the percentage (one decimal at most).

**Legend.** One entry per segment: the state's `icon` (or a coloured dot when none is configured), its label, and its count in the segment's own colour. Wraps freely.

**Colour.** Same contract as §2.4 — Quasar brand names, Material palette names or raw CSS, resolved by `resolveCssColor()` and written per segment as `--aql-funnel-color`.

**Styling.** All rules are `.aql-funnel*` in `custom.scss`; no `<style>` block. A 2px gap separates segments so two adjacent states of similar hue stay legible as two. Segments carry **no** `min-width` — padding out a 1-of-400 sliver would make the bar lie about the proportion it exists to show.

**Spacing / `$attrs`.** Same contract as §2.4.

*Example — JS modifier projecting a resource's states*:
```javascript
export default (currentProps, { resourceRecord }) => ({
  title: 'Workflow Pipeline',
  items: () => {
    const counts = tally(resourceRecord?.records?.value ?? [])
    return WORKFLOW_STATES.map((state) => ({
      label: progressLabel(state), count: counts[state] || 0,
      color: progressColor(state), icon: progressIcon(state)
    }))
  }
})
```

### 2.7 `AgeingBuckets` — Backlog Age Bands

```html
<Section section="AgeingBuckets" :items="[...]" />
```

Answers **"how long has the outstanding work been outstanding?"** A single "12 awaiting approval" counter cannot distinguish twelve requests raised this morning from twelve ignored for a fortnight, and those are opposite situations. Bucketing by age turns the count into a triage instruction.

Age **banding is the caller's decision**, not the component's: the thresholds that matter differ per workflow (an approval queue ages in days, a stock count in months). Buckets arrive already counted, so this section owns presentation only — see `_ui/AQL/components/Operation/OutletRestocks/Index/AgeingBuckets.js`, which bands `PENDING_APPROVAL` rows at 0–1 / 2–3 / 4–7 / 7+ days using `daysFromToday` from `src/utils/dateHelpers.js`.

**Props catalog** — every prop accepts `Function`, evaluated through `evaluateProp` with the `(record, config)` signature.

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `title` | `[String, Function]` | `''` | Divider label above the buckets. Omitted when empty. |
| `items` | `[Array, Function]` | `null` | Bucket array: `{ label, count, color, caption }`, youngest band first. **Each field may itself be a closure.** |

**Normalization & the strict hide rule.** A bucket without a `label` is dropped — it is not a band a reader can interpret. Unlike the funnel's segments, **empty buckets are KEPT**: the bands are a fixed scale, and "0 in 7+ days" is the reassuring half of the reading. They are dimmed (`--empty` modifier) rather than dropped, so the scale stays intact. The section as a whole still hides via `v-if="buckets.length && total > 0"` — with nothing ageing there is no backlog to triage, and a row of four zeroes reads as a problem where there is none.

**Colour.** Same contract as §2.4, written per bucket as `--aql-ageing-color`. The 3px top rail is what makes the bands read as one graded scale rather than four unrelated tiles.

**Styling.** All rules are `.aql-ageing*` in `custom.scss`; no `<style>` block. Buckets are `col` (equal width, one row), and the band label wraps to two lines like `.aql-metrics__label`, since four bands across a phone leave ~80px each.

**Spacing / `$attrs`.** Same contract as §2.4.

### 2.8 `DistributionBars` — Ranked Categorical Breakdown

```html
<Section section="DistributionBars" :items="[...]" />
```

Answers **"where is this concentrated?"** A row of counters states five numbers; a ranked set of bars states their *shape*, because each bar is drawn relative to the largest and the reader sees the distribution rather than reconstructing it. Built entirely from `q-linear-progress` and Quasar utility classes — no charting library (CORE_ARCHITECTURE_RULES §7, Quasar-First).

Entirely **dimension-agnostic**. Provinces, cities, warehouses, suppliers, payment modes: the projection from records to `{ label, count }` belongs to the calling resource's JS modifier, exactly as it does for `MetricCards` and `WorkflowFunnel`. The first consumer is `_ui/AQL/components/Master/Outlets/Index/DistributionBars.js`, which supplies three groups — Province, City, Area.

**Two accepted `items` shapes.** A flat `[{ label, count }]` renders one group and no selector; a grouped `[{ key, label, items: [{ label, count }] }]` renders a `q-btn-toggle` above the bars so the reader switches dimension without leaving the card. A toggle with one option is a label wearing a button's clothes, so the selector is omitted below two groups.

**Props catalog** — `title`, `items` and `color` accept `Function`, evaluated through `evaluateProp` with the `(record, config)` signature.

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `title` | `[String, Function]` | `''` | Divider label above the card. Omitted when empty. |
| `items` | `[Array, Function]` | `null` | Flat or grouped, per above. **Function-valued in a JS modifier**, or it latches the empty first tick. |
| `color` | `[String, Function]` | `'primary'` | One colour for the whole set — the bars are one measurement, not a legend. |
| `maxBars` | `Number` | `8` | Bars before the tail collapses into one `+ N more` caption line. A breakdown is a shape; thirty bars is a table. |
| `cardClass` | `[String, Array, Object]` | `''` | The calling UI's card shell. **Deliberately empty here**: a framework base may not import a `_ui/{Ui}/_config/`, so the resource's JS modifier relays its own `ui.cardClass` (UI_MODULE_DEVELOPER_GUIDE.md §10.1). |
| `rowStaggerMs` | `Number` | `40` | Per-row entrance delay, matching the UI's `rowStaggerMs` token. |

**Normalization & the strict hide rule.** A bar without a label, or with a count of zero, is dropped — an invisible bar still costs a row. A **group** whose bars all drop is removed from the selector entirely rather than offered and then found empty: a tenant that never fills `Area` gets no Area tab. When every group drops, the section renders nothing at all (§9.2 rule 2).

**Selection.** The user's choice is held separately from the resolved active group, so a selection that becomes invalid as data lands (its group emptied out) falls back silently to the first available group instead of leaving the card blank.

**Styling.** No `<style>` block — every class is Quasar's own or one of the canonical shared families (`.aql-detail-row`, `.aql-flex-wrap-text`) already in `custom.scss`. `inheritAttrs: false`, per §12.1's leaf rule.

**Spacing / `$attrs`.** Same contract as §2.4.

---


---

⬑ Back to **[﻿# AQL Page and Section System Guide](UI_PAGE_AND_SECTION_SYSTEM.md)**.

---

⬑ Back to **[﻿# AQL Page and Section System Guide](UI_PAGE_AND_SECTION_SYSTEM.md)**.
