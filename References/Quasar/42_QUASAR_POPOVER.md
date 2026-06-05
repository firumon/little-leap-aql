# 42_QUASAR_POPOVER.md - Lightweight Popover Panels

This document is an educational reference guide covering the implementation, configuration, and behaviors of lightweight, interactive popover panels in Quasar.

---

## 1. Concept Overview

Popovers are lightweight overlays used to display contextual information, supplementary details, or small interactive controls directly adjacent to a trigger element (such as an info icon, button, or label). 

In Quasar, these are commonly implemented using the `QMenu` component configured for click-based or tap-based activation. Unlike tooltips (which are typically hover-only and non-interactive), popovers can contain clickable links, buttons, and formatted text.

---

## 2. Positioning & Properties

When configuring popovers with `QMenu`, the following properties help align the panel relative to its trigger:

*   **`anchor`**: Defines the point on the trigger element to which the popover aligns (e.g., `top middle`, `bottom right`).
*   **`self`**: Defines the point on the popover container that aligns to the anchor point (e.g., `bottom middle`, `top right`).
*   **`offset`**: An array defining horizontal and vertical offsets in pixels (e.g., `[0, 8]`).
*   **`max-width` / `width`**: Styling constraints applied to the popover to ensure readable text wrapping and avoid overflow on narrow screens.

---

## 3. Usage Examples

### Contextual Info Popover

This example displays a help popover containing styled text and a clickable action button.

```html
<template>
  <div class="inline-popover-trigger">
    <!-- Question icon trigger -->
    <q-icon name="help_outline" class="cursor-pointer text-grey-7" size="18px">
      <!-- Lightweight interactive popover panel -->
      <q-menu
        anchor="top middle"
        self="bottom middle"
        :offset="[0, 8]"
        class="bg-grey-9 text-white q-pa-sm"
        style="max-width: 250px;"
      >
        <div class="column q-gutter-y-xs">
          <div class="text-caption text-weight-bold text-primary-light">
            Dynamic Factor Details
          </div>
          <div class="text-caption">
            Exchange factor matches current PO currency rules config.
          </div>
          <q-separator dark class="q-my-xs" />
          <q-btn
            v-ripple
            size="xs"
            color="white"
            flat
            label="Learn More"
            class="self-end"
            @click="emit('learn-more')"
          />
        </div>
      </q-menu>
    </q-icon>
  </div>
</template>

<script setup>
const emit = defineEmits(['learn-more'])
</script>
```

### Simple Text Highlight Popover

This component encapsulates a simple text popover that opens on click.

```html
<template>
  <span class="row items-center cursor-pointer text-primary">
    {{ label }}
    <q-icon name="info" size="xs" class="q-ml-xs" />
    <q-menu anchor="bottom middle" self="top middle" :offset="[0, 4]" class="bg-dark text-white q-pa-sm">
      <div class="text-caption">{{ helpText }}</div>
    </q-menu>
  </span>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  helpText: { type: String, required: true }
})
</script>
```

---

## 4. Design & Usability Guidelines

*   **Click vs. Hover**: Popovers containing interactive elements (like links or buttons) require click or tap activation, as hover-based popovers can close before the user can move their pointer onto the content.
*   **Dimensions on Small Screens**: Limiting the width of the popover card (e.g., standardizing to `250px` or `280px`) prevents horizontal clipping and layout overflow on mobile screens.
*   **Controlling Content Density**: Popovers work best for short, direct messages. If the layout requires complex forms, multi-step actions, or high-density data tables, modal dialogs or dedicated route views are typically preferred.
*   **Accessibility**: Keep trigger icons keyboard-tabbable and ensure the popover text remains accessible to assistive screen reader technologies.
