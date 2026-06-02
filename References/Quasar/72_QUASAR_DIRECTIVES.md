# 72_QUASAR_DIRECTIVES.md - Touch Gestures & Tactile Ripples

This document defines how to implement and configure touch interactions and click feedback triggers using Quasar's directive systems (`v-ripple`, `v-close-popup`, `v-touch-swipe`, `v-touch-pan`, `v-touch-hold`).

---

## 1. Purpose

The purpose of this guide is to ensure all click actions provide tactile response on mobile displays, handle gesture swipe shortcuts, and detail dismiss keys.

---

## 2. Core Philosophy

AQL touch elements are **Responsive, Feedback-Instant, and Gesture-Rich**:
*   **Immediate Feedback:** Taps on mobile screens require immediate visual response. We enforce `v-ripple` on all clickable components to eliminate double-tap mistakes.
*   **Swipe-to-Trigger Shortcuts:** High-density mobile lists use touch swipe actions (e.g. swiping left to delete, right to edit) to simplify operations.
*   **Instant Dismissals:** Close dialogs, bottom sheets, or menus instantly by mapping click controls directly to popup closure hooks (`v-close-popup`).

---

## 3. Golden Rules

1.  **Strict Ripple Enforcements:** Every clickable button, list item, card row, or toggle grid must declare the `v-ripple` directive.
2.  **Use Close-Popup on Dismiss Buttons:** Any close button or list menu option inside overlays must define the `v-close-popup` tag.
3.  **Prohibit Raw Touch Event Watchers:** Do not write custom `touchstart` or `touchend` event handlers in component scripts. Use Quasar's touch directives instead.
4.  **Confirm Distinct Gestures Mapping:** Do not combine horizontal swipe controls (`v-touch-swipe.horizontal`) with vertical panning gestures on the same layout page.

---

## 4. QDirectives Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Operations/OutletGestureControls.vue -->
<template>
  <div class="column q-gutter-y-md">
    <!-- Click button using ripple and close popup directive -->
    <q-card flat bordered class="q-pa-md">
      <div class="row justify-between items-center">
        <span class="text-subtitle2 text-weight-bold">Settings Actions</span>
        <q-btn
          v-close-popup
          v-ripple
          color="grey-7"
          flat
          round
          dense
          icon="close"
          aria-label="Close settings"
        />
      </div>
    </q-card>

    <!-- Visual Swipe Card Segment -->
    <q-card
      v-touch-swipe.horizontal="onSwipeItem"
      class="q-pa-md bg-blue-1 text-blue-9"
      flat
      bordered
    >
      <div class="text-body2 text-weight-bold">Horizontal Swipe Target</div>
      <div class="text-caption">Swipe left/right to trigger dynamic alerts.</div>
    </q-card>

    <!-- Long Press Hold Action target -->
    <q-card
      v-touch-hold:600="onLongPress"
      class="q-pa-md bg-orange-1 text-orange-9"
      flat
      bordered
    >
      <div class="text-body2 text-weight-bold">Long Press Hold Target</div>
      <div class="text-caption">Hold touch for 600ms to open details.</div>
    </q-card>
  </div>
</template>

<script setup>
import { Notify } from 'quasar'

const emit = defineEmits(['delete-item', 'open-details'])

const onSwipeItem = ({ direction }) => {
  Notify.create({
    message: `Swiped direction: ${direction}`,
    color: 'primary',
    timeout: 1500
  })
}

const onLongPress = () => {
  Notify.create({
    message: 'Long press action triggered',
    color: 'warning',
    timeout: 1500
  })
  emit('open-details')
}
</script>
```

---

## 5. Best Practices

*   **Specify Swipe Directions:** Declare swipe directions explicitly to prevent layout scrolling interference: `v-touch-swipe.horizontal`.
*   **Hold Timers tuning:** When using `v-touch-hold`, set duration parameters to `600ms` (`v-touch-hold:600`) to differentiate hold gestures from normal tap interactions.

---

## 6. Mobile First Rules

*   **Responsive Ripple Overrides:** Ensure ripple effects match parent color variables to keep contrast levels readable.
*   **Prevent Scroll Interferences:** Panning gestures (`v-touch-pan`) must block default page scrolls only on the active element.

---

## 7. Common Patterns

### Drawer Touch Pan Drawer Trigger Pattern

Create simple custom touch drawer toggles using touch panning details:

```html
<!-- FRONTENT/src/components/Navigation/OutletPanDrawer.vue -->
<template>
  <div
    v-touch-pan.horizontal.prevent.mouse="onPan"
    class="drawer-pan-area bg-grey-2"
    style="width: 20px; height: 100vh; position: absolute; left: 0; z-index: 10;"
  >
    <!-- Hidden sensor zone that detects swipes and pans to toggle menu -->
  </div>
</template>

<script setup>
const emit = defineEmits(['open-drawer'])

const onPan = ({ direction, distance }) => {
  // Check if pan gesture is moving right
  if (direction === 'right' && distance.x > 30) {
    emit('open-drawer')
  }
}
</script>
```

---

## 8. Reusable Component Suggestions

*   Verify all modal panels align close buttons to standard close-popup triggers.

---

## 9. Accessibility Notes

*   Verify touch hold shortcuts also support standard click triggers so screen readers can trigger actions.

---

## 10. Dark Mode Notes

*   Verify ripple colors adjust contrast dynamically.

---

## 11. Performance Notes

*   **Limit Heavy Logic inside Pan Loops:** Panning fires continuous updates. Avoid executing database queries or UI redraw loops inside active pan callbacks.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Using raw `window.addEventListener('touchstart')` inside layout blocks, which causes memory leaks when components unmount.
    *   *Correction:* Use Quasar directives (`v-touch-swipe`).
*   **Anti-Pattern:** Omitting `v-close-popup` on dismiss buttons inside custom dialog templates, forcing manual logic scripts.
    *   *Correction:* Declare `v-close-popup` directly on the button.

---

## 13. AI Agent Rules

1.  **Validate Ripples:** Ensure all button templates declare `v-ripple`.
2.  **Confirm Close Directives:** Confirm all dialog layouts use `v-close-popup` on close controls.

---

## 14. Decision Matrix

| Touch Goal | Required Action | Target Directive | Layout Configuration |
| :--- | :--- | :--- | :--- |
| **Instant button click**| Tactile Feedback | `v-ripple` | Default on button tag |
| **Dismiss overlay popup**| Close container | `v-close-popup` | Default on close buttons |
| **Swipe row item** | Edit/Delete shortcut | `v-touch-swipe.horizontal` | Set key direction constraints |
| **Long press element** | Show details menu | `v-touch-hold:600` | Declare hold duration threshold |

---

## 15. Final Rule

All visual layouts must implement ripple feedback triggers on click targets, bind close actions directly using the close popup directive, and utilize native touch swipe modifiers for screen gesture shortcuts.
