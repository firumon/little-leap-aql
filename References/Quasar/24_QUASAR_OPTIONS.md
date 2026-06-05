# Quasar Options: Toggles, Checkboxes & Option Groups

This reference document describes how to implement choice selection controls using Quasar components, covering `QToggle`, `QCheckbox`, `QRadio`, and `QOptionGroup` configurations.

---

## 1. Overview of Option Components

Quasar provides several components for gathering binary or multi-choice selections. These components standardise target areas, icons, and keyboard focus states.

### Component Comparison
* **QToggle:** Best suited for binary states (e.g., enable/disable, true/false) where the state change represents an active decision or instant preference adjustment.
* **QCheckbox:** Typically used for multiple selections (e.g., lists of filters or checking rows in a table) where multiple options can be chosen simultaneously.
* **QRadio:** Used for mutually exclusive single selections from a short list.
* **QOptionGroup:** A convenience wrapper that groups multiple checkboxes or radio buttons into a single component bound to a single model.

---

## 2. Key Properties & Options

### QOptionGroup Props
* `type`: Specifies the selection element type (either `radio` or `checkbox`).
* `inline`: Aligns the child elements horizontally inside a row container rather than vertically.
* `options`: An array of objects defining choices, structured with `label` and `value` fields.

### QToggle Props
* `icon`: Appends a helper icon inside the sliding button.
* `checked-icon` / `unchecked-icon`: Customizes the indicator icon based on active state.
* `color`: Assigns a theme color to the active toggle track or icon.

---

## 3. Implementation Example

The example below shows a column arrangement showcasing `QOptionGroup` (configured as radio buttons and checkbox lists) and a `QToggle` control:

```html
<template>
  <div class="column q-gutter-y-md">
    <!-- Radio Option Group for mutually exclusive choices -->
    <div class="option-container bg-grey-1 q-pa-sm rounded-borders">
      <div class="text-caption text-grey-7 q-mb-xs">Order Priority</div>
      <q-option-group
        v-model="fields.priority"
        :options="priorityOptions"
        color="primary"
        inline
        type="radio"
      />
    </div>

    <!-- Toggle Switch for binary states -->
    <div class="row items-center justify-between bg-white q-pa-md border-grey-3 rounded-borders">
      <div class="column">
        <span class="text-subtitle2 text-weight-bold">Enable Notifications</span>
        <span class="text-caption text-grey-6">Receive updates on state updates</span>
      </div>
      <q-toggle
        v-model="fields.notify"
        color="secondary"
        icon="notifications"
      />
    </div>

    <!-- Checkbox Option Group for multiple choices -->
    <div class="option-container bg-grey-1 q-pa-sm rounded-borders">
      <div class="text-caption text-grey-7 q-mb-xs">Delivery Zones</div>
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
  { label: 'Zone A', value: 'north' },
  { label: 'Zone B', value: 'south' },
  { label: 'Zone C', value: 'west' }
]
</script>
```

---

## 4. State Update Handling

Toggles are frequently used to trigger direct asynchronous requests on model updates. The `@update:model-value` event transmits the latest checked status:

```html
<template>
  <div class="row items-center justify-between q-py-sm">
    <span class="text-body2 text-weight-medium">
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
const fields = ref({ isActive: true })

const onStatusChanged = (val) => {
  emit('status-change', val)
}
</script>
```
