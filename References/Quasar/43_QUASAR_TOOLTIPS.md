# 43_QUASAR_TOOLTIPS.md - Tooltips & Informational Cues

This document is an educational reference guide covering the implementation, properties, and responsive behaviors of Quasar's Tooltip component (`QTooltip`).

---

## 1. Component Overview

`QTooltip` is used to provide small, hover-triggered text hints that describe the purpose or action associated with an element (e.g., an icon button or a status label). Because tooltips rely primarily on hover states, they are typically optimized for pointer-based (desktop) interfaces rather than touch-based (mobile) interfaces.

---

## 2. Key Properties & Configurations

*   **`anchor`**: Specifies the alignment point on the target element (e.g., `top middle`, `bottom right`).
*   **`self`**: Specifies the alignment point on the tooltip itself relative to the anchor (e.g., `bottom middle`, `top right`).
*   **`offset`**: An array specifying horizontal and vertical offsets in pixels (e.g., `[0, 4]`).
*   **`v-if` / screen size gating**: Gating tooltips with screen checks (e.g., `v-if="$q.screen.gt.xs"`) prevents tooltips from rendering on touch devices where hover interactions are simulated and can result in sticky overlays.

---

## 3. Usage Examples

### Standard Desktop Tooltip

In this example, the tooltip is attached to an icon button and gated so it only loads on viewports larger than mobile sizes.

```html
<template>
  <div class="inline-actions-container">
    <q-btn
      v-ripple
      flat
      round
      dense
      color="primary"
      icon="archive"
      @click="emit('archive')"
    >
      <!-- Tooltip restricted to screen sizes larger than extra small (mobile) -->
      <q-tooltip
        v-if="$q.screen.gt.xs"
        anchor="top middle"
        self="bottom middle"
        :offset="[0, 4]"
      >
        Archive Supplier
      </q-tooltip>
    </q-btn>
  </div>
</template>

<script setup>
const emit = defineEmits(['archive'])
</script>
```

### Responsive Inline Information Strategy

On desktop screens, helper information can be tucked away into a hover tooltip. On mobile screens, rendering the details directly inline provides a more accessible user experience.

```html
<template>
  <div class="legend-container">
    <!-- Desktop: Hover-based helper -->
    <div v-if="$q.screen.gt.xs" class="row items-center cursor-pointer">
      <span class="text-subtitle2">Priority</span>
      <q-icon name="help" size="xs" class="q-ml-xs" />
      <q-tooltip anchor="top middle" self="bottom middle">
        High priority orders process within 2 hours
      </q-tooltip>
    </div>

    <!-- Mobile: Inline helper details -->
    <div v-else class="column bg-blue-1 q-pa-sm rounded-borders text-blue-9">
      <div class="text-caption text-weight-bold">Order Priority:</div>
      <div class="text-caption">
        High priority orders process within 2 hours.
      </div>
    </div>
  </div>
</template>
```

---

## 4. Behavior and Usability Guidelines

*   **Touch Device Simulation**: Tapping elements with hover-triggered tooltips on mobile devices often triggers the tooltip. Because there is no cursor move away event, the tooltip may remain visible until the user taps elsewhere. Gating the component with `v-if` helps avoid this behavior.
*   **Information Priority**: Critical information is best placed in the primary page flow. Relying on tooltips for essential transaction steps may hide necessary details from users who do not hover over or tab to those elements.
*   **Keep Text Concise**: Tooltips are designed for brief descriptions or labels. When detailed explanations or clickable links are required, interactive popovers (`QMenu`) or modal dialogs (`QDialog`) are more suitable.
*   **Accessibility**: Quasar tooltips automatically apply `role="tooltip"` and link to their triggers via generated ID structures, supporting screen reader access.
