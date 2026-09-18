# Dashboard Engine — Render Chain, Widgets, Loading & Customization

> Canonical guide for dashboard rendering: Tile container, Frame, Widget resolution, loading orchestration, and custom UI overrides.

---

## §6.6 — The Frame (`Frame.vue`)

The frame is a card wrapper with places to fill:
- **Props**: `title`, `subtitle`, `caption`, `controls`, `error`, `loading`, `widget`, `widgetProps`, `data`.
  - `widget`: String — preset name (e.g. `'HorizontalRankBar'`).
  - `widgetProps`: Object — visual props from DBI and sheet.
  - `data`: Object — domain data values.
  - The Frame renders `<Widget :name="widget" v-bind="{ ...widgetProps, ...dataWithoutLoadingAndEmpty }" class="aql-widget-fill" />`.
  - `loading`: Object `{ inflight: [], state: false }`. Accepted for custom frames; Frame draws no spinner (Tile owns spinner).
- **Attrs**: `$attrs.class` and `$attrs.style` go onto the outer `q-card`. Attrs no longer pass to `<Widget>`.
- **Body order**:
  1. `error` set → shows a small error block. A broken tile is always visible.
  2. else → `<Widget :name="widget" v-bind="{ ...widgetProps, ...dataWithoutLoadingAndEmpty }" class="aql-widget-fill" />`.
- **Header controls and wrapping**: The frame renders title/subtitle and `<Controls />`. When both cannot fit on one line, controls drop onto their own full-width line below the title. Titles, subtitles, and control elements inside Frame use one-step smaller typography to prevent overflow. If no controls are defined, it renders nothing.
- **Height from content**: The body height is driven by `widget` preset hints via CSS:
  - **List-style widgets** (`rowHeight` set, no `aspect`): `minHeight = max(preset.minHeight, items.length * preset.rowHeight)`. A list with 1 item stays short; a list with many items is tall.
  - **Picture-style widgets** (`aspect` set): CSS `aspect-ratio: <aspect>` with `preset.minHeight` as floor. Scales cleanly with cell width.
  - **Metric widgets** (neither): `preset.minHeight` as `min-height`.
- **Widget fill**: The widget stretches to fill the whole body width and height (`.aql-widget-fill`).

---

## §6.6.1 — Custom Widgets & JS Modifiers

Tenants can customize dashboard tiles using custom Vue components or JS prop modifiers under `src/_ui/`:

### 1. Custom Widget Replacement (`.vue`)
- **Location**: `_ui/<uiName>/components/widgets/<widget>.vue`, where `<widget>` is the name set in the sheet or DBI `widget` key.
- **Replaces the Frame**: A custom widget component replaces the **whole Frame**. Because the standard Frame holds the title, subtitle, caption, and controls, a custom widget is responsible for rendering those itself if desired.
- **Received Props**: It receives the exact same props as `Frame.vue`:
  `{ title, subtitle, caption, controls, error, loading, widget, widgetProps, data }`.
- **Using Controls**: It can place `<Controls />` by importing `useDataControls`:
  ```javascript
  import { useDataControls } from 'src/composables/data/useDataControls'
  const { Controls } = useDataControls(() => props.controls)
  ```
- **Drawing**: It can construct its own markup/SVG, or render standard widgets:
  `<Widget :name="widget" v-bind="widgetProps" />`, or `<Widget :preset="preset" :base="base" />`.

### 2. JS Prop Modifiers (`.js`)
When using the standard Frame (or a custom widget), props can be adjusted by a `.js` modifier file. `useWidgetResolver` searches these paths in order (first match wins):
1. `_ui/<uiName>/components/<scope>/<resource>/dashboard/<name>.js`
2. `_ui/<uiName>/components/<scope>/<resource>/<name>.js`
3. `_ui/<uiName>/components/<scope>/dashboard/<name>.js`

The modifier receives a flat object of Frame props:
`{ title, subtitle, caption, widget, widgetProps, controls, data, error, name, resource, scope }`
where `data` is the plain unwrapped value (`data.value`).

The default export is an object or a function returning an object:

```javascript
// Object modifier: changes only title
export default {
  title: 'Customized Title'
}
```

```javascript
// Function modifier: updates title and nested widgetProps
export default (flatProps) => {
  return {
    title: `${flatProps.title} (Live)`,
    widgetProps: {
      ...flatProps.widgetProps,
      color: 'accent'
    }
  }
}
```

The resolver computes `finalProps = { ...flat, ...theirs }` inside a reactive computed. `loading` is strictly managed by `Tile.vue` and cannot be overridden by a modifier.

For full modifier patterns and options, see [FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md](FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md).

### 3. Missing Custom Tile Fallback
If a tile is configured as a custom tile in the sheet (`custom: true`) without a matching DBI, and no custom widget `.vue` exists in `_ui/<uiName>/components/widgets/`, `Tile.vue` displays a prominent "Tile Not Defined" card naming the tile and its resource.

### 4. Tile Loading Orchestration
`Tile.vue` manages an inner loading state computed as:
- `inflight`: array containing `'resource'` (`resourceLoading.value`), `'frame'` (resolver not `ready.value`), and `'data'` (`data.value.loading`).
- `state`: true if `inflight.length > 0`.
`<q-inner-loading :showing="loading.state" />` covers the tile without unmounting or replacing its elements.

---

## §8 — Assembly and module loading

1. **Intra-resource DBI discovery**:
   Within a resource, tile descriptors live in `FRONTENT/src/_resource/<Scope>/<Resource>/Dashboard/<name>.js`. Each file represents one DBI whose name matches the file name directly.
2. **Cross-resource lazy assembly**:
   The glob that reaches **across** resources must be **lazy** (`import.meta.glob('../_resource/**/Dashboard/*.js')`).
   **Reason**: With hundreds of resources, an eager cross-resource glob ships and runs every item file for every tenant, even for modules the tenant does not have. Making cross-resource assembly lazy matches the app-wide rule: lazy by default, eager only for a small fixed set (like `_fields/`).

---

## §9 — Current status and what is not built yet

Here is the honest status of the dashboard system:

- **Built & Live**:
  - ARD schema and sheet parsing.
  - `useDashboardResolver`: ARD gathering, filtering, bag scoring, cutoff, sorting, and `uiName` resolution.
  - `useDashboardLayout`: Tile lifecycle tracking (`loading`, `empty`), `controlsMinSpan`, and two-pass allowed-width row packing.
  - `Dashboard.vue`: Clean responsive grid (`row items-stretch`) rendering one `<Tile>` per cell with stepped motion.
  - 8 DJS domain data composables under `Leads/Data` and `LeadFollowUps/Data`.
  - 27 DBI tile descriptor files under `Leads/Dashboard` (14) and `LeadFollowUps/Dashboard` (13).
  - `useDataContext`: Pure stateless math utilities.
  - `useDataControls` and `dataControl()` helper; items own their control refs; 4 field pickers (`plainselect`, `menuselect`, `chipselect`, `select`).
  - `Tile.vue`: Responsive tile container managing loading state (`inflight`), resolving custom widgets or Frame via `useWidgetResolver`, applying JS prop modifiers, and rendering visible fallback for undefined custom tiles.
  - `Frame.vue`: Generic card wrapper with title, subtitle, controls, caption, error/empty handling, content-driven CSS height hints, and responsive header wrapping.
  - `useWidgetResolver`: Tiered resolution for custom widgets (`.vue`) and modifiers (`.js`) under `src/_ui/`.
- **Resource scope boundary**:
  - Only `Leads` (14 items) and `LeadFollowUps` (13 items) are in scope.
  - The 4 `OutletRestocks` item files keep the old `compute(ctx)` shape and are parked. They will be rebuilt from scratch later, along with every other resource.
- **Not Built / Not Wired Yet**:
  - **Manage Dashboard sheet menu**: No Apps Script spreadsheet dialog exists yet to edit dashboard JSON cells visually.
