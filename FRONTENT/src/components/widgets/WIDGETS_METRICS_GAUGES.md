# Dashboard Widgets — Metric & Gauge Bases

> Canonical guide for metric, gauge, progress, bullet, and waffle base widgets: MetricBase, GaugeBase, ProgressBase, BulletBase, and WaffleBase.

All widgets adhere to the core principles defined in the main [WIDGETS.md](WIDGETS.md) hub.

---

<a id="metricbase"></a>
## MetricBase

### 1. What it draws and when to pick it
It draws a very big number in plain HTML with a change badge (like `+12.4%`) and a subtitle below.

**When to pick it over other widgets**:
MetricBase is pure HTML. Pick it when you want a fast, high-impact key number with a comparison to last month or yesterday.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `value` | Number \| String \| Function \| Object | `null` | Any number, renderable, or string | Yes (scalar) | Main big number displayed |
| `compare` | Number \| String | `null` | Any number or string | Yes | Number from prior period to calculate delta |
| `deltaLabel` | String \| Function \| Object | `null` | Text, function, or component | Yes (string) | Custom delta text overriding calculated percentage |
| `caption` | String \| Function \| Object | `null` | Text, function, or component | Yes (string) | Subtitle text below number |
| `arrowStyle` | String | `'angled'` | `'angled'`, `'vertical'`, `'none'` | Yes | Direction arrow style in badge |
| `badgeShape` | String | `'pill'` | `'pill'`, `'ghost'` | Yes | Change badge container shape |
| `sentiment` | String | `'auto'` | `'auto'`, `'neutral'` | Yes | Auto sets badge color by delta sign |
| `invert` | Boolean | `false` | `true`, `false` | Yes | Inverts positive/negative color meaning (e.g. costs) |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats the main number |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'numbers'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

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

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `MetricDelta` | `sentiment="auto"`, `invert=false` | None (metric) | — | 48px |
| `MetricDeltaInverse` | `sentiment="auto"`, `invert=true` | None (metric) | — | 48px |
| `MetricPlain` | `arrowStyle="none"`, `sentiment="neutral"` | None (metric) | — | 48px |

### 6. Slots
- `#value`: Replace the main number.
- `#delta`: Replace the change badge.
- `#caption`: Replace the bottom subtitle.
- `#empty`: Custom empty state replacement.

---

<a id="gaugebase"></a>
## GaugeBase

### 1. What it draws and when to pick it
It draws a round meter like a speedometer in a car. It shows one value out of a maximum.

**When to pick it over ProgressBase**:
Pick GaugeBase when you want a dial or needle feel, like water pressure in a pipe or truck speed. Pick ProgressBase when you want a straight bar or a liquid tank filling up.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `value` | Number \| String | `null` | Any number | Yes | Current reading to display |
| `max` | Number \| String | `null` | Number > 0 | Yes | Top end of the dial |
| `sweep` | String | `'half'` | `'half'`, `'horseshoe'`, `'full'` | Yes | Arc angle shape |
| `thickness` | String | `'medium'` | `'thin'`, `'medium'`, `'thick'` | Yes | Thickness of track ring |
| `showNeedle` | Boolean | `false` | `true`, `false` | Yes | Renders a pointing needle |
| `color` | String | `'primary'` | Brand color name | Yes | Fill color of active arc |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats value text |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'speed'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

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

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `SpeedoGauge` | `sweep="half"`, `showNeedle=true` | `aspect` | 2 | 80px |
| `HorseshoeGauge` | `sweep="horseshoe"`, `thickness="medium"`, `showNeedle=false` | `aspect` | 1.33 | 90px |
| `RingGauge` | `sweep="full"`, `thickness="thin"`, `showNeedle=false` | `aspect` | 1 | 90px |

### 6. Slots
- `#empty`: Custom empty state replacement.

---

<a id="progressbase"></a>
## ProgressBase

### 1. What it draws and when to pick it
It draws a single line or tank filling from 0 to 100%.

**When to pick it over GaugeBase**:
Pick ProgressBase when you have a linear target, like monthly sales goal reached or a water tank filled to 70%. Pick GaugeBase when you want a round dial.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `value` | Number \| String | `null` | Any number | Yes | Current filled value |
| `max` | Number \| String | `null` | Number > 0 | Yes | Total goal or capacity |
| `orientation` | String | `'horizontal'` | `'horizontal'`, `'vertical'` | Yes | Direction of bar |
| `shape` | String | `'round'` | `'round'`, `'flat'`, `'segmented'` | Yes | End cap and segment style |
| `showTrack` | Boolean | `true` | `true`, `false` | Yes | Shows quiet background track |
| `color` | String | `'primary'` | Brand color name | Yes | Fill bar color |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats value text |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'trending_flat'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

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

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `LinearProgress` | `orientation="horizontal"`, `shape="round"`, `showTrack=true` | `aspect` | 6 | 64px |
| `StepProgress` | `orientation="horizontal"`, `shape="segmented"`, `showTrack=true` | `aspect` | 6 | 64px |
| `TankLevel` | `shape="flat"`, `orientation="vertical"` | `aspect` | 0.25 | 80px |

### 6. Slots
- `#empty`: Custom empty state replacement.

---

<a id="bulletbase"></a>
## BulletBase

### 1. What it draws and when to pick it
It draws a performance bar sitting inside colored background zones, with a vertical target marker line.

**When to pick it over ProgressBase**:
Pick BulletBase when you need to show if a score is Bad, Good, or Great, and whether it crossed a specific target line.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `value` | Number \| String | `null` | Any number | Yes | Current achieved number |
| `target` | Number \| String | `null` | Any number | Yes | Goal marker line position |
| `max` | Number \| String | `null` | Number > 0 | Yes | Maximum axis scale |
| `zones` | Array | `[]` | Array of numbers | Yes | Cutoff points for color zones |
| `orientation` | String | `'horizontal'` | `'horizontal'`, `'vertical'` | Yes | Layout direction |
| `zoneStyle` | String | `'muted'` | `'muted'`, `'contrast'` | Yes | Shading style of background zones |
| `markerShape` | String | `'line'` | `'line'`, `'triangle'` | Yes | Target marker indicator shape |
| `color` | String | `'primary'` | Brand color name | Yes | Value bar color |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats value text |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'adjust'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

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

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `QuotaBullet` | `orientation="horizontal"`, `zoneStyle="muted"`, `markerShape="line"` | `aspect` | 5 | 64px |
| `DeliveryBullet` | `orientation="vertical"`, `zoneStyle="contrast"`, `markerShape="triangle"` | `aspect` | 0.25 | 100px |

### 6. Slots
- `#empty`: Custom empty state replacement.

---

<a id="wafflebase"></a>
## WaffleBase

### 1. What it draws and when to pick it
It draws a neat square grid of dots or blocks (like a 10x10 waffle of 100 dots) that fill up to show a percentage.

**When to pick it over ProgressBase**:
Pick WaffleBase when you want users to count parts of a whole, like "42 out of 100 outlets visited". ProgressBase is just a smooth line; WaffleBase gives distinct pieces.

### 2. Full prop table

| Prop | Type | Default | Allowed values | Sheet-safe? | What it does |
| --- | --- | --- | --- | --- | --- |
| `value` | Number \| String | `null` | Any number | Yes | Number of completed items |
| `max` | Number \| String | `null` | Number > 0 | Yes | Total number of items |
| `gridSize` | String | `'10x10'` | `'10x10'`, `'5x5'` | Yes | 100 cells or 25 cells |
| `blockShape` | String | `'square'` | `'square'`, `'circle'` | Yes | Shape of each dot / cell |
| `fillDirection` | String | `'bottom-up'` | `'bottom-up'`, `'left-right'` | Yes | Direction cells light up |
| `color` | String | `'primary'` | Brand color name | Yes | Active cell fill color |
| `valueFormat` | Function | `null` | `Function(value)` | **DBI only** | Formats value text |
| `emptyText` | String \| Function \| Object | `'Nothing to show'` | Text, Function, Component | Yes (string) | Empty state message |
| `emptyIcon` | String | `'grid_view'` | Quasar icon name | Yes | Empty state icon |
| `emptyIconColor` | String | `'grey-5'` | Brand or palette color | Yes | Empty icon color |

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

### 5. Presets & Height hints

| Preset | Fixed props | Height hint type | Hint value | Min height |
| --- | --- | --- | --- | --- |
| `PercentWaffle` | `gridSize="10x10"`, `blockShape="square"` | `aspect` | 1 | 80px |
| `VisitDotGrid` | `gridSize="5x5"`, `blockShape="circle"`, `fillDirection="left-right"` | `aspect` | 1 | 80px |

### 6. Slots
- `#empty`: Custom empty state replacement.
