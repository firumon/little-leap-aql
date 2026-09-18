# Dashboard Custom Widget Implementation

## Scope boundary

This prompt covers building a custom dashboard widget or prop modifier under `src/_ui/`.
- It does NOT cover building reusable generic framework widgets under `FRONTENT/src/components/widgets/` — see [CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/CONTRACT.md).
- It does NOT cover creating DBI domain data items — see [dashboard_implementation.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/dashboard_implementation.md).
- Canonical engine specification: [FEATURE_DASHBOARD_ENGINE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_ENGINE.md).

---

## Read these before touching code

1. [Documents/FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_ENGINE_CUSTOMIZATION.md) — Section 5 covers Custom UI (.vue and .js modifiers).
2. [Documents/FEATURE_DASHBOARD_ENGINE_RENDER.md](file:///f:/LITTLE%20LEAP/AQL/Documents/FEATURE_DASHBOARD_ENGINE_RENDER.md) — §6.6 and §6.6.1 in particular.
3. [Documents/CORE_ARCHITECTURE_RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/CORE_ARCHITECTURE_RULES.md) — Required before any edit under `FRONTENT/`.
4. [FRONTENT/src/components/widgets/CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/widgets/CONTRACT.md) — If embedding `<Widget />`.
5. The target sheet item definition in `App.Resources.Dashboard` or the resource's DBI file under `_resource/<Scope>/<Resource>/Dashboard/<name>.js`.

---

## Rules and Architecture

1. **A custom widget replaces the whole Frame.**
   The standard Frame (`Frame.vue`) provides the card shell, header (`title`, `subtitle`), `<Controls />`, and footer (`caption`). When a custom widget is provided at `_ui/<uiName>/components/widgets/<widget>.vue`, `useWidgetResolver` mounts it **instead of Frame**. The custom widget is in charge of whatever chrome or title it needs.
2. **Prop Surface**:
   The custom widget receives the exact same props as `Frame.vue`:
   - `title`: String
   - `subtitle`: String
   - `caption`: String
   - `controls`: Array of control descriptors
   - `error`: String
   - `loading`: Object `{ inflight: Array, state: Boolean }`
   - `widget`: String (the widget preset name)
   - `widgetProps`: Object (visual props from DBI and sheet)
   - `data`: Object (unwrapped live facts from DJS)
3. **Controls integration**:
   If the tile has controls, render them inside the custom card via `useDataControls`:
   ```javascript
   import { useDataControls } from 'src/composables/data/useDataControls'
   const props = defineProps({ controls: Array, ... })
   const { Controls } = useDataControls(() => props.controls)
   ```
4. **Drawing**:
   A custom widget can:
   - Render its own template/SVG.
   - Or render `<Widget :name="widget" v-bind="widgetProps" />`.
   - Or render `<Widget :preset="preset" :base="base" />`.
5. **No style tag**:
   Follow `CORE_ARCHITECTURE_RULES.md` §7. No `<style>` blocks in reusable components.

---

## JS Prop Modifiers
 
 If you only need to change how props are computed or formatted for an existing widget/frame without rewriting the template:
 Create a `.js` modifier file in one of these paths (evaluated in order):
 1. `_ui/<uiName>/components/<scope>/<resource>/dashboard/<name>.js`
 2. `_ui/<uiName>/components/<scope>/<resource>/<name>.js`
 3. `_ui/<uiName>/components/<scope>/dashboard/<name>.js`
 
 The modifier receives a flat object of Frame props:
 `{ title, subtitle, caption, widget, widgetProps, controls, data, error, name, resource, scope }`
 where `data` is the plain unwrapped value (`data.value`).
 
 The file exports an object or a function returning an object:
 
 ```javascript
 // Object modifier: changes only title
 export default {
   title: 'Custom Title'
 }
 ```
 
 ```javascript
 // Function modifier: reads incoming flat props
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
 
 The resolver computes `finalProps = { ...flat, ...theirs }` inside a reactive computed. `loading` is strictly managed by `Tile.vue` and cannot be turned off by a modifier.

---

## Step-by-Step Implementation

1. Check the target tenant's `uiName` (from `auth.resources` / `dashboardProps.uiName`).
2. Identify the widget preset or tile name from the sheet or DBI.
3. For full visual replacement: create `_ui/<uiName>/components/widgets/<widget>.vue`.
4. For prop customization: create the `.js` modifier at `_ui/<uiName>/components/<scope>/<resource>/dashboard/<name>.js`.
5. Implement reactive props handling without breaking references.
6. Verify live in the browser.

---

## Verification Checklist

1. Does the dashboard grid maintain its exact layout and packing?
2. Does the custom widget stretch to fill its cell?
3. Are controls reactive and wrapping cleanly?
4. Does loading overlay smoothly without snapping or unmounting?
5. Is the fallback card shown properly if the custom widget is missing on a custom tile?
