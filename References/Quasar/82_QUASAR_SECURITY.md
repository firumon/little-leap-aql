# Quasar Security & Input Sanitization Reference Guide

This reference guide describes the principles of securing web inputs, preventing Cross-Site Scripting (XSS) injections, sanitizing dynamic values, and managing credential fields securely within Quasar applications.

---

## 1. Core Principles of Frontend Security

Securing client-side web interfaces involves defending against browser-level vulnerabilities and protecting sensitive data:

*   **Mitigating Cross-Site Scripting (XSS)**: XSS occurs when untrusted user inputs are executed as executable code by the browser. Standard Vue text interpolation (`{{ }}`) automatically escapes HTML tags and prevents script execution.
*   **HTML Sanitization**: When rendering rich text content is necessary, input strings should be cleaned of potentially harmful tags (e.g., `<script>`, `<iframe>`, `onload` attributes) before insertion into the DOM.
*   **Credential Handling**: Inputs representing passwords, API keys, or pin codes should mask characters to prevent visual scanning ("shoulder surfing") and should not be stored in unencrypted browser storage locations.
*   **Transport Security**: Ensuring all network requests utilize secure protocols (HTTPS) prevents intercept attacks on data in transit.

---

## 2. Key Quasar & Vue Security Features

*   **Standard Interpolation (`{{ }}`)**: Vue's default template interpolation converts text elements into safe strings, neutralizing HTML tags and script elements.
*   **Password Masking (`QInput type="password"`)**: `QInput` supports switching between `text` and `password` input modes to display or obscure credentials.
*   **Input Validation Filters**: Programmatic validation rules (`rules` prop) can verify that inputs do not contain malicious characters prior to form submission.

---

## 3. Code Examples

### Credential Input with Toggle & Safe Text Output

The following example demonstrates a form that manages credential masking, visibility toggles, and safe text interpolation:

```html
<template>
  <div class="column q-gutter-y-sm">
    <!-- Secure password visibility toggle input -->
    <q-input
      v-model="fields.password"
      outlined
      dense
      :type="isPwdVisible ? 'text' : 'password'"
      label="Access Password *"
      class="full-width"
    >
      <template v-slot:append>
        <q-icon
          :name="isPwdVisible ? 'visibility_off' : 'visibility'"
          class="cursor-pointer"
          @click="togglePasswordVisibility"
          aria-label="Toggle password visibility"
        />
      </template>
    </q-input>

    <!-- Safe Text Display ( Mustache brackets automatically escape tags ) -->
    <q-card flat bordered class="q-pa-md bg-grey-1">
      <div class="text-caption text-grey-7">User Description Output:</div>
      <div class="text-body2 text-weight-medium">
        {{ fields.description }}
      </div>
    </q-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const isPwdVisible = ref(false)
const fields = ref({
  password: '',
  description: '<script>alert("XSS Attack!")<\/script> Pure safe text!'
})

const togglePasswordVisibility = () => {
  isPwdVisible.value = !isPwdVisible.value
}
</script>
```

### Input Escape Sanitizer Utility

For programmatic sanitization or stripping tags prior to packaging payloads for API submission:

```javascript
// utils/securitySanitizer.js

/**
 * Escapes HTML characters in a string to prevent injection issues.
 */
export function sanitizeString(rawString) {
  if (typeof rawString !== 'string') return rawString
  return rawString
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Strips HTML tags completely.
 */
export function stripHtmlTags(rawString) {
  if (typeof rawString !== 'string') return rawString
  return rawString.replace(/<\/?[^>]+(>|$)/g, "")
}
```

Usage inside setup scripts or composables:
```javascript
import { sanitizeString } from 'src/utils/securitySanitizer'

const submitPayload = {
  name: sanitizeString(formFields.name),
  notes: sanitizeString(formFields.notes)
}
```

---

## 4. Technical Considerations

*   **Autofill Safety**: Setting password elements' autocomplete attributes (e.g., `autocomplete="new-password"` or `autocomplete="current-password"`) helps control how browsers cache and autofill credentials.
*   **Virtual Keyboards on Mobile**: Restricting inputs that collect codes, numbers, or pins to appropriate types (e.g., `type="password" inputmode="numeric" pattern="[0-9]*"`) enforces secure mobile keyboards and disables browser dictionary caching.
*   **Rendering HTML Safely**: Relying on Vue's `v-html` directive creates potential security holes if the bound content is not sanitized. To render rich text (such as custom markdown comments), use established sanitization libraries (e.g., DOMPurify) to cleanse inputs.
*   **Performance of Sanitizers**: Executing heavy regular expressions or parsing logic within template execution scopes can slow down rendering. Running sanitization routines during lifecycle submit actions is more performant than running them continuously on active keypresses.
