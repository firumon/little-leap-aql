# 20_QUASAR_FORMS.md - Form Lifecycles & Submission Patterns

This document defines how to implement data entry forms using Quasar's Form components (`QForm`), form submission lifecycles, fields container management, and mobile keyboard configurations.

---

## 1. Purpose

The purpose of this guide is to ensure forms provide clear UX feedback during submission, handle field focusing properly, reduce network retries on double-clicks, and keep touch-device validation flows natural.

---

## 2. Core Philosophy

AQL form design is **Atomic, Transactional, and Safe**:
*   **Atomic Forms:** All input elements must be grouped inside a single `<q-form>` tag. This integrates internal validation rules and keyboard submit handlers.
*   **Safe Submissions:** A button click must lock the form's entire input area immediately. The submit control must display a loading spinner (`loading` prop) to block double-taps.
*   **Adaptive Keyboards:** Every input field must declare attributes that configure the mobile device's virtual keyboard (e.g. numeric pad for inventory, text for description).

---

## 3. Golden Rules

1.  **Always Use QForm:** Never group inputs inside a bare `div` or raw HTML form. Always wrap with `<q-form @submit="handleSubmit">`.
2.  **Lock State During Submissions:** Bind form input fields and selection components to a central reactivity flag: `:disable="isSubmitting"`.
3.  **Prevent Default Submits:** Ensure forms prevent standard browser window reloading. Let Quasar handle inputs using `q-form @submit.prevent`.
4.  **Enforce Validation Before Actions:** All submit triggers must complete form validation checks before sending payloads to composables.

---

## 4. QForm Layout & Event Setup

```html
<!-- FRONTENT/src/components/Operations/OutletOrderForm.vue -->
<template>
  <q-form @submit.prevent="onSubmit" @reset="onReset" class="q-gutter-y-md">
    <q-card flat bordered>
      <q-card-section class="q-pa-md column q-gutter-y-sm">
        <!-- Text Input with keyboard layout optimization -->
        <q-input
          v-model="formData.name"
          outlined
          dense
          label="Customer Name *"
          :disable="isSubmitting"
          :rules="[ val => val && val.length > 0 || 'Name is required' ]"
        />

        <!-- Number input with numeric keyboard layout -->
        <q-input
          v-model.number="formData.qty"
          outlined
          dense
          type="number"
          inputmode="numeric"
          label="Quantity *"
          :disable="isSubmitting"
          :rules="[ val => val > 0 || 'Quantity must be positive' ]"
        />
      </q-card-section>

      <!-- Gated actions block -->
      <q-card-actions align="right" class="q-pa-md bg-grey-1">
        <q-btn label="Reset" type="reset" color="grey" flat :disable="isSubmitting" v-ripple />
        <q-btn
          v-ripple
          v-if="allowed({ orders: 'create' })"
          label="Submit Order"
          type="submit"
          color="primary"
          :loading="isSubmitting"
        />
      </q-card-actions>
    </q-card>
  </q-form>
</template>

<script setup>
import { ref } from 'vue'
import { useResourceConfig } from 'src/composables/useResourceConfig'

const emit = defineEmits(['submit'])
const { allowed } = useResourceConfig()

const isSubmitting = ref(false)
const formData = ref({
  name: '',
  qty: null
})

const onSubmit = async () => {
  isSubmitting.value = true
  // Mock API transaction delay
  try {
    emit('submit', formData.value)
  } finally {
    isSubmitting.value = false
  }
}

const onReset = () => {
  formData.value.name = ''
  formData.value.qty = null
}
</script>
```

---

## 5. Best Practices

*   **Scroll on Error:** If a form has scrollable content, ensure that validation failures scroll the viewport automatically to the first invalid field.
*   **Keep Input Dense:** Mobile viewports have minimal vertical spacing when virtual keyboards show. Enforce the `dense` prop on all input children.

---

## 6. Mobile First Rules

*   **Auto-Focus Limits:** Avoid using `autofocus` on mobile route loading. Mounting keyboard overlays automatically obscures list configurations and breaks the layout.
*   **Virtual Key Optimization:** Provide `inputmode` values to select numeric or phone layouts rather than standard text keyboards.

---

## 7. Common Patterns

### Transactional Submission Wrapper

```javascript
// Composable Level: FRONTENT/src/composables/useFormHandler.js
import { ref } from 'vue'
import { Notify } from 'quasar'

export function useFormHandler(submitCallback) {
  const isSubmitting = ref(false)

  const executeSubmit = async (payload) => {
    isSubmitting.value = true
    try {
      const response = await submitCallback(payload)
      if (response.success) {
        Notify.create({ message: 'Saved successfully', color: 'positive' })
      } else {
        Notify.create({ message: response.error || 'Failed to save', color: 'negative' })
      }
    } catch (e) {
      Notify.create({ message: 'Network operation failed', color: 'negative' })
    } finally {
      isSubmitting.value = false
    }
  }

  return {
    isSubmitting,
    executeSubmit
  }
}
```

---

## 8. Reusable Component Suggestions

*   `AqlForm`: Base custom layout wrapping page headings, form rules validation hooks, and permission-gated submit overlays.
*   `AqlSubmitBtn`: Standard submit button configuration that includes permissions validation checks and loading states.

---

## 9. Accessibility Notes

*   Never wrap text input tags without assigning proper `label` attributes or helper labels to ensure screen readers match inputs correctly.
*   All error text generated dynamically must announce to ARIA containers.

---

## 10. Dark Mode Notes

*   Verify that error labels on form validation have high contrast values (like `text-negative` red) that stand out against dark card backdrops.

---

## 11. Performance Notes

*   Use `debounce` on search inputs to limit validation updates.
*   Avoid nesting massive responsive watcher events inside form fields.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Submitting form data by listening to key presses on individual input tags rather than utilizing `q-form @submit`.
    *   *Correction:* Bind submit actions directly to the `<q-form>` wrapper.
*   **Anti-Pattern:** Leaving forms unlocked (`disable` flag missing) while transactions are outstanding.
    *   *Correction:* Bind inputs to the reactive `isSubmitting` state.

---

## 13. AI Agent Rules

1.  **Verify Submit Events:** Ensure all form templates bind submission actions via `@submit.prevent` on a `<q-form>` tag.
2.  **Validate Loading Spinners:** Confirm that the primary submit button exposes the `:loading` prop bound to a reactive boolean.

---

## 14. Decision Matrix

| Input Set Count | Workflow State | Target Container | Submission Logic |
| :--- | :--- | :--- | :--- |
| **< 4 inputs** | Simple inline edit | `QCard` inside parent page | Direct inline composable call |
| **4 to 8 inputs** | Transaction overlay | Centered `QDialog` | Popover submit handler |
| **> 8 inputs** | Heavy ERP record | Route dedicated Page | Multi-step wizard composable |

---

## 15. Final Rule

All user input blocks must wrap in a single `<q-form>` container, use dense outlined controls, automatically lock inputs, and render loading spinners on the submit button during API calls.
