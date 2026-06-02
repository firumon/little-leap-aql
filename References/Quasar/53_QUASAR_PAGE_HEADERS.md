# 53_QUASAR_PAGE_HEADERS.md - Page Title Sections & Action Groups

This document defines how to implement and configure page header zones (the block below the main app toolbar) using Quasar CSS layout and typography utilities.

---

## 1. Purpose

The purpose of this guide is to ensure all module pages present a uniform title structure, align main page actions consistently, and apply comfortable touchscreen margins.

---

## 2. Core Philosophy

AQL page headers are **Information-Focused, Action-Light, and Compact**:
*   **Simple Hierarchy:** Page titles use standard text scale classes (`text-h5` on mobile, `text-h4` on desktop) to structure layout hierarchies cleanly.
*   **Action Groups:** Action buttons are grouped opposite page titles inside a responsive flex row, using spacing offsets (`q-mb-md`).
*   **Back Integration:** Detail pages must include a back icon button to return to index lists, decoupled from custom router paths.

---

## 3. Golden Rules

1.  **Strict Margin Spacing:** All page title header zones must specify a bottom margin token of `md` (`q-mb-md` / `q-pb-sm`).
2.  **No Absolute Title Widths:** Allow title strings to wrap or truncate dynamically using the `ellipsis` helper class.
3.  **Gate Header Actions:** Action buttons placed in page headers must bind to permission check parameters (`allowed()`).
4.  **Prohibit Nested Form Fields:** Never place input text fields directly inside page titles blocks without toggles.

---

## 4. Page Header Setup

```html
<!-- FRONTENT/src/components/Operations/OutletPageHeader.vue -->
<template>
  <div class="page-header-container row items-center justify-between no-wrap q-mb-md">
    <!-- Title block with optional back arrow -->
    <div class="row items-center no-wrap ellipsis">
      <q-btn
        v-if="hasBack"
        flat
        round
        dense
        icon="arrow_back"
        color="primary"
        class="q-mr-sm"
        aria-label="Back"
        @click="emit('back')"
      />
      <div class="column ellipsis">
        <h1 class="text-h5 text-weight-bold q-my-none ellipsis">{{ title }}</h1>
        <span v-if="subtitle" class="text-caption text-grey-7 ellipsis">
          {{ subtitle }}
        </span>
      </div>
    </div>

    <!-- Page action buttons group -->
    <div class="row items-center q-gutter-x-sm" v-if="allowed({ inventory: 'create' })">
      <q-btn
        v-ripple
        color="primary"
        :round="$q.screen.lt.sm"
        :icon="actionIcon"
        :label="$q.screen.gt.xs ? actionLabel : ''"
        @click="emit('action')"
      />
    </div>
  </div>
</template>

<script setup>
import { useResourceConfig } from 'src/composables/useResourceConfig'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  hasBack: { type: Boolean, default: false },
  actionLabel: { type: String, default: 'Create' },
  actionIcon: { type: String, default: 'add' }
})

const emit = defineEmits(['back', 'action'])
const { allowed } = useResourceConfig()
</script>
```

---

## 5. Best Practices

*   **Subtitle Helper Captions:** Include subtitle rows showing secondary details (e.g. record update dates or counts) to help users scan contexts quickly.
*   **Icon-Only Button Fallbacks:** On mobile viewports, title buttons must display as round icons, hiding text strings to avoid wrapping details.

---

## 6. Mobile First Rules

*   **Compress Padding:** On screen widths under `sm`, reduce header padding to `q-pa-xs` to preserve main scrolling layout space.
*   **Touch Action Buffers:** Keep buttons separated using standard gutters (`q-gutter-x-sm`) to avoid accidental taps.

---

## 7. Common Patterns

### Sticky Sub-Header Action Pattern

For search pages, place search inputs in a sticky layout bar directly below the page header:

```html
<!-- FRONTENT/src/components/Operations/OutletSearchHeader.vue -->
<template>
  <div class="column q-mb-md">
    <!-- Title segment -->
    <div class="row justify-between items-center q-mb-sm">
      <h1 class="text-h5 text-weight-bold q-my-none">Inventory Catalog</h1>
      <q-btn flat round icon="filter_list" @click="emit('filter')" />
    </div>
    
    <!-- Search block -->
    <q-input
      v-model="searchQuery"
      outlined
      dense
      clearable
      placeholder="Search items..."
      @update:model-value="onSearch"
    >
      <template v-slot:prepend>
        <q-icon name="search" />
      </template>
    </q-input>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const searchQuery = ref('')
const emit = defineEmits(['search', 'filter'])

const onSearch = (val) => {
  emit('search', val)
}
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlPageHeader`: Standard layout container wrapping page titles, back buttons, and dynamic action controls.

---

## 9. Accessibility Notes

*   Verify page headers utilize semantic H1 tags so screen readers understand page structures.
*   Keep arrow buttons tabbable.

---

## 10. Dark Mode Notes

*   Verify subtitle captions use text variable classes (`text-grey-7`) to maintain dark readability contrast scores.

---

## 11. Performance Notes

*   Do not trigger heavy resource reload queries inside header updates loops.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Putting multiple wide text buttons in mobile headers, squeezing the title off the screen.
    *   *Correction:* Collapse text buttons into round icon buttons on mobile screens.
*   **Anti-Pattern:** Declaring custom padding styling overrides on page title wrappers.
    *   *Correction:* Rely on Quasar margin tokens (`q-mb-md`).

---

## 13. AI Agent Rules

1.  **Validate Sizing Rules:** Ensure all header buttons implement responsive sizing (e.g. icon-only on mobile).
2.  **Confirm H1 Semantics:** Verify page headers wrap the main title inside an `h1` element.

---

## 14. Decision Matrix

| Page Context | Title scale | Action Style | Padding Margin |
| :--- | :--- | :--- | :--- |
| **Main Catalog Page** | `text-h5` | Add Item (Round Icon) | `q-mb-md` margin |
| **Record details Page**| `text-subtitle1` | Back Arrow + Edit Icon | `q-mb-sm` margin |
| **Admin Setup Panel** | `text-h4` (Desktop) | Save Details (Text button)| `q-mb-lg` margin |

---

## 15. Final Rule

All page titles must map semantic text hierarchies, stack page controls opposite header text using flex layouts, apply responsive spacing helpers, and include back routing controls on detail views.
