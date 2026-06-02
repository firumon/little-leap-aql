# 40_QUASAR_DIALOGS.md - Modal Dialogs & Overlays

This document defines how to implement and configure overlays using Quasar's dialog component (`QDialog`) while maintaining mobile usability and responsive panel configurations.

---

## 1. Purpose

The purpose of this guide is to ensure all overlays align cleanly with mobile screen thresholds, prevent keyboard focus trapping bugs, detail layout slots, and ensure smooth dismiss transitions.

---

## 2. Core Philosophy

AQL dialogs are **Responsive, Lazy-Loaded, and Secure**:
*   **Adaptive Dimensions:** Dialog cards must automatically expand to full screen (`maximized` mode) on mobile viewports to prevent user typing from pushing inputs off-screen. On desktop, they revert to centered modal windows.
*   **Lazy Instantiation:** Dialog HTML markup must not pollute the DOM container tree when closed. We enforce this by using Quasar's native `lazy` attribute.
*   **Persistent Triggers:** Form-containing dialogs must set `persistent` to prevent users from losing typed data if they accidentally click outside the dialog bounds.

---

## 3. Golden Rules

1.  **Enforce Mobile Maximization:** Always bind the maximized property dynamically: `:maximized="$q.screen.lt.sm"`.
2.  **Declare Lazy Rendering:** Every `<q-dialog>` tag must define the `lazy` attribute to delay child parsing until the modal is opened.
3.  **Secure Forms with Persistence:** Any dialog wrapping input fields must utilize the `persistent` prop.
4.  **Incorporate Explicit Close Controls:** Dialog cards must contain a clear close button in the top-right header section to allow easy touch dismissal.

---

## 4. QDialog Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Operations/OutletActionDialog.vue -->
<template>
  <q-dialog
    v-model="isOpen"
    lazy
    persistent
    :maximized="$q.screen.lt.sm"
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="column no-wrap" style="width: 500px; max-width: 100vw;">
      <!-- Sticky dialog header bar -->
      <q-card-section class="row items-center q-pb-sm bg-primary text-white">
        <div class="text-h6 text-weight-bold">Update Inventory</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-separator />

      <!-- Scrollable content area -->
      <q-card-section class="col scroll q-pa-md">
        <q-input v-model="qty" label="Adjust Quantity" outlined dense type="number" />
      </q-card-section>

      <q-separator />

      <!-- Action buttons -->
      <q-card-actions align="right" class="q-pa-md bg-grey-1">
        <q-btn label="Cancel" flat color="grey" v-close-popup />
        <q-btn label="Confirm" color="primary" @click="onConfirm" :loading="isSaving" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref } from 'vue'

const isOpen = ref(false)
const qty = ref(0)
const isSaving = ref(false)

const emit = defineEmits(['confirm'])

const onConfirm = () => {
  isSaving.value = true
  try {
    emit('confirm', qty.value)
    isOpen.value = false
  } finally {
    isSaving.value = false
  }
}
</script>
```

---

## 5. Best Practices

*   **Slide-Up Transitions:** For mobile devices, set transitions to `slide-up` and `slide-down` to match native operating system panel designs.
*   **Header Close Button:** Ensure that the top header close button utilizes Quasar's `v-close-popup` directive to simplify closing interactions.

---

## 6. Mobile First Rules

*   **Avoid Overflow Clutters:** If a dialog card has more than 5 form fields, reject the dialog approach. Direct the user to a dedicated edit page layout.
*   **Keep Header Sticky:** For maximized mobile viewports, wrap layout segments inside a CSS flex column (`column no-wrap`) to pin the header and footer, allowing only the middle section to scroll.

---

## 7. Common Patterns

### Programmatic Dialog Creation

Instead of declaring dialogs inside templates, use the programmatic `Dialog` plugin for simple confirmations:

```javascript
import { Dialog } from 'quasar'

const showDeleteConfirmation = (recordId, onDelete) => {
  Dialog.create({
    title: 'Confirm Deletion',
    message: 'Are you sure you want to delete this record? This action is permanent.',
    cancel: true,
    persistent: true,
    ok: {
      label: 'Delete',
      color: 'negative',
      flat: true
    }
  }).onOk(() => {
    onDelete(recordId)
  })
}
```

---

## 8. Reusable Component Suggestions

*   `AqlDialog`: Standard layout wrapping page headers, persistent form checks, and dynamic mobile full-screen expansions.

---

## 9. Accessibility Notes

*   Verify all dialog layouts apply focus loops correctly (Quasar handles this natively; do not overwrite focus hooks).
*   Add descriptive `aria-describedby` links to warning dialogues.

---

## 10. Dark Mode Notes

*   Ensure that inner card borders use theme grey colors to fit dark themes.

---

## 11. Performance Notes

*   **Mandatory Lazy Loading:** Always include the `lazy` property on dialog templates to prevent high DOM overhead.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Centering tiny dialog panels with narrow text on mobile viewports, causing users to pinch-zoom to edit fields.
    *   *Correction:* Maximize dialog elements on screens under `sm`.
*   **Anti-Pattern:** Omitting close button controls inside persistent dialogs, trapping users if actions fail.
    *   *Correction:* Always include a header close button.

---

## 13. AI Agent Rules

1.  **Validate Dialog Sizing:** Ensure all template dialog configurations map the dynamic screen size `:maximized` property.
2.  **Confirm Lazy Loading:** Confirm that dialog templates specify the `lazy` attribute.

---

## 14. Decision Matrix

| Overlay Content Type | User Goal | Dialog Property Setting | Target Layout Design |
| :--- | :--- | :--- | :--- |
| **Simple text warning** | Confirm action | Programmatic helper | `Dialog.create(...)` plugin |
| **3 input parameters** | Add item details | Dynamic maximized dialog | Flex column container sheet |
| **Complex checklist** | Edit record mappings| dedicated Route page | Scrollable full-width list |
| **Action selection** | Select workflow | Bottom sheet modal | Slide overlay menu |

---

## 15. Final Rule

All visual dialog setups must define dynamic screen maximization, utilize lazy rendering, wrap contents in a persistent card with a header close action, and show loader statuses during saves.
