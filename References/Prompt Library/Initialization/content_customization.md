---
name: AQL Content & Page Customization Agent
description: Specialized initialization prompt for creating, inspecting, or modifying local page overrides, form layouts, lists, details cards, and collapsible form sections under Content.
---

# Scope Boundary

This document defines initialization parameters for agents tasked with resource-level Content overrides or script-only layout customizations.

## Required Pre-Reads
Before creating or modifying any local Content components:
1. **System Specifications**: Read [AQL_CONTENT_CUSTOMIZATION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_CONTENT_CUSTOMIZATION_SYSTEM.md) to review all valid configuration schemas and default behaviors.
2. **Architecture Constraints**: Read [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) for strict formatting rules (e.g. no `<style>` blocks in local components).

---

## 1. Context Tracing Protocol

To custom-tailor the content layouts:
1. **Locate Metadata**: Read the target resource schema file under `src/metadata/schemas/` or fetch headers in `src/pages/resource/` page context.
2. **Find Target Override Paths**: Check if local custom folder structures already exist at `src/components/[Scope]/[ResourceName]/[Page]/`.
3. **Analyze Dual-Model Suitability**:
   - Prefer **Script-Only Configuration** (e.g. `export const config = { ... }`) for simple layout overrides (columns, card styles, fields ordering, input sections, hidden items, custom field labels, chip/status helpers, dynamic icons).
   - Use **Template SFC Override** ONLY if the resource page requires complex non-standard UI elements, dynamic client-side calculators, custom grid card loops, or external API-connected controls.

---

## 2. Implementation Rules

### 2.1 Writing Script-Only Overrides
- Create the target component (e.g., `Index/Records.vue` or `Add/Form.vue`) containing only a `<script>` or `<script setup>` block.
- **NEVER** include empty `<template></template>` blocks, as they will compile to empty render functions and prevent fallback components from rendering.
- Ensure the configuration object is named `config` and exported:
  ```vue
  <script>
  export const config = {
    // Layout parameters here
  }
  </script>
  ```

### 2.2 Writing Template Overrides
- If a complete template is required, structure it as a standard Vue SFC.
- Bind all values using the page-provided state injection tokens (`resourceConfig` and `resourceRecord`).
- **NEVER** use inline style blocks. Use Quasar utility classes (e.g. `q-pa-md`, `row`, `col`, `q-gutter-sm`) for spacing, grids, and alignments.

### 2.3 Verification & Safety
- Run target checks or build commands (`npm run build` from `FRONTENT/`) to confirm no compilation issues before ending your turn.
- Make sure to document custom modifications in the project's walkthrough.md.
