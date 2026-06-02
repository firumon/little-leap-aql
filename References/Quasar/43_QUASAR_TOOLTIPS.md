# 43_QUASAR_TOOLTIPS.md - Tooltips & Informational Cues

This document defines how to implement and configure informational tooltips using Quasar's tooltip component (`QTooltip`) while respecting mobile accessibility limits.

---

## 1. Purpose

The purpose of this guide is to outline tooltips positioning, explain hover triggers, and establish rules for mobile viewports where hover states do not exist.

---

## 2. Core Philosophy

AQL tooltips are **Desktop-Targeted and Non-Essential**:
*   **Desktop-Only Assist:** Hover tooltips are restricted to desktop viewports (5% usage). They must not hide critical transaction steps or details.
*   **Touch Exclusions:** Since mobile viewports lack a mouse cursor hover state, tooltips must not render on touch targets. If text descriptions are required on mobile, use click-triggered help popovers or inline captions.
*   **Short Descriptions:** Tooltip contents must be kept concise, typically containing under 5 words.

---

## 3. Golden Rules

1.  **Restrict Tooltips to Desktop:** Tooltips must be wrapped with visibility classes or conditional checks: `<q-tooltip v-if="$q.screen.gt.xs">`.
2.  **No Critical Info in Tooltips:** Crucial data (like inventory codes, invoice totals, or status codes) must never live inside a tooltip. They must render directly on the primary card.
3.  **Use Default Transitions:** Keep tooltips lightweight and use standard slide or fade transitions.
4.  **Confirm Correct Offsets:** Position tooltips relative to icons with clear alignments (`anchor="top middle" self="bottom middle"`).

---

## 4. QTooltip Configuration & Layout Setup

```html
<!-- FRONTENT/src/components/Admin/SupplierActionIcons.vue -->
<template>
  <div class="inline-actions-container">
    <!-- Action Button (Desktop Optimized) -->
    <q-btn
      v-ripple
      flat
      round
      dense
      color="primary"
      icon="archive"
      @click="emit('archive')"
    >
      <!-- Tooltip restricted to desktop screens -->
      <q-tooltip
        v-if="$q.screen.gt.xs"
        anchor="top middle"
        self="bottom middle"
        :offset="[0, 4]"
      >
        Archive Supplier
      </q-tooltip>
    </q-btn>
  </div>
</template>

<script setup>
const emit = defineEmits(['archive'])
</script>
```

---

## 5. Best Practices

*   **Compact Styling:** Use standard dark styling variables for tooltip panels.
*   **Brief Strings:** Ensure tooltip text is descriptive yet brief (e.g. "Create invoice", not "Click here to initialize the invoice creation workflow").

---

## 6. Mobile First Rules

*   **Prohibit Touch Hover Blocks:** Mobile users tapping on elements that trigger hover tooltips will cause the tooltip to render and stay stuck on-screen until another area is tapped. Force `v-if="$q.screen.gt.xs"` to prevent this behavior.

---

## 7. Common Patterns

### Responsive Legend Helper Pattern

For mobile layouts, present info details directly inline instead of utilizing hidden tooltips:

```html
<!-- FRONTENT/src/components/Operations/OutletLegendHelper.vue -->
<template>
  <div class="legend-container">
    <!-- Desktop View: Display clean tooltip details -->
    <div v-if="$q.screen.gt.xs" class="row items-center cursor-pointer">
      <span class="text-subtitle2">Priority</span>
      <q-icon name="help" size="xs" class="q-ml-xs" />
      <q-tooltip anchor="top middle" self="bottom middle">
        High priority orders process within 2 hours
      </q-tooltip>
    </div>

    <!-- Mobile View: Display inline text helpers directly -->
    <div v-else class="column bg-blue-1 q-pa-sm rounded-borders text-blue-9">
      <div class="text-caption text-weight-bold">Order Priority Warning:</div>
      <div class="text-caption">
        High priority orders process within 2 hours.
      </div>
    </div>
  </div>
</template>

<script setup>
// Legend component wrapper
</script>
```

---

## 8. Reusable Component Suggestions

*   `AqlInfoIcon`: Desktop icon displaying tooltip summaries and mobile details via dynamic bottom sheet options.

---

## 9. Accessibility Notes

*   Quasar tooltips automatically inject `role="tooltip"` attributes and link to triggers via dynamic ID maps.
*   Keep text labels screen-reader accessible.

---

## 10. Dark Mode Notes

*   Tooltip colors must retain high contrast dark values to ensure visibility.

---

## 11. Performance Notes

*   Avoid declaring complex components inside tooltips as they incur high compilation costs.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Putting primary navigation elements or click links inside a hover-triggered `QTooltip`.
    *   *Correction:* Replace with click-triggered `QMenu` popovers.
*   **Anti-Pattern:** Omitting viewport visibility limits on tooltips, causing them to render on mobile screens.
    *   *Correction:* Apply `v-if="$q.screen.gt.xs"` to tooltips.

---

## 13. AI Agent Rules

1.  **Enforce Viewport Gates:** Ensure all tooltip instances are gated with desktop visibility flags.
2.  **Confirm Label Briefs:** Reject tooltips wrapping long explanation paragraphs.

---

## 14. Decision Matrix

| User Viewport | Essential Information? | Target Component | Trigger Action |
| :--- | :--- | :--- | :--- |
| **Desktop (>1024px)**| No (Nice to have) | `QTooltip` | Hover trigger |
| **Desktop (>1024px)**| Yes (Critical) | Card label text | Persistent layout display |
| **Mobile (<600px)** | No (Nice to have) | Hidden on mobile | None |
| **Mobile (<600px)** | Yes (Critical) | Inline banner / panel | Tap to open help sheet |

---

## 15. Final Rule

All tooltips must be restricted to desktop viewports using screen size conditionals, contain brief information, and map alignments cleanly without nested interactive markup.
