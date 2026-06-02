# 24_QUASAR_OPTIONS.md - Option Selections, Toggles & Checkboxes

This document defines how to implement toggles, checkboxes, radio selections, and option groups using Quasar components to support clean, high-performance interactions on mobile interfaces.

---

## 1. Purpose

The purpose of this guide is to ensure all choice selectors are built using touch-friendly surfaces, prevent drop-down selection fatigue, define when to choose toggles over checkboxes, and detail option groupings.

---

## 2. Core Philosophy

AQL option components are **Visual, Touch-Sized, and Direct**:
*   **Toggles for Actions:** Standard yes/no actions must use `QToggle` rather than a standard checkbox because toggles represent immediate state adjustments and provide comfortable touch targets.
*   **Inline Choice Rows:** When choosing from short lists (<5 options), avoid select fields. Render the list inline using `QOptionGroup` with `inline` configurations.
*   **Direct Touch Bounds:** Interaction sweeps must respond to clicking the option label text, not just the small square check mark.

---

## 3. Golden Rules

1.  **Toggle for Binary Choice:** Use `QToggle` for active/inactive configurations. Save `QCheckbox` for table rows selection or form checklist groupings.
2.  **Ensure Inline Groups:** For short list groups, use `QOptionGroup` with the `inline` property to prevent vertical stack heights on small mobile views.
3.  **Prohibit Plain Checkbox Loops:** Never loop basic HTML inputs. Always map selections to reactive arrays using Quasar options.
4.  **Confirm Distinct Labels:** Every option input must define readable labels to preserve touch accuracy.

---

## 4. QOptionGroup & QToggle Setup

```html
<!-- FRONTENT/src/components/Operations/OutletOptionFields.vue -->
<template>
  <div class="column q-gutter-y-md">
    <!-- Inline Radio Option Group for short lists -->
    <div class="option-container bg-grey-1 q-pa-sm rounded-borders">
      <div class="text-caption text-grey-7 q-mb-xs">Order Priority *</div>
      <q-option-group
        v-model="fields.priority"
        :options="priorityOptions"
        color="primary"
        inline
        type="radio"
      />
    </div>

    <!-- Toggle Selector for binary active state -->
    <div class="row items-center justify-between bg-white q-pa-md border-grey-3 rounded-borders">
      <div class="column">
        <span class="text-subtitle2 text-weight-bold">Enable Notifications</span>
        <span class="text-caption text-grey-6">Send updates when status changes</span>
      </div>
      <q-toggle
        v-model="fields.notify"
        color="secondary"
        icon="notifications"
      />
    </div>

    <!-- Multiple Checkbox Group -->
    <div class="option-container bg-grey-1 q-pa-sm rounded-borders">
      <div class="text-caption text-grey-7 q-mb-xs">Delivery Areas *</div>
      <q-option-group
        v-model="fields.areas"
        :options="areaOptions"
        color="accent"
        type="checkbox"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const fields = ref({
  priority: 'medium',
  notify: true,
  areas: []
})

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Normal', value: 'medium' },
  { label: 'High', value: 'high' }
]

const areaOptions = [
  { label: 'Zone A (North)', value: 'north' },
  { label: 'Zone B (South)', value: 'south' },
  { label: 'Zone C (West)', value: 'west' }
]
</script>
```

---

## 5. Best Practices

*   **Color Accents:** Apply consistent accents using theme variables (`color="primary"`, `color="accent"`) to coordinate with status changes.
*   **Dynamic Descriptions:** Provide detail captions below toggles to ensure the action is clear to users before they tap.

---

## 6. Mobile First Rules

*   **Tap Targets Size:** Always use Quasar's default options configurations. They apply a minimum touch footprint exceeding `44px` on label text wraps.
*   **Avoid Text Wrappings:** Short inline group labels must fit cleanly within mobile screen widths (320px) without wrapping.

---

## 7. Common Patterns

### Status Check Toggle Pattern

```html
<!-- FRONTENT/src/components/Operations/OutletStatusToggle.vue -->
<template>
  <div class="row items-center justify-between q-py-sm">
    <span class="text-body2 text-weight-medium text-grey-8">
      Item Status: {{ fields.isActive ? 'Active' : 'Archived' }}
    </span>
    <q-toggle
      v-model="fields.isActive"
      checked-icon="check"
      color="positive"
      unchecked-icon="clear"
      @update:model-value="onStatusChanged"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['status-change'])

const fields = ref({
  isActive: true
})

const onStatusChanged = (val) => {
  emit('status-change', val)
}
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlToggleRow`: Custom component wrapping a label, description, and toggle in a clean row, complete with user permission verification checks.

---

## 9. Accessibility Notes

*   Ensure that multiple checkbox configurations announce group contexts by wrapping options inside a fieldset or using appropriate labels.

---

## 10. Dark Mode Notes

*   Verify options elements do not apply harsh white background boxes in dark mode grids.

---

## 11. Performance Notes

*   Avoid listening to dynamic reactive shifts on checkbox arrays inside rapid animation loops.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Implementing multiple custom `div` boxes with click handlers to build radio buttons.
    *   *Correction:* Always use `QOptionGroup` or `QRadio` controls to leverage native accessibility profiles.
*   **Anti-Pattern:** Using standard checkboxes for immediate server-sync switches.
    *   *Correction:* Use `QToggle` to signal instant action changes.

---

## 13. AI Agent Rules

1.  **Validate Native Grouping:** Confirm that multiple radio or checkbox sets utilize `QOptionGroup` elements.
2.  **Confirm Binary Toggles:** Reject layouts that implement simple checkboxes for immediate feature activation controls.

---

## 14. Decision Matrix

| Input Requirement | Option Count | Recommended Component | Layout Alignment |
| :--- | :--- | :--- | :--- |
| **Active/Inactive toggle**| 2 choices (binary) | `QToggle` | Row inline |
| **Exclusive single choice**| 3 to 5 options | `QOptionGroup` (type: radio) | Inline column row |
| **Exclusive single choice**| > 8 options | `QSelect` (dense) | Outlined popup |
| **Multiple options check** | < 4 options | `QOptionGroup` (type: checkbox)| Vertical list |

---

## 15. Final Rule

All binary choices must use toggles, while multiple selections under 5 options must use inline option groups rather than dropdown selects.
