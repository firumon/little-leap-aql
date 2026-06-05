# 44_QUASAR_BOTTOM_SHEETS.md - Bottom Sheets & Touch Action Sheets

This document is an educational reference guide covering the implementation, configuration, and usage of bottom sheets in Quasar.

---

## 1. Component Overview

Bottom sheets slide up from the bottom of the screen to present a list of choices or actions. They are commonly used in mobile or touch-focused applications as an alternative to floating dropdown menus, as they position controls within easy reach of the user's thumb.

In Quasar, bottom sheets can be created in two main ways:
1.  **Programmatically**: Using the `BottomSheet` plugin (`$q.bottomSheet`) for quick, standard option lists.
2.  **Custom Templates**: Using the `QDialog` component with `position="bottom"` for custom layouts, styling, or custom lists.

---

## 2. Programmatic Bottom Sheet Setup

The `BottomSheet` plugin allows developers to trigger action menus by passing a list of configurations.

### Dynamic Option Gating Example

In enterprise applications, action lists can be filtered dynamically based on user permissions before the bottom sheet is generated.

```javascript
import { useQuasar } from 'quasar'
import { useResourceConfig } from 'src/composables/useResourceConfig'

export function useOutletActions() {
  const $q = useQuasar()
  const { allowed } = useResourceConfig()

  const showActionsSheet = (outletId, onSelected) => {
    const actions = []
    
    // Permission checks gate individual actions
    if (allowed({ outlet: 'update' })) {
      actions.push({ label: 'Edit Details', value: 'edit', icon: 'edit' })
    }
    if (allowed({ outlet: 'delete' })) {
      actions.push({ label: 'Archive Outlet', value: 'archive', icon: 'delete', classes: 'text-negative' })
    }

    $q.bottomSheet({
      title: 'Outlet Management',
      actions: actions
    }).onOk((action) => {
      onSelected(action.value, outletId)
    })
  }

  return { showActionsSheet }
}
```

---

## 3. Custom Template Bottom Sheet Setup

For advanced markup, layout controls, or custom scroll behaviors, using a template-based `QDialog` with the `position="bottom"` property provides a robust alternative.

```html
<template>
  <q-dialog v-model="isOpen" position="bottom" class="custom-action-sheet">
    <q-card class="rounded-borders-top bg-white text-dark">
      <!-- Title header -->
      <q-card-section class="q-pa-md row items-center">
        <div class="text-subtitle1 text-weight-bold">Batch Actions</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>
      
      <q-separator />

      <!-- Selection List -->
      <q-list padding class="q-pb-lg">
        <q-item clickable v-ripple @click="selectAction('approve')">
          <q-item-section avatar>
            <q-icon name="check_circle" color="positive" />
          </q-item-section>
          <q-item-section>Approve Request</q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="selectAction('reject')">
          <q-item-section avatar>
            <q-icon name="cancel" color="negative" />
          </q-item-section>
          <q-item-section>Reject Request</q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from 'vue'

const isOpen = ref(false)
const emit = defineEmits(['select'])

const selectAction = (action) => {
  emit('select', action)
  isOpen.value = false
}
</script>

<style scoped>
.rounded-borders-top {
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}
</style>
```

---

## 4. Behavior and Usability Guidelines

*   **Responsive Adaptation**: While dropdown menus (`QMenu`) work well on desktop screens, swapping them for bottom sheets on mobile devices provides larger tap targets and improves ergonomics.
*   **Viewport Height Limits**: Scrollable containers can be used within custom bottom sheets to prevent them from growing beyond the screen height when displaying long option lists.
*   **Avoiding Input Focus Issues**: Text input elements inside bottom sheets can be problematic because triggering the virtual keyboard on mobile devices can overlap, resize, or push the sheet out of view. Using dedicated centered dialogs or full-screen routes works better for text inputs.
*   **Accessibility**: Quasar bottom sheets support closing on backdrop click or pressing the Escape key. Including clear labels, header text, and list-level ARIA landmarks supports screen readers.
