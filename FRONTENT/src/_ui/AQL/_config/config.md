# AQL UI — Design System

The human-readable half of `_ui/AQL/_config/`. `config.js` beside this file holds the
values; this file says what they mean and why they hold those values.

Read this before changing a token. Read
[UI_MODULE_DEVELOPER_GUIDE.md §10](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md)
for the rules that make these tokens mandatory rather than advisory.

---

## 0. How a component reads these

A `.vue` never imports this file. One composable per UI relays it, and each page's context
composable re-exports it, so a card gets everything from one import (guide §6.1, §10.1):

```javascript
// _ui/AQL/composables/useAqlConfig.js — the ONE file that imports _config/config.js
import config from 'src/_ui/AQL/_config/config'
export function useAqlConfig () { return config }
```

```html
<script setup>
const { record, pending, ui } = useOutletRestocksContext()
const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>

<template>
  <q-card flat bordered :class="ui.cardClass">…</q-card>
</template>
```

The export is a plain frozen object, not reactive state — reading it in setup and in a
template costs nothing per render.

---

## 1. What `_config/` is for

A `{UiName}` is a resolution scope, not a tenant. Two resources in the same app can carry
two different `CustomUIName` values and resolve under two completely separate `_ui/` trees.
Everything that makes one of those trees *look like itself* — card shell, radius, gradient,
row rhythm, motion, tap targets, emphasis colour — belongs here, in one place per UI name,
and nowhere else.

That is what lets the same module code look right under any UI. `AQL` renders its cards on
a warm gradient shell; a future `LP` UI might render the same cards on a plain white
bordered shell. Neither preference belongs in a module.

> **Every `_ui/{UiName}/` folder gets a `_config/` with `config.js` + `config.md` at
> creation time, before its first component.** A UI folder without one has no design
> system — its modules will each invent their own, which is the exact divergence the
> theme-uniformity rule exists to prevent.

**Scope of a token.** If two modules under this UI would reasonably answer a styling
question the same way, the answer is a token here. If the answer genuinely differs per
module — which icon an empty state shows, what a card is titled — it is not a token; it is
that module's business.

---

## 2. AQL's visual language

AQL is a **mobile-first operational UI**. Every decision below follows from that: the
reader is standing in a warehouse or an outlet, on a phone, doing one task.

| Principle | What it produces |
|---|---|
| One surface family | Every card — detail, wizard step, review, empty state, per-item — is the same shell. A page never reads as two apps glued together. |
| Neutral by default, emphasis is rationed | The page is uniformly neutral so that the one card carrying colour is doing work rather than decorating. |
| Figures are text, states are chips | A number the reader watches change is plain text; a chip is reserved for *what state something is in*. |
| Comfortable targets over density | `dense` is for secondary and read-mostly controls. The control a screen exists to collect keeps its full height. |
| Motion explains, never entertains | A short staggered rise-in tells the reader the list assembled top-down. It is disabled entirely under `prefers-reduced-motion`. |

---

## 3. The tokens

### 3.1 Card shell — `cardClass`

```
page-card aql-premium-gradient-card
```

Applied as `<q-card flat bordered :class="cardClass">`.

| Part | Why |
|---|---|
| `flat` | Drops Quasar's default shadow, so the class's own shadow is the only one in play. |
| `bordered` | Supplies the border hook `aql-premium-gradient-card` then refines. |
| `page-card` | Carries the shared radius token and the `rise-in` entry animation. |
| `aql-premium-gradient-card` | The cool-to-warm diagonal gradient, the `--aql-border` colour and the soft shadow. |

The radius is `$r-md` (14px) from `quasar.variables.scss`, shared with dialogs and headers
so every surface in the app is one family. The border colour is `--aql-border`, derived
from the primary brand colour rather than a neutral grey, which is what keeps the shell
feeling like part of the brand at low contrast.

**This is the shell for every custom card under `_ui/AQL/`** — detail sections, wizard
steps, review summaries, empty states, per-item cards. There is no display-vs-input
variant. `custom.scss` also defines `aql-premium-card` (plain white) and
`aql-premium-gradient-form`; neither is an AQL token, and a module reaching for one is
picking a shell its UI did not choose. Another UI's `_config/config.js` is free to name
one of them as *its* `cardClass`.

### 3.2 Row grammar — `detail*Class`

```html
<div class="aql-detail-grid">
  <div class="aql-detail-line items-center aql-detail-row" :style="rowDelay(i)">
    <span class="aql-detail-key">Outlet</span>
    <span class="aql-detail-val col overflow-hidden flex justify-end items-center">…</span>
  </div>
</div>
```

Key left, value right, dashed separator between lines and none after the last. Used by the
framework's own `contents/ViewRecord.vue`, which is the point: a custom card built on this
grammar cannot misalign against a framework card stacked beside it.

`aql-detail-line` supplies the separator and padding; `items-center` is added by the caller
because some lines hold a badge or an icon rather than text. The value span carries
`col overflow-hidden flex justify-end items-center` so a long value truncates inside its
column instead of pushing the key out of the row.

### 3.3 Motion — `rowStaggerMs: 40`

Each successive `aql-detail-row` enters 40ms after the one above it. 40ms is short enough
that a ten-row card finishes assembling in under half a second, and long enough to read as
a sequence rather than a flicker.

The interval is a token specifically because **stacked cards only animate in step if every
one of them uses the same number.** A card picking 60ms because it looked nicer in
isolation desynchronises the whole page.

`custom.scss` disables all of it under `@media (prefers-reduced-motion: reduce)`. Any new
animation must be added to that block.

### 3.4 Spacing — `gutterDefault` / `gutterFallback`

`pageProps.gutter` is the only spacing mechanism in the UI. It reaches every placeholder
through drilled attrs and is read with `useAttrs()`:

```javascript
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
```

Two different defaults, on purpose:

- **`gutterDefault: 'xs'`** — what the page resolver supplies when a contract says nothing.
  The page's real rhythm.
- **`gutterFallback: 'sm'`** — a component's own `|| 'sm'`. It fires only when `gutter` is
  absent *entirely*, which means the component is being used standalone, outside page-driven
  resolution. Rare in practice.

They are not meant to agree, and the mismatch is not a bug.

Vertical rhythm always belongs to the **container**, never to a `q-mb-*` on the card. A
list-like component takes a `gutter` prop and spaces its own children with it; a card never
spaces itself. `AqlGroupedList`'s `card-class` is appearance only — spacing in it is a bug.

### 3.5 Buttons

**`primaryActionBtnClass` + `primaryActionBtnProps`** — `aql-form-action-btn`, `glossy`,
`push`. The sticky bar's submit button, and any one-click control that commits or computes
for the whole page (an auto-allocate, a select-all that writes). Raised and glossy because
it is the thing the screen is asking for.

**`rowActionBtnProps`** — `flat round dense size="md"`. Every button in a list row's action
cluster, without exception. Sizing used to vary per action (`lg` for the "primary" one),
which made a row read as two toolbars glued together. One scale, one row.

Never wrap a row cluster in `q-btn-group`: the group draws connected-segment chrome, which
makes workflow buttons read as a different control from the View/Edit buttons beside them.

**`minTapTargetPx: 40` / `tapTargetStyle`** — the floor for an icon-only control. A
`flat round dense` Quasar button is comfortably above it; a bare icon or a stripped-down
stepper button is not, and must be given the size explicitly — by binding
`:style="ui.tapTargetStyle"`, never by writing the pixels into a template. Binding a size
from a token is not what the inline-style ban covers; that ban is about spacing.

Every icon-only control also carries an `aria-label`. **A `q-tooltip` does not satisfy
this** — it is invisible to a screen reader and to a touch user who cannot hover, so the
tooltip is an addition, never a substitute. Note that `rowActionBtnProps` supplies neither
the label nor the size: adopting the shared preset leaves both obligations open.

### 3.6 Empty and loading shells

```html
<!-- loading -->
<q-card-section v-if="pending">
  <q-skeleton type="text" width="40%" class="q-mb-sm" />
  <q-skeleton type="text" width="80%" />
</q-card-section>

<!-- empty -->
<q-card-section v-else-if="!rows.length" class="text-center q-py-lg">
  <q-icon name="inventory_2" size="40px" color="grey-4" class="q-mb-sm block q-mx-auto" />
  <div class="text-subtitle1 text-weight-bold text-grey-6">Nothing recorded yet</div>
  <div class="text-caption text-grey-6">Items appear here once the request moves.</div>
</q-card-section>
```

Both live inside the standard card shell, so a card that is loading, empty or full is the
same surface throughout — the page never reflows as data lands.

The caption line is **required**, not optional. An icon and a bold "No items" states that
something is missing; the caption is what says whether that is normal. The icon is always
`emptyIconSize` (40px) in `emptyIconColor` (grey-4) — a larger or darker one turns an
ordinary empty state into an error.

### 3.7 Layout limits — `maxControlsPerRow: 3`

Grouped/repeating controls rendered as columns wrap after three. Beyond three, each control
falls below a comfortable tap target on a phone.

Derive the column width from the **item count**, not a fixed grid, so no row is left with a
lone stranded control:

```
1 → col-12 | 2 → col-6 | 3 → col-4 | 4 → col-6 (2+2) | 5+ → col-4
```

Four splitting 2+2 rather than 3+1 is the case this rule exists for.

### 3.8 Emphasis — `accentCardClass` / `accentBorderStyle`

At most **one** card on a page may break the neutral shell, and only when it is an
*instruction* rather than a statement — something the reader must act on before the rest of
the page matters. It leads the card stack and renders nothing at all in every other state.

AQL's emphasis is a warm tint plus a left accent rail. The rail carries a literal hex
fallback because `--q-orange` is not one of Quasar's brand CSS variables (only `primary`,
`secondary`, `accent`, `dark`, `positive`, `negative`, `info`, `warning` are), so a bare
`var(--q-orange)` resolves to nothing in a stock build.

Two accented cards on one page means neither is emphasised.

---

## 4. Where the CSS lives

The rules these class names refer to are in
[`FRONTENT/src/css/custom.scss`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/css/custom.scss),
globally scoped, shared with the framework's own components. No resolver-backed component
may carry a `<style>` block — a `.vue` override cannot inherit a scoped style, so scoped CSS
silently breaks the override contract.

A second UI adding its own shell adds its rules to a `style.scss` in its own `_config/`,
scoped under a selector keyed to `pageProps.uiName`, so the browser's cascade does the swap
on navigation. That scoping is not wired up yet — it needs each `_config/style.scss`
imported once and the page root carrying the live `uiName` as a class or attribute. Until
it is, AQL's rules stay global in `custom.scss` and this file is the record of which of
them are AQL's own.

---

## 5. Changing a token

1. Change the value in `config.js`.
2. Update the reasoning here — a value with no stated reason gets reverted by the next
   person who finds it inconvenient.
3. If the change adds or renames a class, update `custom.scss` in the same commit.
4. If the change alters what the guide's §10 promises, update
   [UI_MODULE_DEVELOPER_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/UI_MODULE_DEVELOPER_GUIDE.md)
   too.
