# Quasar Validation: Input & Form Rules

This reference document describes how to implement and coordinate validation rules on Quasar input fields using native validation arrays, dynamic validation settings, and composable-based schemas.

---

## 1. Overview of Validation Features

Quasar input components (like `QInput` and `QSelect`) offer built-in validation support via the `:rules` prop. This allows developers to pass arrays of validation functions that execute in order.

### Key Capabilities
* **Stateless Validation Functions:** Rules are typically defined as functions that receive the current field value and return either `true` (if the input is valid) or a `String` (containing the error message if invalid).
* **Lazy Evaluation:** Using `lazy-rules` defers execution so validation is not run prematurely (e.g., when the form is initially loaded).
* **Programmatic Form Integration:** `QForm` aggregates these individual input states, offering a single `.validate()` method to verify the overall form state before final submission.

---

## 2. Key Properties & Dynamic Rules Configuration

### Props
* `rules`: An array of functions. Each function receives the model value and returns a boolean or an error message.
* `lazy-rules`: Configures when validation starts:
  * `true` / `ondirty`: Validation is skipped on mount. It runs once the user starts interacting with the field or when the parent `QForm` validation is triggered programmatically.
  * `always`: Validation runs on initial rendering and with every value change.
* `bottom-slots`: Reserves space below the input for displaying validation errors, preventing layout shifts when messages appear.

---

## 3. Implementation Example

Below is an example of validation rules applied to form fields, featuring local validation methods and asynchronous checks:

```html
<template>
  <q-form ref="formRef" @submit.prevent="onFormSubmit">
    <q-card flat bordered class="q-pa-md">
      <!-- Input applying validation rules from a shared rules helper -->
      <q-input
        v-model="formData.email"
        outlined
        dense
        label="Contact Email"
        lazy-rules="ondirty"
        :rules="[rules.required, rules.email]"
      />

      <!-- Input utilizing programmatic asynchronous validation -->
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
import { useSkuValidation } from 'src/composables/operation/useSkuValidation'

const emit = defineEmits(['save', 'cancel'])

const formRef = ref(null)
const formData = ref({
  email: '',
  sku: ''
})

// Validation rules retrieved from a shared helper
const { rules } = useValidationRules()

// Asynchronous validation handlers from a composable
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
  if (formRef.value) {
    formRef.value.resetValidation()
  }
  emit('cancel')
}
</script>
```

---

## 4. Shared Validation Rules Patterns

Validation logic can be decoupled into dedicated composables or helper functions to support reusability:

```javascript
// Example: src/composables/useValidationRules.js
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

## 5. Asynchronous Validation Concerns

* **Debouncing:** When validation relies on network requests (such as querying a database to verify uniqueness), wrapping the validation callback in a debouncing utility helps reduce server loads by limiting request frequency.
* **Loading States:** Binding the input's `:loading` state to a boolean flag provides visual feedback that a background check is currently active.

