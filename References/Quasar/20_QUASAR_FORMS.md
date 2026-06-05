# Quasar Forms: Lifecycles & Submission Patterns

This reference document describes how to implement and manage data entry forms using Quasar's `QForm` component, covering submission lifecycles, child input coordination, and touch device interactions.

---

## 1. Overview of QForm

The `QForm` component acts as a wrapper for grouping multiple input fields (such as `QInput` and `QSelect`). It listens to submission events, coordinates child validation rules, and manages focus states.

### Key Capabilities
* **Dynamic Validation:** `QForm` automatically scans child inputs that expose validation rules and runs their checks synchronously or asynchronously when the form is submitted.
* **Unified Event Handling:** Triggers custom events like `@submit` and `@reset` while allowing modifiers such as `@submit.prevent` to prevent native browser reloads.
* **Focus Management:** By default, if validation fails, the form attempts to scroll and focus the first invalid input field to guide the user.

---

## 2. Core Properties & Events

### Props
* `autofocus`: Automatically focuses the first child input on mount.
* `no-error-focus`: Disables the automatic focusing behavior on validation failure.
* `no-reset-focus`: Prevents focusing the first child field after resetting the form.

### Events
* `@submit`: Fired when the form is submitted, typically after validation succeeds.
* `@reset`: Fired when the form is reset.

### Methods (Accessible via template ref)
* `validate()`: Triggers validation on all registered child components. Returns a Promise resolving to `true` (valid) or `false` (invalid).
* `resetValidation()`: Clears validation errors from all registered child components.
* `focus()`: Sets focus to the first child component in the form.

---

## 3. Implementation Example

The following is an example demonstrating `QForm` integration with state locking, child validation rules, and action layout sections. In AQL architectures, form action submissions are typically gated via permission checks using the custom `useResourceConfig` composable.

```html
<template>
  <q-form @submit.prevent="onSubmit" @reset="onReset" class="q-gutter-y-md">
    <q-card flat bordered>
      <q-card-section class="q-pa-md column q-gutter-y-sm">
        <!-- Input with name validation -->
        <q-input
          v-model="formData.name"
          outlined
          dense
          label="Customer Name"
          :disable="isSubmitting"
          :rules="[ val => val && val.length > 0 || 'Name is required' ]"
        />

        <!-- Number input configured with appropriate mobile input mode -->
        <q-input
          v-model.number="formData.qty"
          outlined
          dense
          type="number"
          inputmode="numeric"
          label="Quantity"
          :disable="isSubmitting"
          :rules="[ val => val > 0 || 'Quantity must be positive' ]"
        />
      </q-card-section>

      <q-card-actions align="right" class="q-pa-md bg-grey-1">
        <q-btn 
          label="Reset" 
          type="reset" 
          color="grey" 
          flat 
          :disable="isSubmitting" 
          v-ripple 
        />
        <!-- Submit button gated using custom project-wide permissions -->
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

## 4. Submission & State Control Patterns

During network operations, form states are commonly managed programmatically to prevent redundant submissions:

* **State Disabling:** Binding the `:disable` property of inputs to a submission state (e.g., `isSubmitting`) prevents users from editing input data while transaction payloads are pending.
* **Loading Feedbacks:** Applying the `:loading` prop to submit buttons lets the user know the operation is in progress.
* **Virtual Keyboard Optimization:** Declaring properties such as `inputmode` (e.g., `numeric` or `tel`) on `QInput` controls standardizes the virtual keyboard display on touch devices.

---

## 5. Shared Submission Utilities

Common composable patterns help coordinate transactional logic and visual notifications:

```javascript
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
