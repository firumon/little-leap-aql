# AQL Page and Section System (Initialization)

This initialization prompt guides the creation, override, and customization of frontend pages and section components in the AQL repository. It establishes a dynamic layout model using `<Section>` placeholders, replacing all legacy `_common/` wrapper layouts.

> [!IMPORTANT]
> **Scope Boundary**: This document covers `Page.vue` orchestration plus developing new framework section components under `src/components/sections/` and implementing custom UI overrides/modifiers under `src/_ui/[UiName]/components/`.
> Before writing any frontend code, you MUST read the global architecture rules: [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md).

> [!IMPORTANT]
> **Subsystem boundary — three placeholders, one override model.** Sections are only one of three paradigms. All share the identical 10-tier `_ui/` lookup described in §3; they differ only in base folder and identity prop.
>
> | Paradigm | Placeholder | Resolver | Base folder | Init prompt |
> |----------|-------------|----------|-------------|-------------|
> | Section | `Section.vue` | `useSectionResolver.js` | `components/sections/` | **this document** |
> | Content | `Content.vue` | `useContentResolver.js` | `components/contents/` | [content_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_customization.md) |
> | Action | `Action.vue` | `useActionResolver.js` | `components/actions/` | [action_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/action_customization.md) |
>
> **If the task touches the sticky form actions bar, submit/reset/cancel buttons, FABs, CRUD actions, or the submission lifecycle, STOP and load [action_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/action_customization.md) instead** — canonical spec: [AQL_ACTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_ACTION_SYSTEM.md). `PageAction` is **not** a Section.

---

## 1. Architectural Overview & Context

> [!IMPORTANT]
> Before implementing anything, read the full canonical doc: [AQL_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_PAGE_AND_SECTION_SYSTEM.md). It contains the complete `pageProps` contract, BP schema, page override scan table, resolver internals, and `AqlContentWrapper` state logic — all of which are critical to getting this right.

* **Page Orchestrator (`src/pages/Page.vue`)**:
  - Dynamically resolved at runtime via `usePageResolver.js` (which also owns record loading via `useRecord`; form state lives in `usePageState.js`).
  - Always renders `<ResourceBreadcrumb />` unconditionally — it is outside the section system.
  - Mounts a full-page custom override (`resolvedPageComponent`) if matched under `src/_ui/` via a **6-candidate ordered scan** (see canonical doc §1.3.2).
  - Otherwise, falls back to rendering placeholders for visible parts:
    - Pre-Action Sections: `<Section>` per entry in `visibleSectionsBeforeAction` (such as `PageHeader`, `FilterInput`).
    - Body Contents: `<Content>` per entry in `contents`, wrapped inside `<AqlContentWrapper>` (state gate + submission overlay — see canonical doc §1.1).
    - Page Actions: `<Action v-if="ready && pageProps.noActions !== true" action="PageAction" />`, mounted **after** `AqlContentWrapper` and **outside** the animated `.aql-page-body` wrapper (a CSS transform on an ancestor would trap the fixed FAB). Owned by the Action subsystem.
  - The Action subsystem is decoupled from `sections` — base contracts do not need a `'PageAction'` entry; `usePageResolver` still filters the name out of `visibleSectionsBeforeAction` if one is present. `noActions: true` suppresses both `<Action>` and the `ActionDialog`.
  - All placeholders receive `pageProps` via `v-bind`. See canonical doc §1.3.4 for the **full `pageProps` contract** (20+ props including `parentForm`, `childGroups`, `actionForm`, all event handlers).
  - Contexts provided: `'resourceConfig'`, `'resourceRecord'`, and `'pageState'`.
* **Section Placeholder (`src/components/Section.vue`)**:
  - Automatically resolves which component to render via `useSectionResolver(preparedProps)`.
  - The resolver itself injects all three contexts internally for use by JS modifiers.
  - Renders custom Vue override, JS logic modifier + base section fallback, or a "Section Not Defined" warning.
  - `Content.vue` and `Action.vue` are byte-for-byte equivalents against `useContentResolver` / `useActionResolver` — same three states, same `preparedProps = { ...attrs, <identity> }` shape.
* **Page-Level Form State (`usePageState.js`)**:
  - Singleton page form-state provided at `Page.vue`.
  - Full API (node mutations, strategy, request builders, validation, triggers): [PAGE_STATE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/PAGE_STATE.md).

---

## 2. Developing Section Components (Strict Guidelines)

When creating a new base section component inside `src/components/sections/` (e.g., `Toolbar.vue`, `FilterInput.vue`):

1. **Disable Attribute Fallthrough**: Enable manual attribute control using `inheritAttrs: false`.
   ```javascript
   defineOptions({ name: 'Sections[Name]', inheritAttrs: false })
   ```
2. **Inject Page Contexts**: Inject provided scopes rather than calling page hooks locally. Always include `null` defaults so sections don't throw if rendered outside `Page.vue` during testing.
   ```javascript
   const resourceConfig = inject('resourceConfig', null)
   const resourceRecord = inject('resourceRecord', null)
   const pageState      = inject('pageState', null)
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
   > **Important**: `evaluateProp` unwraps Vue refs internally before calling the closure. Closure functions receive **plain objects** (`record`, `config`), not refs. Never call `.value` inside a closure prop.
5. **Document Props**: Always document the prop catalog and default behavior in `Documents/AQL_PAGE_AND_SECTION_SYSTEM.md` §2.3.

---

## 3. Section Customization & Overrides

Overrides reside under `src/_ui/[UiName]/components/`.

### 3.1 The 10-Tier Lookup Sequence
`useSectionResolver.js` scans candidates in this order (first match wins). `useContentResolver.js` and `useActionResolver.js` use the identical sequence with `[Content]` / `[Action]` substituted for `[Section]`:
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

*Path segment rules (all segments are lowercased for registry lookup):*
- `[scope]` → lowercased as-is (e.g. `master`)
- `[Resource]` → `toPascalCase` first, then lowercased (e.g. `'purchase-orders'` → `PurchaseOrders` → **`purchaseorders`**)
- `[page]`, `[Section]`, `[UiName]` → lowercased as-is

*File names are case-insensitive* — the registry lowercases all keys at build time, so `Header.vue` and `header.vue` resolve identically.*

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
