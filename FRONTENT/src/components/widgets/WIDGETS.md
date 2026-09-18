# Dashboard Widgets Library

This document is the canonical hub for the 15 base widgets and their presets.

---

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
- **Aspect and height hints**: Height comes from content via `Frame.vue` CSS, using the preset's hints:
  - **List-style widgets** (`rowHeight` set, no `aspect`): `minHeight = max(preset.minHeight, items.length * preset.rowHeight)`.
  - **Picture-style widgets** (`aspect` set): CSS `aspect-ratio: <aspect>` with `preset.minHeight` as floor.
  - **Metric widgets** (neither): `preset.minHeight` as `min-height`.
- **Component structure**: The 15 base drawing components live at `FRONTENT/src/components/widgets/abstract/<Base>.vue`. Presets are thin data descriptors at `FRONTENT/src/components/widgets/<PresetName>.js`. `<Widget>` connects presets to bases. It accepts optional `name`, `base`, and `preset` props; all other attributes arrive as overrides via `$attrs`. Resolution order: overrides = `$attrs`; preset from `props.preset` or `widgets/<name>.js`; base from `props.base ?? preset?.base`; draws `abstract/<base>.vue` with `{ ...(preset?.props || {}), ...overrides }`. If nothing was asked for, it renders nothing. If something was asked for but not found, it draws a visible warning (`No widget: <name>` or `No base: <base or name>`). There is no `_ui` lookup for widgets.
- **`valueFormat` prop**: Every base widget supports `valueFormat: { type: Function, default: null }`. When provided, displayed item values and value-axis ticks format via `formatValue(v, valueFormat, fallback)`. Percentage shares, deltas, counts, dates, and category labels are unaffected. Because a sheet cell is JSON, `valueFormat` can only be set from a DBI in code.
- **No test harness.** There is no page that draws every widget at once. After changing a widget, check it on a real dashboard tile, and check the other presets that share its base.

---

## Parts of this document

The 15 base widgets are documented across three topic documents:

| Part | Base Widgets Covered |
|---|---|
| [Dashboard Widgets — Chart Bases](WIDGETS_CHARTS.md) | [BarBase](WIDGETS_CHARTS.md#barbase), [LineBase](WIDGETS_CHARTS.md#linebase), [DonutBase](WIDGETS_CHARTS.md#donutbase), [RadialBase](WIDGETS_CHARTS.md#radialbase), [FunnelBase](WIDGETS_CHARTS.md#funnelbase) |
| [Dashboard Widgets — Metric & Gauge Bases](WIDGETS_METRICS_GAUGES.md) | [MetricBase](WIDGETS_METRICS_GAUGES.md#metricbase), [GaugeBase](WIDGETS_METRICS_GAUGES.md#gaugebase), [ProgressBase](WIDGETS_METRICS_GAUGES.md#progressbase), [BulletBase](WIDGETS_METRICS_GAUGES.md#bulletbase), [WaffleBase](WIDGETS_METRICS_GAUGES.md#wafflebase) |
| [Dashboard Widgets — List & Grid Bases](WIDGETS_LISTS_GRIDS.md) | [RankedListBase](WIDGETS_LISTS_GRIDS.md#rankedlistbase), [TimelineBase](WIDGETS_LISTS_GRIDS.md#timelinebase), [AgeingBase](WIDGETS_LISTS_GRIDS.md#ageingbase), [ProportionBase](WIDGETS_LISTS_GRIDS.md#proportionbase), [HeatGridBase](WIDGETS_LISTS_GRIDS.md#heatgridbase) |

---

### Where each base widget lives

| Base Widget | File | Presets |
|---|---|---|
| **AgeingBase** | [WIDGETS_LISTS_GRIDS.md](WIDGETS_LISTS_GRIDS.md#ageingbase) | `DebtAgeing`, `OldStockAgeing` |
| **BarBase** | [WIDGETS_CHARTS.md](WIDGETS_CHARTS.md#barbase) | `ColumnBar`, `HorizontalRankBar`, `CompactBar`, `GroupedColumn`, `GroupedBar`, `StackedColumn`, `StackedBar`, `Percent100Bar` |
| **BulletBase** | [WIDGETS_METRICS_GAUGES.md](WIDGETS_METRICS_GAUGES.md#bulletbase) | `QuotaBullet`, `DeliveryBullet` |
| **DonutBase** | [WIDGETS_CHARTS.md](WIDGETS_CHARTS.md#donutbase) | `RingDonut`, `SolidPie`, `HalfDonut` |
| **FunnelBase** | [WIDGETS_CHARTS.md](WIDGETS_CHARTS.md#funnelbase) | `SalesPipelineFunnel`, `ApprovalFunnel`, `HorizontalFunnel` |
| **GaugeBase** | [WIDGETS_METRICS_GAUGES.md](WIDGETS_METRICS_GAUGES.md#gaugebase) | `SpeedoGauge`, `HorseshoeGauge`, `RingGauge` |
| **HeatGridBase** | [WIDGETS_LISTS_GRIDS.md](WIDGETS_LISTS_GRIDS.md#heatgridbase) | `HourHeatStrip`, `WeekRouteMatrix` |
| **LineBase** | [WIDGETS_CHARTS.md](WIDGETS_CHARTS.md#linebase) | `MiniTrendLine`, `AreaSpark`, `StepSpark`, `DailySalesLine`, `StaffVisitsLine`, `StockVolumeArea`, `RestockStepArea`, `OrderVsDeliveryLine`, `OutletCompareLine` |
| **MetricBase** | [WIDGETS_METRICS_GAUGES.md](WIDGETS_METRICS_GAUGES.md#metricbase) | `MetricDelta`, `MetricDeltaInverse`, `MetricPlain` |
| **ProgressBase** | [WIDGETS_METRICS_GAUGES.md](WIDGETS_METRICS_GAUGES.md#progressbase) | `LinearProgress`, `StepProgress`, `TankLevel` |
| **ProportionBase** | [WIDGETS_LISTS_GRIDS.md](WIDGETS_LISTS_GRIDS.md#proportionbase) | `ShareStrip`, `StockStatusStrip`, `VerticalShareStrip` |
| **RadialBase** | [WIDGETS_CHARTS.md](WIDGETS_CHARTS.md#radialbase) | `ActivityRings`, `TargetArches` |
| **RankedListBase** | [WIDGETS_LISTS_GRIDS.md](WIDGETS_LISTS_GRIDS.md#rankedlistbase) | `TopProductsList`, `LowStockList` |
| **TimelineBase** | [WIDGETS_LISTS_GRIDS.md](WIDGETS_LISTS_GRIDS.md#timelinebase) | `EventTimeline`, `CompactTimeline` |
| **WaffleBase** | [WIDGETS_METRICS_GAUGES.md](WIDGETS_METRICS_GAUGES.md#wafflebase) | `PercentWaffle`, `VisitDotGrid` |

---

<!-- Anchors for backward compatibility -->
<a id="gaugebase"></a>
<a id="progressbase"></a>
<a id="bulletbase"></a>
<a id="wafflebase"></a>
<a id="metricbase"></a>
<a id="barbase"></a>
<a id="proportionbase"></a>
<a id="donutbase"></a>
<a id="radialbase"></a>
<a id="funnelbase"></a>
<a id="ageingbase"></a>
<a id="rankedlistbase"></a>
<a id="heatgridbase"></a>
<a id="linebase"></a>
<a id="timelinebase"></a>
