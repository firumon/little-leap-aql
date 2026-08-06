---
name: AQL Renderable Contract Agent
description: Specialized initialization prompt for creating or materially changing any reusable render component under `abstract/`, `app/`, `contents/`, or `sections/` — enforcing that every overridable prop routes through `abstract/Renderable.js` so `_ui/` tenants can customize via cheap JS modifiers instead of full Vue overrides.
---

# Scope Boundary

This document defines initialization parameters for agents **building or restructuring reusable render components**: anything under `FRONTENT/src/components/abstract/`, `app/`, `contents/`, or `sections/`.

It governs **how a component exposes its cells for customization**. It does NOT cover which override file to create for a given resource (→ [content_customization.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/content_customization.md)), the Section resolver chain (→ [page_and_section_system.md](file:///f:/LITTLE%20LEAP/AQL/References/Prompt%20Library/Initialization/page_and_section_system.md)), or field-type rendering (→ `FRONTENT/src/components/_fields/README.md`).

> [!IMPORTANT]
> **This prompt is additive.** If the task is "create a new Section" or "add a content component", load the matching domain prompt **and** this one. This one only governs the prop surface.

## Required Pre-Reads
1. **The contract**: [AQL_RENDERABLE_CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_RENDERABLE_CONTRACT.md) — dispatch order, prop table, the prop-type widening rule, and known limits.
2. **Architecture constraints**: [ARCHITECTURE RULES.md](file:///f:/LITTLE%20LEAP/AQL/Documents/ARCHITECTURE%20RULES.md) — mandatory before touching anything under `FRONTENT/`.
3. **The reference implementation**: `FRONTENT/src/components/abstract/Renderable.js` and its three call sites in `FRONTENT/src/components/abstract/List.vue`.

---

## 1. The Rule

**Every prop a caller might reasonably want to replace with their own markup MUST route through `Renderable`.**

The test: *could a tenant want a chip, badge, button cluster, or custom component where this renders text?* If yes, it is slot-shaped.

Slot-shaped by default: `label`, `caption`, `chip`, `badge`, `btn`, `metaLabel`, `metaCaption`, and any per-item cell in a repeated row.
Not slot-shaped: `*Color`, `*Class`, `size`, `dense`, `outline`, and any prop consumed as a value rather than rendered.

**Why it matters:** a prop interpolated directly as `{{ resolveProp(x, item) }}` is closed to customization. A tenant wanting one different cell must write a full `.vue` override, which swaps component identity, remounts the list, and kills row transitions. Routing through `Renderable` lets the same change be a one-line `.js` modifier that keeps the component mounted.

---

## 2. Mandatory Design Protocol

Before writing the template of a new `abstract/`/`app/`/`contents/`/`sections/` component:

1. **Enumerate the cells.** List every position that renders caller-supplied content.
2. **Classify each** as slot-shaped or not, using §1's test.
3. **State the classification to the user** and ask whether any borderline prop should be opened up. Err toward opening it — the cost is one `<Renderable>` node; the cost of getting it wrong is a forced `.vue` override for every tenant thereafter.
4. **Only then** write the template, with each slot-shaped cell as a single `<Renderable>`.

If the component being modified is an EXISTING one that does not yet use `Renderable`, say so explicitly and offer the conversion as part of the change rather than adding a new non-conforming cell alongside.

---

## 3. Implementation Rules

### 3.1 The render site
Replace the whole slot/`v-if`/wrapper cascade with one node:

```html
<Renderable :slot-fn="slots.btn" :value="btn" :item="item" :is="QBtn" value-prop="icon"
            flat round dense :color="btnColor(item)" @click.stop="onActionClick(item)" />
```

- `value-prop` when the wrapper takes the value as a **prop** (`QBtn`'s `icon`); omit it for the wrapper's **default slot** (`QItemLabel`'s children).
- Keep the surrounding section's `v-if` gate — `Renderable` returning `null` does not remove the containing element.

### 3.2 Prop declarations — the step that gets missed
Declare every `Renderable`-routed prop as `[String, Function, Object]`, and **mirror it on every component in the forwarding chain**. A JS modifier's props hit `contents/<X>.vue` before `abstract/<X>.vue` and fail validation there first.

Leave directly-resolved props (`icon`, `avatar`, `*Color`) as-is — their type check is doing real work.

### 3.3 Truthiness helpers
Any `has*()` helper must early-return a component value:

```js
if (isComponentDef(prop)) return prop
```

### 3.4 Never widen the attr spread
`Renderable` passes `item` + `class`/`style` only to a caller's component. Do not "helpfully" add more — fallthrough attrs clobber the component's own props.

### 3.5 `inheritAttrs: false` is mandatory on a DOM root
Page props drill down the entire placeholder chain so any component can claim its own `Props<Identity>` block ([AQL_PAGE_AND_SECTION_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_PAGE_AND_SECTION_SYSTEM.md) §1.4.1). Those blocks are **objects**, so a component that renders a DOM root with fallthrough enabled stringifies them onto the element as `propspageheader="[object Object]"`.

Declare `inheritAttrs: false` on any new component in `abstract/`, `app/`, `contents/`, or `sections/`. If callers need to style it, re-bind explicitly on the root rather than relying on fallthrough:

```html
<q-list class="q-gutter-y-xs" :class="$attrs.class" :style="$attrs.style">
```

---

## 4. Authoring a Component To Be Passed As A Prop

- Declare exactly `{ item: { type: Object, required: true } }`.
- Read relations off `item` directly. Never spread it — relation getters (`$outlet`, `_Parents`) are non-enumerable and a spread drops them.
- Use `inject()` for reactive page context (`resourceRecord`, `resourceConfig`, `pageState`), not the modifier's `ctx` snapshot.
- **Adapt existing framework logic, never reimplement it.** Search for an existing embeddable component first — e.g. `components/app/AdditionalActionsButtons.vue` already renders gated workflow actions and exposes `{ actions, open }` via its default slot. Reference: `_ui/AQL/components/Operation/OutletVisits/Index/VisitActionButtons.vue` contributes only the `item` → `record` binding and the button order.
- No `<style>` blocks; Quasar utility classes only (ARCHITECTURE RULES §7).

---

## 5. Verification & Safety

- Run `gitnexus_impact` on any shared resolver you touch (`resolveProp`, `getComponentType`) before editing — these are called from many sites within a single file and the contract change is easy to under-scope.
- **Verify in the browser, not by inspection.** Prop-type warnings fire on the first render of a component-valued prop and are easily missed: load the affected page, switch to the affected view, and check the console with an explicit `warn|Invalid` filter.
- Confirm both paths still work: a caller **slot** override and a **component-valued prop**, on the same cell.
- Run `gitnexus_detect_changes()` before committing.
- Update [AQL_RENDERABLE_CONTRACT.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_RENDERABLE_CONTRACT.md) §9 when a component adopts the contract, and `FRONTENT/src/components/REGISTRY.md` when a reusable API changes.
