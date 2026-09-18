# Dashboard Engine

> Canonical guide for the sheet-driven dashboard engine.

---

## Parts of this document

This document is split so each part stays readable on its own. The parts are canonical — this hub does not restate them.

| Part | Covers |
|---|---|
| [Dashboard Engine — Customization Guide](FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md) | Complete reference of every dashboard option and knob by configuration location (ARD, DBI, `widgetProps`, `dashboard.js`, `_ui`, controls). |
| [Dashboard Engine — Pipeline, Scoring, Layout & Motion](FEATURE_DASHBOARD_ENGINE_FLOW.md) | Pipeline overview (§1), ARD schema and resolver row shape (§2), scoring formula and cutoff (§3), size cascade (§4), packing grid and tile state (§5), and stepped motion (§6.7). |
| [Dashboard Engine — Render Chain, Widgets, Loading & Customization](FEATURE_DASHBOARD_ENGINE_RENDER.md) | The Frame (§6.6), custom widgets and JS modifiers (§6.6.1), assembly and module loading (§8), and current status (§9). |
| [Dashboard Engine — Data Layer, Items, Empty Rule & Math](FEATURE_DASHBOARD_ENGINE_DATA.md) | Domain Data layer (DJS, §6), Item Descriptors (DBI, §6.1), the `empty` rule, Dashboard Controls (§6.5), and pure math utilities (`useDataContext`, §7). |

---

### Where each section lives

Section numbers did not change, so an existing `§N` reference still resolves — find it here:

| § | Section | File |
|---|---|---|
| §0 | Words and short forms | [FEATURE_DASHBOARD_ENGINE.md](FEATURE_DASHBOARD_ENGINE.md) |
| §1 | The shape in one picture | [FEATURE_DASHBOARD_ENGINE_FLOW.md](FEATURE_DASHBOARD_ENGINE_FLOW.md) |
| §2 | ARD, the Dashboard column & Resolver row shape | [FEATURE_DASHBOARD_ENGINE_FLOW.md](FEATURE_DASHBOARD_ENGINE_FLOW.md) |
| §3 | Scoring, bag, position, share, and sort | [FEATURE_DASHBOARD_ENGINE_FLOW.md](FEATURE_DASHBOARD_ENGINE_FLOW.md) |
| §4 | Allowed widths and size cascade | [FEATURE_DASHBOARD_ENGINE_FLOW.md](FEATURE_DASHBOARD_ENGINE_FLOW.md) |
| §5 | Tile state and packing grid (`useDashboardLayout`) | [FEATURE_DASHBOARD_ENGINE_FLOW.md](FEATURE_DASHBOARD_ENGINE_FLOW.md) |
| §6 | Domain Data Layer (DJS: `_resource/.../Data/`) | [FEATURE_DASHBOARD_ENGINE_DATA.md](FEATURE_DASHBOARD_ENGINE_DATA.md) |
| §6.1 | Dashboard Item Descriptors (DBI: `_resource/.../Dashboard/`) | [FEATURE_DASHBOARD_ENGINE_DATA.md](FEATURE_DASHBOARD_ENGINE_DATA.md) |
| §6.5 | Dashboard Controls (`useDataControls`) | [FEATURE_DASHBOARD_ENGINE_DATA.md](FEATURE_DASHBOARD_ENGINE_DATA.md) |
| §6.6 | The Frame (`Frame.vue`) | [FEATURE_DASHBOARD_ENGINE_RENDER.md](FEATURE_DASHBOARD_ENGINE_RENDER.md) |
| §6.6.1 | Custom Widgets & JS Modifiers | [FEATURE_DASHBOARD_ENGINE_RENDER.md](FEATURE_DASHBOARD_ENGINE_RENDER.md) |
| §6.7 | Dashboard Motion (`Dashboard.vue`) | [FEATURE_DASHBOARD_ENGINE_FLOW.md](FEATURE_DASHBOARD_ENGINE_FLOW.md) |
| §7 | `useDataContext` | [FEATURE_DASHBOARD_ENGINE_DATA.md](FEATURE_DASHBOARD_ENGINE_DATA.md) |
| §8 | Assembly and module loading | [FEATURE_DASHBOARD_ENGINE_RENDER.md](FEATURE_DASHBOARD_ENGINE_RENDER.md) |
| §9 | Current status and what is not built yet | [FEATURE_DASHBOARD_ENGINE_RENDER.md](FEATURE_DASHBOARD_ENGINE_RENDER.md) |
| All | Complete Dashboard Customization Guide | [FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md](FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md) |

---

## §0 — Words and short forms

Here are the words we use. We explain each one before we use it anywhere else:

- **The Dashboard column**: The column named `Dashboard` in the `App.Resources` Google Sheet. It holds a list of items for each resource.
- **A dashboard item**: One item inside that cell list. It picks which widget to show, who can see it, and how it looks. We also call this **the sheet item**.
- **The data layer (DJS)**: Plain domain data composables inside `_resource/<Scope>/<Resource>/Data/use<Topic>Data.js`. They prepare data about one topic (counts, lists, series, controls) without knowing about dashboards or widgets.
- **A tile**: The container component on the dashboard page (`FRONTENT/src/components/Tile.vue`) that wraps each dashboard cell. It manages loading state, resolves custom widgets or the default Frame via `useWidgetResolver`, applies tiered JS prop modifiers, and displays a visible fallback card if a custom tile is not defined.
- **A frame**: The visual card wrapper around a widget (`FRONTENT/src/components/Frame.vue`). It renders the title, subtitle, caption, and places `<Controls />`. It receives `widget` (String name), `widgetProps` (Object), and `data` (Object), and renders `<Widget :name="widget" v-bind="{ ...widgetProps, ...dataWithoutLoadingAndEmpty }" class="aql-widget-fill" />`. It accepts `loading` for custom UIs and draws no spinner.
- **A widget**: The visual component that draws the picture only (`FRONTENT/src/components/widgets/Widget.vue`). It accepts optional `name`, `base`, and `preset` props; all other attributes arrive as overrides via `$attrs`. Resolution: overrides = `$attrs`; preset from `props.preset` or `widgets/<name>.js`; base from `props.base ?? preset?.base`; draws `abstract/<base>.vue` with `{ ...(preset?.props || {}), ...overrides }`. If nothing was asked for, it draws a visible `No widget found`. If missing, it draws a visible error (`No widget: <name>` or `No base: <base or name>`). There is no `_ui` lookup for widgets.
- **The page contract**: The rules in `FRONTENT/src/pages/Dashboard/dashboard.js` that set the grid columns, rowUnit, gaps, motion timing (`motionMs`, `staggerMs`, `staggerCap`), layout classes (`pageClass`, `gridClass`), and dynamically resolves `uiName` from authorized resources.
- **The item key**: The unique ID of a tile, written as `resource::name` (or `resource::source` if name is absent).

### Layer nesting when built

When built, the layers nest like this:
```
Tile (outside, container & loading)  ──>  Frame (middle, card UI)  ──>  Widget (inside, picture only)
```
`Dashboard.vue` mounts one `<Tile>` per row. The frame is built at `FRONTENT/src/components/Frame.vue`. The picture component is `FRONTENT/src/components/widgets/Widget.vue`. Custom widgets under `_ui/<uiName>/components/widgets/<widget>.vue` can replace the Frame entirely.

Here are the short forms used in this document:

| Short form | What it means |
|---|---|
| **ARD** | The `App.Resources` `Dashboard` sheet column. |
| **DBD** | The data layer — the item factory files under `_resource/<Scope>/<Resource>/Data/`. |

**Short forms belong to this document only. They must NEVER appear in code, in a file name, in a folder name, or in a variable name. If you find one in the codebase, it is a bug — rename it.**
