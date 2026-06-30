---
name: AQL Content & Page Customization Agent
description: Specialized initialization prompt for creating, inspecting, or modifying local page overrides, form layouts, lists, details cards, and collapsible form sections under Content.
---

# Scope Boundary

This document defines initialization parameters for agents tasked with resource-level Content overrides or JS layout modifications.

## Required Pre-Reads
Before creating or modifying any local Content components:
1. **System Specifications**: Read [AQL_CONTENT_CUSTOMIZATION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_CONTENT_CUSTOMIZATION_SYSTEM.md) to review all valid configuration schemas and default behaviors.
2. **Architecture Constraints**: Read [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) for strict formatting rules (e.g. no `<style>` blocks in local components).

---

## 1. Context Tracing Protocol

To custom-tailor the content layouts:
1. **Locate Metadata**: Read the target resource schema file under `src/metadata/schemas/` or fetch headers in `src/pages/resource/` page context.
2. **Find Target Override Paths**: Check if local custom folder structures already exist at `src/components/[Scope]/[ResourceName]/[Page]/`.
3. **Analyze Overriding Strategy**:
   - Prefer **JS Logic Modifiers** (`[Section].js` at Tiers 7 & 8) for simple adjustments (altering field orders, modifying classes, toggling borders, custom labels, custom layouts).
   - Use **Vue Template SFC Overrides** (`[Section].vue`) ONLY if the page requires complex non-standard UI elements, custom slots, or specialized inputs.

---

## 2. Implementation Rules

### 2.1 Writing JS Logic Modifiers (Tiers 7 & 8 only)
- Create the target component (e.g., `Index/Records.js` or `Add/Form.js`) exporting a default function.
- The function receives the component's `preparedProps` object, modifies it, and returns the updated props:
  ```javascript
  export default function (props) {
    return {
      ...props,
      bordered: true,
      flat: false,
      class: 'custom-class'
    }
  }
  ```

### 2.2 Writing Vue Template Overrides (Tiers 1-8)
- Vue overrides must contain a `<template>` block. Components without a template block are **never allowed**.
- Bind all values using the page-provided state injection tokens (`resourceConfig` and `resourceRecord`).
- **NEVER** use inline style blocks. Use Quasar utility classes (e.g. `q-pa-md`, `row`, `col`, `q-gutter-sm`) for spacing, grids, and alignments.

### 2.3 Verification & Safety
- Run target checks or verify paths to confirm no compilation issues before ending your turn.
- Make sure to document custom modifications in the project's walkthrough.md.
