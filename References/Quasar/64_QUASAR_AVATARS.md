# 64_QUASAR_AVATARS.md - User Profiles & Profile Initials

This document defines how to implement and configure user profiles and item initial markers using Quasar's avatar component (`QAvatar`).

---

## 1. Purpose

The purpose of this guide is to explain avatar sizes scale variables, detail user initial fallback systems, and standardize visual spacing metrics.

---

## 2. Core Philosophy

AQL avatars are **Initials-First, Size-Standardized, and High-Contrast**:
*   **Initials Fallback:** We avoid raw placeholder graphics. When user profile images are absent, avatars must display the user's name initials.
*   **Sizing Standards:** To maintain list layout harmony, avatar dimensions must map to standard sizes (`32px` for lists, `38px` for cards, `48px` for profile header pages).
*   **Contrasting Colors:** Avatar background elements must use vibrant primary colors or secondary accents to distinguish placeholders visually.

---

## 3. Golden Rules

1.  **Always Set Initials Fallback:** Avatars must resolve to two-letter name initials when image links are undefined.
2.  **No Arbitrary Sizing Heights:** Set explicit sizing scales using the size attribute: `<q-avatar size="32px">`. Avoid custom CSS dimensions.
3.  **Ensure Direct Ripple Cues:** If tapping the avatar executes profile page routing, wrap the avatar inside a `<q-btn flat round>` layout.
4.  **Confirm Flat Outlines:** Avatars inside dense lists must maintain flat background designs to fit list borders.

---

## 4. QAvatar Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Navigation/OutletProfileAvatar.vue -->
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

// Extract name initials (e.g. "John Doe" -> "JD")
const userInitials = computed(() => {
  if (!props.name) return 'U'
  const parts = props.name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})
</script>

<style scoped>
/* Clear button margins */
.leading-tight {
  line-height: 1.2;
}
</style>
```

---

## 5. Best Practices

*   **Vibrant Backgrounds:** Leverage semantic variables for background colors (`color="primary"`, `color="secondary"`) to keep aesthetics harmonized.
*   **Icon Fallbacks:** If initials are unavailable, display standard placeholders (`icon="person"`).

---

## 6. Mobile First Rules

*   **Align List Offsets:** Use `QItemSection` side alignment layouts to prevent avatars from skewing line heights inside dense items lists.
*   **Touch Action Wrapper:** Ensure clickable avatars are wrapped inside standard buttons to expand touch target areas to at least `44px`.

---

## 7. Common Patterns

### Responsive Header Profile Pattern

```html
<!-- FRONTENT/src/components/Navigation/OutletHeaderProfile.vue -->
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

<script setup>
// Profile header wrapper
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlAvatar`: Base profile avatar wrapping user name initial resolvers, icon structures, and dynamic profile linkings.

---

## 9. Accessibility Notes

*   Verify all image-based avatars contain proper `alt` text labels.
*   Initial overlays must have descriptive title labels.

---

## 10. Dark Mode Notes

*   Ensure background colors maintain strong visual contrast ratios when dark themes are active.

---

## 11. Performance Notes

*   **Avoid Raw Image Redundant Loading:** For list items loops, prefer initials displays over loading hundreds of image URLs.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Writing custom CSS circular borders (`border-radius: 50%`) around raw HTML `img` elements.
    *   *Correction:* Always leverage Quasar's `<q-avatar>` wrapper.
*   **Anti-Pattern:** Omitting initial values or icons when image loading fails, leaving empty grey circles.
    *   *Correction:* Define fallback parameters inside avatars.

---

## 13. AI Agent Rules

1.  **Validate Fallback Scripts:** Ensure avatar components implement initials calculations.
2.  **Confirm Sizing Specs:** Confirm that custom CSS size calculations are bypassed in favor of native properties.

---

## 14. Decision Matrix

| Avatar Usage | Visual Context | Sizing Value | Default Filler |
| :--- | :--- | :--- | :--- |
| **Row List Item** | Dense Feed list | `32px` | Two-character initials |
| **Record details Card**| Info Detail card | `38px` | Two-character initials |
| **Layout Profile page**| Main Account view | `48px` | User image or initials |
| **Status Warning tag** | Action alert | `24px` (dense) | Status alert icon |

---

## 15. Final Rule

All user profile representations must implement text initials fallback structures, scale dimensions using standard sizes, apply vibrant background colors, and wrap action targets inside button controls.
