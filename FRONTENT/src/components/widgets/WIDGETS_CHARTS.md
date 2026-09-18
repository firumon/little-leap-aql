# Dashboard Widgets — Chart Bases

> Canonical guide for chart-type base widgets: BarBase, LineBase, DonutBase, RadialBase, and FunnelBase.

All widgets adhere to the core principles defined in the main [WIDGETS.md](WIDGETS.md) hub.

---

<a id="barbase"></a>
## BarBase

### 1. What it draws and when to pick it
**This base replaces three.** A simple bar chart is a stack of one, so grouped and stacked are a `mode`, not separate widgets.

It draws vertical columns or horizontal bars. It supports single series, grouped bars, stacked bars, and 100% share bars.

**When to pick it over RankedListBase**:
Pick BarBase when you want to measure values against a true numeric axis or stack parts together. Pick RankedListBase when you want clean HTML rows with product names, numbers, and rank badges.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `items` | Array | `null` | Array of `{ label, value }` | Yes | Items for single series mode |
| `series` | Array | `null` | Array of `{ name, items }` | Yes | Series for grouped or stacked mode |
| `orientation` | String | `'auto'` | `'horizontal'`, `'vertical'`, `'auto'` | Yes | Direction of bars |
| `mode` | String | `'single'` | `'single'`, `'grouped'`, `'stacked'`, `'percent100'` | Yes | Grouping / stacking strategy |
| `barWidth` | String | `'normal'` | `'slim'`, `'normal'`, `'thick'` | Yes | Thickness of bars |
| `rowHeight` | Number | `46` | Positive number | Yes | Per-row height hint for horizontal orientation |
| `showValueLabels` | Boolean | `true` | `true`, `false` | Yes | Shows value labels above columns or beside bars |
| `signColor` | Boolean | `false` | `true`, `false` | Yes | Uses positive/negative colors based on sign |
| `color` | String | `'primary'` | Brand color name | Yes | Base theme color role |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats value text and numeric axis ticks |
| `minTier` | String | `'micro'` | `'micro'`, `'compact'`, `'standard'`, `'wide'` | Yes | Minimum tier required to render |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'bar_chart'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

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

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `ColumnBar` | `orientation="vertical"`, `mode="single"` | `aspect` | 1.78 | 120px |
| `HorizontalRankBar` | `orientation="horizontal"`, `mode="single"` | `rowHeight` | 46px | 46px |
| `CompactBar` | `orientation="auto"`, `mode="single"`, `barWidth="slim"`, `showValueLabels=false` | `aspect` | 1.78 | 80px |
| `GroupedColumn` | `orientation="vertical"`, `mode="grouped"` | `aspect` | 1.78 | 130px |
| `GroupedBar` | `orientation="horizontal"`, `mode="grouped"` | `rowHeight` | 46px | 46px |
| `StackedColumn` | `orientation="vertical"`, `mode="stacked"`, `minTier="compact"` | `aspect` | 1.78 | 120px |
| `StackedBar` | `orientation="horizontal"`, `mode="stacked"`, `minTier="compact"` | `rowHeight` | 46px | 46px |
| `Percent100Bar` | `orientation="horizontal"`, `mode="percent100"`, `barWidth="thick"`, `minTier="compact"` | `rowHeight` | 46px | 46px |

### 6. Slots
- `#empty`: Custom empty state replacement.

---

<a id="linebase"></a>
## LineBase

### 1. What it draws and when to pick it
**This base replaces three.** Line, area, and sparkline are one picture with different switches.

It draws a line or filled area chart plotting readings along a calendar date scale. It uses round Y-axis tick marks.

**When to pick it over other widgets**:
LineBase is for trends over time. It places points on a true calendar timeline, not by row index. A 2-week gap looks like a real gap. Two readings on one day both plot cleanly.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `points` | Array | `[]` | Array of `{ x, y }` | Yes | Points for single line |
| `series` | Array | `[]` | Array of `{ name, points }` | Yes | Multiple line series |
| `curve` | String | `'smooth'` | `'smooth'`, `'straight'`, `'step'` | Yes | Line curve interpolation |
| `fill` | String | `'none'` | `'none'`, `'fade'`, `'solid'` | Yes | Area fill below line |
| `lineWidth` | String | `'medium'` | `'thin'`, `'medium'` | Yes | Stroke thickness |
| `showGrid` | Boolean | `true` | `true`, `false` | Yes | Horizontal grid lines |
| `showPoints` | Boolean | `false` | `true`, `false` | Yes | Dots on every data point |
| `showEndDot` | Boolean | `false` | `true`, `false` | Yes | Dot on the last data point |
| `color` | String | `'primary'` | Brand color name | Yes | Line theme color |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats Y-axis value ticks |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'show_chart'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

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

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `MiniTrendLine` | `curve="smooth"`, `fill="none"`, `showGrid=false`, `showEndDot=true` | `aspect` | 3 | 32px |
| `AreaSpark` | `curve="smooth"`, `fill="fade"`, `showGrid=false`, `showEndDot=false` | `aspect` | 3 | 32px |
| `StepSpark` | `curve="step"`, `fill="none"`, `showGrid=false`, `showEndDot=true` | `aspect` | 3 | 32px |
| `DailySalesLine` | `curve="smooth"`, `fill="none"`, `showGrid=true`, `showPoints=true` | `aspect` | 1.78 | 120px |
| `StaffVisitsLine` | `curve="straight"`, `fill="none"`, `showGrid=true` | `aspect` | 1.78 | 120px |
| `StockVolumeArea` | `curve="smooth"`, `fill="fade"`, `showGrid=true` | `aspect` | 1.78 | 120px |
| `RestockStepArea` | `curve="step"`, `fill="solid"`, `showGrid=true` | `aspect` | 1.78 | 120px |
| `OrderVsDeliveryLine` | Multi-series, `curve="smooth"`, `showGrid=true`, `showEndDot=true` | `aspect` | 1.78 | 130px |
| `OutletCompareLine` | Multi-series, `curve="straight"`, `lineWidth="thin"`, `showGrid=true` | `aspect` | 1.78 | 130px |

### 6. Slots
- `#empty`: Custom empty state replacement.

---

<a id="donutbase"></a>
## DonutBase

### 1. What it draws and when to pick it
It draws a round pie chart or circular ring divided into slices.

**When to pick it over RadialBase**:
Pick DonutBase when all pieces add up to 100% of a whole (like total revenue split by product). Pick RadialBase when each arc is an independent target.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, color }` | Yes | Slices of the pie/ring |
| `holeSize` | String | `'medium'` | `'none'`, `'medium'`, `'large'` | Yes | Center cutout size (`none` for solid pie) |
| `sweepAngle` | String | `'full'` | `'full'`, `'half'` | Yes | Full circle or semi-circle arc |
| `sliceGap` | String | `'small'` | `'none'`, `'small'` | Yes | Gap between adjacent slices |
| `color` | String | `'primary'` | Brand color name | Yes | Default fallback color |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats value in tooltip/legend |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'pie_chart'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

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

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `RingDonut` | `holeSize="medium"`, `sweepAngle="full"` | `aspect` | 1 | 90px |
| `SolidPie` | `holeSize="none"`, `sweepAngle="full"`, `sliceGap="none"` | `aspect` | 1 | 90px |
| `HalfDonut` | `holeSize="large"`, `sweepAngle="half"` | `aspect` | 2 | 70px |

### 6. Slots
- `#empty`: Custom empty state replacement.

---

<a id="radialbase"></a>
## RadialBase

### 1. What it draws and when to pick it
It draws concentric rings sitting inside each other, like Apple Watch activity rings.

**When to pick it over DonutBase**:
Pick RadialBase when you have 2 to 5 separate goals (like Daily Sales, Van Visits, and Cleaning Audits) that each have their own maximum. DonutBase slices share one total; RadialBase rings are separate targets.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, max, color }` | Yes | Each ring's data (up to 5 rings) |
| `capStyle` | String | `'round'` | `'round'`, `'flat'` | Yes | Arc end styling |
| `sweep` | String | `'full'` | `'full'`, `'horseshoe'` | Yes | Complete circle or open horseshoe arc |
| `trackBackground` | Boolean | `true` | `true`, `false` | Yes | Renders quiet background ring tracks |
| `color` | String | `'primary'` | Brand color name | Yes | Default fallback color |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats value text in legend/label |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'donut_large'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

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

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `ActivityRings` | `capStyle="round"`, `sweep="full"`, `trackBackground=true` | `aspect` | 1 | 110px |
| `TargetArches` | `capStyle="flat"`, `sweep="horseshoe"`, `trackBackground=true` | `aspect` | 1.33 | 110px |

### 6. Slots
- `#empty`: Custom empty state replacement.

---

<a id="funnelbase"></a>
## FunnelBase

### 1. What it draws and when to pick it
It draws a stepped or smooth funnel showing drop-off across stages of a workflow.

**When to pick it over RankedListBase**:
Pick FunnelBase when your data follows a chain of events where each stage loses items from the previous stage (like New Inquiries -> Price Quotes -> Confirmed Orders).

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `items` | Array | `[]` | Array of `{ label, value, color }` | Yes | Ordered workflow stages |
| `direction` | String | `'vertical'` | `'vertical'`, `'horizontal'` | Yes | Flow direction |
| `shape` | String | `'smooth'` | `'stepped'`, `'smooth'` | Yes | Stepped blocks or smooth tapered funnel |
| `neckStyle` | String | `'straight'` | `'straight'`, `'pinch'` | Yes | End neck tapering style |
| `color` | String | `'primary'` | Brand color name | Yes | Base theme color |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats stage value numbers |
| `minTier` | String | `'compact'` | `'micro'`, `'compact'`, `'standard'`, `'wide'` | Yes | Minimum tier required to render |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'filter_alt'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

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

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `SalesPipelineFunnel` | `direction="vertical"`, `shape="smooth"`, `neckStyle="pinch"`, `minTier="compact"` | `aspect` | 0.75 | 120px |
| `ApprovalFunnel` | `direction="vertical"`, `shape="stepped"`, `neckStyle="straight"`, `minTier="compact"` | `aspect` | 0.75 | 120px |
| `HorizontalFunnel` | `direction="horizontal"`, `shape="smooth"`, `neckStyle="straight"`, `minTier="compact"` | `aspect` | 2 | 100px |

### 6. Slots
- `#empty`: Custom empty state replacement.
