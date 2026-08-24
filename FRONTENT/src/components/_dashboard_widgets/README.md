# Dashboard Widgets

Pure presentation components for dashboard and metric displays.

## What lives here

A widget in this folder is **100% stateless and resource-unaware**:

- No `inject`, no stores, no composables, no `evaluateProp`.
- No knowledge of resources, pages, sections, or the `_ui/` tier system.
- Every input arrives as a **plain resolved prop** — numbers, strings, arrays of plain
  objects. No closures.
- No `<style>` block. Classes are Quasar's own or the `.aql-*` families already declared
  in `src/css/custom.scss` (CORE_ARCHITECTURE_RULES §7).
- Scale-free: 1 row or 1000 rows, 1 series or 100 series, the same component renders it.

## What does NOT live here

Anything that resolves a closure, reads a store, applies section chrome, or knows a
column name. That is the job of the matching **section wrapper** in
`src/components/sections/`.

## The two-layer split

```
_ui/AQL/components/.../Index/Gauge.js     ← records → plain data (resource-specific)
        │
src/components/sections/Gauge.vue          ← inject contexts, resolve closures,
        │                                    section chrome, strict hide rule
src/components/_dashboard_widgets/Gauge.vue ← pure drawing
```

A section wrapper is thin on purpose. It:

1. injects `resourceConfig` / `resourceRecord`,
2. resolves every closure-valued prop through `evaluateProp`,
3. renders `SectionDividerLabel` and applies the declared `padding`,
4. enforces the strict hide rule (`v-if="items.length"`),
5. mounts the widget with resolved props only.

## Naming

Domain-agnostic, professional names. Never prefix or suffix a component with
`Universal`, `Global`, `Generic`, or similar.

## Catalog

See [REGISTRY.md](./REGISTRY.md) for every widget, its prop contract, data format, and a
usage example.
