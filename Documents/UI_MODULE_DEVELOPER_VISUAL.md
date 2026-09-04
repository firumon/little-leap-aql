# 3-Layer UI — Visual Design Contract

> Part of **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**. Card shells, row grammar, spacing, motion and quiet states.

---

## 10. Visual Design Contract

> [!IMPORTANT]
> **Theme uniformity.** Every module under one `_ui/{Ui}/` scope shares one visual
> language. A user navigating between modules under the same UI name must never feel like
> they've entered a different, standalone app — no module-by-module divergence in card
> shell, radius, gradient, shadow, motion or spacing.

### 10.1 The card shell is a per-UI token

**One shell for every custom UI surface** under a given UI — detail sections, wizard steps,
review summaries, empty states, per-item cards. Not just View pages, and with no
display-versus-input variant.

**Which shell that is belongs to the UI, not the module.** It is
`_ui/{Ui}/_config/config.js`'s `cardClass`, read by every component in that tree.

**How a component obtains `ui`.** A `.vue` may not import the config directly — §6.1 admits
only UI Composables — so one composable per UI relays it, and each page's context composable
re-exports it so a card needs a single import:

```javascript
// _ui/{Ui}/composables/use{Ui}Config.js — the ONE file that imports _config/config.js
import config from 'src/_ui/{Ui}/_config/config'
export function use{Ui}Config () { return config }
```

```javascript
// _ui/{Ui}/composables/{Scope}/{Resource}/{Page}/use{Resource}Context.js
import { use{Ui}Config } from 'src/_ui/{Ui}/composables/use{Ui}Config'

export function use{Resource}Context () {
  const ui = use{Ui}Config()
  // … record / config / pageState, per §6.2
  return { record, config, pageState, pending, ui }
}
```

```html
<script setup>
const { record, pending, ui } = use{Resource}Context()
const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>

<template>
  <q-card flat bordered :class="ui.cardClass">
    <div :class="ui.detailGridClass">
      <div v-for="(line, i) in lines" :key="line.label"
           class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]"
           :style="rowDelay(i)">
        …
      </div>
    </div>
  </q-card>
</template>
```

The token object is a plain frozen module export, not reactive state — reading it in setup
and in the template is safe, and it costs nothing per render. `rowDelay` is a function
returning a fresh object per call, which is fine on a `:style` binding but must never become
a hoisted-looking inline literal in the template (§11 rule 5).

A literal `class="page-card aql-premium-gradient-card"` and a local
`const ROW_STAGGER_MS = 40` both defeat the point: retuning the UI stops being a one-file
change, and a second UI inherits AQL's shell whether or not it wants it.

For `_ui/AQL/` that resolves to `page-card aql-premium-gradient-card` — `flat` drops
Quasar's default shadow so the class's own is the only one, `bordered` supplies the hook the
class refines, `page-card` carries the shared radius token and the entry animation. A second
UI naming a different class in its own `_config/` is not divergence; it is the mechanism.
The rationale for each of AQL's values is
[`_ui/AQL/_config/config.md`](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/_ui/AQL/_config/config.md).

| Part | Token | Rule |
|---|---|---|
| Card | `cardClass` | never a hand-written class string, never a per-module variant |
| Rows | `detail*Class` — `grid` › `line` › `key` + `val` | the shared label/value grid; never rebuilt from raw `row`/`col` |
| Stagger | `detailRowClass` + `:style="rowDelay(i)"`, `rowStaggerMs` | stacked cards animate in step only if every one shares the interval |
| Rhythm | the parent's `q-gutter-y-{gutter}` (§10.2) | vertical spacing belongs to the container, never a `q-mb-*` on the card |

`AqlGroupedList`'s `card-class` is **appearance only** — never put spacing in it. Spacing
goes through its `gutter` prop. A nested list inside a gradient card must be wrapped in
`.aql-grouped-list-body` so it inherits the card's fill/radius rather than painting an
opaque row surface over the gradient.

### 10.2 Spacing — `gutter` vertical, `padding` horizontal

> [!IMPORTANT]
> **`pageProps.gutter` is the only mechanism for spacing BETWEEN sibling surfaces, and it
> is mandatory.** Inline `style` margins, and ad hoc `q-mb-*`/`q-mt-*`/`q-py-*` used to
> push one card away from the next, are **strictly forbidden** — as are one-off
> gradient/shadow values and per-module radius overrides.

**What the ban does not cover.** Spacing *inside* a card is not gutter's job and never was.
These are sanctioned, and a module writes them as shown rather than inventing its own:

| Inside a card | Sanctioned |
|---|---|
| the empty and skeleton shells' own inset | exactly as §10.4 prints them — `q-py-lg`, `q-mb-sm`, `q-mx-auto` |
| padding within a `q-card-section` | Quasar's own `q-pt-*`/`q-pb-*`/`q-ml-*` where a sub-block needs separating from the one above it |
| a horizontal inset on a section root | one declared `padding` prop, below |

The test is what the class is spacing *from*. Pushing a card away from its neighbour is
gutter's job and belongs to the container. Setting a separator's breathing room inside one
card is that card's own composition, and routing it through gutter would couple a card's
internals to the page's rhythm.

```javascript
import { computed, useAttrs } from 'vue'
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
```

`gutter` reaches every placeholder through drilled `pageProps`. Read it via `useAttrs()` —
never `v-bind="$attrs"` onto the root just to get it through (that leaks `Props<Identity>`
object values onto the DOM, §12.2). A component's own `|| 'sm'` fallback fires only when
`gutter` is absent entirely — standalone usage outside page-driven resolution — and is not
meant to agree with `pageProps`' own default.

**Horizontal inset is a separate, declared channel.** A section renders edge-to-edge inside
`.aql-page-body`, so a card that needs to sit inboard of the page edge declares a `padding`
prop and applies it as `q-px-{padding}` (§7.5). This is the *only* sanctioned use of a
Quasar padding class in a module: one declared prop, horizontal axis only, defaulted in the
component and overridable from the contract. Vertical padding still belongs to gutter.

**A card holding siblings passes gutter down explicitly.** `.aql-page-body`'s gutter reaches
the section, never its children, so a card rendering several sub-cards takes `gutter` from
the page contract and spaces them itself — the same way `AqlGroupedList` takes its own.

### 10.3 Per-UI configuration — `_ui/{Ui}/_config/`

> [!IMPORTANT]
> Card shell, radius, gradient, border colour, motion timing, tap-target floor, empty-state
> shell and any other UI-scoped design token live in **one place per UI name**:
>
> ```
> _ui/{Ui}/_config/
> ├─ config.js      machine-readable tokens/classes THIS UI uses (imported by components)
> ├─ config.md      human doc: what this UI's design system is, and why
> └─ style.scss     (optional) the CSS for this UI's own shell, scoped to its identity
> ```
>
> **Both `config.js` and `config.md` are created with the `_ui/{UiName}/` folder itself,
> before its first component.** Every module built under that name inherits its tokens
> purely by being built there. No module hardcodes its own radius/gradient/colour/animation
> values — a module-level override is exactly the divergence §10's uniformity rule forbids.

`config.js` exports the concrete class names and token values this UI's components bind to;
`config.md` is the paired human explanation — what the visual language is, which tokens
exist, and why each holds its value. A value with no stated reason gets reverted by the next
person who finds it inconvenient, which is why the `.md` is not optional.

Components read tokens through their UI Composable (§6.2) rather than importing the config
directly, so retuning one UI's shell stays a one-file change.

**Runtime scoping.** `pageProps.uiName` (§5.4) is known at the page root on every render.
Scoping each `_ui/{Ui}/_config/style.scss` ruleset under a selector keyed to that value —
a `ui-scope-{uiName}` class or a `data-ui-scope` attribute on the page root — makes the
browser's own cascade do the swap: navigating between resources under different UI names
changes the attribute, one UI's rules stop matching and the other's start, with no unload
step and no JavaScript beyond setting the attribute. It requires each `style.scss` imported
once so its rules exist in the bundle, and the page-root wrapper carrying the live `uiName`.
Wiring that is an infrastructure task, not part of generating a module; until it is wired,
a UI's CSS lives in the global stylesheet and its `config.md` records which rules are its
own.

### 10.4 Loading, empty, and hidden — the three quiet states

A card outside `<AqlContentWrapper>` (§9.1's exceptions) owns all three itself. They use one
recipe, not a bespoke one per component.

**Loading** — a skeleton *inside the card shell*, so the surface doesn't appear and reflow
as data lands:

```html
<q-card-section v-if="pending">
  <q-skeleton type="text" width="40%" class="q-mb-sm" />
  <q-skeleton type="text" width="80%" />
</q-card-section>
```

**Empty** — the standard shell → a centered `q-card-section` → an icon at the UI's
`emptyIconSize`/`emptyIconColor` → a bold short subtitle → **a caption line explaining the
empty state in one sentence.** The caption is required: an icon and a bold "No items" says
something is missing; the caption is what says whether that is normal. A larger or darker
icon turns an ordinary empty state into an error.

**Hidden** — a card that renders nothing in a given state uses **`v-if` at the root, never
`v-show`.** A hidden root still occupies a slot in the page body's gutter stack and opens a
blank gap between the cards around it.

Two refinements:

- **Hide while loading, too**, for a card that is conditional on record state. Flashing an
  instruction card in and out on a slow fetch is worse than showing it a moment late.
- **Empty is not always neutral.** A card whose emptiness is *good news* ("every requested
  unit is covered") says so, with a positive icon — the shell is the same, the wording and
  colour follow the meaning.

**Banner vs. card.** A `q-banner` is the one surface that is deliberately *not* the card
shell, and the distinction is what it is talking about:

| | Card | Banner |
|---|---|---|
| States | a fact of its own — this record, these items | a fact **about the cards around it** |
| Examples | identity, contents, disposition, history | "stock is allocated once approved", "cancelled lines write no movement", "editing is disabled in this state" |
| Shell | the UI's `cardClass` | `q-banner rounded dense`, no card class |

Tint follows the same rationing as everything else: neutral (`bg-grey-2`) when it explains a
consequence the reader should know about, warning-tinted only when it explains why something
the reader came to do **will not work**. A banner never carries the card shell, and a card
never does a banner's job — an explanation dressed as a card reads as another item in the
stack, and the reader counts it as data.

### 10.5 Layout rules worth stating explicitly

These recur often enough to name, so a module author reaches for the rule instead of
guessing. Numeric values come from `_config/config.js`.

- **Truncated display text** in a narrow column gets an explicit, reasoned character cap —
  pick the number from the column's actual width and say so in a one-line comment. Don't
  truncate without a reason, and don't leave long text unbounded in a column sized for
  something short.
- **A flex column holding text of unknown length beside a fixed-width figure or button
  cluster** carries the UI's `flexWrapTextClass`. A flex child's implicit `min-width: auto`
  floors it at its longest word, which is what pushes the trailing figures onto a new line
  for a long name.
- **Grouped/repeating controls in a row** cap at `maxControlsPerRow` (three) before
  wrapping, and derive the column width from the item **count**, not a fixed grid — four
  splits 2+2, never 3+1 with a stranded control.
  ```javascript
  // Dynamic Control Grid Partitioning Formula:
  // 1 item -> col-12; 2 or 4 items -> col-6 (2+2); 3 or 5+ items -> col-4 (3+3)
  function binColumnClass (count) {
    if (count <= 1) return 'col-12'
    if (count === 2 || count === 4) return 'col-6'
    return 'col-4'
  }
  ```
- **Hierarchical 3-level tri-state selection trees** (Product › SKU › Storage Bin) in
  delivery or dispatch pickers use `indeterminate-value="null"` on parents:
  ```html
  <q-checkbox :model-value="productState(prod)" :indeterminate-value="null"
              @update:model-value="toggleProduct(prod)" />
  ```
  Toggling a parent sets all descendants; selecting a subset computes an indeterminate state
  automatically.
- **Icon-only controls** meet `minTapTargetPx` and carry an `aria-label`. **A tooltip does
  not satisfy this** — it is invisible to a screen reader and to a touch user who cannot
  hover, so a `q-tooltip` is an addition to the label, never a substitute. Note that the
  UI's `rowActionBtnProps` preset supplies **neither**: adopting the shared button
  presentation leaves both obligations open on every button.
- **Apply `minTapTargetPx` from the token, not a literal.** Bind the UI's `tapTargetStyle`
  rather than writing `style="min-width: 40px; min-height: 40px"` — a hardcoded pair is the
  per-module override §10.3 forbids, and it silently stops tracking the UI that owns the
  number. Sizing bound from a token is not what §10.2's inline-style ban is about; that ban
  is about spacing.
  ```html
  <q-btn outline round icon="remove" padding="none" :style="ui.tapTargetStyle" … />
  ```
- **A primary, flow-anchoring input** — the one field the screen exists to collect — is
  never `dense`. Reserve `dense` for secondary and read-mostly fields; a dense primary field
  ends up smaller than the buttons flanking it.
- **Chips carry state; figures are text — and a count of records *in* a state is a state
  legend, so it may be a chip.** The distinction is whether the number is a *reading* or a
  *value the user is changing*: `3 fully covered / 1 partial / 2 unallocated` is a legend
  over three states and belongs in chips; the running `12 of 40 units` the same user is
  driving upward is plain text at a larger weight. Two adjacent numbers can legitimately get
  different treatments for this reason.
- **Disable rather than hide an inapplicable inline control** — *when its question still
  stands.* The two cases:

  | | Treatment |
  |---|---|
  | The question stands, the answer is currently unavailable (nothing left to cancel, no rows to act on) | **disable** — a present-but-inert control reads honestly; an enabled one that silently does nothing does not |
  | The question has become meaningless (a submission comment while the record is being saved as a draft — there is no reader for it yet) | **hide** — asking and then withdrawing the question reads as the card changing its mind, and a disabled field still says "you should have something to put here" |

  Also don't toggle a row's presence inside a block being actively edited: a block that
  gains or loses a row as numbers change shifts the inputs under the user's cursor mid-edit.
  Render it always and disable it instead.
- **A one-click control that computes a result the user did not specify states its rule on
  screen**, in one caption beneath it — "empties the smallest bins first", "fills from the
  nearest warehouse". An auto-fill the user cannot predict is one they have to undo and redo
  by hand to trust, which costs more than the button saved.
- **State the operator when a card shows arithmetic.** A header reading `12 + 3 = 15` says
  strictly more than a `+3` chip, and costs one row.

### 10.6 Other styling rules

- No `<style>` block in any resolver-backed component — a tenant `.vue` override cannot
  inherit a scoped style, so scoped CSS silently breaks the override contract.
- No `QTable` for record lists — horizontal scroll on mobile. Use stacked cards/lists.
- Every animation must honour `@media (prefers-reduced-motion: reduce)`.
- Dynamic colours go through a CSS custom property, not per-colour class variants.
- A colour named in a `var()` must be one the build actually defines. Quasar publishes brand
  variables only for `primary`, `secondary`, `accent`, `dark`, `positive`, `negative`,
  `info` and `warning` — anything else needs a literal fallback (e.g.
  `var(--q-orange, #ff9800)`) or it resolves to nothing.

---


---

⬑ Back to **[3-Layer UI — Resource UI Module Developer Guide](UI_MODULE_DEVELOPER_GUIDE.md)**.
