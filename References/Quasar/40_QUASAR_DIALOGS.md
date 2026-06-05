# 40_QUASAR_DIALOGS.md - Modal Dialogs & Overlays

This document is an educational reference guide covering the configuration, usage, and layout options for Quasar's Dialog component (`QDialog`).

---

## 1. Component Overview

`QDialog` is a component used to display modal dialogs, overlays, or prompt windows over the main application view. It supports responsive behaviors, lazy instantiation, custom transitions, and programmatic invocation.

### Key Sub-Components
*   `QCard`: Typically used as the root container inside a dialog to structure the content.
*   `QCardSection`: Used to define distinct layout regions, such as headers, body content, and descriptive text.
*   `QCardActions`: Configured for buttons and user action triggers at the bottom of the card.
*   `v-close-popup`: A directive that can be attached to buttons inside the dialog to close the overlay when clicked.

---

## 2. Key Properties & Configurations

*   **`v-model`**: Controls the visibility of the dialog (boolean).
*   **`lazy`**: Defers the rendering of the dialog's children until it is opened, which can help keep the initial DOM light.
*   **`persistent`**: Prevents the user from closing the dialog by clicking outside the modal boundary or pressing the `Escape` key.
*   **`maximized`**: Forces the dialog to fill the entire screen viewport. In responsive applications, this property can be bound dynamically based on screen size (e.g., `:maximized="$q.screen.lt.sm"`).
*   **`transition-show` / `transition-hide`**: Sets custom CSS transitions for opening and closing animations (e.g., `"slide-up"`, `"fade"`).

---

## 3. Usage Examples

### Template-Based Dialog

The template approach allows embedding interactive forms, complex layouts, and dynamic elements.

```html
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
      <!-- Dialog Header -->
      <q-card-section class="row items-center q-pb-sm bg-primary text-white">
        <div class="text-h6 text-weight-bold">Update Inventory</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-separator />

      <!-- Scrollable Content Area -->
      <q-card-section class="col scroll q-pa-md">
        <q-input v-model="qty" label="Adjust Quantity" outlined dense type="number" />
      </q-card-section>

      <q-separator />

      <!-- Actions -->
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

### Programmatic Dialog Creation

For simple confirmation dialogs, notifications, or text prompts, Quasar provides a programmatic API via the `Dialog` plugin:

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

## 4. Behavior and Layout Best Practices

*   **Responsive Adaptation**: Dynamically toggling the `:maximized` property based on screen breakpoints allows the modal to adapt seamlessly between desktop layouts and mobile viewports.
*   **Sticky Sections in Maximized Layouts**: Applying flex layouts (such as `column no-wrap` and `col scroll`) ensures that headers and footers remain fixed at the edges of the screen, while only the body content scrolls.
*   **Lazy Loading**: The `lazy` prop prevents the framework from rendering child elements in the DOM until the dialog is active, optimizing rendering performance.
*   **Accessibility**: Quasar manages focus trapping and focus loops natively. Developers can enhance accessibility by adding clear labels, close triggers, and using appropriate semantic tags or ARIA attributes.
