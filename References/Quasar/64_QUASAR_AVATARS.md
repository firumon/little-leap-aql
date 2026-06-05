# Quasar Avatars (QAvatar) Reference Guide

This reference guide describes the implementation and configuration of user profile images, placeholders, and initials markers using Quasar's avatar component (`QAvatar`).

---

## 1. Component Overview

The `QAvatar` component is a container used to display circular images, initials, or icons representing users or entities. Key roles include:

*   **User Profiles**: Displays user photos or fallbacks in headers, cards, and profile screens.
*   **List Identifiers**: Renders small visual indicators (such as letters or icons) inside lists to represent categories or entities.
*   **System Action Icons**: Renders a circular background around an icon to signal system states or notifications.

---

## 2. Key Attributes & Visual Properties

*   **`size`**: Configures the width and height of the avatar (e.g., `size="32px"`, `size="48px"`).
*   **`color`**: Sets the background color using Quasar color classes.
*   **`text-color`**: Sets the color of the text or icon inside the avatar.
*   **`square`**: Removes the default circular shape and renders the avatar with square corners.
*   **`font-size`**: Adjusts the size of the text/icon inside the avatar relative to the component size.

---

## 3. Code Examples

### Profile Avatar with Initials Fallback

The following component demonstrates rendering a user profile image with a reactive fallback to the user's name initials if the image is missing or fails to load:

```html
<template>
  <div class="row items-center q-gutter-x-sm">
    <!-- Primary Profile Avatar with initials fallback -->
    <q-avatar
      :size="size"
      :color="backgroundColor"
      text-color="white"
    >
      <img v-if="imageUrl" :src="imageUrl" alt="User profile image" />
      <span v-else class="text-weight-bold">{{ userInitials }}</span>
    </q-avatar>

    <!-- Optional Label -->
    <div class="column" v-if="showLabels && name">
      <span class="text-subtitle2 text-weight-bold leading-tight">{{ name }}</span>
      <span class="text-caption text-grey-6 leading-tight">{{ role }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, default: '' },
  role: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  size: { type: String, default: '38px' },
  backgroundColor: { type: String, default: 'primary' },
  showLabels: { type: Boolean, default: false }
})

// Extract name initials (e.g., "John Doe" -> "JD")
const userInitials = computed(() => {
  if (!props.name) return 'U'
  const parts = props.name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})
</script>

<style scoped>
.leading-tight {
  line-height: 1.2;
}
</style>
```

### Layout Profile Header

An example of displaying a larger entity avatar in a header banner:

```html
<template>
  <div class="profile-header bg-grey-1 q-pa-md rounded-borders">
    <div class="row items-center no-wrap">
      <!-- Profile avatar sized for headers -->
      <q-avatar size="48px" color="secondary" text-color="white" class="q-mr-md">
        <span>OP</span>
      </q-avatar>
      
      <div class="column ellipsis">
        <span class="text-subtitle1 text-weight-bold ellipsis">Operator Team</span>
        <span class="text-caption text-grey-7">Zone A Warehouse</span>
      </div>
    </div>
  </div>
</template>
```

---

## 4. Technical Considerations

*   **Sizing Patterns**:
    *   `32px` is standard for list items (`QItemSection avatar`).
    *   `38px` is standard for card layouts or inline profile widgets.
    *   `48px` or larger is standard for dedicated profile headers or user detail views.
*   **Fallback Strategies**: Providing initials or a generic fallback icon (e.g., `icon="person"`) ensures the avatar remains readable if an image URL is broken or not provided.
*   **Accessibility**: If an avatar contains a profile photo, ensure the `img` tag specifies an `alt` attribute describing the image. If the avatar displays initials or icons, specify an `aria-label` on the `QAvatar` wrapper to make it accessible to screen readers.
*   **Interactive Targets**: When utilizing clickable avatars, wrapping the avatar inside a flat, round button (`<q-btn flat round>`) expands the touch target size to meet mobile accessibility standards.
