# Quasar Architectural Patterns & Development Best Practices

This guide describes the architectural patterns and coding standards used in AQL frontend development. It focuses on maintaining structural layer separation, ensuring routing integrity, handling currency dynamically, and structuring Vue reactivity.

---

## 1. Architectural Layer Separation

To ensure maintainability, components should remain stateless and logic-free:

*   **View Layer**: Vue single-file components (SFCs) focus on visual representation, layout, and user events. Direct Axios calls, database mutations, or state logic are separated from the template.
*   **Composable Layer**: Encapsulates business logic, form validation calculations, and coordinates state triggers.
*   **Store / Service Layer**: Pinia stores hold global application state, while services execute network transport operations and payload packaging.

---

## 2. AQL Project-Wide Architecture Rules

The AQL project relies on several key architecture rules to enforce consistency and security:

### Resource Navigation via `useResourceNav`
Routing actions should go through the unified `useResourceNav` composable rather than calling Vue Router (`router.push`) directly. This ensures URL structures are mapped consistently and navigation hooks run successfully.

### Currency Formatting via `useCurrency`
Financial calculations and currency symbols are handled dynamically. Instead of hardcoding currency prefixes (e.g., `₹` or `AED`), components format monetary values using the `_C` helper from the `useCurrency` composable to adapt to regional settings.

### Separation of Concerns in Data Fetching
Axios instances and API endpoints are declared within backend services and state stores. Views trigger actions through composables instead of importing or invoking Axios directly.

---

## 3. Reactivity and State Patterns

### Prop Mirroring vs. Computed Chains

Copying incoming props into local reactive references can break Vue's reactive link. If the parent state changes, the local reference remains stale.

*   **Prop Mirroring Pattern (Stale State)**:
    ```javascript
    const props = defineProps({ item: Object })
    const localItemQty = ref(props.item.qty) // Tracks initial state only
    ```
*   **Computed Chain Pattern (Reactive State)**:
    ```javascript
    const props = defineProps({ item: Object })
    const calculatedQty = computed(() => props.item.qty) // Tracks changes dynamically
    ```

### Rendering Lists Efficiently
In high-density scroll feeds, components like `QVirtualScroll` or virtualized list adapters reduce rendering overhead. Heavy computed operations (such as array sorting or filtering) are declared inside script tags or computed variables rather than executing inline within template rendering expressions.

---

## 4. Layout and Style Alignment

*   **Leveraging Quasar's Flex Grid**: Relying on Quasar's native flex classes (e.g., `row`, `column`, `col-xs-12`, `col-md-6`) ensures responsive compatibility across mobile and desktop screens. Specifying absolute widths (e.g., `width: 350px`) on parent containers can cause layout clipping.
*   **Button and Touch Targets**: Designing interactive elements (like icon buttons and navigation rows) to maintain standard touch targets of 48px or more (using padding classes) supports accessibility on touch devices.
