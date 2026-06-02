# 13_QUASAR_DARK_MODE.md - Dark Mode Integration

This document defines how to implement, configure, and maintain Dark Mode support using Quasar's Dark plugin and responsive CSS classes.

---

## 1. Purpose

The purpose of this guide is to ensure the user interface scales cleanly between standard and dark modes, ensuring readability, conserving battery power on mobile OLED displays, and enforcing standardized contrast ratios.

---

## 2. Core Philosophy

AQL Dark Mode relies on **CSS Token Autonomy**. We write components that adjust themes without manual Javascript watcher tracking:
*   **Built-in Component Inversion:** Standard Quasar elements (`QCard`, `QList`, `QDialog`) automatically invert background and text colors when Dark Mode is enabled. We must avoid placing rigid overrides (like `style="background: white;"`) that break this behavior.
*   **Semantic Color Shifting:** Always bind layout containers to semantic classes (`bg-surface`, `bg-grey-1`, `text-primary`) that have built-in dark configuration variations rather than absolute static color names (`bg-white`).

---

## 3. Golden Rules

1.  **Never Use Static Hex Backgrounds:** Absolute hex bindings (e.g. `#ffffff` or `#121212`) are banned. Spacing cards and background panels must use variable utility colors.
2.  **Rely on Component Dark Property:** When a parent layout does not propagate dark styles correctly, use the `:dark` attribute bound to the Quasar state: `class="q-card" :dark="$q.dark.isActive"`.
3.  **Prohibit High-Contrast Text Overrides:** Never force dark text colors (`text-black`, `text-grey-9`) on elements that wrap generic container panels.
4.  **Confirm Image & Media Opacities:** Images and visual banners must dim slightly in dark mode to prevent visual fatigue. Use `class="q-img" :class="{ 'dimmed': $q.dark.isActive }"`.

---

## 4. Dark Mode CSS & Plugin Setup

### Programmatic Dark Theme Toggle
```javascript
// Composition API Toggle Pattern
import { useQuasar } from 'quasar'

const $q = useQuasar()

// Toggle dark mode state
const toggleDarkMode = () => {
  $q.dark.toggle() // Changes true/false/auto
}
```

### System Variable Mappings (`src/css/quasar.variables.scss`)
```scss
// Custom dark theme token variables (applied via body.body--dark class)
body.body--dark {
  background: #121212;
  .bg-surface {
    background: #1e1e1e !important;
  }
  .border-grey-3 {
    border-color: #2d2d2d !important;
  }
}
```

---

## 5. Best Practices

*   **Semantic Border Classes:** Instead of using default borders, declare custom classes that inherit context: `border: 1px solid var(--border-color)`.
*   **Form Input Colors:** Ensure form controls (`QInput`, `QSelect`) preserve readable borders in dark layouts. Use the `outlined` style which natively adjusts edge colors.

---

## 6. Mobile First Rules

*   **OLED Spacing Comfort:** Utilize deep black tones (`#000000`) for root app page backgrounds and slate tones (`#1e1e1e`) for card lists to leverage OLED screen power-saving behaviors on mobile devices.
*   **High Contrast Action Buttons:** Verify that primary button text colors maintain clean, readable contrast limits on deep dark headers.

---

## 7. Common Patterns

### Responsive Theme-Adaptive Card

```html
<!-- FRONTENT/src/components/Operations/OutletThemeCard.vue -->
<template>
  <q-card
    class="theme-card q-mb-md"
    flat
    bordered
    :class="$q.dark.isActive ? 'bg-grey-9 text-white' : 'bg-white text-dark'"
  >
    <q-card-section class="q-pa-md">
      <div class="row justify-between items-center">
        <div>
          <span class="text-caption" :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-7'">
            Account Balance
          </span>
          <h6 class="text-h6 q-my-none text-weight-bold">
            {{ _C(balance, true) }}
          </h6>
        </div>
        <q-btn
          v-ripple
          round
          flat
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          @click="toggleTheme"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { useCurrency } from 'src/composables/useCurrency'

defineProps({
  balance: { type: Number, required: true }
})

const $q = useQuasar()
const { _C } = useCurrency()

const toggleTheme = () => {
  $q.dark.toggle()
}
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlThemeToggle`: Floating layout switch widget that swaps dark/light state overlays and saves user preferences to LocalStorage.
*   `AqlAdaptiveImage`: Custom image wrapper that applies CSS color filters dynamically depending on dark mode state.

---

## 9. Accessibility Notes

*   Verify all text elements satisfy WCAG AA contrast ratios (4.5:1 for standard text, 3:1 for large text) in dark configurations.
*   Keep focus borders visible for accessibility readers.

---

## 10. Dark Mode Notes

*   Do not combine intense neon highlights with dark backgrounds as they trigger screen smear on low-end mobile OLED viewports. Use muted accents.

---

## 11. Performance Notes

*   Avoid listening to dark mode transitions inside rapid animations as layout re-render passes can choke UI thread speeds.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Setting hardcoded light background colors on cards (`class="bg-white"`) without dynamic overrides.
    *   *Correction:* Replace with native classes or dynamic bindings (`class="bg-surface"`).
*   **Anti-Pattern:** Applying black inline font styles inside dark text wrappers.
    *   *Correction:* Rely on class properties (`text-primary`, `text-body2`).

---

## 13. AI Agent Rules

1.  **Audit Color Classes:** Reject any generated components that specify rigid light styling rules without verifying dark-state overrides.
2.  **Confirm Theme Plugins:** Use native `useQuasar().dark` utilities instead of writing custom document body CSS toggle scripts.

---

## 14. Decision Matrix

| Context Element | Layout Scope | Light Mode Class | Dark Mode Class |
| :--- | :--- | :--- | :--- |
| **App Root Background**| Base page view | `bg-grey-1` | `bg-dark` / `#121212` |
| **Card Container** | Detail card blocks | `bg-white` | `bg-grey-9` / `bg-surface` |
| **Form Inputs** | Outlined text areas| `text-dark` | `text-white` |
| **Helper Details** | Caption blocks | `text-grey-7` | `text-grey-4` |

---

## 15. Final Rule

All layouts must implement background variables that support native theme inversion, with any custom dark-mode specific adjustments driven via the Quasar `Dark` plugin.
