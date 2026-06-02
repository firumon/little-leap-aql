# 11_QUASAR_STYLING.md - Visual Styling & Theme Architecture

This document defines the guidelines for applying styling, color themes, spacing helpers, and typography configurations in the AQL application using Quasar's native CSS engine.

---

## 1. Purpose

The purpose of this guide is to eliminate ad-hoc inline styling, prevent Tailwind-style utility bloat, ensure visual uniformity between mobile and desktop portals, and define boundaries for custom global styles in `custom.scss`.

---

## 2. Core Philosophy

AQL styling is **Utility-Driven and Tokenized**. We avoid custom CSS selectors by default:
*   **Tokens over Colors:** Never use raw hex codes (e.g., `#ef4444`) inside templates or style sheets. Use Quasar semantic classes (e.g., `text-negative`, `bg-warning`) or reference SASS variables (`$primary`, `$grey-7`).
*   **Standardized Spacing Grid:** Grid spacing must use Quasar's standard margins and padding steps (`xs=4px`, `sm=8px`, `md=16px`, `lg=24px`, `xl=48px`). The default spacing block for card and page borders is `md` (`q-pa-md` / `q-ma-md`).
*   **No Scoped Bloat:** Styles must be globally maintainable. Any custom layout modification that has potential for reuse must reside in `src/css/custom.scss` as a global helper, keeping component files thin and clean.

---

## 3. Golden Rules

1.  **CSS Priority Chain:** 1. Native Quasar component attributes (`dense`, `flat`, `outlined`), 2. Quasar utility classes (`row`, `q-pa-md`, `text-h6`), 3. Reusable global classes (`custom.scss`), 4. Scoped CSS blocks (Last resort, 100% single-use only).
2.  **No Scoped CSS for Layouts:** Layout spacing, flex alignment, and positioning must be handled via utility classes (`flex-center`, `justify-between`, `items-start`). Never write custom media queries inside components.
3.  **Prohibit Plain HTML Formatting:** Never use plain text tags without class modifiers (e.g. raw `<h1>`). Format all typography via Quasar text classes (e.g. `<div class="text-h5">`).
4.  **Use Native Shadow Classes:** Elevation must be controlled using Quasar shadow classes (`shadow-1` to `shadow-24`). Custom CSS box-shadow declarations are forbidden.

---

## 4. CSS Styling Setup

### Standard Color Variable Registry (SCSS)
Variables mapped inside `src/css/quasar.variables.scss`:
```scss
$primary   : #1a56db; // Dark Blue
$secondary : #7c3aed; // Purple
$accent    : #0d9488; // Teal

$dark      : #1f2937; // Slate Dark

$positive  : #16a34a; // Green
$negative  : #dc2626; // Red
$info      : #2563eb; // Light Blue
$warning   : #ca8a04; // Amber
```

---

## 5. Best Practices

*   **Row & Column Sizing:** Always combine `row` with `col-` classes. If a component should span full width on mobile but partition on larger screens, apply multiple grid helpers:
    `<div class="col-12 col-sm-6 col-md-4">`
*   **Gutter Spacing:** Never use margins to separate child columns inside a row. Use Quasar's gutter utility class on the row:
    `<div class="row q-col-gutter-sm">`
*   **Typography Scale:** Use standard text helper sizes (`text-h6` for card headers, `text-subtitle2` for sub-labels, `text-body2` for descriptions, `text-caption` for secondary details).

---

## 6. Mobile First Rules

*   **Button Sizing:** Use the `dense` attribute on inputs and action buttons in mobile viewports to preserve vertical real estate.
*   **Tap Clearance:** Ensure elements styled with action clicks have dynamic spacing helpers to avoid overlapping tap regions (`q-my-sm`).

---

## 7. Common Patterns

### Responsive Typography Grid

```html
<!-- FRONTENT/src/components/Operations/OutletStatsCard.vue -->
<template>
  <q-card class="stats-card" flat bordered>
    <q-card-section class="q-pa-md bg-grey-1">
      <div class="row items-center justify-between">
        <!-- Responsive layout adjustments via flex utilities -->
        <div class="column">
          <span class="text-caption text-grey-7 uppercase text-weight-medium">
            Outstanding Balance
          </span>
          <span class="text-h5 text-primary text-weight-bold">
            {{ _C(balance, true) }}
          </span>
        </div>
        <q-icon name="trending_up" class="text-positive" size="2rem" />
      </div>
      
      <!-- Collapsible details block styled with utilities -->
      <div class="row q-mt-sm justify-between text-body2 text-grey-8">
        <span>Due Date:</span>
        <span class="text-weight-medium">12th June</span>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { useCurrency } from 'src/composables/useCurrency'

defineProps({
  balance: { type: Number, required: true }
})

const { _C } = useCurrency()
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlMetricCard`: Reusable layout component combining primary color cards, dynamic icon classes, and automated currency styling.
*   `AqlHeaderSection`: Simple header container wrapping a dynamic text label, action icons, and inline divider grids.

---

## 9. Accessibility Notes

*   Verify that any custom text coloring achieves a contrast ratio of at least 4.5:1 against the card background.
*   Avoid using background images with white text overlay unless a dark gradient mask (`bg-gradient`) is present.

---

## 10. Dark Mode Notes

*   Always use `text-grey-7` (for dark mode support) or `text-grey-6` rather than dark grey hexes like `#333` for captions.
*   Leverage `bg-dark` and `text-white` classes which resolve cleanly when `Dark` plugins apply style configurations.

---

## 11. Performance Notes

*   Avoid declaring massive nested class structures in `custom.scss` as it degrades CSS parser lookup efficiency. Keep rules shallow.
*   Do not combine static utility strings inside reactive class objects:
    *   *Correction:* `<div class="static-class" :class="reactiveClass">`

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Writing inline styles (e.g. `style="padding: 12px; margin-top: 5px;"`) directly inside tags.
    *   *Correction:* Replace with utility classes: `class="q-pa-md q-mt-xs"`.
*   **Anti-Pattern:** Declaring custom colors using inline HEX values or direct styles inside components.
    *   *Correction:* Bind to standard CSS variable themes (`text-primary`, `bg-grey-2`).

---

## 13. AI Agent Rules

1.  **Refuse Inline Styles:** If your code writes `style="..."` on any element, you must replace it with Quasar's utility class tokens.
2.  **Verify SASS variables:** Ensure all custom SCSS layouts in `custom.scss` refer strictly to Quasar color variables (e.g., `color: $primary`).

---

## 14. Decision Matrix

| Layout Constraint | Recommended Spacing Token | Recommended Grid Class | Typography Class |
| :--- | :--- | :--- | :--- |
| **Page Outer Border** | `q-pa-md` | `col-12` | `text-h5` (Title) |
| **Card Inner Section**| `q-pa-md` | `row justify-between` | `text-subtitle2` (Header) |
| **Inline List Items** | `q-py-sm q-px-md`| `row items-center` | `text-body2` (Details) |
| **Compact Field Grid**| `q-col-gutter-xs`| `col-6` | `text-caption` (Labels) |

---

## 15. Final Rule

All layouts must use Quasar utility classes for margins, paddings, flex alignments, and typography scales, with any custom SASS references defined globally in `custom.scss`.
