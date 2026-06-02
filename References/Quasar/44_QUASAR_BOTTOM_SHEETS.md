# 44_QUASAR_BOTTOM_SHEETS.md - Bottom Sheets & Touch Action Sheets

This document defines how to implement and configure bottom-sliding action panels using Quasar's Bottom Sheet plugin and custom dialog templates to optimize touch ergonomics.

---

## 1. Purpose

The purpose of this guide is to explain the priority of bottom sheets over standard floating menu dropdowns on mobile interfaces, define option structures, and explain permission gating rules for actions.

---

## 2. Core Philosophy

AQL action sheets are **Thumb-Accessible, Highly Ergonomic, and Simple**:
*   **Thumb Sweep Sweep Comfort:** Controls placed near the bottom of mobile screens are easier to reach. Bottom sheets slide items directly into this primary touch zone.
*   **Explicit Action Lists:** Actions display in clear, full-width list rows containing vector icons, providing high clarity compared to tiny nested text dropdown menus.
*   **Instant Cancellation:** Users can swipe down or tap the backdrop overlay to dismiss options instantly.

---

## 3. Golden Rules

1.  **Prefer Bottom Sheets on Mobile:** Contextual card menu selections on screens under `sm` must map to bottom sheets rather than floating menus.
2.  **Lock Sheet Heights:** Ensure bottom sheets do not exceed `50%` of viewport heights. If option counts are high, wrap items in scroll containers.
3.  **Gate Actions Programmatically:** Filter the option configurations array using permission checks (`allowed()`) before passing data parameters to sheets.
4.  **Incorporate Ripple Feedback:** Every action line button inside custom bottom sheets must define the `v-ripple` directive.

---

## 4. QBottomSheet Plugin & Custom Layout Setup

### Programmatic Bottom Sheet Trigger
```javascript
// Composition API Call Pattern inside a Composable
import { useQuasar } from 'quasar'
import { useResourceConfig } from 'src/composables/useResourceConfig'

export function useOutletActions() {
  const $q = useQuasar()
  const { allowed } = useResourceConfig()

  const showActionsSheet = (outletId, onSelected) => {
    // 1. Build actions array applying permission gates
    const actions = []
    
    if (allowed({ outlet: 'update' })) {
      actions.push({ label: 'Edit Details', value: 'edit', icon: 'edit' })
    }
    if (allowed({ outlet: 'delete' })) {
      actions.push({ label: 'Archive Outlet', value: 'archive', icon: 'delete', classes: 'text-negative' })
    }

    // 2. Spawn Bottom Sheet
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

## 5. Best Practices

*   **Standard List Formatting:** Display options inside a vertical list. Avoid grid structures (multiple icon grid columns) unless configuring direct file sharing workflows.
*   **Contrast Styling:** Ensure delete or warning actions apply explicit red styling colors (`classes: 'text-negative'`).

---

## 6. Mobile First Rules

*   **Keyboard Exclusions:** Never render text input components inside a bottom action sheet. Toggling text cursors pushes sheets out of the screen.
*   **Header Titles:** Include descriptive header labels to remind the user what record they are modifying.

---

## 7. Common Patterns

### Custom Layout Bottom Sheet Card

When programmatic defaults are insufficient, implement bottom sheets using `QDialog` with `position="bottom"`:

```html
<!-- FRONTENT/src/components/Operations/OutletCustomActionSheet.vue -->
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
/* Ensure top borders are rounded for bottom sheet appearance */
.rounded-borders-top {
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}
</style>
```

---

## 8. Reusable Component Suggestions

*   `AqlActionSheet`: Custom component wrapper pre-loaded with permission filters, status labels, and item lists.

---

## 9. Accessibility Notes

*   Verify screen readers announce option lists dynamically when bottom sheets slide up.
*   Support esc key dismissals.

---

## 10. Dark Mode Notes

*   Ensure that top borders and icons use slate styling parameters (`bg-surface`, `text-white`) under dark mode themes.

---

## 11. Performance Notes

*   Do not bundle heavy calculations inside action list options. Compile values prior to sheets triggers.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Using standard desktop dropdown menus on mobile viewports for crucial actions.
    *   *Correction:* Replace with the `BottomSheet` plugin helper.
*   **Anti-Pattern:** Putting heavy text inputs inside bottom action sheet models.
    *   *Correction:* Open centered Dialog pages instead.

---

## 13. AI Agent Rules

1.  **Validate Ergonomics:** Ensure that contextual lists containing more than 3 options default to bottom sheets on mobile.
2.  **Confirm Permissions Filter:** Confirm action configurations verify permission flags prior to generating options lists.

---

## 14. Decision Matrix

| Viewport Category | Option Count | Action Intent | Recommended Component Selection |
| :--- | :--- | :--- | :--- |
| **Mobile (<600px)** | > 3 options | Record workflow actions | Programmatic `BottomSheet` plugin |
| **Mobile (<600px)** | 2 options | Direct status switches | Double action buttons card footer |
| **Desktop (>1024px)**| > 3 options | Record workflow actions | Floating drop-down Menu (`QMenu`) |
| **All Screens** | Multi-level inputs | Record edits | dedicated Route page / maximized dialog |

---

## 15. Final Rule

All mobile record action panels must implement bottom sheets, compile options lists dynamically using programmatic permission gates, use standard list formats, and apply direct ripple tap feedback.
