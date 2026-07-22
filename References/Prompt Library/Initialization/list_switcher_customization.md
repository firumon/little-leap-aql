# Scope Boundary: AQL List Switcher Customization

This prompt instructs how to create or modify custom UI layouts, templates, and dynamic property modifiers for the AQL list switching components (`ListSwitcher` and `ListSwitcherItem`) inside the frontend.

## 1. Domain Map & Key Files

Before making any changes, locate and read the following base components:
- Base Container: [ListSwitcher.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/sections/ListSwitcher.vue)
- Base Switcher Item: [ListSwitcherItem.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/components/sections/ListSwitcherItem.vue)
- CSS Spacing & Brand Styles: [custom.scss](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/css/custom.scss)
- Canonical Guide: [AQL_FRONTEND_LIST_SWITCHER.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_FRONTEND_LIST_SWITCHER.md)

---

## 2. Override Resolution Logic

AQL looks for custom templates or logic modifiers under directories mapped by:
`src/_ui/[UiName]/components/[Scope]/[ResourceName]/`

The registry lookup keys are:
- Container: `'ListSwitcher'` (files: `ListSwitcher.vue` or `ListSwitcher.js`)
- Switcher Item: `'ListSwitcherItem'` (files: `ListSwitcherItem.vue` or `ListSwitcherItem.js`)

### 2.1 Sheet Config Dependency (App.Resources.ListViews)
- **Sheet Setup**: Manage views via the `ListViews` column in `APP.Resources` spreadsheet. See [AQL Menu Admin Guide](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_MENU_ADMIN_GUIDE.md#L201-L212).
- **JSON Schema**: For operators, fields, and config array schema details, see [Resource Columns Guide](file:///f:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md).
- **Conditional Overriding Criteria (Critical)**:
  1. **Empty String (Blank Cell)**: JS modifiers (`ListSwitcher.js`) and Vue overrides (`ListSwitcher.vue`) are **ALLOWED**. Resource falls back to default Active/Inactive views.
  2. **`[]` (Explicit Switch-Off Array)**: JS modifiers and Vue overrides are **DISABLED / IGNORED**. Views switcher is hidden/disabled.
  3. **JSON Array with Values (e.g. `[{"name": "Paid"}, ...]`)**: JS modifiers and Vue overrides are **DISABLED / IGNORED**. Standard sheet-driven views tabs are enforced.


---

## 3. Implementation Steps

### 3.1. Writing a JS Property Modifier (JS Modifier)
Use this when you want to dynamically alter items, limits, or styling properties without rewriting the HTML markup.

Create `ListSwitcher.js` or `ListSwitcherItem.js`:
```javascript
export default function() {
  return {
    // Return properties to merge
    maxVisibleItems: 6,
    items: [
      { name: 'Active', color: 'positive', icon: 'check_circle' },
      { name: 'Inactive', color: 'negative', icon: 'cancel' }
    ]
  }
}
```

**Full example with `filter` trees** — see the working reference at [`src/_ui/AQL/components/master/currencies/ListSwitcher.js`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_ui/AQL/components/master/currencies/ListSwitcher.js):
```javascript
export default function() {
  return {
    maxVisibleItems: null, // null disables the "More" overflow dropdown; all items render inline
    items: [
      {
        name: 'Inactive',
        default: true,
        color: 'positive',
        icon: 'check_circle',
        filter: {
          type: 'group',
          logic: 'AND',
          items: [{ type: 'condition', column: 'Status', operator: 'eq', value: 'Inactive' }]
        }
      }
      // ...additional items, each with its own name/color/icon/default/filter
    ]
  }
}
```

**Item object properties** (see also `useListViews.js`'s auto-generated views, which share this same shape):
- `name` (required): unique identifier, matched against `activeItem` and passed to `setActiveView(name)`.
- `label` (optional): display text; falls back to `name`.
- `icon` (optional): Quasar icon name.
- `color` (optional): color keyword (`positive`, `negative`, `primary`, `warning`, `grey`, ...); defaults to `'primary'`.
- `default` (optional): marks the view auto-selected on initial load when there's no active URL/query state.
- `filter` (optional): a **Group** (`{ type: 'group', logic: 'AND'|'OR', items: [...] }`) or **Condition** (`{ type: 'condition', column, operator, value }`) object evaluated per-row via `evaluateFilter()`. See [Resource Columns Guide](file:///f:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md) and [AQL_FRONTEND_LIST_SWITCHER.md §5.1.1](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_FRONTEND_LIST_SWITCHER.md#511-filter-json-schema-reference) for the full operator list (`eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`, `contains`).

**Items resolution precedence** — `ListSwitcher.vue` uses the first non-null source:
1. Explicit `items` prop (from this JS modifier, or an explicit template binding).
2. Fallback to `resourceRecord.effectiveViews` (sheet-configured `APP.Resources.ListViews`, or scope-aware auto-generated views from `useListViews.js`: `master` scope auto-generates Active/Inactive from `Status`; other scopes prefer `Progress`, then `Type`, then the first matching `AppOptions`-backed column).

This is a full override, not a merge — returning an `items` array from `ListSwitcher.js` replaces sheet/auto-generated views entirely.

### 3.2. Overriding only the Container wrapper
Create `ListSwitcher.vue`. Use the generic `Section` component to delegate rendering of the items so they fall back to the default styling (or custom item override) natively:
```html
<template>
  <div class="custom-switcher-bar">
    <span class="custom-switcher-title">Filter by State:</span>
    <Section
      v-for="item in visibleItems"
      :key="item.name"
      section="ListSwitcherItem"
      v-bind="buildItemProps(item)"
      @click="handleItemClick(item.name)"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import Section from 'src/components/Section.vue'

// (Define/copy necessary container computing logic from the base ListSwitcher.vue)
</script>
```

### 3.3. Overriding only the Item layout
Create `ListSwitcherItem.vue` to specify custom item templates (e.g. adding active chips, custom badges, count bubbles):
```html
<template>
  <button
    class="custom-list-item-pill"
    :class="{ 'is-active': active }"
    v-bind="$attrs"
  >
    <q-icon v-if="icon" :name="icon" />
    <span>{{ label }}</span>
    <span v-if="item.count" class="custom-badge">{{ item.count }}</span>
  </button>
</template>

<script setup>
defineProps({
  item:   { type: Object, required: true },
  active: { type: Boolean, default: false },
  label:  { type: String, default: '' },
  icon:   { type: String, default: '' },
})
</script>
```

---

## 4. Verification Check list
1. **No Layer Violations**: Do not import store modules directly inside `ListSwitcherItem.vue`. Rely on props passed from `ListSwitcher.vue`.
2. **Horizontal Overflow**: Check that mobile views still scroll horizontally without wrapping when many views exist.
3. **Dropdown active states**: If on desktop, click an overflow item inside the "More" dropdown and ensure the dropdown button inherits its styling and active indicator dot properly.
