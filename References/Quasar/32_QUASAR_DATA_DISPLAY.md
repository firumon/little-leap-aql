# 32_QUASAR_DATA_DISPLAY.md - Visual Accents, Banners & Spacing

This document defines how to use Quasar's visual accent and structural components (`QSeparator`, `QSpace`, `QBanner`, `QIcon`) to organize screen sections, display alert feedback, and align layout controls.

---

## 1. Purpose

The purpose of this guide is to standardize dividing lines, flex spacing tools, layout notification banners, and status icons to ensure clean readability across mobile interfaces.

---

## 2. Core Philosophy

AQL visual accents are **Functional, Semantic, and Clean**:
*   **Logical Dividers:** Never use heavy border styles to segment sections. Use `QSeparator` with standard colors to isolate visual groups (like card text from action rows).
*   **Flex-Grow Alternative:** Flex rows must not use floating styles or margin calculations. We use `QSpace` inside flex wrappers to push actions to screen boundaries.
*   **Notification Banners:** Inline warnings, permission errors, and offline alerts must display using semantic `QBanner` overlays instead of raw alerts.

---

## 3. Golden Rules

1.  **Use QSpace for Flex Alignment:** Push elements to opposite edges inside a row using `<q-space />` instead of writing custom flex alignment CSS.
2.  **Rely on Native Icons Library:** Icons must map strictly to imported vector packs (usually Material Icons) via `<q-icon name="icon_name">`. Prohibit loading random image files for system symbols.
3.  **Color Banners Semantically:** Alert banners must map colors to transaction states (`bg-warning`, `bg-negative`, `bg-info`).
4.  **Confirm Separator Inset:** Use `inset` properties on list dividers to align separating lines with list details text rather than extending across the avatar area.

---

## 4. Component Layout Setup

```html
<!-- FRONTENT/src/components/Operations/OutletInfoCard.vue -->
<template>
  <div class="column q-gutter-y-md">
    <!-- Offline Status Warning Banner -->
    <q-banner dense inline-actions class="text-white bg-warning rounded-borders" v-if="isOffline">
      <template v-slot:avatar>
        <q-icon name="cloud_off" size="sm" />
      </template>
      You are currently offline. Operations will be queued.
      <template v-slot:action>
        <q-btn flat color="white" label="Sync" @click="emit('sync')" />
      </template>
    </q-banner>

    <q-card flat bordered>
      <!-- Title section with QSpace alignment -->
      <q-card-section class="row items-center q-py-sm">
        <div class="text-subtitle1 text-weight-bold">Item Details</div>
        <q-space />
        <q-icon name="info" class="text-grey-6" size="20px" />
      </q-card-section>

      <!-- Standard visual dividing line -->
      <q-separator />

      <!-- Content area -->
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

## 5. Best Practices

*   **Banner Actions Placement:** Limit banners to a single call-to-action button to prevent visual crowding on mobile.
*   **Separator Spacing:** Do not combine margins (`q-my-md`) with separators if the parent wrapper already maps spacing properties.

---

## 6. Mobile First Rules

*   **Responsive Banner Text:** Keep banner messages brief (under two lines) on mobile screens so actions remain visible without scrolling.
*   **Icon Touch Buffers:** Icons that act as click targets must have padding classes (`q-pa-xs`) to widen touch boundaries.

---

## 7. Common Patterns

### Custom Notification Indicator Pattern

```html
<!-- FRONTENT/src/components/Operations/OutletNotificationBanner.vue -->
<template>
  <q-banner rounded class="bg-grey-2 text-dark q-pa-sm border-grey-3">
    <template v-slot:avatar>
      <q-icon name="announcement" color="primary" />
    </template>
    <div class="text-caption text-weight-medium">
      AQL update completed. Refresh portal to view updated inventory.
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

---

## 8. Reusable Component Suggestions

*   `AqlEmptyState`: Reusable card wrapper displaying warning banners, accent icons, and descriptive labels when lists return empty.

---

## 9. Accessibility Notes

*   Verify all banners define roles (`role="alert"`) so screen readers announce warnings immediately.
*   Check that icon markers do not carry focus borders if they represent static visual details.

---

## 10. Dark Mode Notes

*   Ensure that banners use custom theme color tokens (`bg-grey-2` in light shifting to dynamic dark variables in dark mode).

---

## 11. Performance Notes

*   Avoid loading dozens of vector icons simultaneously inside infinite lists. Use simple text markers when appropriate.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Implementing custom `border-bottom: 1px solid #ccc` styles on list items.
    *   *Correction:* Apply `<q-separator />` or use list separator rules.
*   **Anti-Pattern:** Centering layouts using empty spacer divs with `flex-grow` properties.
    *   *Correction:* Use Quasar's `<q-space />`.

---

## 13. AI Agent Rules

1.  **Validate Element Spacing:** Confirm that flex margins do not use hardcoded positioning rules when `<q-space />` is available.
2.  **Ensure Vector Icons:** Reject custom icon wrappers importing SVG files directly unless standard libraries lack a suitable symbol.

---

## 14. Decision Matrix

| Formatting Goal | Layout Target | Output Component | Attributes |
| :--- | :--- | :--- | :--- |
| **Separate card header** | Card segment | `QSeparator` | None (standard line) |
| **Indent list items** | List separator | `QSeparator` | `inset` (keeps avatar clear) |
| **Align action buttons**| Toolbar/Footer | `QSpace` | None (flex push) |
| **Offline alert** | Page top overlay | `QBanner` | `dense inline-actions` |

---

## 15. Final Rule

All page segmentation and item layouts must use separators for divisions, spaces for flex alignment, banners for status alerts, and map standard icon tokens for system symbols.
