# 82_QUASAR_SECURITY.md - Frontend Security & Input Sanitization

This document defines how to secure user input forms, prevent Cross-Site Scripting (XSS) injections, sanitize raw HTML rendering, and handle sensitive credential fields using Quasar configurations.

---

## 1. Purpose

The purpose of this guide is to explain XSS injection preventions, standard password mask controls, and establish rules for using native Vue templates rendering directives safely.

---

## 2. Core Philosophy

AQL security is **Zero-Trust, Sanitized-First, and Mask-Control**:
*   **Prohibit Raw HTML Directives:** Tapping raw HTML output vectors using Vue's `v-html` directive is banned. All text displays must use default interpolation (`{{ }}`) to sanitize inputs.
*   **Input Script Escaping:** All user-supplied input strings must strip visual HTML tags and code blocks dynamically before executing API updates.
*   **Encrypted Display Masks:** Sensitive user properties (tokens, credentials, warehouse codes) must mask content by default, exposing visibility options only behind explicit click actions.

---

## 3. Golden Rules

1.  **Ban v-html Directive:** Never write `<div v-html="userInput">`. Use plain text mustache brackets: `{{ userInput }}`.
2.  **Toggle Password Visibilities:** Input components handling credentials must mask characters by default and toggle visibilities using a click accessory icon: `type="password"`.
3.  **Sanitize String Variables:** User inputs carrying potential code tags must run through utility sanitize filters before payload compilations.
4.  **Confirm HTTPS Protocol Transport:** All Axios calls and sync queries must target secure HTTPS endpoint links exclusively.

---

## 4. QInput Security & Password Toggle Setup

```html
<!-- FRONTENT/src/components/Operations/OutletSecurityFields.vue -->
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

---

## 5. Best Practices

*   **Prevent Auto-Autocomplete on Passwords:** Set inputs autocomplete keys to `autocomplete="new-password"` or `autocomplete="current-password"` to avoid web browsers caching sensitive fields.
*   **Strip Raw Regex Inputs:** Sanitize input strings using regex filter checks: `val.replace(/<[^>]*>?/gm, '')` to strip tags.

---

## 6. Mobile First Rules

*   **Secure Mobile Keyboards:** Ensure fields capturing pins or verification codes define appropriate masking types (`type="password" inputmode="numeric" pattern="[0-9]*"`) to support security.
*   **Hide Input Echoes:** Turn off auto-correct on authentication codes.

---

## 7. Common Patterns

### Input Escape Sanitizer Pattern

Filter form variables programmatically prior to generating API save models:

```javascript
// FRONTENT/src/utils/securitySanitizer.js

/**
 * Escapes HTML tag characters in a string to prevent XSS injection.
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

Usage inside composables:
```javascript
import { sanitizeString } from 'src/utils/securitySanitizer'

const submitPayload = {
  name: sanitizeString(formFields.name),
  notes: sanitizeString(formFields.notes)
}
```

---

## 8. Reusable Component Suggestions

*   `AqlPasswordInput`: Reusable password text field incorporating visibility controls, autocomplete masks, and validation rules.

---

## 9. Accessibility Notes

*   Verify toggle visibility icons include descriptive ARIA labels so screen reader users understand action consequences.

---

## 10. Dark Mode Notes

*   Ensure validation indicators (error texts, warning banners) preserve WCAG AA contrast rules in dark templates.

---

## 11. Performance Notes

*   Avoid executing complex HTML tag strip regexes inside live template functions loops. Run filters during save executions.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Rendering user-entered comment strings inside raw `v-html` layout zones.
    *   *Correction:* Always interpolate content using standard mustache syntax (`{{ }}`).
*   **Anti-Pattern:** Storing plain text password strings inside standard cache values (`LocalStorage`).
    *   *Correction:* Credentials must reside exclusively in secure memory zones.

---

## 13. AI Agent Rules

1.  **Ban v-html:** Reject any template files writing the `v-html` key.
2.  **Validate Password Inputs:** Verify fields representing passwords declare visibility toggles.

---

## 14. Decision Matrix

| Data Classification | Display Goal | Recommended Directive | Keyboard Type |
| :--- | :--- | :--- | :--- |
| **Standard text input** | Read/write | `{{ }}` interpolation | `type="text"` |
| **User description html**| Render bold notes | Safe sanitization helper| `type="textarea"` |
| **User password** | Hidden characters | Password toggle button| `type="password"` |
| **Verification pin** | Hidden digits | Password toggle | `type="password" inputmode="numeric"` |

---

## 15. Final Rule

All visual layouts must prohibit raw HTML rendering directives, escape user inputs before compiling payloads, hide password strings by default behind toggle controllers, and transmit API models via HTTPS.
