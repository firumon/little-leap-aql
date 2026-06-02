# 21_QUASAR_VALIDATION.md - Input & Form Validation Rules

This document defines how to implement validation rules on Quasar inputs using native validation arrays, dynamic lazy-validation properties, and decoupled logic composables.

---

## 1. Purpose

The purpose of this guide is to ensure input validation is clean, performance-optimized on mobile devices, and avoids triggering premature error messages before a user completes their input.

---

## 2. Core Philosophy

AQL validation is **Decoupled and Declarative**:
*   **Decoupled Schema:** Simple rules (like checking for empty strings) can reside in reusable utility collections. Complex, cross-field validation rules (like comparing invoice date against order date) must live in composables.
*   **Lazy Verification:** Validation checks must not fire on field initialization. We use dynamic rules checking (`lazy-rules`) to defer validation evaluations until the field loses focus or the form submits.
*   **Pure Functions:** All validation rules are stateless, pure JavaScript functions that return either `true` (success) or a `String` representing the failure error message.

---

## 3. Golden Rules

1.  **Always Set Lazy Rules:** All input components requiring rules must specify `lazy-rules="ondirty"` to prevent validation from firing while typing.
2.  **No Anonymous Functions in Templates:** Never declare validation logic directly inline inside template attributes (e.g. `:rules="[val => !val]"` is forbidden). Define rules in the script block.
3.  **Clear Validation on Reset:** Always call the form's native `resetValidation()` function during form cancellation or reset.
4.  **No Direct DOM Manipulation for Errors:** Never query DOM elements or change style properties manually to display errors. Bind validation states strictly to the input controls.

---

## 4. QInput Rules & Lazy Validation Setup

```html
<!-- FRONTENT/src/components/Operations/OutletInventoryForm.vue -->
<template>
  <q-form ref="formRef" @submit.prevent="onFormSubmit">
    <q-card flat bordered class="q-pa-md">
      <!-- Input using imported reusable validation functions -->
      <q-input
        v-model="formData.email"
        outlined
        dense
        label="Contact Email"
        lazy-rules="ondirty"
        :rules="[rules.required, rules.email]"
      />

      <!-- Input using programmatic async composable rules -->
      <q-input
        v-model="formData.sku"
        outlined
        dense
        label="SKU Code"
        lazy-rules="ondirty"
        :rules="[rules.required, validateSku]"
        :loading="isValidatingSku"
      />

      <q-card-actions align="right" class="q-mt-md">
        <q-btn label="Cancel" color="grey" flat @click="onCancel" />
        <q-btn label="Save" type="submit" color="primary" />
      </q-card-actions>
    </q-card>
  </q-form>
</template>

<script setup>
import { ref } from 'vue'
import { useValidationRules } from 'src/composables/useValidationRules'
import { useSkuValidation } from 'src/composables/operations/useSkuValidation'

const emit = defineEmits(['save', 'cancel'])

const formRef = ref(null)
const formData = ref({
  email: '',
  sku: ''
})

// Reusable validation rules
const { rules } = useValidationRules()

// Programmatic async validation from composable
const { isValidatingSku, checkSkuAvailability } = useSkuValidation()

const validateSku = async (val) => {
  const result = await checkSkuAvailability(val)
  return result.isValid || result.message
}

const onFormSubmit = async () => {
  const success = await formRef.value.validate()
  if (success) {
    emit('save', formData.value)
  }
}

const onCancel = () => {
  formRef.value.resetValidation()
  emit('cancel')
}
</script>
```

---

## 5. Best Practices

*   **Rule Composition:** Chain multiple validation rules inside the array in order of execution. Put lightweight checks (e.g. `required`) first to skip heavy regex parsing or async checks on empty values.
*   **Error Message Clarity:** Provide precise error messages that tell the user exactly what to correct (e.g., "Quantity must be greater than zero", not "Invalid input").

---

## 6. Mobile First Rules

*   **Keyboard Dismissal on Submit:** Ensure that validation failures keep focus on the first invalid field, but don't force-open the keyboard on mobile unless the user taps the field.
*   **Touch Friendly Error Margins:** Keep the spacing helper height (`bottom-slots` property or default layout offsets) constant. This prevents input boxes from jumping or shifting the layout vertically when validation error messages render.

---

## 7. Common Patterns

### Decoupled Validation Composables

```javascript
// FRONTENT/src/composables/useValidationRules.js
export function useValidationRules() {
  const rules = {
    required: (val) => (val !== null && val !== undefined && val !== '') || 'Field is required',
    email: (val) => {
      const pattern = /^(?=[a-zA-Z0-9@._%+-]{6,254}$)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      return pattern.test(val) || 'Invalid email address'
    },
    numeric: (val) => !isNaN(Number(val)) || 'Value must be a number',
    positive: (val) => Number(val) > 0 || 'Value must be positive'
  }

  return { rules }
}
```

---

## 8. Reusable Component Suggestions

*   `AqlValidatedInput`: Standard wrapper around `QInput` preloaded with AQL lazy validation triggers, error templates, and touch keyboard selectors.

---

## 9. Accessibility Notes

*   Quasar inputs automatically map validation state changes to ARIA attributes (`aria-invalid="true"`). Make sure custom form fields match these behaviors.
*   Set focus to the first failed field on programmatic validation triggers.

---

## 10. Dark Mode Notes

*   Ensure validation error colors use CSS color variables (`var(--q-negative)`) rather than fixed hex overrides so the error text is readable on dark background themes.

---

## 11. Performance Notes

*   **Debounce Async Rule Checks:** When checking uniqueness via network queries, wrap the API check in a debounce helper to prevent calling the server on every keystroke.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Writing validation loops inside the submit action callback instead of utilizing the form's `validate()` promise.
    *   *Correction:* Check form validity using `const success = await formRef.value.validate()`.
*   **Anti-Pattern:** Failing to define the `lazy-rules` parameter, causing errors to display as soon as the user opens the page.
    *   *Correction:* Use `lazy-rules="ondirty"`.

---

## 13. AI Agent Rules

1.  **Enforce Schema Separation:** Verify that all validation rules are defined inside helper script blocks or separate composables rather than inline template code.
2.  **Ensure Form Resets:** Confirm that all form cancel actions call `resetValidation()` on the layout reference object.

---

## 14. Decision Matrix

| Validation Complexity | Trigger Requirement | Validation Strategy | Implementation Area |
| :--- | :--- | :--- | :--- |
| **Simple text formatting** | Lost focus / Blur | Rules array with `lazy-rules` | Local script rules helper |
| **Cross-field comparisons**| Blur / Form submit | Programmatic script function | Composable state comparison |
| **Backend query (uniqueness)**| Keystroke with pause | Debounced async function | Composable API query |
| **Multi-step forms** | Wizard step click | Programmatic layout step checks | Wizard store validation hooks |

---

## 15. Final Rule

All validation checks must use dynamic lazy rule arrays, decouple complex rules into stateful composables, check form validity programmatically using the form reference, and call clear validation loops on resets.
