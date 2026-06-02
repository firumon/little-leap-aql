# 81_QUASAR_ACCESSIBILITY.md - Accessibility (a11y) Compliance

This document defines how to implement, configure, and maintain accessibility (a11y) standards inside the AQL application using Quasar's native semantic parameters and ARIA utilities.

---

## 1. Purpose

The purpose of this guide is to ensure all pages comply with WCAG 2.1 AA requirements, support screen readers, maintain clear keyboard focus navigation routes, and standardize tap targets.

---

## 2. Core Philosophy

AQL accessibility is **Semantic, Keyboard-Navigable, and Contrast-Compliant**:
*   **Semantic Landmarks:** Avoid using generic `div` elements for primary layout boundaries. Use HTML5 structural tags (`header`, `main`, `footer`, `nav`, `section`).
*   **Keyboard Focus Focus Loop:** Users must be able to complete tasks (such as filling forms or approving orders) using keyboard tab paths. Focus markers must stay visible.
*   **Explicit Action Labels:** Buttons displaying only icons must declare explicit string descriptors (`aria-label`) for screen readers.

---

## 3. Golden Rules

1.  **Label All Icon Buttons:** Every button lacking explicit text labels must define a clear descriptive label: `<q-btn icon="edit" aria-label="Edit Supplier record" />`.
2.  **Ensure Semantic Document Hierarchy:** Layout headers, page contents, and footers must wrap in semantic tags: `<q-header role="banner">`.
3.  **Contrast AA Compliance:** Text and action colors must satisfy WCAG AA contrast ratios (4.5:1 for standard body text, 3:1 for large text headings).
4.  **No Focus Trap Bypasses:** Popups and dialogs must contain focus loop systems that automatically route focus back to trigger buttons when dismissed.

---

## 4. Accessibility Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Operations/OutletA11yForm.vue -->
<template>
  <!-- Main structural element wrapper with semantic landmark -->
  <main class="q-pa-md" role="main">
    <q-form @submit.prevent="onFormSubmit" aria-labelledby="form-title">
      <q-card flat bordered class="q-pa-md">
        <!-- Heading with unique label ID linked to form -->
        <q-card-section class="q-pa-none q-mb-md">
          <h1 id="form-title" class="text-h5 text-weight-bold q-my-none">
            Supplier Details Form
          </h1>
        </q-card-section>

        <q-card-section class="column q-gutter-y-sm">
          <!-- Text Input with explicit label binding -->
          <q-input
            v-model="supplierName"
            outlined
            dense
            label="Supplier Company Name"
            aria-required="true"
            :rules="[ val => !!val || 'Company name is required' ]"
          />

          <!-- Icon button with explicit ARIA label configuration -->
          <div class="row items-center justify-between">
            <span class="text-body2 text-grey-8">Verify Registration Status</span>
            <q-btn
              v-ripple
              flat
              round
              color="primary"
              icon="verified"
              aria-label="Verify registration parameters online"
              @click="verifySupplier"
            />
          </div>
        </q-card-section>

        <!-- Actions block -->
        <q-card-actions align="right" class="q-mt-md">
          <q-btn label="Cancel" flat color="grey" v-close-popup />
          <q-btn label="Save Supplier" type="submit" color="primary" />
        </q-card-actions>
      </q-card>
    </q-form>
  </main>
</template>

<script setup>
import { ref } from 'vue'

const supplierName = ref('')
const emit = defineEmits(['save'])

const verifySupplier = () => {
  // Verification logic
}

const onFormSubmit = () => {
  emit('save', supplierName.value)
}
</script>
```

---

## 5. Best Practices

*   **Keyboard Shortcuts:** Allow keyboard shortcuts (such as Esc key dismissals on popups) to align with standard web paradigms.
*   **Explicit Text Focus Borders:** Do not suppress default CSS outline selectors on keyboard focuses unless custom high-contrast focus rings are defined.

---

## 6. Mobile First Rules

*   **Standard Tap Size Clearances:** Keep all interactive options buttons separated using minimum tap sizes limits (`44px` heights).
*   **Virtual Screen Reader Announcements:** Use toast notifications mapping `role="status"` properties to announce transactions completions dynamically on mobile devices.

---

## 7. Common Patterns

### Screen Reader Live Alerts Pattern

Broadcast alerts programmatically to assistive screens using inline live announcers:

```html
<!-- FRONTENT/src/components/Navigation/OutletLiveAnnouncer.vue -->
<template>
  <!-- Hidden announcer block that captures dynamic system alerts -->
  <div
    class="sr-only"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {{ announcementText }}
  </div>
</template>

<script setup>
defineProps({
  announcementText: { type: String, default: '' }
})
</script>

<style scoped>
/* Keep selector invisible on screen but readable by accessibility tags */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
```

---

## 8. Reusable Component Suggestions

*   Verify all form controls utilize AqlValidatedInput to coordinate ARIA tags.

---

## 9. Accessibility Notes

*   Verify that nested tables define table headers mappings.

---

## 10. Dark Mode Notes

*   Ensure color tokens pass standard contrast formulas in dark mode.

---

## 11. Performance Notes

*   Avoid executing continuous DOM updates inside screen announcer elements.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Using standard HTML `div` blocks with click handlers as buttons without keyboard focus indicators.
    *   *Correction:* Always use `<q-btn>` or assign `tabindex="0"` and `role="button"`.
*   **Anti-Pattern:** Hiding critical visual text inside hover-only tooltips.
    *   *Correction:* Render information text inline.

---

## 13. AI Agent Rules

1.  **Reject Bare Icons:** Reject button layouts lacking explicit `aria-label` settings.
2.  **Confirm Landmark Tags:** Check that page containers implement semantic HTML tags.

---

## 14. Decision Matrix

| User Interaction Need | Primary Device | Recommended Component | Target Accessibility Attributes |
| :--- | :--- | :--- | :--- |
| **Verify input detail** | Screen Reader | `QInput` with rules | `aria-required="true"`, error label link |
| **Close layout dialog** | Touch / Keyboard | `QBtn` (icon-only) | `aria-label="Close dialog"`, close-popup |
| **Read transaction grid**| Keyboard / Reader | `QTable` semantic | `thead`, `tbody`, row scoped headers |
| **Sync completion toast**| Touch / Reader | Dynamic toast alert | `role="status"`, `aria-live="polite"` |

---

## 15. Final Rule

All visual components and routing pages must implement semantic HTML layout tags, declare explicit label descriptors on all icon-only buttons, pass WCAG AA contrast rules, and support keyboard navigation loops.
