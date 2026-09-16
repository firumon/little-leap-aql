# Dashboard Widgets Library

This document is the deep guide for all 15 base widgets.

## What is true for every widget

- **Only the picture**: The widget draws only the chart or list picture. The box around it owns the tile title, caption, menu buttons, and the loading spinner.
- **Two states only**: A widget has only two states: empty and drawn. When data is missing or bad, it shows a clean empty state.
- **Brand colors**: Widgets never use hardcoded hex codes. Colors come from the tenant's brand settings. When a tenant changes brand colors, all charts update at once.
- **The eight-color series**: When a chart needs multiple colors, it uses this fixed order:
  1. `primary`
  2. `secondary`
  3. `accent`
  4. `info`
  5. `primary`, 35% lighter
  6. `secondary`, 35% lighter
  7. `primary`, 60% lighter
  8. `secondary`, 60% lighter
  Past 8 the series repeats.
  `positive`, `negative`, and `warning` are never in this series. They mean good, bad, and needs attention, so a fifth product drawn in red would read as a problem.
- **Four density tiers**: Sizing is measured on the tile box itself, never on the browser screen:
  - `micro` (< 160px): Picture only. No words or numbers.
  - `compact` (160px to 279px): Picture with the most important numbers.
  - `standard` (280px to 519px): Full picture with labels and ticks.
  - `wide` (520px and above): Full picture with side legends and captions.
- **Aspect and height unit**: Heights snap to 40px grid units using:
  `height = Math.ceil((aspect ? Math.max(minHeight, width / aspect) : minHeight) / 40) * 40`.
- **No test harness.** There is no page that draws every widget at once any more. After changing a widget, check it on a real dashboard tile, and check the other presets that share its base — they are listed under "Presets" in this file.

---

## GaugeBase

### 1. What it draws and when to pick it
It draws a round meter like a speedometer in a car. It shows one value out of a maximum.

**When to pick it over ProgressBase**:
Pick GaugeBase when you want a dial or needle feel, like water pressure in a pipe or truck speed. Pick ProgressBase when you want a straight bar or a liquid tank filling up.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `value` | Number \| String | `null` | Any number | Current reading to display |
| `max` | Number \| String | `null` | Number > 0 | Top end of the dial |
| `sweep` | String | `'half'` | `'half'`, `'horseshoe'`, `'full'` | Shape of the arc |
| `thickness` | String | `'medium'` | `'thin'`, `'medium'`, `'thick'` | Thickness of the track ring |
| `showNeedle` | Boolean | `false` | `true`, `false` | Draws a pointing needle |
| `color` | String | `'primary'` | Any brand color name | Fill color of the arc |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Any text or component | Message shown when data is missing |
| `emptyIcon` | String | `'speed'` | Quasar icon name | Icon shown in empty state |
| `emptyIconColor` | String | `'grey-5'` | Color name | Color of empty state icon |

### 3. Data shape
Expects a single value and a maximum number:
```json
{
  "value": 68,
  "max": 100
}
```

### 4. Density tiers
- `micro`: Ring only. Value text and needle are hidden.
- `compact`: Ring, needle, and bold central number.
- `standard`: Full ring, needle, central number, and min/max edge numbers.
- `wide`: Full ring with large centered number and scale labels.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `SpeedoGauge` | `sweep="half"`, `showNeedle=true` | 2 | 80px |
| `HorseshoeGauge` | `sweep="horseshoe"`, `thickness="medium"`, `showNeedle=false` | 1.33 | 90px |
| `RingGauge` | `sweep="full"`, `thickness="thin"`, `showNeedle=false` | 1 | 90px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Change preset props in the sheet config.
- **Modifier**: Add a `.js` modifier file under `src/_ui/` to change props.
- **Override**: Make a `.vue` file under `src/_ui/`. This is an SVG chart, so you cannot replace inner SVG nodes with HTML.

### 8. Edge cases handled
- `max <= 0` or missing: Shows empty state.
- `value > max`: Value stays capped at 100% of the ring.
- `value < 0`: Clamped to 0.

---

## ProgressBase

### 1. What it draws and when to pick it
It draws a single line or tank filling from 0 to 100%.

**When to pick it over GaugeBase**:
Pick ProgressBase when you have a linear target, like monthly sales goal reached or a water tank filled to 70%. Pick GaugeBase when you want a round dial.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `value` | Number \| String | `null` | Any number | Current filled value |
| `max` | Number \| String | `null` | Number > 0 | Total goal or capacity |
| `orientation` | String | `'horizontal'` | `'horizontal'`, `'vertical'` | Bar direction |
| `shape` | String | `'round'` | `'round'`, `'flat'`, `'segmented'` | End cap and bar styling |
| `showTrack` | Boolean | `true` | `true`, `false` | Shows quiet background track |
| `color` | String | `'primary'` | Any brand color name | Fill bar color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty state text |
| `emptyIcon` | String | `'trending_up'` | Icon name | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Expects a single value and maximum:
```json
{
  "value": 850,
  "max": 1000
}
```

### 4. Density tiers
- `micro`: Slim bar only. No percentage or labels.
- `compact`: Bar with percentage text on the right or top.
- `standard`: Full bar with percentage and min/max goal text.
- `wide`: Full bar with clear values and goal markers.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `LinearProgress` | `orientation="horizontal"`, `shape="round"`, `showTrack=true` | 6 | 64px |
| `StepProgress` | `orientation="horizontal"`, `shape="segmented"`, `showTrack=true` | 6 | 64px |
| `TankLevel` | `styleVariant="flat"`, `orientation="vertical"` | 0.25 | 80px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Adjust preset props in sheet settings.
- **Modifier**: Use a `.js` modifier under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `max <= 0`: Shows empty state.
- `value > max`: Bar fills to 100% without overflowing its box.
- `value === 0`: Shows empty bar track at 0%.

---

## BulletBase

### 1. What it draws and when to pick it
It draws a performance bar sitting inside colored background zones, with a vertical target marker line.

**When to pick it over ProgressBase**:
Pick BulletBase when you need to show if a score is Bad, Good, or Great, and whether it crossed a specific target line.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `value` | Number \| String | `null` | Any number | Current achieved number |
| `target` | Number \| String | `null` | Any number | Goal line position |
| `max` | Number \| String | `null` | Number > 0 | Maximum axis value |
| `zones` | Array | `[]` | Array of numbers | Cutoff points for color zones |
| `orientation` | String | `'horizontal'` | `'horizontal'`, `'vertical'` | Direction of the bullet |
| `color` | String | `'primary'` | Brand color name | Bar color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty text |
| `emptyIcon` | String | `'adjust'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Expects a value, target, optional max, and zones:
```json
{
  "value": 78,
  "target": 85,
  "zones": [50, 75, 100]
}
```

### 4. Density tiers
- `micro`: Value bar and target line only. No zone text or numbers.
- `compact`: Value bar, target line, and final value.
- `standard`: Value bar, target line, background zones, and numbers.
- `wide`: Full bullet with zone numbers and target indicator.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `QuotaBullet` | `orientation="horizontal"`, `zoneStyle="muted"`, `markerShape="line"` | 5 | 64px |
| `DeliveryBullet` | `orientation="vertical"`, `zoneStyle="contrast"`, `markerShape="triangle"` | 0.25 | 100px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Tweak target, zones, and color.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override file under `src/_ui/`.

### 8. Edge cases handled
- `max` not supplied: Automatically calculated from max of value, target, and zones.
- `value === 0`: Draws a 0-width bar with the target marker still visible.
- `target missing`: Draws background zones and bar without target line.

---

## WaffleBase

### 1. What it draws and when to pick it
It draws a neat square grid of dots or blocks (like a 10x10 waffle of 100 dots) that fill up to show a percentage.

**When to pick it over ProgressBase**:
Pick WaffleBase when you want users to count parts of a whole, like "42 out of 100 outlets visited". ProgressBase is just a smooth line; WaffleBase gives distinct pieces.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `value` | Number \| String | `null` | Any number | Number of completed items |
| `max` | Number \| String | `null` | Number > 0 | Total number of items |
| `gridSize` | String | `'10x10'` | `'10x10'`, `'5x5'` | 100 cells or 25 cells |
| `blockShape` | String | `'square'` | `'square'`, `'circle'` | Shape of each dot |
| `fillDirection` | String | `'bottom-up'` | `'bottom-up'`, `'left-right'` | Direction dots light up |
| `color` | String | `'primary'` | Brand color name | Active dot color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty text |
| `emptyIcon` | String | `'grid_view'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Expects a value and a maximum:
```json
{
  "value": 46,
  "max": 100
}
```

### 4. Density tiers
- `micro`: Grid of dots only. No caption or numbers.
- `compact`: Grid of dots with percentage label below.
- `standard`: Grid with "46 of 100 · 46%" caption below.
- `wide`: Centered grid with clear text.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `PercentWaffle` | `gridSize="10x10"`, `blockShape="square"` | 1 | 80px |
| `VisitDotGrid` | `gridSize="5x5"`, `blockShape="circle"`, `fillDirection="left-right"` | 1 | 80px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Change grid size, shape, and color.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `width or height is 0`: SVG does not render negative radius.
- `value === 0`: All dots stay in the quiet track color.
- `value > max`: Caps cleanly at 100% of the grid dots.

---

## MetricBase

### 1. What it draws and when to pick it
It draws a very big number in plain HTML with a change badge (like `+12.4%`) and a subtitle below.

**When to pick it over other widgets**:
MetricBase is pure HTML. Pick it when you want a fast, high-impact key number with a comparison to last month or yesterday.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `value` | Number \| String \| Function \| Object | `null` | Any number or renderable | Main big number |
| `compare` | Number \| String | `null` | Any number | Number from prior period |
| `deltaLabel` | String \| Function \| Object | `null` | Text or component | Custom delta text or component |
| `caption` | String \| Function \| Object | `''` | Text or component | Subtitle text below number |
| `arrowStyle` | String | `'angled'` | `'angled'`, `'vertical'`, `'none'` | Direction arrow style |
| `badgeShape` | String | `'pill'` | `'pill'`, `'ghost'` | Change badge container style |
| `sentiment` | String | `'auto'` | `'auto'`, `'neutral'` | Auto sets color by direction |
| `invert` | Boolean | `false` | `true`, `false` | If true, down is good (e.g. returns, costs) |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty state text |
| `emptyIcon` | String | `'pin'` | Icon name | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Expects a value, optional compare value, and caption:
```json
{
  "value": 14200,
  "compare": 12800,
  "caption": "vs last month"
}
```

### 4. Density tiers
- `micro`: Big value only. Badge and caption hidden.
- `compact`: Big value and change badge.
- `standard`: Big value, badge with arrow, and caption below.
- `wide`: Large layout with clear spacing.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `MetricDelta` | `sentiment="auto"`, `invert=false` | none | 48px |
| `MetricDeltaInverse` | `sentiment="auto"`, `invert=true` | none | 48px |
| `MetricPlain` | `arrowStyle="none"`, `sentiment="neutral"` | none | 48px |

### 6. Slots
- `#value`: Replace the main number.
- `#delta`: Replace the change badge.
- `#caption`: Replace the bottom subtitle.
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Renderable cells**: `value`, `delta`, and `caption` all pass through `<Renderable>`. You can plug in a custom chip, badge, or button!
- **Sheet**: Change format, currency, and compare rules.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `compare missing or 0`: Change badge is omitted safely.
- `value === compare`: Shows neutral `0.0%` badge with no up/down arrow.
- `value < 0`: Formats correctly with a minus sign.

---

## BarBase

### 1. What it draws and when to pick it
**This base replaces three.** A simple bar chart is a stack of one, so grouped and stacked are a `mode`, not separate widgets.

It draws vertical columns or horizontal bars. It supports single series, grouped bars, stacked bars, and 100% share bars.

**When to pick it over RankedListBase**:
Pick BarBase when you want to measure values against a true numeric axis or stack parts together. Pick RankedListBase when you want clean HTML rows with product names, numbers, and rank badges.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of objects | Items for single bar mode |
| `series` | Array | `[]` | Array of series objects | Series for grouped or stacked mode |
| `categories` | Array | `[]` | Array of strings | Category labels along the axis |
| `orientation` | String | `'vertical'` | `'vertical'`, `'horizontal'` | Column or row layout |
| `mode` | String | `'single'` | `'single'`, `'grouped'`, `'stacked'`, `'percent100'` | Bar grouping strategy |
| `showLegend` | Boolean | `true` | `true`, `false` | Shows top series legend |
| `color` | String | `'primary'` | Brand color name | Base color for single items |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty state text |
| `emptyIcon` | String | `'bar_chart'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Single mode uses `items`:
```json
{
  "items": [
    { "label": "Deira Souk", "value": 840 },
    { "label": "Al Barsha", "value": 1120 }
  ]
}
```
Grouped or stacked mode uses `series`:
```json
{
  "series": [
    {
      "name": "5 Gallon Can",
      "items": [{ "label": "Mon", "value": 400 }, { "label": "Tue", "value": 520 }]
    },
    {
      "name": "500ml Bottle",
      "items": [{ "label": "Mon", "value": 180 }, { "label": "Tue", "value": 240 }]
    }
  ]
}
```

### 4. Density tiers
- `micro`: Bars only. Axis lines, numbers, and labels are hidden.
- `compact`: Bars with brief category labels.
- `standard`: Full axis ticks, zero line, category labels, and top values.
- `wide`: Spacious layout with top legend and clear labels.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `ColumnBar` | `orientation="vertical"`, `mode="single"` | 1.78 | 120px |
| `HorizontalRankBar` | `orientation="horizontal"`, `mode="single"` | 1.33 | 120px |
| `CompactBar` | `orientation="auto"`, `mode="single"`, `barWidth="slim"`, `showValueLabels=false` | 1.78 | 80px |
| `GroupedColumn` | `orientation="vertical"`, `mode="grouped"` | 1.78 | 130px |
| `GroupedBar` | `orientation="horizontal"`, `mode="grouped"` | 1.33 | 130px |
| `StackedColumn` | `orientation="vertical"`, `mode="stacked"`, `minTier="compact"` | 1.78 | 120px |
| `StackedBar` | `orientation="horizontal"`, `mode="stacked"`, `minTier="compact"` | 1.33 | 120px |
| `Percent100Bar` | `orientation="horizontal"`, `mode="percent100"`, `barWidth="thick"`, `minTier="compact"` | 1.33 | 120px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Choose preset, orientation, and colors.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `negative values`: In single and stacked modes, bars grow downwards or leftwards from the zero line. In percent100 mode, negative values have no whole to be part of, so it safely shows empty state.
- `value === 0`: Draws zero-height bar; axis remains clean.
- `single item`: Centers the bar neatly.

---

## ProportionBase

### 1. What it draws and when to pick it
It draws a single segmented bar where colored slices sit side by side to show parts of one whole total.

**When to pick it over BarBase**:
Pick ProportionBase when you have only one total to divide (like current warehouse stock split by bottle size). Pick BarBase when you want to compare multiple different bars over time.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, color }` | Parts of the total |
| `orientation` | String | `'horizontal'` | `'horizontal'`, `'vertical'` | Direction of the bar |
| `splitStyle` | String | `'gap'` | `'gap'`, `'flush'` | Gaps between segments |
| `color` | String | `'primary'` | Brand color name | Default color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty text |
| `emptyIcon` | String | `'view_week'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Expects an array of items with values:
```json
{
  "items": [
    { "label": "Full Cans", "value": 1420 },
    { "label": "Empty Returns", "value": 430 },
    { "label": "Damaged", "value": 50 }
  ]
}
```

### 4. Density tiers
- `micro`: Segmented bar only. No legend or text.
- `compact`: Bar with compact 2-column legend below.
- `standard`: Bar with percentage labels and full legend rows.
- `wide`: Spacious bar with clear legend layout.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `ShareStrip` | `orientation="horizontal"`, `splitStyle="continuous"`, `barHeight="thin"` | 6 | 64px |
| `StockStatusStrip` | `orientation="horizontal"`, `splitStyle="gap"`, `barHeight="thick"` | 6 | 64px |
| `VerticalShareStrip` | `orientation="vertical"`, `splitStyle="continuous"`, `barHeight="thick"` | 0.25 | 90px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Select preset and item colors.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `one part at 95%`: Large part fills the bar; tiny slivers remain visible. Inner labels only draw inside segments wide enough to hold them.
- `item with value 0`: Omitted from the bar and legend.
- `total <= 0`: Shows empty state.

---

## DonutBase

### 1. What it draws and when to pick it
It draws a round pie chart or circular ring divided into slices.

**When to pick it over RadialBase**:
Pick DonutBase when all pieces add up to 100% of a whole (like total revenue split by product). Pick RadialBase when each arc is an independent target.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, color }` | Slices of the pie |
| `holeSize` | String | `'medium'` | `'none'`, `'medium'`, `'large'` | Center cutout size (`none` for solid pie) |
| `sweepAngle` | String | `'full'` | `'full'`, `'half'` | Full circle or semi-circle |
| `sliceGap` | String | `'small'` | `'none'`, `'small'` | Space between slices |
| `color` | String | `'primary'` | Brand color name | Default color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty text |
| `emptyIcon` | String | `'pie_chart'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Expects an array of items with values:
```json
{
  "items": [
    { "label": "5 Gallon Can", "value": 5400 },
    { "label": "500ml Bottle", "value": 2100 },
    { "label": "Dispenser Rental", "value": 1100 }
  ]
}
```

### 4. Density tiers
- `micro`: Donut ring only. No text or legend.
- `compact`: Donut ring with compact legend below.
- `standard`: Ring with center total and legend below.
- `wide`: Side-by-side layout: ring on the left, legend list on the right.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `RingDonut` | `holeSize="medium"`, `sweepAngle="full"` | 1 | 90px |
| `SolidPie` | `holeSize="none"`, `sweepAngle="full"`, `sliceGap="none"` | 1 | 90px |
| `HalfDonut` | `holeSize="large"`, `sweepAngle="half"` | 2 | 70px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Pick preset, hole size, and colors.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `one slice at 95%`: Large slice takes almost full circle. In standard and wide tiers, tiny slices use tidy leader lines. In half donut, leader lines are suppressed to stay clean.
- `item with value 0`: Omitted from the chart.
- `total <= 0`: Shows empty state.

---

## RadialBase

### 1. What it draws and when to pick it
It draws concentric rings sitting inside each other, like Apple Watch activity rings.

**When to pick it over DonutBase**:
Pick RadialBase when you have 2 to 5 separate goals (like Daily Sales, Van Visits, and Cleaning Audits) that each have their own maximum. DonutBase slices share one total; RadialBase rings are separate targets.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, max, color }` | Each ring's data |
| `sweep` | String | `'full'` | `'full'`, `'horseshoe'` | Complete circle or open horseshoe |
| `capStyle` | String | `'round'` | `'round'`, `'butt'` | Ends of the progress arcs |
| `trackBackground` | Boolean | `true` | `true`, `false` | Quiet background ring tracks |
| `color` | String | `'primary'` | Brand color name | Default ring color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty text |
| `emptyIcon` | String | `'donut_large'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Expects up to 5 items, each with value and max:
```json
{
  "items": [
    { "label": "Sales Target", "value": 840, "max": 1000 },
    { "label": "Restock Visits", "value": 18, "max": 20 },
    { "label": "Sanitizations", "value": 5, "max": 8 }
  ]
}
```

### 4. Density tiers
- `micro`: Nested rings only. No text.
- `compact`: Rings with clean center area.
- `standard`: Rings with legend rows below.
- `wide`: Rings on the left, full legend with progress numbers on the right.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `ActivityRings` | `capStyle="round"`, `sweep="full"`, `trackBackground=true` | 1 | 110px |
| `TargetArches` | `capStyle="flat"`, `sweep="horseshoe"`, `trackBackground=true` | 1.33 | 110px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Adjust items, max values, and colors.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `value > max`: Progress ring caps at 100% without overlapping itself.
- `value === 0`: Colored arc is 0 length; quiet background track remains visible.
- `invalid max (<= 0)`: Shows empty state.

---

## FunnelBase

### 1. What it draws and when to pick it
It draws a stepped or smooth funnel showing drop-off across stages of a workflow.

**When to pick it over RankedListBase**:
Pick FunnelBase when your data follows a chain of events where each stage loses items from the previous stage (like New Inquiries -> Price Quotes -> Confirmed Orders).

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, color }` | Workflow stages |
| `direction` | String | `'vertical'` | `'vertical'`, `'horizontal'` | Direction of flow |
| `styleVariant` | String | `'stepped'` | `'stepped'`, `'smooth'` | Stepped blocks or smooth tapered funnel |
| `color` | String | `'primary'` | Brand color name | Base color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty text |
| `emptyIcon` | String | `'filter_alt'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Expects an ordered list of stages:
```json
{
  "items": [
    { "label": "Leads", "value": 240 },
    { "label": "Quotes", "value": 160 },
    { "label": "Negotiation", "value": 90 },
    { "label": "Delivered", "value": 65 }
  ]
}
```

### 4. Density tiers
- `micro`: Tapered funnel shape only.
- `compact`: Funnel shapes with stage values.
- `standard`: Full funnel with stage labels, counts, and drop-off percentages.
- `wide`: Spacious horizontal or vertical pipeline layout.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `SalesPipelineFunnel` | `direction="vertical"`, `shape="smooth"`, `neckStyle="pinch"`, `minTier="compact"` | 0.75 | 120px |
| `ApprovalFunnel` | `direction="vertical"`, `shape="stepped"`, `neckStyle="straight"`, `minTier="compact"` | 0.75 | 120px |
| `HorizontalFunnel` | `direction="horizontal"`, `shape="smooth"`, `neckStyle="straight"`, `minTier="compact"` | 2 | 100px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Configure stages and colors.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `stage value 0`: Drawn with a minimum readable neck so it does not vanish.
- `lopsided stage (e.g. 95% drop)`: Clamps stage width so labels and stages stay aligned.
- `empty items`: Shows empty state.

---

## AgeingBase

### 1. What it draws and when to pick it
It draws a horizontal stacked bar or stepped blocks split into time overdue brackets (like 0-30, 31-60, 61-90, 90+ days), colored from calm green to warning red.

**When to pick it over ProportionBase**:
Pick AgeingBase when showing overdue bills or old inventory by age buckets. AgeingBase uses alert severity colors. Pick ProportionBase for product categories or status shares.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, color }` | Age brackets |
| `bucketStyle` | String | `'bar'` | `'bar'`, `'blocks'` | Continuous bar or stepped blocks |
| `color` | String | `'primary'` | Brand color name | Base color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty text |
| `emptyIcon` | String | `'history'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Expects ordered age brackets:
```json
{
  "items": [
    { "label": "0-30 Days", "value": 45000, "color": "positive" },
    { "label": "31-60 Days", "value": 18000, "color": "info" },
    { "label": "61-90 Days", "value": 7500, "color": "warning" },
    { "label": "90+ Days", "value": 3200, "color": "negative" }
  ]
}
```

### 4. Density tiers
- `micro`: Colored bar or blocks only. No text.
- `compact`: Bar with bracket amounts below.
- `standard`: Full bar with age labels, amounts, and percentages.
- `wide`: Spacious layout with clear severity legends.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `DebtAgeing` | `bucketStyle="blocks"`, `dangerTint="escalating"`, `showBaseline=true` | 1.78 | 100px |
| `OldStockAgeing` | `bucketStyle="staircase"`, `dangerTint="last-only"`, `showBaseline=false` | 1.78 | 100px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Adjust age buckets and colors.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `one bucket at 95%`: Large bucket takes most of the bar; smaller overdue buckets remain visible.
- `bucket with value 0`: Omitted from the bar display.
- `total <= 0`: Shows empty state.

---

## RankedListBase

### 1. What it draws and when to pick it
It draws a neat HTML list of top items. Each row has a rank number badge, item name, subtitle caption, value number, and a soft tinted background bar.

**When to pick it over BarBase**:

**How it differs from a horizontal bar chart:**

| Feature | RankedList | BarBase horizontal |
|---|---|---|
| Rank badge | **Yes** | No |
| Caption line under each row | **Yes** | No |
| Order | Always biggest first | Whatever order the data comes in |

RankedListBase is built with pure HTML. Pick it when you have long product names, need subtitle captions, or want to put custom chips and badges into rows. Pick BarBase when you need a strict SVG chart with a numeric axis.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, caption, color }` | List rows |
| `rowSpacing` | String | `'tight'` | `'tight'`, `'cozy'` | Row padding |
| `barStyle` | String | `'fill'` | `'fill'`, `'capsule'`, `'none'` | Background highlight pill shape |
| `showRankNumber` | Boolean | `true` | `true`, `false` | Shows 1, 2, 3 rank badge |
| `color` | String | `'primary'` | Brand color name | Highlight bar color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty text |
| `emptyIcon` | String | `'format_list_numbered'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Expects a list of ranked items:
```json
{
  "items": [
    { "label": "5 Gallon Can", "value": 8420, "caption": "Top refill SKU" },
    { "label": "500ml Bottle x24", "value": 4180, "caption": "Retail carton" },
    { "label": "1.5L Bottle x12", "value": 2100, "caption": "Family pack" }
  ]
}
```

### 4. Density tiers
- `micro`: Shows top 2 or 3 rows with rank badge and value only. Subtitle caption is hidden. Never goes blank.
- `compact`: Rank badge, label, and value number.
- `standard`: Rank badge, label, subtitle caption, and value number.
- `wide`: Comfortable spacious rows with full descriptions.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `TopProductsList` | `rowSpacing="tight"`, `barStyle="fill"` | none | 160px |
| `LowStockList` | `rowSpacing="cozy"`, `barStyle="capsule"`, `color="negative"` | none | 220px |

### 6. Slots
- `#rank`: Replace the rank number badge.
- `#label`: Replace the item name.
- `#caption`: Replace the subtitle caption.
- `#value`: Replace the number on the right.
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Renderable cells**: `label`, `caption`, `value`, and rank badges all go through `<Renderable>`. You can easily inject a status chip, image, or link!
- **Sheet**: Adjust row spacing and bar styles.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `missing caption`: Caption line is hidden cleanly without leaving blank space.
- `item with value 0`: Highlight bar has 0% width; text stays aligned.
- `empty items`: Shows empty state.

---

## HeatGridBase

### 1. What it draws and when to pick it
It draws a grid of boxes colored by activity level. Quiet times are light, and busy times are deep color.

**When to pick it over WaffleBase**:
WaffleBase counts finished items (on vs off). HeatGridBase measures heat or intensity (how busy each hour of the day or day of the week is).

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value }` | Data for 1D hour strip |
| `matrix` | Object | `null` | `{ rows, columns, values }` | Data for 2D route grid |
| `layout` | String | `'strip'` | `'strip'`, `'matrix'` | Single row strip or 2D matrix |
| `color` | String | `'primary'` | Brand color name | Heat color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty text |
| `emptyIcon` | String | `'calendar_view_month'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
For a strip (like 24 hours):
```json
{
  "items": [
    { "label": "08:00", "value": 12 },
    { "label": "09:00", "value": 45 },
    { "label": "10:00", "value": 95 }
  ]
}
```
For a matrix (like 7 days x 4 shifts):
```json
{
  "matrix": {
    "rows": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "columns": ["Morning", "Noon", "Afternoon", "Evening"],
    "values": [
      [10, 45, 80, 20],
      [15, 60, 95, 30]
    ]
  }
}
```

### 4. Density tiers
- `micro`: Colored squares only. No text labels.
- `compact`: Squares with minimal edge labels.
- `standard`: Full grid with column hour or shift headers.
- `wide`: Complete labeled matrix with row and column names.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `HourHeatStrip` | `layout="strip"`, `cellRound="none"`, `cellGap="tight"` | 5 | 40px |
| `WeekRouteMatrix` | `layout="matrix"` | 1.78 | 120px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Choose strip or matrix and brand color.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `all values 0`: All boxes show base quiet track color.
- `extreme peak`: Shading scales from 0 to peak value smoothly.
- `empty data`: Shows empty state.

---

## LineBase

### 1. What it draws and when to pick it
**This base replaces three.** Line, area, and sparkline are one picture with different switches.

It draws a line or filled area chart plotting readings along a calendar date scale. It uses round Y-axis tick marks.

**When to pick it over other widgets**:
LineBase is for trends over time. It places points on a true calendar timeline, not by row index. A 2-week gap looks like a real gap. Two readings on one day both plot cleanly.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `points` | Array | `[]` | Array of `{ x, y }` | Points for single line |
| `series` | Array | `[]` | Array of `{ name, points }` | Multiple lines |
| `curve` | String | `'smooth'` | `'smooth'`, `'straight'`, `'step'` | Line curve math |
| `fill` | String | `'none'` | `'none'`, `'fade'`, `'solid'` | Area fill below line |
| `lineWidth` | String | `'medium'` | `'thin'`, `'medium'` | Stroke thickness |
| `showGrid` | Boolean | `true` | `true`, `false` | Horizontal grid lines |
| `showPoints` | Boolean | `false` | `true`, `false` | Dots on every data point |
| `showEndDot` | Boolean | `false` | `true`, `false` | Dot on last data point |
| `color` | String | `'primary'` | Brand color name | Line color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty text |
| `emptyIcon` | String | `'show_chart'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Single line uses `points`:
```json
{
  "points": [
    { "x": "2026-09-03", "y": 1420 },
    { "x": "2026-09-04", "y": 1680 },
    { "x": "2026-09-05", "y": 1540 }
  ]
}
```
Multiple lines use `series`:
```json
{
  "series": [
    {
      "name": "5 Gallon Can",
      "points": [{ "x": "2026-09-04", "y": 840 }, { "x": "2026-09-05", "y": 920 }]
    },
    {
      "name": "500ml Bottle",
      "points": [{ "x": "2026-09-04", "y": 320 }, { "x": "2026-09-05", "y": 370 }]
    }
  ]
}
```

### 4. Density tiers
- `micro`: Line or area only. No axis lines, text labels, or numbers.
- `compact`: Line with grid lines. Y-axis labels omitted to save width.
- `standard`: Full grid lines, Y-axis tick values, zero baseline, and date labels.
- `wide`: Full chart with top series legend and detailed date ticks.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `MiniTrendLine` | `curve="smooth"`, `fill="none"`, `showGrid=false`, `showEndDot=true` | 3 | 32px |
| `AreaSpark` | `curve="smooth"`, `fill="fade"`, `showGrid=false`, `showEndDot=false` | 3 | 32px |
| `StepSpark` | `curve="step"`, `fill="none"`, `showGrid=false`, `showEndDot=true` | 3 | 32px |
| `DailySalesLine` | `curve="smooth"`, `fill="none"`, `showGrid=true`, `showPoints=true` | 1.78 | 120px |
| `StaffVisitsLine` | `curve="straight"`, `fill="none"`, `showGrid=true` | 1.78 | 120px |
| `StockVolumeArea` | `curve="smooth"`, `fill="fade"`, `showGrid=true` | 1.78 | 120px |
| `RestockStepArea` | `curve="step"`, `fill="solid"`, `showGrid=true` | 1.78 | 120px |
| `OrderVsDeliveryLine` | Multi-series, `curve="smooth"`, `showGrid=true`, `showEndDot=true` | 1.78 | 130px |
| `OutletCompareLine` | Multi-series, `curve="straight"`, `lineWidth="thin"`, `showGrid=true` | 1.78 | 130px |

### 6. Slots
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Sheet**: Adjust curve, fill, line width, grid, and points.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `negative values`: Y-axis baseline moves to the middle, zero tick line is drawn, and area fills spread out both ways from zero. Negatives keep their series color.
- `time gaps`: Spaced by true calendar dates, so a 2-week gap looks like a real gap.
- `two readings on same date`: Both points draw cleanly with a vertical step.
- `real zero`: Sits right on the zero baseline line.
- `empty points or series`: Shows empty state.

---

## TimelineBase

### 1. What it draws and when to pick it
It draws a clean HTML list of chronological events linked by a connector line, with event markers, labels, dates, and captions.

**When to pick it over RankedListBase**:
RankedListBase ranks items by amount with highlight bars. TimelineBase tracks events over time in chronological order, with connecting track lines.

### 2. Full prop table

| Prop | Type | Default | Allowed values | What it does |
| --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, date, caption, color, marker, icon }` | Event items |
| `direction` | String | `'vertical'` | `'vertical'`, `'horizontal'` | Vertical or horizontal layout |
| `markerShape` | String | `'dot'` | `'dot'`, `'icon'` | Round dot or icon marker |
| `showConnector` | Boolean | `true` | `true`, `false` | Draws line connecting markers |
| `color` | String | `'primary'` | Brand color name | Default marker color |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text or component | Empty text |
| `emptyIcon` | String | `'timeline'` | Icon name | Empty icon |
| `emptyIconColor` | String | `'grey-5'` | Color name | Empty icon color |

### 3. Data shape
Expects an ordered array of event items:
```json
{
  "items": [
    { "label": "Draft Created", "date": "2026-09-06", "caption": "Requisition PO-8410 created" },
    { "label": "Approved", "date": "2026-09-07", "caption": "Verified stock balance" },
    { "label": "Delivered", "date": "2026-09-09", "caption": "Customer signed invoice" }
  ]
}
```

### 4. Density tiers
- `micro`: Shows top 2 or 3 rows with label and date only. Captions hidden. Never goes blank.
- `compact`: Clean markers, labels, and dates.
- `standard`: Full markers, labels, dates, and subtitle captions.
- `wide`: Comfortable spacious layout with full descriptions.

### 5. Presets

| Preset | Fixed props | Aspect | Min height |
| --- | --- | --- | --- |
| `EventTimeline` | `direction="vertical"`, `markerShape="dot"`, `showConnector=true` | none | 240px |
| `CompactTimeline` | `direction="horizontal"`, `markerShape="dot"`, `showConnector=true` | 3 | 60px |

### 6. Slots
- `#marker`: Replace the event marker.
- `#label`: Replace the event title text.
- `#date`: Replace the event date text.
- `#caption`: Replace the subtitle description.
- `#empty`: Custom empty state replacement.

### 7. How to customize
- **Renderable cells**: `label`, `date`, `caption`, and `marker` all pass through `<Renderable>`. You can plug in custom chips, status icons, or buttons!
- **Sheet**: Adjust direction, marker shape, and connector line.
- **Modifier**: Use a `.js` modifier file under `src/_ui/`.
- **Override**: Make a `.vue` override under `src/_ui/`.

### 8. Edge cases handled
- `missing caption`: Caption block is omitted cleanly.
- `long labels or captions`: Truncated cleanly with CSS ellipsis.
- `empty items`: Shows empty state.


