# Page & Section — Customization & Overrides

> Part of **[﻿# AQL Page and Section System Guide](UI_PAGE_AND_SECTION_SYSTEM.md)**. Per-tenant and per-page section overrides.

---

## 3. Section Customization & Overrides

Section customization is handled cleanly using client-specific overrides under `src/_ui/[UiName]/components/`.

### 3.1 The 10-Tier Lookup Priority
When `Section.vue` calls `useSectionResolver(preparedProps)`, it scans for overrides in this order (first match wins):
1. **Vue override** (resource + page specific): `.../[scope]/[Resource]/[page]/[Section].vue`
2. **JS modifier** (resource + page specific): `.../[scope]/[Resource]/[page]/[Section].js`
3. **Vue override** (resource specific): `.../[scope]/[Resource]/[Section].vue`
4. **JS modifier** (resource specific): `.../[scope]/[Resource]/[Section].js`
5. **Vue override** (page specific): `.../[scope]/[page]/[Section].vue`
6. **JS modifier** (page specific): `.../[scope]/[page]/[Section].js`
7. **Vue override** (scope-wide): `.../[scope]/[Section].vue`
8. **JS modifier** (scope-wide): `.../[scope]/[Section].js`
9. **Vue override** (ui-wide fallback): `.../[Section].vue`
10. **JS modifier** (ui-wide fallback): `.../[Section].js`

**Path segment transformation rules** (critical — get this wrong and nothing resolves):

| Segment | Input | Transformation | Example |
|---------|-------|----------------|---------|
| `[scope]` | Route scope | Lowercased as-is | `master` |
| `[Resource]` | Resource slug | `toPascalCase` → then lowercased | `'purchase-orders'` → `PurchaseOrders` → `purchaseorders` |
| `[page]` | Canonical page | Lowercased as-is | `view` |
| `[Section]` | Section name | Lowercased as-is | `header` |
| `[UiName]` | `customUIName` | Lowercased as-is | `aql` |

> [!IMPORTANT]
> The `[Resource]` path segment is **not** the raw slug. It goes through `toPascalCase` first (joining hyphenated words, capitalising each), then gets lowercased for the registry key. This means `'purchase-orders'` maps to the directory `purchaseorders`, not `purchase-orders` or `PurchaseOrders`. Use this to name your override files/folders.
>
> `customUIName` defaults to `'AQL'` when not configured in `APP.Resources`. This means `src/_ui/AQL/components/` is always scanned — it is the framework's default client, not a special-case tenant.

### 3.2 Vue Overrides vs. JS Modifiers
* **JS Modifiers (`.js`)**: Keep the base template but alter or computed the props passed to it. It can export a static object or a function receiving the current state.
  * *Function signature*:
    ```javascript
    // src/_ui/AQL/components/master/products/PageHeader.js
    // Note: all path segments are lowercased; 'Products' → 'products'
    export default (currentProps, { pageState, resourceRecord, resourceConfig }) => {
      // currentProps = the full pageProps object (page, scope, resource, uiName, loading, ...)
      // resourceRecord and resourceConfig here are the raw injected objects (with .record.value etc.)
      return {
        title: (record) => `Product: ${record?.Name || 'Unnamed'}`
      }
    }
    ```
* **Vue Overrides (`.vue`)**: Replaces the base template completely. Write standard SFC files containing a `<template>` block.

### 3.3 Overlapping Attribute Conflicts (The Div-Wrap Trap)
When implementing a `.vue` template override that still wraps the framework's presentation element, you must handle attribute fallthrough carefully. If you do not disable fallthrough, the parent orchestrator attributes will overwrite your local variables.

#### **Avoid the Div-Wrap Trap**
Do not wrap your override inside a `<div>` simply to stop attribute fallthrough:
```html
<!-- BAD: Swallows back/reload actions, permission controls, and status badges -->
<template>
  <div>
    <GenericHeaderPanel title="Custom Title" />
  </div>
</template>
```

#### **Correct Pattern: Disable Fallthrough & Explicitly Bind `$attrs`**
Set `inheritAttrs: false` in the component script and bind `$attrs` **before** writing your custom properties:
```html
<!-- GOOD: Preserves all common behaviors while applying your specific title override -->
<template>
  <GenericHeaderPanel v-bind="$attrs" title="Custom Title" />
</template>

<script setup>
import GenericHeaderPanel from "../../../shared/GenericHeaderPanel.vue"
defineOptions({ inheritAttrs: false })
</script>
```

---


---

⬑ Back to **[﻿# AQL Page and Section System Guide](UI_PAGE_AND_SECTION_SYSTEM.md)**.
