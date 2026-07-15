# AQL Page and Section System (Initialization)

This initialization prompt guides the creation, override, and customization of frontend pages and section components in the AQL repository. It establishes a dynamic layout model using `<Section>` placeholders, replacing all legacy `_common/` wrapper layouts.

> [!IMPORTANT]
> **Scope Boundary**: This document covers both developing new framework section components under `src/components/sections/` and implementing custom UI overrides/modifiers under `src/_ui/[UiName]/components/`. 
> Before writing any frontend code, you MUST read the global architecture rules: [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md).

---

## 1. Architectural Overview & Context

* **Page Orchestrator (`src/pages/Page.vue`)**:
  - Dynamically resolved at runtime via `usePageResolver.js`.
  - Mounts a full-page custom override (`resolvedPageComponent`) if matched under `src/_ui/`.
  - Otherwise, falls back to rendering placeholding `<Section>` components for visible parts:
    - Pre-Action Sections: `visibleSectionsBeforeAction` (such as `Header`, `Toolbar`).
    - Body Sections: `contents` wrapped inside `<AqlContentWrapper>`.
    - Post-Action Sections: `Action` section.
  - Contexts provided: `'resourceConfig'`, `'resourceRecord'`, and `'pageState'`.
* **Section Placeholder (`src/components/Section.vue`)**:
  - Automatically resolves which component to render via `useSectionResolver(preparedProps)`.
  - Renders custom Vue override, JS logic modifier + base section fallback, or a "Section Not Defined" warning.
* **Page-Level Form State (`usePageState.js`)**:
  - Singleton page form-state provided at `Page.vue`.
  - Exports resource-agnostic canonical GAS request builders (e.g. `compositeSaveRequest`).

---

## 2. Developing Section Components (Strict Guidelines)

When creating a new base section component inside `src/components/sections/` (e.g., `Toolbar.vue`):

1. **Disable Attribute Fallthrough**: Enable manual attribute control using `inheritAttrs: false`.
   ```javascript
   defineOptions({ name: 'Sections[Name]', inheritAttrs: false })
   ```
2. **Inject Page Contexts**: Inject provided scopes rather than calling page hooks locally.
   ```javascript
   const resourceConfig = inject('resourceConfig')
   const resourceRecord = inject('resourceRecord')
   const pageState      = inject('pageState')
   ```
3. **Compound Prop Typing**: Ensure styling/label props support closure functions.
   ```javascript
   const props = defineProps({
     label: { type: [String, Function], default: '' }
   })
   ```
4. **Evaluate Closures**: Use the `evaluateProp` helper to compute final attributes dynamically (passing the record and config to closures):
   ```javascript
   import { evaluateProp } from 'src/composables/resources/useSectionResolver'
   const finalAttrs = computed(() => ({
     label: evaluateProp(props.label, resourceRecord, resourceConfig)
   }))
   ```
5. **Document Props**: Always document the prop catalog and default behavior at the bottom of the section component or in `Documents/AQL_PAGE_AND_SECTION_SYSTEM.md`.

---

## 3. Section Customization & Overrides

Overrides reside under `src/_ui/[UiName]/components/`.

### 3.1 The 10-Tier Lookup Sequence
`useSectionResolver.js` scans candidates in this order (first match wins):
1. **Vue override** (resource + page specific): `.../[scope]/[Resource]/[page]/[Section].vue`
2. **JS modifier** (resource + page specific): `.../[scope]/[Resource]/[page]/[Section].js`
3. **Vue override** (resource specific): `.../[scope]/[Resource]/[Section].vue`
4. **JS modifier** (resource specific): `.../[scope]/[Resource]/[Section].js`
5. **Vue override** (page specific): `.../[scope]/[page]/[Section].vue`
6. **JS modifier** (page specific): `.../[scope]/[page]/[Section].js`
7. **Vue override** (scope-wide): `.../[scope]/[Section].vue`
8. **JS modifier** (scope-wide): `.../[scope]/[Section].js`
9. **Vue override** (ui-wide fallback): `.../[Section].vue`
10. **JS modifier** (ui-wide fallback): `.../[Section].js`

*Note: `[Resource]` is PascalCase. `[page]` and `[scope]` are lowercased.*

### 3.2 Vue Overrides vs JS Modifiers
* **JS Modifiers (`.js`)**: Keep the base template but alter props.
  * *Signature*:
    ```javascript
    export default (currentProps, { pageState, resourceRecord, resourceConfig }) => ({
      title: (record) => `User: ${record?.Username}`
    })
    ```
* **Vue Overrides (`.vue`)**: Replaces the template completely.

### 3.3 Attribute Fallthrough in Vue Overrides (Strict)
To prevent property collisions when wrapping default components inside an override:
* **DO NOT** wrap the component in a raw `<div>` wrapper (this swallows back actions, badges, and reload events).
* **DO** specify `inheritAttrs: false` and explicitly bind `$attrs` **before** custom properties:
  ```html
  <template>
    <GenericHeaderPanel v-bind="$attrs" title="Custom Override Title" />
  </template>
  ```

---

## 4. Strict Maintenance Rule

> [!IMPORTANT]
> **Documentation Sync Requirement**: Any modifications, refactoring, or additions to the Page/Section system structure (such as expanding page overrides, adding custom Vue-based page customization logic, or rewriting record/resource page flows) MUST be accompanied by updates to:
> 1. The canonical doc: [AQL_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_PAGE_AND_SECTION_SYSTEM.md)
> 2. This initialization prompt: [page_and_section_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_section_system.md)
