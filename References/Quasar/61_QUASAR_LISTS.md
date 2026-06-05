# Quasar Lists (QList) Reference Guide

This reference guide describes the implementation and configuration of list feeds and settings interfaces using Quasar's list components (`QList`, `QItem`, `QItemSection`, `QItemLabel`).

---

## 1. Component Overview

Quasar provides a set of layout-friendly list components designed to display rows of information, navigation paths, or options:

*   **`QList`**: The main container for lists. Supports visual attributes like `bordered`, `separator`, and `dense`.
*   **`QItem`**: Represents a single row item in a list. When interactive, it supports the `clickable` and `v-ripple` attributes.
*   **`QItemSection`**: Divides the layout of a single row (`QItem`) into logical horizontal blocks. Sub-components can use qualifiers like `avatar`, `thumbnail`, or `side`.
*   **`QItemLabel`**: The standard component for text blocks inside lists. It supports attributes like `header` (for grouping), `caption` (for secondary details), and custom classes for text wrapping.

---

## 2. Typical Layout Configuration

Lists are commonly configured using a structured alignment pattern:
1.  **Leading Block (`q-item-section avatar` or `thumbnail`)**: Used for visual identifiers such as icons, user initials, or image thumbnails.
2.  **Center Block (`q-item-section`)**: Contains the primary text (`QItemLabel`) and secondary captions (`QItemLabel caption`).
3.  **Trailing Block (`q-item-section side`)**: Reserved for actions, secondary data, status tags, toggle inputs, or chevron navigation helpers.

---

## 3. Code Examples

### Standard Clickable User List

The following example demonstrates a user directory list utilizing avatar initials, titles, status chips, and chevron indicators:

```html
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

### Settings Navigation List

Below is a configuration displaying grouped configurations separated by visual divider lines:

```html
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

## 4. Technical Considerations

*   **Touch Targets on Mobile**: The default padding of `QItem` provides touch clearance values of 48px or more, aligning with web accessibility best practices.
*   **Text Overflow**: Long text blocks inside `QItemLabel` can be constrained using CSS helpers like `ellipsis` to prevent wrapping from disrupting the layout.
*   **Accessibility**: Interactive items can define standard ARIA roles (such as `role="button"` or `role="link"`) and enable appropriate keyboard navigation behaviors.
*   **Item Separators**: Enabling the `separator` prop on `QList` or including `<q-separator />` elements helps structure large collections of text-heavy elements.
