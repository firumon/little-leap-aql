# Quasar Accessibility (a11y) Reference Guide

This reference guide describes the implementation and maintenance of accessibility (a11y) standards in Quasar applications, focusing on WCAG 2.1 AA compliance, screen readers, keyboard navigation, and touch bounds.

---

## 1. Core Principles

Designing accessible web interfaces involves ensuring that all users can perceive, operate, and understand the application:

*   **Semantic Structures**: Using HTML5 landmark elements (such as `header`, `main`, `footer`, `nav`, `section`) rather than generic `div` containers helps assistive technologies (like screen readers) parse the structure of the document.
*   **Keyboard Navigation**: Interactive components (including inputs, tabs, and buttons) should support tab-focus paths, arrow-key navigation, and standard keyboard triggers (such as `Enter` and `Space`).
*   **Visual Contrast**: Text elements and controls should meet WCAG AA contrast ratio guidelines (e.g., at least 4.5:1 for standard body text, and 3:1 for large headings) against their background surfaces.
*   **Clear Labeling**: Components lacking visual text labels (like icon-only buttons) require textual descriptions via ARIA attributes so that screen readers can convey their purpose.

---

## 2. Key Quasar a11y Features

Quasar components have built-in accessibility supports that developers can configure:

*   **`aria-label` / `aria-labelledby`**: Provides textual descriptions for visual components.
*   **`tabindex`**: Manages the keyboard focus order of custom HTML components.
*   **Built-in Dialog Focus Trap**: Quasar's `QDialog` automatically captures focus when opened, preventing users from tabbing to behind-the-scenes content, and restores focus to the triggering element upon closure.
*   **Visual Focus Outline**: Dynamic focus ring classes highlight active elements when tabbed using a keyboard.

---

## 3. Code Examples

### Accessible Form Component

The following example shows an input form that utilizes landmark wrapping, explicit label associations, aria requirements, and descriptive labels on icon-only buttons:

```html
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

### Screen Reader Live Announcements

To announce system updates or alerts (such as a successful operation) to screen readers dynamically:

```html
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
/* Hidden visually, but read by assistive technologies */
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

## 4. Technical Considerations

*   **Keyboard Focus Indicator**: Suppressing the browser's default focus outline without providing a high-contrast alternative prevents keyboard-only users from identifying their location on the screen.
*   **Interactive Target Sizing**: On mobile screens, keeping interactive targets at a minimum height and width of `48px` (or utilizing Quasar's default element sizing and padding spacing controls) reduces accidental triggers and supports touch accessibility.
*   **Dynamic Visual Tools**: Placing critical information solely in hover-only tooltips makes it inaccessible to touch screen devices and keyboard-only navigators. Text can instead be rendered inline or inside toggled popups.
*   **Dynamic Announcements**: When updating content dynamically via inline live announcers (`aria-live`), restrict modifications to concise, state-based feedback string updates.
*   **Contrast Ratios under Themes**: Verifying that color combinations meet WCAG criteria in both light and dark mode configurations ensures visibility across different themes.
