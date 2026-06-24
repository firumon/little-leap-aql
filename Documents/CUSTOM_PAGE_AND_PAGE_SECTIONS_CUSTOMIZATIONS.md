# Custom Page and Page Sections Customizations

## Overview

AQL's frontend architecture is designed for deep, tiered customization of pages and layout sections. This is achieved through a unified, multi-tiered component resolution system powered by `useSectionResolver.js` (for layout sections) and `usePageResolver.js` (for top-level pages).

Customization is structured into three distinct layers of responsibility. Placing components in the correct layer is critical to maintaining clean boundaries and preventing accidental cross-tenant or cross-page leaks.

---

## The Three Customization Layers

AQL's customization hierarchy is divided into three layers. You must always use the **Entity-Custom Layer** as your default standard, reserving the other two for rare, exceptional cases.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Tenant-Custom Layer (components/_custom/)                 │ ◄── RARE USE ONLY (Tenant-specific)
├─────────────────────────────────────────────────────────────┤
│ 2. Entity-Custom Layer (components/{Scope}/{ResourceName}/) │ ◄── STANDARD / RECOMMENDED (Resource-specific)
├─────────────────────────────────────────────────────────────┤
│ 3. Framework Layer (components/_common/)                    │ ◄── RARE USE ONLY (Global fallback)
└─────────────────────────────────────────────────────────────┘
```

### 1. Entity-Custom Layer (Standard / Recommended)
* **Directory**: `src/components/{ScopeFolder}/{EntityName}/` (e.g., `src/components/Masters/Products/`)
* **Purpose**: This is the **default, standard location** for customizing any resource's layout sections. If a resource requires specific form layouts, unique child sections, or customized headers, the component must be created here.
* **Tiers**: Matches Tiers 7–8 in the resolution checklist.

### 2. Tenant-Custom Layer (Rare Use Only)
* **Directory**: `src/components/_custom/{customUIName}/{ScopeFolder}/` (e.g., `src/components/_custom/A2930/Masters/`)
* **Purpose**: Reserved strictly for tenant-specific overrides (identified by the resource's `ui.customUIName` configuration). Creating or editing files here should be done in **rare situations only** when a specific tenant requires unique behavior that cannot be handled generically.
* **Tiers**: Matches Tiers 1–6 in the resolution checklist.

### 3. Framework Layer (Rare Use Only)
* **Directory**: `src/components/_common/`
* **Purpose**: Represents the core framework-level default templates and fallbacks shared globally across all resources. Creating or editing files here should be done in **rare situations only** (e.g., framework-wide layout updates or core bug fixes) to avoid breaking global consistency.
* **Tiers**: Matches Tiers 9–12 in the resolution checklist.

---

## 12-Tier Section Resolution Checklist

When resolving a layout section (e.g., `Header` on the `View` page for `Products` in the `Masters` scope under tenant `A2930`), `useSectionResolver.js` checks paths in the following priority order:

### Tenant-Custom Tiers (Rare Use Only)
1. **Tenant-custom, Entity-specific, Page-specific (Nested)**:
   `components/_custom/A2930/Masters/Products/View/Header.vue`
2. **Tenant-custom, Entity-specific, Page-generic**:
   `components/_custom/A2930/Masters/Products/Header.vue`
3. **Tenant-custom, Scope-common, Page-specific (Nested)**:
   `components/_custom/A2930/Masters/View/Header.vue`
4. **Tenant-custom, Global Page-specific (Scope-generic) (Nested)**:
   `components/_custom/A2930/View/Header.vue`
5. **Tenant-custom, Scope-common, Page-generic**:
   `components/_custom/A2930/Masters/Header.vue`
6. **Tenant-custom, Tenant-global**:
   `components/_custom/A2930/Header.vue`

### Entity-Custom Tiers (Standard / Recommended)
7. **Entity-custom, Page-specific (Nested)**:
   `components/Masters/Products/View/Header.vue`
8. **Entity-custom, Page-generic**:
   `components/Masters/Products/Header.vue`

### Framework Tiers (Rare Use Only)
9. **Scope-common, Page-specific (Nested)**:
   `components/_common/Masters/View/Header.vue`
10. **Scope-common, Scope-generic**:
    `components/_common/Masters/Header.vue`
11. **Global-common, Page-specific (Nested)**:
    `components/_common/View/Header.vue`
12. **Global-common (Global fallback)**:
    `components/_common/Header.vue`

---

## Naming & Implementation Rules

* **Component Files**: Must use `PascalCase` (e.g., `Header.vue`, `Details.vue`, `Form.vue`).
* **Resource Folders**: Must be the `PascalCase` representation of the resource slug (e.g., `products` → `Products`, `purchase-requisitions` → `PurchaseRequisitions`).
* **SFC Cleanliness**: Keep custom components thin. Business logic must live in composables; styling must use Quasar classes or generic classes in `custom.scss`. Custom styles/SFC `<style>` blocks are forbidden.
