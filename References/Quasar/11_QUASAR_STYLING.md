# Quasar Styling & Theme Reference

This document describes the paradigms and utilities available for applying styles, colors, spacing, and typography within Quasar applications.

## 1. Styling Architecture & Priority

Quasar styling typically follows a priority chain to maintain codebase consistency:
1.  **Component Attributes:** Props built directly into Quasar components (e.g., `dense`, `flat`, `outlined`, `rounded`).
2.  **Utility CSS Classes:** Built-in classes for margins, padding, layout flex, alignment, and text (e.g., `row`, `q-pa-md`, `text-subtitle2`).
3.  **Global Styles:** Shared variables and custom CSS classes defined globally (e.g., in `src/css/custom.scss` or `quasar.variables.scss`).
4.  **Component-Specific Styles:** Local CSS or SCSS styling blocks within a Vue single file component.

---

## 2. Quasar Color Tokens and Theme System

Quasar utilizes a standardized color palette defined by theme variables in `src/css/quasar.variables.scss`. These variables are exposed both as SCSS variables and as CSS classes.

### Theme Variables Mappings
```scss
$primary   : #1a56db; // Primary Branding (e.g. Dark Blue)
$secondary : #7c3aed; // Secondary color (e.g. Purple)
$accent    : #0d9488; // Accent details (e.g. Teal)

$dark      : #1f2937; // Dark Mode Background Slate

$positive  : #16a34a; // Semantic Success (Green)
$negative  : #dc2626; // Semantic Danger/Error (Red)
$info      : #2563eb; // Semantic Information (Blue)
$warning   : #ca8a04; // Semantic Warning (Amber)
```

### CSS Usage Examples
*   **Text Colors:** `text-primary`, `text-secondary`, `text-negative`, `text-grey-7`.
*   **Background Colors:** `bg-primary`, `bg-grey-1`, `bg-surface`.

---

## 3. Spacing Grid & Layout Utilities

Quasar's spacing system maps padding (`q-p*`) and margin (`q-m*`) classes across five standard steps:
*   **xs** (extra small): `4px` (e.g., `q-pa-xs`)
*   **sm** (small): `8px` (e.g., `q-pa-sm`)
*   **md** (medium): `16px` (e.g., `q-pa-md`)
*   **lg** (large): `24px` (e.g., `q-pa-lg`)
*   **xl** (extra large): `48px` (e.g., `q-pa-xl`)

### Layout Grid Classes
*   **Rows and Columns:** A layout row is initiated with the `row` class, and child elements specify widths using column classes (e.g., `col-12` on mobile, scaling up to `col-sm-6 col-md-4` on wider screens).
*   **Gutter Spacing:** Gutter classes like `q-col-gutter-sm` or `q-gutter-y-md` can be applied to rows to distribute spacing evenly between columns without breaking grid alignments.
*   **Flex Alignment:** Alignment classes include `items-center`, `justify-between`, `flex-center`, and `no-wrap`.

---

## 4. Typography Scale Reference

Typography is styled using standard utility classes:
*   `text-h5` / `text-h6`: Title and card headers.
*   `text-subtitle1` / `text-subtitle2`: Major labels, sub-headers, or values.
*   `text-body1` / `text-body2`: Standard content text and paragraph styling.
*   `text-caption`: Secondary details, timestamps, or captions.
*   `text-weight-bold` / `text-weight-medium`: Font weight modifications.

---

## 5. Code Example: Responsive Stats Card Styling

The following component demonstrates spacing, color variables, flex alignment, and typography tokens:

```html
<template>
  <q-card class="stats-card" flat bordered>
    <q-card-section class="q-pa-md bg-grey-1">
      <div class="row items-center justify-between">
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

## 6. Spacing and Styling Matrix

| Context | Spacing Selection | Grid Layout | Typography Class |
| :--- | :--- | :--- | :--- |
| **Page Wrapper** | `q-pa-md` | `col-12` | `text-h5` (Title) |
| **Card Section** | `q-pa-md` | `row justify-between` | `text-subtitle2` (Header) |
| **List Row** | `q-py-sm q-px-md` | `row items-center` | `text-body2` (Record detail) |
| **Gutter/Grid Field** | `q-col-gutter-xs` | `col-6` | `text-caption` (Helper label) |
