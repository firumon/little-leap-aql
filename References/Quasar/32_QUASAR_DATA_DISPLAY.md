# Quasar Data Display: Visual Accents, Banners & Spacing

This reference document describes how to implement and configure Quasar's display and layout components (`QSeparator`, `QSpace`, `QBanner`, `QIcon`) to segment sections, align items, and render notification contexts.

---

## 1. Overview of Spacing & Display Components

Quasar offers several utilities to manage document structure and alignment without requiring custom CSS or inline spacing rules:
* **QSeparator:** Renders thin dividing lines to partition content, such as separating list items or card headers from content sections.
* **QSpace:** A component that acts as a flexible spacer in flexbox containers, pushing adjacent elements to opposite ends.
* **QBanner:** Displays notification messages, alert statuses, or banners inline with the application layout.
* **QIcon:** Wraps vector web fonts or custom SVG assets to render graphic indicators.

---

## 2. Key Properties & Options

### QSeparator
* `inset`: Indents the line from the edges, often aligned to avoid cutting off list avatars or icons.
* `vertical`: Toggles the divider orientation from horizontal to vertical.

### QBanner
* `dense`: Compact layout mode with reduced padding.
* `inline-actions`: Aligns action buttons in a row next to the alert text instead of stacking them below.
* Slots:
  * `avatar`: Used to place an icon or graphic status badge.
  * `action`: Used to place button links, such as close, retry, or sync commands.

---

## 3. Implementation Example

The example below shows a card layout combining spacing, separators, banners, and icon elements:

```html
<template>
  <div class="column q-gutter-y-md">
    <!-- Inline alert warning banner -->
    <q-banner dense inline-actions class="text-white bg-warning rounded-borders" v-if="isOffline">
      <template v-slot:avatar>
        <q-icon name="cloud_off" size="sm" />
      </template>
      Connection is currently offline. Operations will be queued.
      <template v-slot:action>
        <q-btn flat color="white" label="Sync" @click="emit('sync')" />
      </template>
    </q-banner>

    <q-card flat bordered>
      <!-- Title section aligned using QSpace -->
      <q-card-section class="row items-center q-py-sm">
        <div class="text-subtitle1 text-weight-bold">Item Details</div>
        <q-space />
        <q-icon name="info" class="text-grey-6" size="20px" />
      </q-card-section>

      <q-separator />

      <!-- Content sections partitioned using inset separators -->
      <q-card-section class="q-pa-md">
        <div class="row justify-between text-body2 q-py-xs">
          <span class="text-grey-7">Item Name:</span>
          <span class="text-weight-bold">Outlet Box</span>
        </div>
        <q-separator inset class="q-my-xs" />
        <div class="row justify-between text-body2 q-py-xs">
          <span class="text-grey-7">Stock Status:</span>
          <span class="text-weight-bold text-positive">Available</span>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
defineProps({
  isOffline: { type: Boolean, default: false }
})
const emit = defineEmits(['sync'])
</script>
```

---

## 4. Common Presentation Patterns

### Inline Alert Banners
Banners are typically used to convey general system messages or user feedback. Incorporating an action button within the same row is accomplished using the `inline-actions` prop:

```html
<template>
  <q-banner rounded class="bg-grey-2 text-dark q-pa-sm border-grey-3">
    <template v-slot:avatar>
      <q-icon name="announcement" color="primary" />
    </template>
    <div class="text-caption text-weight-medium">
      Data sync completed. Refresh the portal to view changes.
    </div>
    <template v-slot:action>
      <q-btn flat dense color="primary" label="Refresh" size="sm" @click="onRefresh" />
    </template>
  </q-banner>
</template>

<script setup>
const emit = defineEmits(['refresh'])
const onRefresh = () => {
  emit('refresh')
}
</script>
```
