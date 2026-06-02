# 42_QUASAR_POPOVER.md - Lightweight Popover Panels

This document defines how to implement lightweight popover containers using Quasar's positioning layers to present interactive highlights and options.

---

## 1. Purpose

The purpose of this guide is to explain popover placement configurations, ensure interactive actions dismiss cleanly on tap-outs, and define boundary layouts.

---

## 2. Core Philosophy

AQL popovers are **Lightweight, Non-Intrusive, and Instant**:
*   **Actionable Highlights:** Popovers display quick contextual highlights (like currency conversion details or short SKU descriptions) right next to the trigger element.
*   **Instant Dismissal:** Any click/tap outside the popover region must instantly close the panel, avoiding sticky screen overlays.
*   **Minimal DOM Footprint:** We keep interactive elements inside popovers to a minimum. Avoid placing complex inputs or heavy image layouts inside popovers.

---

## 3. Golden Rules

1.  **Strict Size Boundaries:** Popover panels must not exceed `280px` in width on mobile screens to prevent layout clipping.
2.  **No Text-Select Traps:** Popover triggers must respond to a click or tap gesture, never mouse hovers or text selection highlights.
3.  **Position with Context Offset:** Ensure all popovers define explicit target anchors (e.g. `anchor="center right" self="center left"`).
4.  **Incorporate Close Keys:** When popovers present multiple links or buttons, include a tiny close icon for quick touch dismissal.

---

## 4. QMenu Popover Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Operations/OutletInfoPopover.vue -->
<template>
  <div class="inline-popover-trigger">
    <!-- Question icon trigger -->
    <q-icon name="help_outline" class="cursor-pointer text-grey-7" size="18px">
      <!-- Lightweight interactive popover panel -->
      <q-menu
        anchor="top middle"
        self="bottom middle"
        :offset="[0, 8]"
        class="bg-grey-9 text-white q-pa-sm"
        style="max-width: 250px;"
      >
        <div class="column q-gutter-y-xs">
          <div class="text-caption text-weight-bold text-primary-light">
            Dynamic Factor Details
          </div>
          <div class="text-caption">
            Exchange factor matches current PO currency rules config.
          </div>
          <q-separator dark class="q-my-xs" />
          <q-btn
            v-ripple
            size="xs"
            color="white"
            flat
            label="Learn More"
            class="self-end"
            @click="emit('learn-more')"
          />
        </div>
      </q-menu>
    </q-icon>
  </div>
</template>

<script setup>
const emit = defineEmits(['learn-more'])
</script>
```

---

## 5. Best Practices

*   **Dark Popover Styling:** Use dark background themes (`class="bg-grey-9 text-white"`) for information popovers. This distinguishes popovers from the primary card surfaces.
*   **Simple Action Triggers:** Keep clickable elements inside the popover limited to secondary utility transitions.

---

## 6. Mobile First Rules

*   **Avoid Keyboard Trapping:** Never mount text inputs inside lightweight popovers. Virtual keyboards force the entire popover position off-screen.
*   **Wide Tap Clearances:** Triggers must have surrounding margins to prevent overlapping adjacent buttons on mobile screens.

---

## 7. Common Patterns

### Contextual Help Popover Pattern

```html
<!-- FRONTENT/src/components/Operations/OutletHelpTrigger.vue -->
<template>
  <span class="row items-center cursor-pointer text-primary">
    {{ label }}
    <q-icon name="info" size="xs" class="q-ml-xs" />
    <q-menu anchor="bottom middle" self="top middle" :offset="[0, 4]" class="bg-dark text-white q-pa-sm">
      <div class="text-caption">{{ helpText }}</div>
    </q-menu>
  </span>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  helpText: { type: String, required: true }
})
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlPopover`: Simple custom icon wrapper displaying dark popover details, matching help descriptions.

---

## 9. Accessibility Notes

*   Verify popup containers announce details using screen reader tags.
*   Keep triggers keyboard tabbable.

---

## 10. Dark Mode Notes

*   Dark popovers (`bg-grey-9`) look clean in both light and dark themes. Ensure that text remains high contrast.

---

## 11. Performance Notes

*   Ensure popovers do not run complex watchers or listeners while closed.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Using tooltips (`QTooltip`) for complex interactive options lists that require tapping links.
    *   *Correction:* Replace with click-triggered `QMenu` popovers.
*   **Anti-Pattern:** Putting heavy text layouts inside popovers, causing horizontal clipping.
    *   *Correction:* Keep popover text under three lines.

---

## 13. AI Agent Rules

1.  **Reject Hover Triggers:** Ensure all interactive informational popovers utilize click/tap triggers.
2.  **Verify Sizing Widths:** Confirm that popover custom widths remain under `280px`.

---

## 14. Decision Matrix

| Information Goal | Context Interaction | Output Selection | Placement Configuration |
| :--- | :--- | :--- | :--- |
| **Simple text hint** | Info detail | `QTooltip` (desktop only)| `top middle` / `bottom middle` |
| **Explanation with link**| Click info icon | `QMenu` popover | `top middle` / `bottom middle` |
| **Interactive options**| Click edit btn | Context Menu | `bottom right` / `top right` |
| **ERP Configuration** | Click settings | Dynamic Dialog sheet | Maximized card |

---

## 15. Final Rule

All popovers must utilize lightweight click-triggered panel containers, fit within a width limit of 280px, lock offsets, and close immediately upon tapping outside.
