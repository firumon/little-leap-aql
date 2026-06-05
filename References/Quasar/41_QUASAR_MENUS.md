# 41_QUASAR_MENUS.md - Dropdown Menus & Context Options

This document is an educational reference guide covering the configuration, positioning, and usage of Quasar's Menu component (`QMenu`).

---

## 1. Component Overview

`QMenu` is a component used to display dropdown menus, floating options lists, and context-sensitive action triggers. It is typically anchored to a button or target container and supports customizable positioning, offsets, and transitions.

### Key Features
*   **Anchor Positioning**: Allows precise control over where the menu appears relative to the parent element.
*   **Auto-Dismiss**: Closes the menu automatically when an option inside the list is clicked.
*   **Responsive Fallbacks**: Can be integrated with other components, such as `QBottomSheet`, to optimize interactions across different viewport sizes.

---

## 2. Key Properties & Configurations

*   **`auto-close`**: Automatically dismisses the menu once a click event is triggered inside the menu.
*   **`anchor`**: Defines which corner/edge of the parent element the menu should align to (e.g., `bottom left`, `top right`).
*   **`self`**: Defines which corner/edge of the menu itself should align to the anchor point (e.g., `top left`, `bottom right`).
*   **`offset`**: An array of two numbers representing the horizontal and vertical offset in pixels from the anchor point (e.g., `:offset="[0, 8]"`).
*   **`transition-show` / `transition-hide`**: Configures animations for the entrance and exit of the menu container.

---

## 3. Usage Examples

### Standard Inline Dropdown Menu

An inline dropdown menu typically resides within a button, triggering a list of actions when clicked.

```html
<template>
  <div class="inline-menu-trigger">
    <!-- Trigger Button -->
    <q-btn flat round dense icon="more_vert" color="grey-7">
      <!-- Embedded contextual dropdown menu -->
      <q-menu
        auto-close
        transition-show="jump-down"
        transition-hide="jump-up"
        anchor="bottom right"
        self="top right"
        :offset="[0, 8]"
      >
        <q-list style="min-width: 150px;" class="q-py-xs">
          <q-item clickable v-ripple @click="emit('action', 'edit')">
            <q-item-section avatar class="q-pe-none">
              <q-icon name="edit" size="xs" />
            </q-item-section>
            <q-item-section>Edit Details</q-item-section>
          </q-item>

          <q-item clickable v-ripple @click="emit('action', 'duplicate')">
            <q-item-section avatar class="q-pe-none">
              <q-icon name="file_copy" size="xs" />
            </q-item-section>
            <q-item-section>Duplicate</q-item-section>
          </q-item>

          <q-separator class="q-my-xs" />

          <q-item clickable v-ripple class="text-negative" @click="emit('action', 'delete')">
            <q-item-section avatar class="q-pe-none">
              <q-icon name="delete" size="xs" color="negative" />
            </q-item-section>
            <q-item-section>Delete Record</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
  </div>
</template>

<script setup>
const emit = defineEmits(['action'])
</script>
```

### Responsive Menu Selector Composable

For responsive designs, you can programmatically decide to use a `QMenu` on desktop and fallback to a bottom sheet on mobile screens.

```javascript
import { useQuasar } from 'quasar'

export function useResponsiveMenu() {
  const $q = useQuasar()

  const openActionsMenu = (options, onSelected) => {
    if ($q.screen.lt.sm) {
      // Mobile fallback using Quasar's BottomSheet plugin
      $q.bottomSheet({
        title: 'Actions',
        actions: options
      }).onOk((action) => {
        onSelected(action.value)
      })
    }
  }

  return { openActionsMenu }
}
```

---

## 4. Behavior and Layout Considerations

*   **Explicit Dimensions**: Setting a `min-width` on the inner `QList` prevents content clipping or text wrapping when menu labels vary in length.
*   **Touch Clearances**: Adding padding to menu list items improves usability on touch-enabled interfaces.
*   **Avoid Complex Inputs**: Dropdowns are typically best suited for simple, quick-selection menus. For complex interactive elements or long forms, modal dialogs or separate route pages offer a more robust user experience.
*   **Accessibility**: Ensuring proper keyboard navigation and tab orders allows screen readers and keyboard users to navigate menu options successfully.
