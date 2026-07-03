---
name: aql-coding-patterns
description: Enforce consistent coding styles and formatting patterns across JS, Vue, and GS (Google Apps Script) files in the AQL repository. Use whenever creating or editing JS, Vue, or GS files to strictly align with the user's styling rules.
---

# AQL Coding Patterns Skill

This skill enforces strict, clean formatting, code style, and file-type conventions across all JavaScript (`.js`), Vue (`.vue`), and Google Apps Script (`.gs`) files in the `little-leap-aql` repository.

## 1. Strict Formatting & EditorConfig Rules

Always adhere strictly to the `.editorconfig` specifications when reading, writing, or editing code:
- **Indentation**: Exactly `2` spaces (never tabs).
- **Line Endings**: Always use Windows style **CRLF** (`\r\n`).
- **Final Newline**: Always insert a single trailing newline at the end of every file.
- **Trailing Whitespace**: Always trim trailing spaces from the end of all lines before saving.
- **Encoding**: UTF-8.

## 2. Line Width & Character Limits

- **Standard/Soft Line Limit**: `130` characters. Aim to keep lines within this width.
- **Hard Maximum Limit**: `150` characters. Wrap lines before they exceed this limit.

## 3. Comments & Section Markers

- **NO verbose/bulky file header banners** (avoid the complex `/** === ... === */` blocks).
- Use **single-line documentation comments** only (`//` or short `/* */`).
- Use concise, clean section markers to organize code blocks logically (e.g., `// Main Section`, `// Action Handlers`, `// Helper Functions`).
- Keep comments direct and focused on the "why" rather than repeating the code.

## 4. Syntax Rules by File Type

### JavaScript Files (`.js`)
- Use full modern **ES6+** syntax.
- Use `const` and `let` (never `var`).
- Prefer arrow functions (`const myFn = () => {}`), async/await, object/array destructuring, rest/spread operators, and modern array methods.

### GAS (`.gs`) & Vue (`.vue`) Files
- **No `var`**: Always use `const` and `let` for variable declarations to ensure proper block scoping.
- **Traditional/Regular Functions**: Use regular function declarations (`function myFunc(args) { ... }`) instead of assigning anonymous arrow functions to constants for top-level/main operation.

## 5. Vue 3 Single File Component (SFC) Guidelines

### Block Order
Always organize `.vue` files in the following exact order:
1. `<template>`
2. `<script setup>`
3. `<style>`

### Attribute Alignment & Wrapping
- **Single-Line Priority**: If all attributes for an element fit within one line (within the `130-150` character limit), keep them all on a single line.
- **Multi-Line Attribute Grouping**: When attributes exceed the line limit, wrap them logically by category rather than placing every single attribute on its own line:
  - **Same-Line Tag Start (MUST follow)**: The first attribute of the element (regardless of which group it belongs to) MUST start on the same line as the opening tag itself, rather than starting on the next line.
  - **Group 1**: Attributes without values (e.g., `disabled`, `readonly`, `clickable`).
  - **Group 2**: Static attributes with static string values (e.g., `class="text-bold"`, `label="Submit"`).
  - **Group 3**: Dynamic attributes/props with variables (e.g., `:items="items"`, `:to="routePath"`).
  - **Group 4**: Event listeners (e.g., `@click="save"`, `@input="handleInput"`).
  - *Keep attributes belonging to the same group on the same line until the 130-150 character limit is approached, then wrap.*

## 6. Flow Control, Curly Braces, and Returns

### Curly Brace Style (K&R / 1TBS)
For multiline functions and control statements, place the opening curly brace `{` on the same line as the declaration, and start the first statement on the next line indented by 2 spaces:
```javascript
function processPayment(paymentId) {
  const payment = getPayment(paymentId);
  return payment;
}
```

### Single-Statement & Guard Clauses
- **Compact style**: Write single-statement functions, arrow returns, or conditional guard clauses on a single line if they are short (e.g., `if (!data) return;` or `const getVal = () => state.val;`).
- Expand them to multi-line blocks with curly braces only if the line exceeds character limits or the statement is too complex.
- Use early returns to minimize indentation nesting.

### Object Destructuring Alignment & Grouping
- **Single-Line Priority**: If all destructured keys fit on a single line within the 130-150 character limit, write them on one line.
- **Grouped Wrapping**: If the destructuring statement exceeds the line limit, do NOT format with one property per line. Instead, wrap properties logically onto separate lines, grouping properties of similar purpose together (e.g., states/variables, options/dropdown data, methods/actions/navigation):
  ```javascript
  const {
    saving, form,                     // Group 1: State / reactive references
    outletOptions, skuOptions,        // Group 2: Option lists / dropdown data arrays
    warehouseOptions, reasonOptions,
    reload, saveReturn, cancel,       // Group 3: Methods / actions / navigation
    applyOutletQueryParam
  } = flow
  ```


