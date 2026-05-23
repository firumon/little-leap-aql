# PLAN: Config-Driven Dashboard Module
**Status**: COMPLETED
**Created**: 2026-05-23
**Created By**: Brain Agent (Antigravity)
**Executed By**: Build Agent (Antigravity)

## Objective
Create a highly modular, config-driven Dashboard system for AQL that supports declarative and procedural custom widget definitions. The dashboard must be permission-gated, performance-optimized using reactively memoized Pinia-data evaluations, and packed without visual gaps into a 12-column Quasar grid. Common widgets will render visually premium, custom pure Vue SVG animations and charts (Metric, BarChart, DonutChart, Timeline) without any third-party charting libraries, and fall back dynamically to skeleton states during asynchronous resource synchronization.

## Context
- **Main Gateway Assembler**: `FRONTENT/src/pages/Dashboard/DashboardIndex.vue`
- **Declarative JS Widgets**: Located in `FRONTENT/src/dashboard/<scope>/<resource>/<widgetname>.js`
- **Central Composable**: `FRONTENT/src/composables/_dashboard/useDashboard.js`
- **Common Widget Components**: `FRONTENT/src/components/_dashboard/` (e.g., `MetricWidget.vue`, `BarChartWidget.vue`, `DonutChartWidget.vue`, `TimelineWidget.vue`)
- **Developer Reference**: `Documents/DASHBOARD_DEVELOPMENT_GUIDE.md`
- **Parent Store Contracts**: `useDataStore` (`FRONTENT/src/stores/data.js`) handles caching and in-memory rows. `useResourceIoStore` (`FRONTENT/src/stores/resourceIo.js`) handles batch fetching.
- **Permissions**: Gate widgets reactively using the `allowed` helper from `useResourceConfig`.

## Pre-Conditions
- [x] Read and adhere to the strict `Documents/ARCHITECTURE RULES.md` without exception before writing or modifying any files under `FRONTENT/`.
- [x] Familiarize with the standard `useDataStore` methods (`getRecords`, `loadingByResource`, `backgroundSyncingByResource`) and `useResourceIoStore` methods (`fetchResources`, `syncResources`).

## Steps

### Step 1: Create the Comprehensive Developer Reference & Routing Configuration
- [x] Create a comprehensive, self-contained reference guide at `Documents/DASHBOARD_DEVELOPMENT_GUIDE.md`. The document must serve as the single source of truth for creating, configuring, and extending dashboard widgets.
- [x] Document the folder hierarchy rules, metadata configuration format, pipeline and custom mapper evaluation criteria, visual guidelines for native SVG charting, and dynamic permission gates.
- [x] Include the **"Header-to-Widget Decision Matrix"** mapping data patterns directly to specific widget selections.
- [x] Add the **"Extension Protocol"** providing concrete steps and code structures to add new widget types using pure Vue SVG.
- [x] Register this new guide in the central routing documentation at `Documents/DOC_ROUTING.md` under a new section titled `### Dashboard Implementation`.
**Files**: `Documents/DASHBOARD_DEVELOPMENT_GUIDE.md`, `Documents/DOC_ROUTING.md`
**Pattern**: Standard AQL documentation style.
**Rule**: The developer guide must be completely self-contained and clear enough to allow future agents to build new widgets without extra instructions.

### Step 2: Implement Native SVG Common Widget Components (No Third-Party Charting Libraries)
- [x] Create `FRONTENT/src/components/_dashboard/MetricWidget.vue`:
  - Implement a premium-styled card component featuring smooth gradient backgrounds tailored with HSL colors (e.g., subtle glowing gradients), large numeric value displays with smooth entry transitions, an optional icon with `hover-scale` animations, and subtitles.
  - Bind loading states to `<q-skeleton>` placeholders that match the metric container aspect ratio when loading is true.
- [x] Create `FRONTENT/src/components/_dashboard/BarChartWidget.vue`:
  - Implement a responsive `<svg>` container (aspect ratio 16:9 or custom height).
  - Compute relative bar heights based on the maximum data value: `(value / maxValue) * chartHeight`.
  - Render `<rect>` tags for each category with smooth vertical expanding transitions using SVG `<animate>` or CSS keyframe animations.
  - Draw axis lines, category markers, and glowing visual shadows using `<feDropShadow>` or `<feGaussianBlur>` SVG filters.
  - Integrate a responsive horizontal text label layout to avoid overlapping, and fall back dynamically to matching `<q-skeleton type="rect" />` cards when loading is active.
- [x] Create `FRONTENT/src/components/_dashboard/DonutChartWidget.vue`:
  - Implement a custom pure SVG Donut chart using circular segments.
  - Define circle radius $R$ and compute circumference $C = 2 \pi R$.
  - Calculate percentage $P_i$ for each segment. Render `<circle>` tags using `stroke-dasharray="C"` and computed `stroke-dashoffset="C - (P_i * C)"`.
  - Offset segment origins dynamically using a running cumulative offset logic or by applying SVG `transform="rotate(deg, cx, cy)"`.
  - Add interactive hover state handlers that scale or translate sectors slightly on hover, reveal customized tooltips showing the current category, value, and percent, and print the total or current highlighted metric in the center `<text>` tag.
  - Ensure skeletal fallback grids align with the circular bounding box.
- [x] Create `FRONTENT/src/components/_dashboard/TimelineWidget.vue`:
  - Create a sleek vertical stepper/timeline component using Quasar or custom list elements with native CSS markers.
  - Support list rendering with status badges, detailed date/time formatting, titles, and hover-lift list item cards.
  - Connect loading hooks to matching multi-line list skeletons.
**Files**:
- `FRONTENT/src/components/_dashboard/MetricWidget.vue`
- `FRONTENT/src/components/_dashboard/BarChartWidget.vue`
- `FRONTENT/src/components/_dashboard/DonutChartWidget.vue`
- `FRONTENT/src/components/_dashboard/TimelineWidget.vue`
**Pattern**: Component isolation, native Vue reactive SVG math, and CSS-driven GPU-accelerated micro-animations.
**Rule**: No external charting libraries (e.g., Chart.js, ApexCharts, ECharts) are permitted. All layouts must use HSL color systems, pure SVG, CSS transitions, and fit into dark/light custom themes.

### Step 3: Develop the useDashboard.js Composable
- [x] Create the central composable at `FRONTENT/src/composables/_dashboard/useDashboard.js`.
- [x] Implement Vite Glob Discovery to discover and register all dashboard widgets dynamically: `import.meta.glob('src/dashboard/**/*.js', { eager: true })`.
- [x] Integrate a reactive gating layer that inspects the discovered widgets and uses the `allowed` permission helper from `useResourceConfig` to screen out unauthorized widgets based on the metadata contract `permission: { ResourceName: 'read' }`.
- [x] Implement the **Scope-Based Grid Sorting Priority**:
  - Sort discovered active widgets first by scope priority: `operations` (priority 3) > `accounts` (priority 2) > `masters` (priority 1).
  - Resolve secondary sorting using the numeric `weight` descending.
  - Break tertiary ties alphabetically by the configured widget title.
- [x] Design the reactive, memoized data calculation loop:
  - Aggregate all unique resource dependencies required by the active, filtered widgets list (scanning both `dataSource.resource` and `dataSource.resources`).
  - Implement a batch fetch sequence on mount: if any resource rows are empty and not currently loading, dispatch `useResourceIoStore.fetchResources(requiredResources)` to seed data store and client IndexedDB caching.
  - Compute a reactive loading flag: `loading` is true if any resource in the required list is currently flagged in `loadingByResource[res]` or `backgroundSyncingByResource[res]` within Pinia `useDataStore`.
  - Memoize widget data operations using `computed()` keyed directly to the reactive arrays `dataStore.rows[resourceName]`. Filtering, joining, and aggregation loops must **only** re-evaluate when the underlying sheet row data actually changes.
- [x] Support the declarative pipelines and custom procedural evaluation mappers:
  - **Declarative Pipeline**:
    - **Filters**: Apply filters matching operators `eq` (equal), `ne` (not equal), `gt` (greater than), `lt` (less than), `in` (matches array values), and `contains` (substring search).
    - **Aggregations**: Resolve `count` (length of record array), `sum` (accumulates values on a given numeric field), and `avg` (average calculation on a field).
  - **Procedural Evaluation**:
    - If `dataSource.evaluate` is defined, execute it.
    - In single-resource mode, pass the filtered records object array and a standard context object containing currency helper `_C` and local config.
    - In multi-resource mode, pass an array of record arrays representing each declared resource in the configured order.
**Files**: `FRONTENT/src/composables/_dashboard/useDashboard.js`
**Pattern**: Pinia data integration, functional pipeline filtering, and reactively memoized computation.
**Rule**: Side-effect operations must stay entirely inside stores/composables. No component may query IndexedDB or dispatch raw APIs. Respect multi-resource permissiongates fail-safe (AND logic).

### Step 4: Implement the Gateway Assembler & Grid-Packing Algorithm
- [x] Modify `FRONTENT/src/pages/Dashboard/DashboardIndex.vue` to serve as the gateway grid renderer.
- [x] Import `useDashboard` and inject `activeWidgets`, `widgetValues`, and `loading` reactive parameters.
- [x] Implement the **Greedy 12-Column Grid-Packing Algorithm** inside a computed property (`packedRows`):
  1. Initialize an empty rows array `packedRows = []`.
  2. Create a shallow copy of the active widgets: `const queue = [...activeWidgets.value]`.
  3. Loop while `queue` is not empty:
     - Open a new row `const currentRow = []` and set `let remainingSpace = 12`.
     - Iteratively scan down the queue to find the first widget whose layout width (e.g., `widget.metadata.config.layout.md`, default `4` or `6`) is `<= remainingSpace`.
     - If a widget fits:
       - Remove it from the `queue`.
       - Push it to the `currentRow`.
       - Subtract its layout width from `remainingSpace`.
       - Repeat the scanning search with the updated `remainingSpace`.
     - If no remaining widgets in the `queue` can fit in `remainingSpace` (or `remainingSpace === 0`):
       - Push `currentRow` to `packedRows` and finalize the row structure.
- [x] Refine the template structure to render packed rows:
  - Loop through `packedRows` using `<div v-for="(row, rIdx) in packedRows" :key="rIdx" class="row q-col-gutter-md q-mb-md">`.
  - Inside each row, render widgets with column widths derived dynamically:
    ```html
    <div
      v-for="widget in row"
      :key="widget.metadata.id"
      :class="[
        'col-12',
        widget.metadata.config.layout?.sm ? `col-sm-${widget.metadata.config.layout.sm}` : '',
        widget.metadata.config.layout?.md ? `col-md-${widget.metadata.config.layout.md}` : 'col-md-4',
        widget.metadata.config.layout?.lg ? `col-lg-${widget.metadata.config.layout.lg}` : 'col-lg-3'
      ]"
    >
      <component
        :is="getWidgetComponent(widget.metadata.config.type)"
        :widget-config="widget"
        :widget-value="widgetValues[widget.metadata.id]"
        :loading="loading"
      />
    </div>
    ```
  - Map dynamic component types:
    ```javascript
    import MetricWidget from 'src/components/_dashboard/MetricWidget.vue'
    import BarChartWidget from 'src/components/_dashboard/BarChartWidget.vue'
    import DonutChartWidget from 'src/components/_dashboard/DonutChartWidget.vue'
    import TimelineWidget from 'src/components/_dashboard/TimelineWidget.vue'

    function getWidgetComponent(type) {
      const components = {
        MetricWidget,
        BarChartWidget,
        DonutChartWidget,
        TimelineWidget
      }
      return components[type] || null
    }
    ```
- [x] Integrate empty state rendering: if `packedRows.length === 0` and `loading === false`, display a premium, responsive empty dashboard view using a customized Quasar icon, detailed dynamic text, and a prompt indicating that no dashboard widgets are active or permissioned for their account role.
**Files**: `FRONTENT/src/pages/Dashboard/DashboardIndex.vue`
**Pattern**: Computed grid packing, dynamic components, responsive grid columns.
**Rule**: Grid packing must prevent horizontal wrapping irregularities and vertical height gaps by strictly utilizing explicit Quasar row separation wrappers per packed row.

### Step 5: Construct Out-of-the-Box Core Declarative JS Widgets
- [x] Create `FRONTENT/src/dashboard/operations/purchaseRequisitions/pendingPRs.js` (MetricWidget):
  - Configuration: MetricWidget, title: "Pending PRs", icon: "shopping_cart", color: "orange", weight: 100, layout: `{ xs: 12, sm: 6, md: 4 }`.
  - Data Source: Single-resource `purchaseRequisitions`, filter `Status == "Pending"`, aggregate: `count`.
- [x] Create `FRONTENT/src/dashboard/operations/rfqs/awaitingRFQs.js` (MetricWidget):
  - Configuration: MetricWidget, title: "Awaiting RFQs", icon: "request_quote", color: "blue", weight: 90, layout: `{ xs: 12, sm: 6, md: 4 }`.
  - Data Source: Single-resource `rfqs`, filter `Status == "Awaiting Quotations"`, aggregate: `count`.
- [x] Create `FRONTENT/src/dashboard/operations/purchaseOrders/purchaseOrderSummary.js` (BarChartWidget):
  - Configuration: BarChartWidget, title: "Purchase Orders by Vendor", icon: "storefront", color: "purple", weight: 80, layout: `{ xs: 12, sm: 12, md: 8 }`.
  - Data Source: Single-resource `purchaseOrders`, custom procedural mapper `evaluate` that groups purchase order amounts by vendor and returns sorted top 5 values for display.
- [x] Create `FRONTENT/src/dashboard/operations/goodsReceipts/pendingGRNs.js` (TimelineWidget):
  - Configuration: TimelineWidget, title: "Recent Pending GRNs", icon: "receipt", color: "teal", weight: 70, layout: `{ xs: 12, sm: 12, md: 4 }`.
  - Data Source: Single-resource `goodsReceipts`, filter `Status == "Pending Receipt"`, custom evaluate function that extracts title, subtitle (Vendor, Date), status code, and orders by descending creation date up to 5 records.
**Files**:
- `FRONTENT/src/dashboard/operations/purchaseRequisitions/pendingPRs.js`
- `FRONTENT/src/dashboard/operations/rfqs/awaitingRFQs.js`
- `FRONTENT/src/dashboard/operations/purchaseOrders/purchaseOrderSummary.js`
- `FRONTENT/src/dashboard/operations/goodsReceipts/pendingGRNs.js`
**Pattern**: Modular widget export structures matching the metadata contract.
**Rule**: Respect permissions (`{ purchaseRequisitions: 'read' }`, `{ rfqs: 'read' }`, `{ purchaseOrders: 'read' }`, `{ goodsReceipts: 'read' }`).

---

## Documentation Updates Required
- [x] Create `Documents/DASHBOARD_DEVELOPMENT_GUIDE.md` detailing the complete customization specifications, catalog, and extensions checklist.
- [x] Update `Documents/DOC_ROUTING.md` with routing rules to direct implementation queries under `# Dashboard Implementation`.
- [x] Update `Documents/CONTEXT_HANDOFF.md` explaining the modular config-driven design, Vue SVG math implementations, Pinia memoization rules, and greedy 12-column row packing.

---

## Acceptance Criteria
- [x] **Dynamic Discovery & Sorting**: Modifying weights or titles of files under `src/dashboard/` immediately updates order and rendering priorities in the gateway page.
- [x] **Airtight Permission Gating**: Revoking read privileges for `purchaseRequisitions` in the user auth profile dynamically filters out the "Pending PRs" widget from the user's view, rendering other widgets correctly.
- [x] **Gapless Greedy Grid Packing**: Widgets of mixed sizes (e.g., md=8, md=4, md=4) pack into clean horizontal rows (`[8, 4]`, then `[4]`) instead of showing vertical floating gaps standard in regular CSS flex layouts.
- [x] **No Charting Libraries**: Chart components (`BarChartWidget`, `DonutChartWidget`) compile and render with pure responsive SVG markup, HSL colors, responsive textual labels, and custom scale animations, without any dependencies on Canvas or third-party charting libraries.
- [x] **Reactive Performance Memoization**: Computations only re-run when resource-specific Pinia row caching values `dataStore.rows[resourceName]` update. Adding or removing records dynamically triggers re-rendering without manual keys or timers.
- [x] **Skeletal State Cohesion**: Mocking latency on `fetchResources` triggers perfect rendering of `<q-skeleton>` components inside Metric, Bar, and Donut elements, matching widget dimensions.

---

## Execution Self-Check Protocol

The Build Agent MUST update this checklist after completing each numbered sub-task. Mark `[x]` immediately after the task is done. This is the single source of execution progress.

### Progress Log
- [x] Step 1: Reference Docs and Routing configured.
- [x] Step 2: SVG Chart components created (`MetricWidget.vue`, `BarChartWidget.vue`, `DonutChartWidget.vue`, `TimelineWidget.vue`).
- [x] Step 3: Composable `useDashboard.js` logic and memoization loop implemented.
- [x] Step 4: Assembler gateway layout and Packing Algorithm in `DashboardIndex.vue` finalized.
- [x] Step 5: Core JS Widget definitions deployed and verified.

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `Documents/DASHBOARD_DEVELOPMENT_GUIDE.md`
- `Documents/DOC_ROUTING.md`
- `FRONTENT/src/components/_dashboard/MetricWidget.vue`
- `FRONTENT/src/components/_dashboard/BarChartWidget.vue`
- `FRONTENT/src/components/_dashboard/DonutChartWidget.vue`
- `FRONTENT/src/components/_dashboard/TimelineWidget.vue`
- `FRONTENT/src/composables/_dashboard/useDashboard.js`
- `FRONTENT/src/pages/Dashboard/DashboardIndex.vue`
- `FRONTENT/src/dashboard/operations/purchaseRequisitions/pendingPRs.js`
- `FRONTENT/src/dashboard/operations/rfqs/awaitingRFQs.js`
- `FRONTENT/src/dashboard/operations/purchaseOrders/purchaseOrderSummary.js`
- `FRONTENT/src/dashboard/operations/goodsReceipts/pendingGRNs.js`

### Validation Performed
- [x] Confirm code builds successfully using `npm run build` or dev compilation checking.
- [x] Perform local browser verification: mock varying role permissions and verify dashboard responsiveness.
- [x] Verify that there are absolutely no layout wrap-gaps in grid spacing on diverse screen widths (using responsive browser inspector).
- [x] Inspect browser logs to verify that computations are correctly cached and only trigger recalculations when reactive resource rows in Pinia change.

### Manual Actions Required
- [x] Ensure user has configured roles/permissions in Sheets backend to test full permission-gating and resource-loading behaviors.
