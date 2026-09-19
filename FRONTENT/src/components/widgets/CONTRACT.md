# Dashboard Widget Contract

> Read this **before** writing any widget. It fixes the boring parts, so all widgets look like one family.
> Companion file: [FEATURE_DASHBOARD_ENGINE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_ENGINE.md).
>
> **The three widget documents:**
> - [REGISTRY.md](REGISTRY.md): Picks a preset. Only preset names go in the sheet.
> - [WIDGETS.md](WIDGETS.md): The deep guide per base widget (props, data shapes, density tiers, and slots).
> - [CONTRACT.md](CONTRACT.md): The rules every widget must obey.

---

## 1. What a widget is

A widget draws **one picture**. That is all.

It does not draw the card. It does not draw the title, the caption, or the control inputs. The frame owns those.
The tile still passes the card's non-empty `title`, `subtitle` and `caption` as props. A widget that declares them may use them. A widget that does not simply ignores them. An empty one is never passed, so a widget's own fallback text still works.

The widget system consists of:
- `FRONTENT/src/components/widgets/Widget.vue` — the single picture component.
- `FRONTENT/src/components/widgets/abstract/<Base>.vue` — the 15 base drawing components.
- `FRONTENT/src/components/widgets/<PresetName>.js` — preset data files with base reference, fixed props, and height hints.

There is no `_ui` lookup for widgets. A tenant who wants a different card layout customizes the frame.

---

## 2. Rules it inherits

These are not new. They already bind every reusable component in AQL. A widget is no different.

| Rule | Where it comes from |
|---|---|
| **No `<style>` block. Ever.** Widget CSS goes to `src/css/widgets.scss` as a named class. | `CORE_ARCHITECTURE_RULES.md` §7 |
| **`aspect`, `minHeight`, and `rowHeight` go in the preset `.js`** file, so the engine and frame can read them. | this contract, part 9.1 |
| **Max ~400 lines per file.** Split if it grows. | §9 |
| **Quasar first.** Custom CSS only when Quasar cannot do it. | §7 |
| **`inheritAttrs: false`** on any component with a DOM root. | `renderable_contract.md` §3.5 |
| **Every replaceable cell routes through `Renderable`.** | `renderable_contract.md` §1 |
| **Animation honours `prefers-reduced-motion`.** | §7 |
| **No business logic.** No stores, no services, no API calls. | §5 |

**Why no `<style>`:** a widget is an override target. A tenant `.vue` override cannot inherit a scoped style, so scoped CSS breaks the override quietly.

**Widgets get their own stylesheet.** A new file, `FRONTENT/src/css/widgets.scss`, holds widget CSS only. It is imported from `app.scss` beside `custom.scss`:

```scss
@import 'transitions';
@import 'custom';
@import 'widgets';
```

`quasar.config.js:25-27` lists only `app.scss`, so nothing else needs changing there.

Every class in it starts with `.aql-widget-`. Nothing else goes in this file, and widget CSS goes nowhere else.

---

## 3. Prop vocabulary

Same idea always gets the same name. No synonyms.

### 3.1 Data props

| Prop | Type | Meaning |
|---|---|---|
| `value` | Number, String | One number. For single-value widgets. |
| `max` | Number | The whole, when `value` is a part. |
| `items` | Array | Many parts. `[{ label, value, color, caption }]` |
| `series` | Array | Many named groups. `[{ name, color, items }]` or `[{ name, color, points }]` |
| `points` | Array | Ordered points over time. `[{ x, y }]` |

**Helper inputs**, used beside a main one:

| Prop | Type | Meaning |
|---|---|---|
| `target` | Number | A line to beat. Not the same as `max`. |
| `zones` | Array | Bands behind the value. `[{ upTo, color }]` |
| `compare` | Number | The earlier value, so a widget can work out the change |

### 3.1a One main input, with shorthand

A widget takes **one** main input. But two shorthands are allowed, and the base normalises them:

- `points` becomes a `series` of one.
- `items` becomes a `series` of one group.

This is what lets one `LineBase` serve a sparkline, an area chart, and a multi-line chart, and one `BarBase` serve simple, grouped, and stacked bars. Without it we would carry three near-identical bases each.

### 3.2 Look props

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `color` | String | `'primary'` | A colour **role**, not a hex. See part 5. |
| `valueFormat` | Function | `null` | Formats displayed item values and value-axis ticks. Defaults to standard number formatting when null. |
| `orientation` | String | `'auto'` | `'horizontal'`, `'vertical'`, `'auto'` |
| `dense` | Boolean | `false` | Tighter drawing |
| `thickness` | String | — | `'thin'`, `'medium'`, `'thick'` |
| `sweep` | String | — | `'half'`, `'horseshoe'`, `'full'` |
| `holeSize` | String | — | `'none'`, `'medium'`, `'large'`. `'none'` makes a donut a pie |
| `mode` | String | — | Set per base. E.g. bars: `'single'`, `'grouped'`, `'stacked'`, `'percent100'` |

**Use word tokens, not raw numbers.** `thickness: 'thick'` beats `thickness: 0.18`. A sheet author can read a word. A number is a guess, and every widget would guess differently.

### 3.3 Empty state props

| Prop | Type | Default |
|---|---|---|
| `emptyText` | String, Function, Object | `'Nothing to show'` |
| `emptyIcon` | String | per widget |
| `emptyIconColor` | String | `'grey-5'` |

Copied from `abstract/List.vue:31-38`, which already does this well.

---

## 4. Slot-shaped or not

The test from `renderable_contract.md` §1: **could a tenant want a chip, a badge, or their own component where this renders text?** If yes, it is slot-shaped.

**Slot-shaped** — declare as `[String, Function, Object]` and render through `<Renderable>`:

`label`, `caption`, `display`, `emptyText`, and every per-item cell in a repeated row.

**Not slot-shaped** — leave the real type, it is doing real work:

`value`, `max`, `color`, `orientation`, `size`, `dense`, `thickness`, and anything used as a number or a flag.

Mirror the widened type on **every** component in the chain. A preset sits in front of a base, so a modifier's prop hits the preset first and fails there.

### 4.1 `Renderable` only reaches HTML widgets

You cannot put a chip, a badge, or a tenant's own component inside an `<svg>`. So a cell drawn as SVG text is closed to customization, whatever we write here.

That splits the set in two.

**HTML widgets — Metric, RankedList, Timeline.** These are text and rows. Nothing in them needs SVG. They are built as plain HTML, and every caller-facing cell goes through `Renderable`:

- Metric: the value, the delta label, the caption
- RankedList: the rank badge, the name, the value, the caption. Supports `valueFormat` (function to format the right-hand value label) and `captionPlacement` (`'below'` or `'inline'`). When `barStyle="capsule"`, inner content has horizontal padding so text does not touch the capsule ends.
- Timeline: the label, the date, the caption, the marker

So a tenant can drop a chip beside a row, or an icon in place of a dot, with a one-line `.js` modifier.

**SVG widgets — the other twelve.** A gauge, a donut, a bar chart. These are pictures, and a picture has no cells to replace. They are customized by props, then by a `.js` modifier changing props, then by a full `.vue` override. `Renderable` is used only for `emptyText`.

**The test:** if the thing is text or a row, it is HTML. If it is a drawn shape, it is SVG. A widget never mixes the two.

---

## 5. Colour is resolved at run time. Never hardcoded.

A widget never writes `#D4A843`. Not in script, not in CSS, not in an SVG attribute.

**Why this is strict:** tenants will define their own brand colours. The whole theme must change with them, with no code edit. A hex frozen into a widget breaks that on day one.

**How:** use `resolveCssColor()` from `src/utils/colorHelpers.js:27`, or `var(--q-<role>)` straight in CSS.

Its own comment says why it works: Quasar brand colours are exposed as CSS custom properties, so they stay themable at run time.

| Input | What comes back | Follows the tenant? |
|---|---|---|
| `'primary'` | `var(--q-primary)` | **Yes** |
| `'red-10'` | a real hex, cached | No. It is frozen. |
| `'#e11d48'` | passed through | No |

**So widgets use brand roles only.** A Material palette name resolves to a fixed hex and stops following the tenant, so treat it as a last resort. A raw hex is not allowed at all.

In SVG, that means `:style="{ fill: resolveCssColor(color) }"` or a class from `widgets.scss` that uses `var(--q-primary)`. Never `fill="#0F2B4A"`.

The roles, from [quasar.variables.scss](../FRONTENT/src/css/quasar.variables.scss):

| Role | Use for |
|---|---|
| `primary` | Default. Neutral data. |
| `secondary`, `accent` | Highlight, second series |
| `positive` | Good. Done, paid, approved. |
| `negative` | Bad. Failed, overdue, rejected. |
| `warning` | Needs attention. Pending, due soon. |
| `info` | Neutral note |

### 5.1 The colour series

When a widget needs **many** colours — a donut with 6 parts — it walks one fixed series, in order.

The series is defined **once**, in one place. Every multi-part widget uses that same one. Never a palette per widget.

**Order:**

| # | Colour | How it is made |
|---|---|---|
| 1 | `primary` | brand navy |
| 2 | `secondary` | brand gold |
| 3 | `accent` | lighter gold |
| 4 | `info` | brand blue |
| 5 | primary, 35% lighter | derived at run time |
| 6 | secondary, 35% lighter | derived at run time |
| 7 | primary, 60% lighter | derived at run time |
| 8 | secondary, 60% lighter | derived at run time |

Past 8 parts, the series repeats. A chart with more than 8 parts is a design problem, not a colour problem — roll the tail into "Other" instead.

**State colours stay out of the series.** `positive`, `negative`, and `warning` carry meaning. If the fifth product in a list is drawn red, it reads as a problem when it is not. Those three are used only when the data really means good, bad, or needs attention.

**The lighter steps must be made at run time.** Do not use `--q-primary-light`. `custom.scss:5-17` builds those from SCSS at build time, so they freeze and stop following a tenant's brand.

**Use CSS `color-mix`, not a script helper:**

```
color-mix(in srgb, var(--q-primary) 65%, white)   // the 35% lighter step
color-mix(in srgb, var(--q-primary) 40%, white)   // the 60% lighter step
```

Do **not** build the tints with `colors.lighten(colors.getPaletteColor('primary'), 35)`.

`getPaletteColor` reads the DOM once and hands back a plain hex. Put that inside a `computed` and it has nothing reactive to track, so it caches for the life of the page. The four brand roles would keep following a tenant and the four tints would freeze at whatever the brand was on first render. That is worse than either choice alone, because half the chart follows and half does not.

`color-mix` is a live CSS value. Nothing to cache, nothing to recompute, and no fallback hex is needed.

**A caller's colour wins.** If `items[].color` is given, it beats the series for that part. It still goes through `resolveCssColor()`. In practice the caller supplies colours most of the time, and the series is the safe default when they do not.

### 5.2 A negative value is not automatically red

Below zero does not mean bad. A stock count correction, a credit note, a cool month — none of those are failures.

**Default: a negative bar keeps its series colour.** Only its direction changes.

Red is used in two cases, both deliberate:

- the item gives its own `color`
- the preset sets **`signColor: true`**, because the measure really is good above zero and bad below it — a variance, a profit, a surplus

So a variance chart still reads red and green. An adjustments chart does not scream.

### 5.3 A heat scale is one hue, never a rainbow

A heat grid, a heat strip, and any "more is darker" fill use **one** colour at changing opacity. Usually `primary`, from about 0.1 to 1.0.

Never walk the colour series for heat. A rainbow makes the reader hunt for a key, when the whole point is that darker means more.

---

## 6. The two states

A widget renders exactly one of **two** things.

| State | When | What |
|---|---|---|
| **Empty** | Data came, but it cannot be drawn | `#empty` slot, or the default icon and text |
| **Drawn** | Data is fine | The picture |

**Loading belongs to the engine**, not the widget. The frame shows the spinner while data is on its way, and a widget is only mounted once there is something to draw.

Two things to keep straight:

- **Empty here means "this widget cannot draw this data".** Wrong shape. Not enough parts. A gauge with no `max`.
- **Zero data is not this widget's problem.** The engine handles that, with the sheet's `empty` key. See engine spec part 6.4.

### 6.1 Settled edge cases

These come up in real data. Every widget answers them the same way.

| Case | What the widget does |
|---|---|
| `max` is 0 or missing | **Empty.** Not 0%. A gauge, progress bar or waffle cannot divide by zero, and a full-looking ring on no data is a lie. |
| `compare` is missing (`null`/`undefined`) | No badge at all. |
| `value` 0 and `compare` 0 | No badge at all. |
| `compare` is 0 and `value` > 0 | Show the number with a plain **"NEW"** badge. No arrow, no up or down colour. A change from zero is not a percentage. |
| A part has value 0 | Keep its place in the legend, draw nothing. Do not drop it — a missing row reads as a bug. |
| One part is 95% of the whole | Draw it true. Let small parts collapse to a sliver, and move their labels out to a leader line or the legend. Never fake a minimum slice size. |
| Values go below zero | The baseline moves off the bottom. Bars and areas draw both ways from it. Only `BarBase` and `LineBase` handle this — a donut or funnel with negative parts is meaningless, so it is **empty**. See 6.2 for what stacking does. |

So a widget's empty state is seen only when the sheet says `empty: 'show'`. That is expected.

Model the markup on `abstract/List.vue:23-38`, minus the loading row — keyed children inside one `TransitionGroup`, so the states cross-fade instead of popping.

---

### 6.2 Negatives, mode by mode

`BarBase` handles negatives, but not every mode can.

| Mode | With a negative value |
|---|---|
| `single` | Draws below the baseline. Keeps its series colour. |
| `grouped` | Same. Each bar goes its own way from the baseline. |
| `stacked` | **Diverging stack.** Positives stack upward from the baseline, negatives stack downward. Never mix the two in one direction. |
| `percent100` | **Empty.** |

**Why `percent100` must refuse.** A share needs a whole to be a share *of*. Add −310 and +45 and the total is 265, so one part is 117% and the bar runs off the end. That number is not merely ugly, it is false. There is no honest way to draw it, so the widget says it cannot.

---

## 7. Density

The widget asks **how wide am I**, never **what device is this**.

A composable gives the tier as a reactive value, using `ResizeObserver` on the widget root.

| Tier | Tile width | What shows |
|---|---|---|
| `micro` | under 160px | Picture only. No words. |
| `compact` | 160 to 280px | Picture and value. |
| `standard` | 280 to 520px | Picture, labels, values. **Phones land here.** |
| `wide` | over 520px | Everything. Axis, legend, side by side. |

Hard rules:

- **The picture is always drawn.** At every tier. It is never dropped.
- **Text is dropped, not shrunk.** Never squeeze a label to 8px to make it fit.
- **A list widget has no picture.** For RankedList and Timeline, "picture only" is meaningless — the rows *are* the content. At `micro` they show fewer rows with the shortest cell only (rank, a truncated name, the value) and drop every caption. They never go blank.
- **`orientation: 'auto'` flips to horizontal bars** at `compact` and `micro`. Labels then sit beside their own bar instead of being squeezed under it.
- A widget may **drop parts**, not only words. A donut at `micro` may show the top 3 and roll the rest into "Other".

### 7.1 Essential elements survive the tier

The tier table is the default, not a law. Some widgets carry one piece of text that **is** the meaning, not decoration.

A donut is the clear case. Slices with no legend are just coloured arcs. So a widget may mark **one** element as essential, and an essential element stays down to `compact`.

Only one per widget. If a widget claims two, the design is too busy for a small tile.

### 7.2 When a widget is too complex to shrink

Some pictures cannot be read small. A week-by-route heat matrix. A funnel. A grouped bar chart. Squeezing them into 160px gives mush, not information.

So a widget may declare **`minTier`** — the smallest tier at which its real picture still works.

Below that tier it draws a **simple stand-in**, not mush and not a blank:

- usually the total, as one number
- or a sparkline, if the data is over time

It is never hidden. The tile still says something true.

---

## 8. Base and preset
 
One base holds the SVG/HTML drawing in `abstract/<Base>.vue`. Presets are thin data descriptors in `<PresetName>.js`.
 
**Prop or new name:**
 
- A **prop** when the data stays the same and only the drawing changes.
- A **new name** when the data shape changes, or when the author thinks of it as a different thing.
 
**A preset holds no drawing code.** It is a small `.js` file declaring its base, fixed props, and height hints:
 
```js
// CompactBar.js
export default {
  base: 'BarBase',
  props: { orientation: 'auto', mode: 'single', barWidth: 'slim', showValueLabels: false },
  aspect: 1.78,
  minHeight: 80
}
```

### 8.1 Drawing with `Widget.vue`

`FRONTENT/src/components/widgets/Widget.vue` accepts three optional props:
- `name` (String) — preset file name.
- `base` (String) — base in `abstract/` to draw with.
- `preset` (Object) — inline preset object (`{ base, props, minHeight, aspect, rowHeight }`).

All other attributes arrive via `$attrs` as **overrides**. `inheritAttrs: false` is set.

**Resolution order**:
1. `overrides = $attrs`
2. `preset`: `props.preset` if given, else `widgets/<name>.js` if `name` is given, else no preset.
3. `base = props.base ?? preset?.base`
4. Draw `abstract/<base>.vue` with `{ ...(preset?.props || {}), ...overrides }`. Provided attributes win.

This allows custom frames to render directly with no preset file: `<Widget base="DonutBase" :items="..." />`.

**When nothing can be drawn**:
- If no `name`, `preset`, or `base` was asked for → renders nothing.
- If something was asked for but cannot be found → renders a small visible error:
  - `name` given but no `widgets/<name>.js` → `No widget: <name>`
  - no base could be resolved, or base not found in `abstract/` → `No base: <base or name>`
A broken or misspelled tile is always visible and never fails silently.
 
**Only presets are written in the sheet.** `ColumnBar`, `SolidPie`, `SpeedoGauge`. A base is never named in `App.Resources.Dashboard`.
 
---
 
## 9. Geometry
 
### 9.1 Height

A widget does not choose its own height. The card is as tall as what is inside it. There is no grid-row maths. The body height comes from the widget's height hints via CSS in `Frame.vue`:

Every widget preset carries up to three static numbers in its `.js` file:
 
| Number | Meaning |
|---|---|
| `aspect` | width divided by height, as a **number**. A donut is `1`. A 16 by 9 chart is `1.78`. A wide strip is `6`. Used for picture-style presets. |
| `minHeight` | the smallest height it can still be read at. Used by all presets. |
| `rowHeight` | the height of one row in a list or row-stack widget. Used for list-style presets. |

**The list vs picture rule:**
- **List-style presets** (horizontal/rank bars, ranked lists, vertical timelines, and row-stacked items): declare `rowHeight` and `minHeight`. Do NOT use `aspect`. The height grows and shrinks with the number of rows: `height = max(minHeight, items.length × rowHeight)`. A list with 1 row stays short; a list with 8 rows is tall.
- **Picture-style presets** (donuts, rings, lines, columns, gauges, radials, funnels, heat grids, waffles): declare `aspect` and `minHeight`. They scale as a whole picture with the cell width.
- **Metric presets**: declare `minHeight` only.

**These sit on the preset `.js` file, not the base.** One base can want very different shapes: a half gauge is `2`, a full ring is `1`. The base cannot hold one number for both. The preset knows which it is, so it declares them.

`Frame.vue` applies these hints to the body using CSS:
- `rowHeight` set → body min-height is the larger of `minHeight` and `items.length × rowHeight` (`items` or list data from the `widget` prop). A list with 2 rows is short; a list with 10 rows is tall.
- `aspect` set → CSS `aspect-ratio: <aspect>` on the body, with `minHeight` as a floor.
- neither → `minHeight` as `min-height`.
- no preset (inline `preset` prop or raw `base`) → read hints from inline `preset` if provided, else natural content height.

**The rule this puts on widgets: fill the height you are given, not only the width.** The root is a flex box that stretches, and the SVG scales in both directions. Crucially, a list-style base must draw to its row count, not only the Frame body (as `BarBase` horizontal now does, sizing its internal rows and SVG viewBox to the category count).

### 9.2 Time is spaced by date, not by index

For anything taking `points` or a `series` of points, the x position comes from the **date**, not from the position in the list.

Real data has holes. Deliveries stop on a holiday. A meter is not read for two weeks. Two readings land on one day.

Spacing by index makes a two-week hole look like one ordinary step. The line then reads as steady when it was not. That is a picture that lies.

Spacing by date shows the hole as a hole. That is the truth, and it is the point of the chart.

Two matching rules:

- **Two points on the same date** both draw. They do not merge and they do not overwrite.
- **A gap is not a zero.** A missing day is nothing. A day with a real 0 is a point on the baseline. They must not look the same.

### 9.3 Drawing

- SVG only. No chart library. See engine spec part 7.2.
- Every SVG has a `viewBox` and scales to its box. Never a fixed pixel width or height.
- The widget fills the space the engine gives it. It never sets its own margin or padding — the frame already did that. See `CORE_ARCHITECTURE_RULES.md` §7.1.2, invisible containers never pad.
- Numbers on screen go through the shared formatter. Money through `_C()` from `useCurrency`. A widget never writes its own money format.

---

### 9.4 Axis ticks must be nice numbers

Never cut the data range into equal parts. That gives gridlines at 655 and 2.3K, and nobody reads those.

**Round outward to a nice step first, then divide.**

1. Work out the rough step: `(hi - lo) / wanted number of lines`.
2. Round that step **up** to the nearest 1, 2, 2.5 or 5 times a power of ten.
3. Push `lo` down and `hi` up to whole multiples of that step.
4. Draw a line at every step between them.

| Data range | Wrong (range ÷ 3) | Right |
|---|---|---|
| 0 to 2,960 | 2.3K, 1.9K, 1.5K, 1.1K | 0, 1K, 2K, 3K |
| 0 to 983 | 983, 655, 328, 0 | 0, 250, 500, 750, 1000 |
| 0 to 157 | 157, 104, 52 | 0, 50, 100, 150 |

Zero is always a tick when the data includes it.

This lives in the shared scales and ticks composable, so every chart gets it once.

### 9.5 Files that will not fit in 400 lines

`BarBase` and `LineBase` carry scales, ticks, and axis labels. They will not fit the 400 line limit on their own.

Plan for that now, not later: pull scales and ticks into a shared composable both of them use. Two bases inventing their own tick maths is exactly the drift this contract exists to stop.

---

## 10. Naming

| Thing | Rule | Example |
|---|---|---|
| File | PascalCase, no `Widget` suffix | `Gauge.vue`, `BarChart.vue` |
| Base file | ends `Base` | `BarsBase.vue`, `GaugeBase.vue` |
| Sheet name | matches the file name | `widget: 'BarChart'` |
| CSS class | `aql-widget-` prefix, in `widgets.scss` | `.aql-widget-bar-track` |

---

## 11. A widget must never

- Draw a card, a title, a caption, or a control input
- Read a store, call a service, or touch the API
- Hardcode a resource name, a status word, or any colour value
- Write its own money or date format
- Carry a `<style>` block
- Set its own outer padding or margin
- Ask what the screen size is
- Grow past ~400 lines

---

## 12. Checklist before a widget is done

1. It draws only the picture.
2. Its main data prop is one of `value`, `items`, `series`, `points`.
3. Every replaceable cell goes through `Renderable`, and the widened type is mirrored on the preset too.
3b. Its preset declares `aspect` and `minHeight` (and `rowHeight` for list and timeline presets), and it fills the height it is given.
4. Every colour is a brand role through `resolveCssColor()` or `var(--q-*)`. No hex anywhere.
5. Both states render, and the empty state has a `#empty` slot. No loading state — that is the engine's.
5b. The edge cases in part 6.1 behave as written: `max: 0`, missing `compare` / `0 vs 0` (no badge), `compare: 0` with positive value ("NEW" badge), a zero part, a 95% part, and negative values.
6. It reads its own width and follows the four tiers.
7. The picture still draws at `micro`, or the preset declares `minTier` and a stand-in.
8. No `<style>` block. Any custom CSS is a named `.aql-widget-*` class in `widgets.scss`.
9. `inheritAttrs: false` is set.
10. Under 400 lines.
