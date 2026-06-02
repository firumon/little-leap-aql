# 61_QUASAR_LISTS.md - List Feeds & Structural Options

This document defines how to implement and configure data listings using Quasar's list components (`QList`, `QItem`, `QItemSection`) to support high-density mobile list feeds.

---

## 1. Purpose

The purpose of this guide is to explain list structural design, ensure list rows maintain touch clearances, and standardize text alignments.

---

## 2. Core Philosophy

AQL lists are **High-Density, Segmented, and Action-Safe**:
*   **High-Density Feeds:** To display transaction logs or settings lists efficiently, we use compact list structures (`dense` attributes).
*   **Logical Section Wrapping:** List rows divide content areas clearly. Icons or avatars map to leading blocks, titles map to center blocks, and status values or edit buttons map to trailing blocks.
*   **Rippled Touch Targets:** Every clickable list item must supply immediate feedback using `v-ripple` and enforce comfortable touch target heights.

---

## 3. Golden Rules

1.  **Always Set Click Ripples:** Every interactive list row element must declare the `v-ripple` directive: `<q-item clickable v-ripple>`.
2.  **Separate Items Natively:** Enable borders between items using Quasar list separator attributes: `<q-list separator>`.
3.  **Isolate Side Actions Explicitly:** Place tags, status chips, or secondary buttons strictly inside a trailing container: `<q-item-section side>`.
4.  **Use Semantic Labels Scaling:** Format list item text hierarchies using standard labels scale elements (`QItemLabel`).

---

## 4. QList Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Operations/OutletUserList.vue -->
<template>
  <q-card flat bordered>
    <!-- List container with separator lines enabled -->
    <q-list separator>
      <!-- Clickable row item -->
      <q-item
        v-for="user in users"
        :key="user.id"
        clickable
        v-ripple
        @click="emit('select', user.id)"
      >
        <!-- Lead avatar section -->
        <q-item-section avatar>
          <q-avatar color="primary" text-color="white" size="38px">
            {{ getInitials(user.name) }}
          </q-avatar>
        </q-item-section>

        <!-- Center detail text section -->
        <q-item-section>
          <q-item-label class="text-weight-bold">{{ user.name }}</q-item-label>
          <q-item-label caption class="text-grey-7">{{ user.role }}</q-item-label>
        </q-item-section>

        <!-- Trailing action/status section -->
        <q-item-section side>
          <div class="row items-center q-gutter-x-xs">
            <q-chip
              dense
              size="sm"
              :color="user.isActive ? 'positive' : 'negative'"
              text-color="white"
            >
              {{ user.isActive ? 'Active' : 'Locked' }}
            </q-chip>
            <q-icon name="chevron_right" color="grey-6" />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </q-card>
</template>

<script setup>
defineProps({
  users: { type: Array, required: true }
})

const emit = defineEmits(['select'])

const getInitials = (name) => {
  return name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'U'
}
</script>
```

---

## 5. Best Practices

*   **Header Dividers:** Use list headers (`QItemLabel` with `header` attribute) to group list categories cleanly (e.g. "Operations", "Masters").
*   **Side Icon Alignments:** Align side icons to the center of list items to keep items visually balanced.

---

## 6. Mobile First Rules

*   **Ensure Min Target Clearance:** Clickable list items must maintain a target height of at least `44px` (Quasar's `QItem` handles this natively when using standard paddings).
*   **Prevent Multi-Line Wrap Clipping:** Truncate long sub-labels inside center sections using the `ellipsis` class: `<q-item-label caption class="ellipsis">`.

---

## 7. Common Patterns

### Settings Navigation List Pattern

```html
<!-- FRONTENT/src/components/Navigation/OutletSettingsList.vue -->
<template>
  <q-list bordered class="bg-white rounded-borders">
    <!-- Group header -->
    <q-item-label header class="text-weight-bold">System Preferences</q-item-label>

    <q-item clickable v-ripple @click="navigate('profile')">
      <q-item-section avatar>
        <q-icon name="person" color="primary" />
      </q-item-section>
      <q-item-section>User Profile</q-item-section>
      <q-item-section side>
        <q-icon name="chevron_right" />
      </q-item-section>
    </q-item>

    <q-separator />

    <q-item clickable v-ripple @click="navigate('notifications')">
      <q-item-section avatar>
        <q-icon name="notifications" color="secondary" />
      </q-item-section>
      <q-item-section>Notifications Settings</q-item-section>
      <q-item-section side>
        <q-icon name="chevron_right" />
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script setup>
const emit = defineEmits(['navigate'])
const navigate = (target) => {
  emit('navigate', target)
}
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlList`: Reusable list feed container integrating dynamic filters, status chip indicators, and lazy loaders.

---

## 9. Accessibility Notes

*   Verify interactive items specify standard navigation roles (`role="link"` or `role="button"`).
*   Ensure focus transitions flow correctly.

---

## 10. Dark Mode Notes

*   Ensure list backgrounds change automatically to `bg-dark` or `bg-surface` when dark mode triggers.

---

## 11. Performance Notes

*   Do not nest complex watcher operations inside list items body slots.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Nesting custom flex rows directly inside raw `QList` tags without wrapping them in `QItem` containers.
    *   *Correction:* Always organize list structures using standard `QItem` and `QItemSection` elements.
*   **Anti-Pattern:** Omitting standard border separator indicators on large lists.
    *   *Correction:* Enable `<q-list separator>`.

---

## 13. AI Agent Rules

1.  **Validate List Hierarchies:** Ensure list layout templates structure cells strictly via `QItemSection` containers.
2.  **Confirm Rippled Items:** Reject interactive row components lacking `v-ripple` directives.

---

## 14. Decision Matrix

| Dataset Row Volume | Item Interaction Goal | Output Component | Side Section Layout |
| :--- | :--- | :--- | :--- |
| **< 15 items** | Main navigation route | Standard `QList` | Chevron navigation arrow |
| **15 to 50 items** | View record details | `QVirtualScroll` | Status Badge details |
| **Checklist options** | Select properties | `QList` with option values | Toggle control element |

---

## 15. Final Rule

All visual list feeds must utilize standard list item wrappers, enable border separators, structure row segments using item sections, and define ripple feedback cues on all touch zones.
