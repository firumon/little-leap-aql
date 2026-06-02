# 41_QUASAR_MENUS.md - Dropdown Menus & Context Options

This document defines how to implement and configure contextual popover menus using Quasar's menu component (`QMenu`) while maintaining layout compatibility.

---

## 1. Purpose

The purpose of this guide is to outline dropdown selection overlays, explain vertical positioning alignments, detail offset calculations, and establish when to swap menus for mobile bottom sheets.

---

## 2. Core Philosophy

AQL menus are **Compact, Contextual, and Auto-Closing**:
*   **Contextual Limits:** Floating popup menus are reserved for compact, low-density desktop portal layouts or quick navigation bar shortcuts.
*   **Auto-Close Behavior:** Option lists inside dropdown selectors must dismiss themselves immediately upon selecting an option to prevent overlays from lingering.
*   **Anchor Offsets:** Menus must define clear offsets relative to parent nodes to prevent visual overlaps or screen edge cutoffs.

---

## 3. Golden Rules

1.  **Mobile Dropdown Exclusion:** Contextual actions containing more than 3 selection buttons on screens under `sm` must swap from floating `QMenu` components to `QBottomSheet` layers.
2.  **Ensure Auto-Close:** Every `<q-menu>` element must declare the `auto-close` attribute to dismiss the popover once an item is tapped.
3.  **Declare Clean Anchors:** Position menus explicitly using standard anchor and self-positioning coordinates (e.g. `anchor="bottom end" self="top end"`).
4.  **No Nested Scroll Regions:** Menus must not wrap scrollable input elements. If complex settings are needed, render a dialog or navigation page.

---

## 4. QMenu Configuration & Positioning Layout

```html
<!-- FRONTENT/src/components/Navigation/OutletActionMenu.vue -->
<template>
  <div class="inline-menu-trigger">
    <!-- Trigger Button -->
    <q-btn flat round dense icon="more_vert" color="grey-7">
      <!-- Embedded contextual dropdown menu -->
      <q-menu
        auto-close
        transition-show="jump-down"
        transition-hide="jump-up"
        anchor="bottom right"
        self="top right"
        :offset="[0, 8]"
      >
        <q-list style="min-width: 150px;" class="q-py-xs">
          <q-item clickable v-ripple @click="emit('action', 'edit')">
            <q-item-section avatar class="q-pe-none">
              <q-icon name="edit" size="xs" />
            </q-item-section>
            <q-item-section>Edit Details</q-item-section>
          </q-item>

          <q-item clickable v-ripple @click="emit('action', 'duplicate')">
            <q-item-section avatar class="q-pe-none">
              <q-icon name="file_copy" size="xs" />
            </q-item-section>
            <q-item-section>Duplicate</q-item-section>
          </q-item>

          <q-separator class="q-my-xs" />

          <q-item clickable v-ripple class="text-negative" @click="emit('action', 'delete')">
            <q-item-section avatar class="q-pe-none">
              <q-icon name="delete" size="xs" color="negative" />
            </q-item-section>
            <q-item-section>Delete Record</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
  </div>
</template>

<script setup>
const emit = defineEmits(['action'])
</script>
```

---

## 5. Best Practices

*   **Explicit Menu Widths:** Specify min-widths on menu lists (e.g., `style="min-width: 150px"`) to prevent text wrapping on long label entries.
*   **AQL Permission Checks:** Gate individual list items inside the menu using permission rules.

---

## 6. Mobile First Rules

*   **Avoid Menu Overflows:** Standard menus on small viewports can clip off-screen. Ensure all menus are configured with appropriate offsets.
*   **Visual Padding comfort:** Target list items inside menus must maintain padding heights matching touch clearances (`q-py-sm`).

---

## 7. Common Patterns

### Contextual Option Action Switch Pattern

Toggle between desktop menu list overlays and mobile bottom sheet panels using responsive composables:

```javascript
// FRONTENT/src/composables/useResponsiveMenu.js
import { useQuasar, BottomSheet } from 'quasar'

export function useResponsiveMenu() {
  const $q = useQuasar()

  const openActionsMenu = (options, onSelected) => {
    if ($q.screen.lt.sm) {
      // Mobile: Open a comfortable bottom sheet picker
      $q.bottomSheet({
        title: 'Actions',
        actions: options
      }).onOk((action) => {
        onSelected(action.value)
      })
    }
  }

  return { openActionsMenu }
}
```

---

## 8. Reusable Component Suggestions

*   `AqlContextMenu`: Standard custom component wrapping trigger icons, rendering responsive dropdown layouts dynamically.

---

## 9. Accessibility Notes

*   Verify popup menu anchors declare structural links. Keyboard users must be able to focus and tab through options.

---

## 10. Dark Mode Notes

*   Keep menu shadows clean. In dark mode, rely on standard slate styling (`bg-grey-9` or `bg-surface`) to separate popups from the background.

---

## 11. Performance Notes

*   **Limit Menu Spawns:** Avoid instantiating custom menus inside every row of a high-volume list. Keep triggers generic or dynamically mount them.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Putting heavy text inputs inside a dropdown list menu, trapping keyboard focuses.
    *   *Correction:* Replace with dedicated Dialog cards.
*   **Anti-Pattern:** Leaving menus open after selecting options because the `auto-close` key was omitted.
    *   *Correction:* Apply the `auto-close` tag.

---

## 13. AI Agent Rules

1.  **Verify Auto-Close Configuration:** Reject any menu wrapper code that fails to declare the `auto-close` attribute.
2.  **Confirm Touch Boundaries:** Confirm that action lists inside menus have layout sizes suited for mobile.

---

## 14. Decision Matrix

| Option Selection count | Interaction Area | Recommended Container | Anchor & Self configs |
| :--- | :--- | :--- | :--- |
| **< 3 options** | Navbar header | Floating Menu (`QMenu`) | `bottom right` / `top right` |
| **3 to 8 options** | Card item row | Bottom Sheet | Dynamic panel slide |
| **> 8 options** | List settings | Dynamic Dialog sheet | Full screen maximization |

---

## 15. Final Rule

All dropdown menus must declare the auto-close property, define explicit offset anchor variables, limit item sizes on touch interfaces, and fallback to bottom sheets on mobile devices.
