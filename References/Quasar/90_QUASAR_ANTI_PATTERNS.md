# 90_QUASAR_ANTI_PATTERNS.md - Banned Patterns & Code Quality Rules

This document defines the absolute "donts" and banned programming patterns in the AQL frontend codebase. It establishes why these patterns degrade quality, and outlines the correct alternatives.

---

## 1. Purpose

The purpose of this guide is to enforce strict code formatting and design rules, prevent architectural regression (like layer violations), and stop developers from writing inefficient code structures.

---

## 2. Core Philosophy

AQL code quality is driven by **Architectural Consistency**:
*   **Bypassing Layers is Forbidden:** Direct imports of data stores or backend API services inside visual `.vue` files represent layer violations. Components must only speak to composables.
*   **Reactivity Workarounds Banned:** Maintaining parallel local caches or forcing element re-renders via keys to fix stale inputs are architectural violations. Fix the reactive dependency chain instead.
*   **Utility-Driven Layouts Only:** Hand-rolled flex layouts or custom grid systems are forbidden. Leverage Quasar grid rules.

---

## 3. Golden Rules

1.  **Ban Options API:** Never generate Vue code blocks using Options API (`data()`, `methods`, `computed` blocks). Use Composition API `<script setup>` exclusively.
2.  **No router.push in Components:** All navigation triggers must pass through the `useResourceNav` composable to map URL boundaries.
3.  **Prohibit Custom Inline Layout Sizing:** Never specify absolute container measurements (e.g. `width: 350px`) in components CSS blocks. Use Quasar flex layout classes.
4.  **No Hardcoded Currency Symbols:** The rupee (`₹`) and dirham (`AED`) symbols must never be printed as raw text strings. Use the dynamic `_C` helper.

---

## 4. Anti-Patterns Master Reference Catalog

AI agents must audit code against the following master list of banned operations:

| Banned Operation (Anti-Pattern) | Architectural Reason | Correct AQL Compliant Alternative |
| :--- | :--- | :--- |
| **Importing stores in Views** | Layer violation. View templates must remain stateless. | View calls composables. Composable accesses store state. |
| **Direct Axios calls in Views**| Layer violation. Views must not run network payloads. | Map network calls inside services, coordinate in stores. |
| **Using `router.push`** | Breaks unified resource navigations wrapper. | Call `const { navigate } = useResourceNav()`. |
| **Writing `<style scoped>`** | Promotes custom visual variations and code bloat. | Rely on Quasar CSS utilities, add custom rules to `custom.scss`. |
| **Hardcoding `₹ 100`** | Breaks dynamic currency configurations. | Call `_C(100, true)` from `useCurrency` composable. |
| **Raw HTML tables on Mobile** | Breaks touch UI, causes horizontal layout overflows. | Stack records vertically using flat, bordered `QCard` items. |
| **Mirroring props in refs** | Breaks Vue's single reactive source of truth. | Bind variables directly or compute changes via `computed()`. |

---

## 5. Best Practices

*   **Audit Code Layering:** Before committing changes, inspect: Did you import a service (`*Service.js`) inside a Vue component script? If so, extract it to a composable.
*   **Avoid Force Renders:** Do not resolve stale templates by binding reactive `:key="renderTrigger"` trackers to force component rebuilds. Rebuild reactive calculations using computed wrappers.

---

## 6. Mobile First Rules

*   **No Multi-Column Dropdowns:** Prohibit floating menus containing options columns. Swap to `QBottomSheet` or dynamic fullscreen modals.
*   **Prohibit Small Tap Targets:** Icons or buttons with touch boundaries under `44px` are banned. Expand clearances using padding classes (`q-pa-sm`).

---

## 7. Common Patterns

### Correcting Reactivity Workarounds (Before & After)

#### Broken Anti-Pattern: Local Mirror Caches
```javascript
// ANTI-PATTERN: Copying props values to local ref to manage updates
const props = defineProps({ item: Object })
const localItemQty = ref(props.item.qty) // Stale when parent state shifts!
```

#### Correct AQL Pattern: Computed Chain
```javascript
// CORRECT: Bind directly or map changes via reactive computed wrapper
const props = defineProps({ item: Object })
const calculatedQty = computed(() => props.item.qty) // Natively tracks parent changes!
```

---

## 8. Reusable Component Suggestions

*   Enforce usage of `AqlList` and `AqlItem` wrappers to replace raw loops.

---

## 9. Accessibility Notes

*   Verify button widgets include label attributes. Banish naked `q-btn` structures lacking descriptions.

---

## 10. Dark Mode Notes

*   Avoid setting hardcoded background hex codes in component styles as they override dark mode inversions.

---

## 11. Performance Notes

*   **Block Redundant Computed Loops:** Do not put intensive array filtering formulas inside template bindings. Declare computations inside script sections.

---

## 12. Anti-Patterns

*   **Anti-Pattern:** Putting heavy text layouts next to button arrays inside card footers, causing horizontal line wrapping.
    *   *Correction:* Place button groups in their own row inside `QCardActions`.
*   **Anti-Pattern:** Direct `router.push('/dashboard')` inside components.
    *   *Correction:* Always use `const { navigate } = useResourceNav()`.

---

## 13. AI Agent Rules

1.  **Strict Layer Auditing:** Reject any generated components that violate standard separation rules.
2.  **Confirm Script Setup:** Reject Option API models.

---

## 14. Decision Matrix

| Code Violations Category | Severity Level | Target Remediation | Impact Scope |
| :--- | :--- | :--- | :--- |
| **API calls in components**| CRITICAL | Extract to Composable and Service | Structural separation |
| **Direct `router.push`** | HIGH | Replace with `useResourceNav` | Routing integrity |
| **Raw CSS layout styling**| MEDIUM | Replace with Quasar Flex Grid | Theme consistency |
| **Hardcoded Rupee prefix**| MEDIUM | Replace with `_C` currency helper | Region configuration |

---

## 15. Final Rule

All codebase changes must strictly reject Options API syntax, prohibit direct store or service imports inside components, prevent local reactivity cache mirrors, bypass direct routing calls, and ban custom CSS layout styles.
