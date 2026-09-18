# Dashboard Widgets Registry

Only preset names go in the sheet. You never write a base name in the sheet.

Each preset is a small data file at `FRONTENT/src/components/widgets/<PresetName>.js` specifying its base, fixed props, and height hints (`minHeight`, `aspect`, `rowHeight`).
`<Widget name="PresetName" v-bind="data" />` loads the preset, draws its base from `widgets/abstract/<Base>.vue`, and renders the picture.
Provided props win over preset props. If a widget name is unknown or its base is missing, a visible warning is rendered. There is no `_ui` lookup for widgets.

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `SpeedoGauge` | Half-circle dial with a needle | `value`, `max` | Van speed, plant water pressure, daily delivery speed | [details](WIDGETS.md#gaugebase) |
| `HorseshoeGauge` | Open circular arc without needle | `value`, `max` | Cold room temperature, daily power load, dispenser test score | [details](WIDGETS.md#gaugebase) |
| `RingGauge` | Full round circular ring | `value`, `max` | Bottle line capacity used, warehouse bay fill share | [details](WIDGETS.md#gaugebase) |

## ProgressBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `LinearProgress` | Flat horizontal bar filling left to right | `value`, `max` | Monthly sales target reached, loading bay load share | [details](WIDGETS.md#progressbase) |
| `StepProgress` | Bar split into square blocks | `value`, `max` | Five-step sanitization test, weekly truck check rounds | [details](WIDGETS.md#progressbase) |
| `TankLevel` | Tall vertical tank filling from bottom | `value`, `max` | Raw water tank volume, clean tank water level | [details](WIDGETS.md#progressbase) |

## BulletBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `QuotaBullet` | Flat bar with goal line and bad-good color bands | `value`, `target`, `zones`, `max` | Monthly sales quota vs target, driver bottle delivery goal | [details](WIDGETS.md#bulletbase) |
| `DeliveryBullet` | Slim horizontal bar with a goal marker | `value`, `target`, `max` | Daily 5-gallon target, route stop completion rate | [details](WIDGETS.md#bulletbase) |

## WaffleBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `PercentWaffle` | 100 square dots in a 10 by 10 grid | `value`, `max` | Percent of all outlets visited today, dispenser sanitation pass rate | [details](WIDGETS.md#wafflebase) |
| `VisitDotGrid` | 25 round dots in a 5 by 5 grid | `value`, `max` | Weekly route completion, van fleet readiness | [details](WIDGETS.md#wafflebase) |

## MetricBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `MetricDelta` | Big bold number with a good or bad change badge | `value`, `compare`, `caption` | Today sales vs yesterday, total 5-gallon cans sold | [details](WIDGETS.md#metricbase) |
| `MetricDeltaInverse` | Big number where lower is better | `value`, `compare`, `caption` | Damaged bottles count, customer complaint count | [details](WIDGETS.md#metricbase) |
| `MetricPlain` | Big number with a quiet caption below | `value`, `caption` | Total dispenser count in field, total active drivers | [details](WIDGETS.md#metricbase) |

## BarBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `ColumnBar` | Vertical bars side by side | `items` (`label`, `value`) | Sales by outlet area, can refills by day of week | [details](WIDGETS.md#barbase) |
| `HorizontalRankBar` | Horizontal bars stacked downwards | `items` (`label`, `value`) | Can volume by driver name, top branch sales | [details](WIDGETS.md#barbase) |
| `CompactBar` | Thin horizontal bars in little space | `items` (`label`, `value`) | Van route check, small summary card of top SKUs | [details](WIDGETS.md#barbase) |
| `GroupedColumn` | Vertical bars grouped side by side per time unit | `series` (`name`, `items`) | 5-gallon vs small bottles sold over 6 days | [details](WIDGETS.md#barbase) |
| `GroupedBar` | Horizontal bars grouped per item | `series` (`name`, `items`) | Target vs actual bottles sold per sales agent | [details](WIDGETS.md#barbase) |
| `StackedColumn` | Tall vertical bars stacked in pieces | `series` (`name`, `items`) | Total sales split into cans, bottles, and dispenser rent | [details](WIDGETS.md#barbase) |
| `StackedBar` | Horizontal bars stacked in pieces | `series` (`name`, `items`) | Stock split into depot floor, vans, and cleaning bays | [details](WIDGETS.md#barbase) |
| `Percent100Bar` | Horizontal bars filling full width showing share % | `series` (`name`, `items`) | Share of wholesale vs retail sales per depot | [details](WIDGETS.md#barbase) |

## ProportionBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `ShareStrip` | Single horizontal bar split into colored pieces | `items` (`label`, `value`) | Total warehouse stock split by bottle size | [details](WIDGETS.md#proportionbase) |
| `StockStatusStrip` | Bar split with tight gaps between items | `items` (`label`, `value`) | Bottles categorized as clean, in wash, or scrap | [details](WIDGETS.md#proportionbase) |
| `VerticalShareStrip` | Single tall vertical bar split into pieces | `items` (`label`, `value`) | Van loading space filled by product category | [details](WIDGETS.md#proportionbase) |

## DonutBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `RingDonut` | Circular ring with a hollow center | `items` (`label`, `value`) | Revenue split by SKU, delivery cost split by zone | [details](WIDGETS.md#donutbase) |
| `SolidPie` | Full round pie chart | `items` (`label`, `value`) | Market share by region, staff shift distribution | [details](WIDGETS.md#donutbase) |
| `HalfDonut` | Semi-circular half donut ring | `items` (`label`, `value`) | Fuel budget spend, maintenance cost split | [details](WIDGETS.md#donutbase) |

## RadialBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `ActivityRings` | Concentric circles inside each other | `items` (`label`, `value`, `max`) | Daily team progress: sales goal, restock goal, route visits | [details](WIDGETS.md#radialbase) |
| `TargetArches` | Concentric open arcs | `items` (`label`, `value`, `max`) | Depot performance metrics: safety checks, volume, on-time rate | [details](WIDGETS.md#radialbase) |

## FunnelBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `SalesPipelineFunnel` | Vertical tapering funnel with step lines | `items` (`label`, `value`) | New customer leads to signed contracts, quotes to orders | [details](WIDGETS.md#funnelbase) |
| `ApprovalFunnel` | Flat step bars that narrow downwards | `items` (`label`, `value`) | Purchase orders from Draft to Approved to Paid | [details](WIDGETS.md#funnelbase) |
| `HorizontalFunnel` | Funnel flowing left to right | `items` (`label`, `value`) | Factory production line from raw water to boxed pallets | [details](WIDGETS.md#funnelbase) |

## AgeingBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `DebtAgeing` | Stacked horizontal bar colored green to red | `items` (`label`, `value`) | Customer unpaid bills by days overdue (0-30, 31-60, 61-90, 90+) | [details](WIDGETS.md#ageingbase) |
| `OldStockAgeing` | Stepped blocks showing shelf age | `items` (`label`, `value`) | Bottled water inventory age in storage days | [details](WIDGETS.md#ageingbase) |

## RankedListBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `TopProductsList` | Ranked list with numbers, names, and light bars | `items` (`label`, `value`, `caption`) | Top selling water SKUs, best sales staff of the month | [details](WIDGETS.md#rankedlistbase) |
| `LowStockList` | Ranked list of items needing attention | `items` (`label`, `value`, `caption`) | Depots lowest on 5-gallon caps, outlets needing immediate restock | [details](WIDGETS.md#rankedlistbase) |

## HeatGridBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `HourHeatStrip` | Strip of 24 boxes colored by activity level | `items` (`label`, `value`) | Order volume by hour of day, call center traffic | [details](WIDGETS.md#heatgridbase) |
| `WeekRouteMatrix` | 7 by 4 grid of colored intensity squares | `matrix` (`rows`, `columns`, `values`) | Weekly delivery route loads across morning, noon, and evening | [details](WIDGETS.md#heatgridbase) |

## LineBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `MiniTrendLine` | Tiny smooth line with an end dot | `points` (`x`, `y`) | Quick 7-day sales trend beside a big total number | [details](WIDGETS.md#linebase) |
| `AreaSpark` | Tiny smooth line with soft shaded fill below | `points` (`x`, `y`) | Water tank volume over 24 hours | [details](WIDGETS.md#linebase) |
| `StepSpark` | Tiny stepped line with an end dot | `points` (`x`, `y`) | Dispenser inventory step downs on a driver route | [details](WIDGETS.md#linebase) |
| `DailySalesLine` | Smooth curve with points and grid lines | `points` (`x`, `y`) | Daily can sales in AED over the last month | [details](WIDGETS.md#linebase) |
| `StaffVisitsLine` | Straight line segments with grid lines | `points` (`x`, `y`) | Outlet visits logged by field agents each day | [details](WIDGETS.md#linebase) |
| `StockVolumeArea` | Smooth curve with soft colored area fill | `points` (`x`, `y`) | Total cans held in stock across 30 days | [details](WIDGETS.md#linebase) |
| `RestockStepArea` | Stepped line with solid area fill | `points` (`x`, `y`) | Warehouse stock jumps after supplier deliveries arrive | [details](WIDGETS.md#linebase) |
| `OrderVsDeliveryLine` | Multi-line smooth curves with end dots | `series` (`name`, `points`) | Comparing daily orders received against daily bottles delivered | [details](WIDGETS.md#linebase) |
| `OutletCompareLine` | Multi-line thin straight lines | `series` (`name`, `points`) | Sales comparison between 3 key mall branches | [details](WIDGETS.md#linebase) |

## TimelineBase

| Widget | Draws | Data in | Use it for | Details |
| --- | --- | --- | --- | --- |
| `EventTimeline` | Vertical timeline with dots and connecting line | `items` (`label`, `date`, `caption`) | Order history from draft, approval, transit, to delivery | [details](WIDGETS.md#timelinebase) |
| `CompactTimeline` | Horizontal timeline showing events across time | `items` (`label`, `date`) | Key depot project milestones, factory maintenance schedule | [details](WIDGETS.md#timelinebase) |
