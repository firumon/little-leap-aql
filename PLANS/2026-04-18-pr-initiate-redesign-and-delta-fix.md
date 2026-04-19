# PR Initiate Redesign + Delta Sync Fix

**Date:** 2026-04-18  
**Scope:** GAS backend bug fix, hero.scss additions, InitiatePurchaseRequisitionsPage.vue full cleanup, RecordReviewPurchaseRequisitionPage.vue appOptions fix

---

## Context

`InitiatePurchaseRequisitionsPage.vue` was partially redesigned but has:
- ~250 lines of scoped CSS with `pri-` prefix (duplicates hero.scss)
- Hardcoded `types` and `priorities` arrays (should come from `appOptionsMap`)
- Native HTML date input (should be q-date popup)
- Hero card width not matching section cards
- Step 2 missing sort controls and warehouse scope toggle; shows product code instead of totalStock
- Post-save delta sync returns empty — newly created PRs invisible until full refresh

`RecordReviewPurchaseRequisitionPage.vue` also hardcodes types/priorities.

GAS bug: `masterApi.gs` early-exit at lines 20–26 uses stale `resource.config.lastDataUpdatedAt` which causes delta GET to return empty rows immediately after `compositeSave`.

---

## Files Touched

| File | Change Type |
|------|-------------|
| `GAS/masterApi.gs` | Bug fix — early-exit condition |
| `FRONTENT/src/css/hero.scss` | Additions — stepper + sel-btn classes |
| `FRONTENT/src/pages/Operations/PurchaseRequisitions/InitiatePurchaseRequisitionsPage.vue` | Full cleanup |
| `FRONTENT/src/pages/Operations/PurchaseRequisitions/RecordReviewPurchaseRequisitionPage.vue` | appOptions fix only |

---

## Step 1 — GAS: Fix Delta Sync Early-Exit (`masterApi.gs`)

### Root Cause

Lines 20–26 in `masterApi.gs`:
```js
if (
  lastUpdatedAt &&
  resource.config.lastDataUpdatedAt &&
  lastUpdatedAt.getTime() >= resource.config.lastDataUpdatedAt
) {
  return buildMasterRowsResponse(auth, resourceName, resource, [], lastUpdatedAt, headers);
}
```

`resource.config.lastDataUpdatedAt` is a **static config value** set at sheet-init time. It is never updated after `compositeSave` writes a new row. After the first successful sync, `lastUpdatedAt` (client cursor) equals or exceeds this stale value, triggering an early-exit that returns zero rows — making newly created records invisible.

### Fix

Remove the early-exit block entirely. The row-level filter at lines 58–62 already handles delta correctly:
```js
if (!updatedDate || updatedDate.getTime() <= lastUpdatedAt.getTime()) continue;
```

This is the safe, correct filter. The early-exit block is a micro-optimisation that causes correctness failures and must be removed.

**Action:** Delete lines 20–26 (the early-exit `if` block) from `masterApi.gs`.

---

## Step 2 — hero.scss: Add Reusable Classes

Add the following blocks to `hero.scss`. Follow `quasar.variables.scss` variable conventions. Do NOT conflict with any Quasar class names.

### 2a. Stepper Row

```scss
// ── Step indicator ──────────────────────────────────────────────────────────
.step-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 20px 24px 0;
}

.step-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.step-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  border: 2px solid rgba(white, 0.25);
  color: rgba(white, 0.5);
  transition: background 0.2s, border-color 0.2s, color 0.2s;

  &.is-done {
    background: rgba($secondary, 0.85);
    border-color: $secondary;
    color: $primary;
  }

  &.is-active {
    background: $secondary;
    border-color: $secondary;
    color: $primary;
  }
}

.step-label {
  font-size: 11px;
  font-weight: 500;
  color: rgba(white, 0.5);
  white-space: nowrap;

  .is-active ~ &,
  .step-node.is-active & { color: $secondary; }
  .step-node.is-done & { color: rgba(white, 0.75); }
}

.step-line {
  flex: 1;
  height: 2px;
  background: rgba(white, 0.15);
  margin: 0 8px;
  margin-bottom: 18px; // visually align to circle centre

  &.is-done { background: rgba($secondary, 0.6); }
}
```

### 2b. Light-Surface Selector Buttons (type / priority selectors)

```scss
// ── Light-surface selector grid ────────────────────────────────────────────
.sel-grid {
  display: grid;
  gap: 8px;
}

.sel-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 8px;
  border-radius: $r-sm;
  border: 1.5px solid $border;
  background: $surface;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  color: $ink-2;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  user-select: none;

  .sel-btn__icon {
    font-size: 20px;
    color: $ink-muted;
    transition: color 0.15s;
  }

  &:hover {
    border-color: $primary-100;
    background: $primary-50;
  }

  &.is-active {
    border-color: var(--sel-color, #{$primary});
    background: var(--sel-bg, #{$primary-50});
    color: var(--sel-color, #{$primary});
    box-shadow: 0 0 0 3px var(--sel-ring, #{$primary-100});

    .sel-btn__icon { color: var(--sel-color, #{$primary}); }
  }
}

// Row-direction variant (e.g. priority buttons)
.sel-btn--row {
  flex-direction: row;
  justify-content: flex-start;
  gap: 8px;
  padding: 10px 14px;
}
```

---

## Step 3 — `InitiatePurchaseRequisitionsPage.vue`: Full Cleanup

### 3a. appOptions — Types and Priorities

Remove hardcoded `types` and `priorities` arrays.

```js
// Remove these:
const types = [{ label:'Stock', value:'STOCK', icon:'inventory_2' }, ...]
const priorities = [{ label:'Low', value:'Low', hex:'#1A7A4A', bg:'#E8F6EE' }, ...]

// Replace with:
import { useAuthStore } from 'src/stores/auth'
const auth = useAuthStore()

const TYPE_META = {
  STOCK:   { icon: 'inventory_2',  color: '#0F2B4A', bg: '#EEF3F9', ring: '#D0DEF0' },
  PROJECT: { icon: 'architecture',  color: '#1A6FAD', bg: '#E8F2FB', ring: '#BDD9F0' },
  SALES:   { icon: 'storefront',    color: '#1A7A4A', bg: '#E8F6EE', ring: '#B8E4CB' },
  ASSET:   { icon: 'build_circle',  color: '#C97B1A', bg: '#FDF3E3', ring: '#F5D9A0' },
}

const PRIORITY_META = {
  Low:    { icon: 'arrow_downward', color: '#1A7A4A', bg: '#E8F6EE' },
  Medium: { icon: 'remove',         color: '#C97B1A', bg: '#FDF3E3' },
  High:   { icon: 'arrow_upward',   color: '#C0362C', bg: '#FBE9E8' },
  Urgent: { icon: 'priority_high',  color: '#7B1FA2', bg: '#F5E5FB' },
}

const types = computed(() =>
  (auth.appOptionsMap['PurchaseRequisitionType'] || []).map(v => ({
    value: v,
    label: v.charAt(0) + v.slice(1).toLowerCase(),
    ...TYPE_META[v],
  }))
)

const priorities = computed(() =>
  (auth.appOptionsMap['PurchaseRequisitionPriority'] || []).map(v => ({
    value: v,
    label: v,
    ...PRIORITY_META[v],
  }))
)
```

### 3b. Hero Card Width — Match Section Cards

The hero card must have the same horizontal margin/padding as the section cards below it so widths visually align.

In the template, the hero card and `q-page` body wrapper must use the same `max-width` and side padding. Use `q-mx-auto` (Quasar utility) and a consistent padding class — do not add custom margin CSS to `.hero-card` directly as it would affect all hero cards.

Wrap the whole page content in a single column:
```html
<div class="pr-init-page">
  <!-- hero card -->
  <div class="hero-card pr-init-hero"> ... </div>
  <!-- step body -->
  <div class="pr-init-body"> ... section-cards ... </div>
</div>
```

Scoped CSS (minimal):
```scss
.pr-init-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 0 16px 32px;
}
.pr-init-hero {
  border-radius: $r-xl $r-xl 0 0;
  margin-bottom: 0;
}
.pr-init-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}
```

### 3c. Stepper — Use hero.scss Classes

Replace any `pri-stepper` / `pri-step-*` scoped classes with the new `.step-row`, `.step-node`, `.step-circle`, `.step-line`, `.step-label` from hero.scss.

Bind `.is-active` and `.is-done` dynamically:
```html
<div class="step-row">
  <template v-for="(s, i) in steps" :key="s.key">
    <div class="step-node" :class="{ 'is-active': currentStep === s.n, 'is-done': currentStep > s.n }">
      <div class="step-circle" :class="{ 'is-active': currentStep === s.n, 'is-done': currentStep > s.n }">
        <q-icon v-if="currentStep > s.n" name="check" size="14px" />
        <span v-else>{{ s.n }}</span>
      </div>
      <span class="step-label">{{ s.label }}</span>
    </div>
    <div v-if="i < steps.length - 1" class="step-line" :class="{ 'is-done': currentStep > s.n }" />
  </template>
</div>
```

### 3d. Type Selector — Use sel-grid + sel-btn

```html
<div class="sel-grid" style="grid-template-columns: repeat(4, 1fr)">
  <button
    v-for="t in types" :key="t.value"
    class="sel-btn"
    :class="{ 'is-active': form.Type === t.value }"
    :style="{ '--sel-color': t.color, '--sel-bg': t.bg, '--sel-ring': t.ring }"
    @click="form.Type = t.value"
  >
    <q-icon :name="t.icon" class="sel-btn__icon" />
    {{ t.label }}
  </button>
</div>
```

### 3e. Priority Selector — Use sel-btn--row

```html
<div class="sel-grid" style="grid-template-columns: 1fr 1fr">
  <button
    v-for="p in priorities" :key="p.value"
    class="sel-btn sel-btn--row"
    :class="{ 'is-active': form.Priority === p.value }"
    :style="{ '--sel-color': p.color, '--sel-bg': p.bg, '--sel-ring': p.bg }"
    @click="form.Priority = p.value"
  >
    <q-icon :name="p.icon" class="sel-btn__icon" />
    {{ p.label }}
  </button>
</div>
```

### 3f. Date Input — q-date Popup

Replace `<q-input type="date">` with a readonly display input + popup proxy:

```html
<q-input
  :model-value="form.RequiredDate"
  readonly
  outlined
  dense
  label="Required Date"
  class="field-input"
>
  <template #append>
    <q-icon name="event" class="cursor-pointer">
      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
        <q-date
          v-model="form.RequiredDate"
          mask="YYYY-MM-DD"
          :options="d => d >= today"
        >
          <div class="row items-center justify-end">
            <q-btn v-close-popup label="Close" color="primary" flat />
          </div>
        </q-date>
      </q-popup-proxy>
    </q-icon>
  </template>
</q-input>
```

Add to script:
```js
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/')
```

### 3g. Step 2 — Sort Controls + Warehouse Toggle

Restore the two controls above the items list:

```html
<!-- Sort toggle -->
<q-btn-toggle
  v-model="itemSort"
  toggle-color="primary"
  :options="[
    { label: 'By Product Qty', value: 'product' },
    { label: 'By SKU Qty', value: 'sku' },
  ]"
  unelevated
  dense
  rounded
/>

<!-- Warehouse scope toggle -->
<div class="row items-center gap-sm">
  <span class="field-label">Selected WH only</span>
  <q-toggle v-model="filterBySelectedWh" color="primary" dense />
</div>
```

Add to script:
```js
const itemSort = ref('product')
const filterBySelectedWh = ref(false)
```

Sort computed for items:
```js
const sortedItems = computed(() => {
  const list = filterBySelectedWh.value
    ? items.value.filter(i => i.warehouseCode === form.value.WarehouseCode)
    : items.value

  return [...list].sort((a, b) => {
    if (itemSort.value === 'sku') return (b.skuQty ?? 0) - (a.skuQty ?? 0)
    return (b.totalStock ?? 0) - (a.totalStock ?? 0)
  })
})
```

### 3h. Product Row Right Corner — totalStock

Replace product code display with `totalStock`:

```html
<!-- Remove: -->
<span class="sku-badge">{{ item.ProductCode }}</span>

<!-- Add: -->
<span class="hero-meta">
  <q-icon name="inventory_2" size="12px" />
  {{ item.totalStock ?? '—' }}
</span>
```

### 3i. Scoped CSS Target

After all changes, scoped CSS must reduce to ≤35 lines. Permitted scoped classes:

```scss
<style lang="scss" scoped>
@use 'src/css/quasar.variables' as *;

.pr-init-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 0 16px 32px;
}
.pr-init-hero {
  border-radius: $r-xl $r-xl 0 0;
  margin-bottom: 0;
}
.pr-init-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}
</style>
```

All other styling comes from `hero.scss` classes (`section-card`, `field-label`, `action-bar`, `item-row`, `sku-badge`, `num-field`, etc.) and Quasar utilities.

---

## Step 4 — `RecordReviewPurchaseRequisitionPage.vue`: appOptions Fix

Same decorator pattern as Step 3a. Remove hardcoded arrays, import `useAuthStore`, create `TYPE_META` / `PRIORITY_META` maps, derive `types` and `priorities` as computed properties. No CSS changes needed — this file already follows the 12-line scoped CSS standard.

---

## Execution Order

1. `GAS/masterApi.gs` — delete early-exit block (lines 20–26)
2. `hero.scss` — add stepper + sel-btn blocks
3. `InitiatePurchaseRequisitionsPage.vue` — full cleanup (steps 3a–3i)
4. `RecordReviewPurchaseRequisitionPage.vue` — appOptions fix only

---

## Verification

- [ ] Build passes (`quasar build` or `vite build`) — no TS/lint errors
- [ ] Step 1 → type selector renders 4 columns, active state visible with color ring
- [ ] Step 1 → priority shows 2-column row buttons with correct active state
- [ ] Step 1 → date field opens q-date popup, no native browser date input
- [ ] Step 1 → hero card width matches section cards below
- [ ] Step 2 → sort toggle present; switching changes item order
- [ ] Step 2 → warehouse toggle filters items correctly
- [ ] Step 2 → right corner shows totalStock number, not product code
- [ ] Step 3 (Done) → navigate to view page; PR record loads without full-app refresh
- [ ] RecordReview page → type/priority labels render correctly from appOptions
- [ ] No Quasar component styles overridden (inspect `.q-btn`, `.q-input`, etc.)
