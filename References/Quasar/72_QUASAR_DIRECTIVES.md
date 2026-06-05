# Quasar Directives Reference Guide

This reference guide describes the configuration and usage of Quasar's native directives (such as `v-ripple`, `v-close-popup`, `v-touch-swipe`, `v-touch-pan`, and `v-touch-hold`) to manage touch gestures, click feedback, and popup overlays.

---

## 1. Overview of Quasar Directives

Quasar directives are reusable utility hooks applied directly to HTML elements or Vue components to attach specialized behaviors and event listeners:

*   **`v-ripple`**: Appends an animated material design ripple effect to an element upon user contact, providing visual confirmation of interaction.
*   **`v-close-popup`**: Closes the closest parent popup overlay (such as a `QDialog`, `QMenu`, or `QPopupProxy`) when the host element is clicked.
*   **`v-touch-swipe`**: Detects swiping gestures in horizontal or vertical directions.
*   **`v-touch-pan`**: Tracks dragging/panning gestures, sending continuous coordinates during the interaction.
*   **`v-touch-hold`**: Triggers a callback when an element is pressed and held for a specified duration.

---

## 2. Code Examples

### Standard Tap, Hold, and Swipe Interaction

The following component shows how to bind click feedback, popup closures, swiping, and hold-to-trigger events:

```html
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

### Drag/Pan Sensor Area for Mobile Drawer Actions

To implement swipe-to-reveal navigation drawers, panning directives can capture drag distances:

```html
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
  if (direction === 'right' && distance.x > 30) {
    emit('open-drawer')
  }
}
</script>
```

---

## 3. Technical Considerations

*   **Restricting Gesture Axes**: Specifying orientation modifiers (e.g., `v-touch-swipe.horizontal` or `v-touch-swipe.vertical`) avoids conflicts with native browser page scrolling.
*   **Hold Event Duration**: Adding a duration argument (e.g., `v-touch-hold:600` for 600ms) prevents quick taps from accidentally triggering hold events.
*   **Overlay Closure Integration**: Utilizing `v-close-popup` directly on cancel or confirmation buttons removes the need for manual toggle state variables in the Vue component script.
*   **Performance in Panning Loops**: Panning callbacks fire repeatedly on every frame of movement. To maintain a smooth framerate, avoid writing expensive computations, state changes, or API calls inside `v-touch-pan` callbacks.
*   **Accessibility Fallbacks**: Gestures (like swipe or hold) are not easily reproducible by keyboard users or screen readers. Providing standard, clickable buttons or keyboard event listeners (`@keyup.enter`) as secondary pathways ensures equivalent access.
