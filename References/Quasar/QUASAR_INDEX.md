# QUASAR Framework AI Knowledge Base Index (QUASAR_INDEX.md)

> [!IMPORTANT]
> The files in this directory describe Quasar component capabilities — what each component offers, its props, slots, sub-components, and typical behavior. They are educational references, NOT project rulebooks. Project-wide architecture rules live in Documents/ARCHITECTURE RULES.md. If a component doc conflicts with ARCHITECTURE RULES.md, the latter wins.

This is the primary index and routing directory for the Quasar Framework AI Knowledge Base within the AQL project. This document serves as the entry point for all AI coding agents (Gemini, Claude, ChatGPT, Cursor, Roo Code, Aider, etc.) to navigate Quasar guidelines, implementation patterns, and Mobile-First constraints.

---

## 1. Purpose

The purpose of this index is to provide a central registry and routing mechanism for AI coding agents to locate topic-specific Quasar documentation. It defines the application stack, the operational constraints (95% Mobile UX), and establishes the lookup pathways for all components, styling utilities, navigation flows, and performance directives within the repository.

---

## 2. Core Philosophy

AI agents must think **Quasar-First** and **Mobile-First**. In the AQL project:
*   **Touch over Clicks:** Interaction targets must be large and forgiving.
*   **Virtual Lists over Tables:** `QCard` lists combined with `QVirtualScroll` take absolute precedence over `QTable`.
*   **Responsive is Native:** The Screen plugin controls UI hierarchy dynamically.
*   **Architectural Purity:** Components only display data and invoke composables. They never access Pinia stores directly, never call services, and never perform API or IndexedDB (IDB) operations.

---

## 3. Golden Rules

1.  **Strict Layer Separation:** Components speak ONLY to composables. Composables contain business logic and speak to stores. Stores coordinate actions and speak to services. Services handle raw API and IndexedDB.
2.  **No Naked Actions:** All interactive elements must be permission-gated using the `allowed()` helper from `useResourceConfig`.
3.  **No Hardcoded Currency:** All price/amount displays must use the polyvalent dynamic helper `_C` from the `useCurrency` composable.
4.  **No Scoped CSS Duplication:** Styling must use native Quasar utilities. Custom styling goes only into `custom.scss` as highly reusable classes. Local component `<style>` blocks are forbidden.

---

## 4. Component Usage (Index of Files)

AI agents must reference the following files depending on the task:

| File Name | Scope & Core Component Focus |
| :--- | :--- |
| **[01_QUASAR_PHILOSOPHY.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/01_QUASAR_PHILOSOPHY.md)** | Core mindset: Mobile-first UX, Quasar-first design, Touch targets, Page routing. |
| **[02_QUASAR_AI_RULES.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/02_QUASAR_AI_RULES.md)** | Standard AI prompt rules, code boundaries, state validation routines. |
| **[03_QUASAR_COMPONENT_SELECTION.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/03_QUASAR_COMPONENT_SELECTION.md)** | Decision trees and matrices for choosing between cards, lists, tables, and dialogs. |
| **[10_QUASAR_LAYOUTS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/10_QUASAR_LAYOUTS.md)** | `QLayout`, `QHeader`, `QFooter`, `QPageContainer`, `QPage` and drawer integration. |
| **[11_QUASAR_STYLING.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/11_QUASAR_STYLING.md)** | Typography, flex grid, colors, helpers, CSS variables, `custom.scss` rules. |
| **[12_QUASAR_RESPONSIVE.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/12_QUASAR_RESPONSIVE.md)** | `Screen` plugin, adaptive layout boundaries, desktop vs mobile toggles. |
| **[13_QUASAR_DARK_MODE.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/13_QUASAR_DARK_MODE.md)** | `Dark` plugin, design tokens for high-contrast dark environments. |
| **[20_QUASAR_FORMS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/20_QUASAR_FORMS.md)** | `QForm`, submit/reset events, autofocusses, mobile keyboard adjustments. |
| **[21_QUASAR_VALIDATION.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/21_QUASAR_VALIDATION.md)** | Internal Quasar validation rules, lazy rules, async rules, custom composable checks. |
| **[22_QUASAR_INPUTS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/22_QUASAR_INPUTS.md)** | `QInput`, field masks, text/number inputs, action suffixes, clearable settings. |
| **[23_QUASAR_SELECTS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/23_QUASAR_SELECTS.md)** | `QSelect`, autocomplete, filtering, virtual-scroll lists, native mobile selection. |
| **[24_QUASAR_OPTIONS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/24_QUASAR_OPTIONS.md)** | `QRadio`, `QCheckbox`, `QToggle`, `QOptionGroup` guidelines. |
| **[30_QUASAR_TABLES.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/30_QUASAR_TABLES.md)** | `QTable` implementation limits (5% Desktop portal only), slot modifications. |
| **[31_QUASAR_VIRTUAL_SCROLL.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/31_QUASAR_VIRTUAL_SCROLL.md)** | `QVirtualScroll`, infinite scroll components, memory cleanup, list speed. |
| **[32_QUASAR_DATA_DISPLAY.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/32_QUASAR_DATA_DISPLAY.md)** | `QSeparator`, `QSpace`, `QBanner`, `QIcon` usage. |
| **[40_QUASAR_DIALOGS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/40_QUASAR_DIALOGS.md)** | `QDialog`, custom layout slots, transition optimization, dismiss workflows. |
| **[41_QUASAR_MENUS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/41_QUASAR_MENUS.md)** | `QMenu`, anchor rules, self rules, target offsets, mobile overlay switches. |
| **[42_QUASAR_POPOVER.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/42_QUASAR_POPOVER.md)** | Popup elements, interactive badges, overlay placement limits on touch. |
| **[43_QUASAR_TOOLTIPS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/43_QUASAR_TOOLTIPS.md)** | `QTooltip` rules: desktop-only hints, mobile accessibility exclusions. |
| **[44_QUASAR_BOTTOM_SHEETS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/44_QUASAR_BOTTOM_SHEETS.md)** | `BottomSheet` plugin and custom layouts (the preferred mobile context action). |
| **[50_QUASAR_NAVIGATION.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/50_QUASAR_NAVIGATION.md)** | `QTabs`, `QRouteTab`, bottom nav styling, link rules with `useResourceNav`. |
| **[51_QUASAR_DRAWERS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/51_QUASAR_DRAWERS.md)** | `QDrawer` behavior, gestures, breakpoint triggers. |
| **[52_QUASAR_TOOLBAR.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/52_QUASAR_TOOLBAR.md)** | `QToolbar` items, responsive button sizing, status indicators. |
| **[53_QUASAR_PAGE_HEADERS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/53_QUASAR_PAGE_HEADERS.md)** | Page title blocks, action groups, back-buttons on mobile views. |
| **[54_QUASAR_GLOBAL_SEARCH.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/54_QUASAR_GLOBAL_SEARCH.md)** | Instant search bars, filters, dropdowns, local cache queries. |
| **[55_QUASAR_NOTIFICATIONS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/55_QUASAR_NOTIFICATIONS.md)** | `Notify`, `Dialog` plugins, progress indicators, inline alerts. |
| **[60_QUASAR_CARDS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/60_QUASAR_CARDS.md)** | `QCard`, sections, item groupings, swipe gestures. |
| **[61_QUASAR_LISTS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/61_QUASAR_LISTS.md)** | `QList`, `QItem`, `QItemSection`, high density layouts. |
| **[62_QUASAR_CHIPS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/62_QUASAR_CHIPS.md)** | `QChip` for badges, filter states, multi-select items. |
| **[63_QUASAR_BADGES.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/63_QUASAR_BADGES.md)** | `QBadge` for notifications, floats, alignments. |
| **[64_QUASAR_AVATARS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/64_QUASAR_AVATARS.md)** | `QAvatar` initial labels, icons, borders. |
| **[70_QUASAR_COMPOSABLES.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/70_QUASAR_COMPOSABLES.md)** | `useQuasar`, `useMeta`, lifecycle wrappers. |
| **[71_QUASAR_PLUGINS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/71_QUASAR_PLUGINS.md)** | Quasar service plugins (Dialog, Loading, Notify, LocalStorage). |
| **[72_QUASAR_DIRECTIVES.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/72_QUASAR_DIRECTIVES.md)** | Touch directives (`v-touch-pan`, `v-touch-swipe`, `v-ripple`, `v-close-popup`). |
| **[73_QUASAR_UTILITIES.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/73_QUASAR_UTILITIES.md)** | Format, Date, DOM, Event, and validation helpers. |
| **[80_QUASAR_PERFORMANCE.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/80_QUASAR_PERFORMANCE.md)** | Optimization checklists: virtual scrolls, load footprints. |
| **[81_QUASAR_ACCESSIBILITY.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/81_QUASAR_ACCESSIBILITY.md)** | Color contrast, focus loops, screen readers. |
| **[82_QUASAR_SECURITY.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/82_QUASAR_SECURITY.md)** | Script injection preventions, secure forms, raw HTML guidelines. |
| **[90_QUASAR_ANTI_PATTERNS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/90_QUASAR_ANTI_PATTERNS.md)** | Master list of patterns banned in AQL frontend. |
| **[91_QUASAR_MOBILE_FIRST.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/91_QUASAR_MOBILE_FIRST.md)** | UX design checklists: padding, touch sizes, view hierarchies. |
| **[92_QUASAR_AI_IMPLEMENTATION_RULES.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/92_QUASAR_AI_IMPLEMENTATION_RULES.md)** | System prompt rules and verification commands. |

---

## 5. Best Practices

*   **Read the Specific Doc first:** Before editing any Quasar component, locate its corresponding file in the directory above and read it.
*   **AQL Architecture Alignment:** Ensure all layout implementations comply with the AQL Frontend Architecture Rules ([ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md)).
*   **Composition API & Javascript Setup:** All JS implementation must follow the standard `<script setup>` pattern. Do NOT use TypeScript.
*   **No custom layouts:** Do not use `div` elements with raw inline styles or flex variables when Quasar layout tools (`q-col-gutter`, `row`, `col-12`) are available.

---

## 6. Mobile-First Rules

*   **Layout Height:** Never use `100vh` on mobile as browser toolbars cause vertical overflow. Always use Quasar's `style="min-height: inherit"` inside `QPage` or use height calculators from the Screen plugin.
*   **Click Delay:** Ensure `v-ripple` is present on all interactive elements to give immediate touch feedback.
*   **Target Size:** Min size for any touch element is `44px` height and width. Use class `q-pa-md` or `q-py-sm` to enforce spacing.
*   **Input Fields:** Set `dense` and `outlined` as default props for mobile forms to maximize screen area usage.

---

## 7. Common Patterns

Here is the default pattern for an AQL mobile page setup inside `<script setup>`:

```html
<!-- FRONTENT/src/pages/ExamplePage.vue -->
<template>
  <q-page class="q-pa-md flex flex-center" padding>
    <q-card class="full-width q-mb-md" flat bordered v-if="allowed({ exampleResource: 'read' })">
      <q-card-section>
        <div class="text-h6">{{ _C(100, true) }}</div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { useCurrency } from 'src/composables/useCurrency'
import { useResourceConfig } from 'src/composables/useResourceConfig'

const { _C } = useCurrency()
const { allowed } = useResourceConfig()
</script>
```

---

## 8. Reusable Component Suggestions

For any page, design decisions regarding components must follow this hierarchy:
1.  **Use Existing Components:** Always check if a pre-existing reusable component or wrapper (e.g., `AqlList`, `AqlDialog`) is suitable before writing custom markup.
2.  **Create Reusable Components:** If no existing component fits but the visual structure is reused in multiple places, extract and build a new reusable wrapper component.
3.  **Inline Local Templates:** If the visual structure is for a single-use scenario or strictly specific to one container, write the template directly within that specific component file to avoid polluting the global registries.

---

## 9. Accessibility Notes

*   Ensure correct usage of `aria-label` inside `QBtn` if it only displays an icon.
*   Keep reading sequences correct by using semantic HTML (`main`, `header`, `footer`, `section`).

---

## 10. Dark Mode Notes

*   Always use color helper tokens (`text-primary`, `bg-dark`, `text-grey-7`) rather than absolute hex values (`#fff`, `#000`) so that layouts adjust automatically when dark mode is active.

---

## 11. Performance Notes

*   Never load components dynamically inside loops.
*   Implement `lazy` on dialogs and menus (`lazy-rules` or `lazy` mount properties) to prevent high DOM overhead.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Direct `router.push('/some-path')` inside components.
    *   *Correction:* Always use `const { navigate } = useResourceNav()` to route pages.
*   **Anti-Pattern:** Call standard browser alert popup.
    *   *Correction:* Always use Quasar's `this.$q.dialog` or the imported `Dialog` plugin helper.

---

## 13. AI Agent Rules

When you are acting as an AI assistant editing files in AQL:
1.  **Read the Route First:** Locate the component in this file index and open the target `.md` reference.
2.  **Verify Layers:** Ensure you do not write API/Service commands in Vue components.
3.  **Confirm Permissions:** Ensure all new click actions are gated with `allowed()`.

---

## 14. Decision Matrix

Use the matrix below to navigate the Quasar AI Knowledge Base files:

| Development Need | Primary Reference Document | Target Component/Utility |
| :--- | :--- | :--- |
| **Grid Alignment & Flex** | [11_QUASAR_STYLING.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/11_QUASAR_STYLING.md) | Quasar Flex system, spacing helpers |
| **User Input & Text Fields** | [22_QUASAR_INPUTS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/22_QUASAR_INPUTS.md) | `QInput` masks, Dense forms |
| **List rendering (huge data)** | [31_QUASAR_VIRTUAL_SCROLL.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/31_QUASAR_VIRTUAL_SCROLL.md) | `QVirtualScroll`, Infinite loader |
| **Action Dropdowns / Choices** | [44_QUASAR_BOTTOM_SHEETS.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/44_QUASAR_BOTTOM_SHEETS.md) | Bottom sheets |
| **Dynamic Form Validation** | [21_QUASAR_VALIDATION.md](file:///f:/LITTLE%20LEAP/AQL/References/Quasar/21_QUASAR_VALIDATION.md) | dynamic lazy rules |

---

## 15. Final Rule

Before starting any task, read this index file to locate the exact topic-specific Quasar guidelines, and verify your proposed layout adheres to the AQL [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md).
