<template>
  <q-card flat bordered class="page-card aql-premium-gradient-card">
    <!-- PRODUCT HEADER — name | actions | totals, on one line.
         `no-wrap` keeps the three regions on the same row; the name column carries
         `min-width: 0` so it may SHRINK. Without that a flex item's implicit
         `min-width: auto` floors it at its longest word, which is what pushes the
         actions and totals onto a new line for a long product name. -->
    <q-card-section class="q-pb-none">
      <div class="row items-center no-wrap q-col-gutter-sm">
        <div class="col aql-flex-wrap-text">
          <div class="text-subtitle1 text-weight-medium">{{ group.productName }}</div>
        </div>

        <!-- Actions sit BEFORE the totals: they act on the numbers to their right,
             so reading order matches cause then effect. -->
        <div class="col-auto row items-center no-wrap q-gutter-xs">
          <q-btn
            flat
            dense
            color="primary"
            icon="bolt"
            :disable="!canAllocate"
            :data-testid="`restock-approve-auto-product-${group.productCode}`"
            @click="$emit('allocate', group.productCode)"
          />
          <q-btn
            flat
            dense
            color="grey-7"
            icon="restart_alt"
            :disable="!group.allocated"
            :data-testid="`restock-approve-clear-product-${group.productCode}`"
            @click="$emit('clear', group.productCode)"
          />
        </div>
        <q-space />
        <!-- Plain text, no chip: this is a running total the approver watches
             change, and a chip reads as a status badge rather than a figure. -->
        <div class="col-auto text-right">
          <div class="text-subtitle1 text-weight-bold" :class="totalClass">{{ group.allocated }} / {{ group.requested }} {{ group.uom }}</div>
        </div>
      </div>
    </q-card-section>

    <!-- One block per SKU. Allocation is per SKU because that is what a bin
         holds; the product above is only how the request is read. -->
    <q-card-section v-for="sku in group.skus" :key="sku.code" class="q-pt-sm">
      <q-separator class="q-mb-sm" />

      <!-- SKU SUB-HEADER — variant on the left, requested + status on the right. -->
      <div class="row items-center no-wrap q-col-gutter-sm q-mb-sm">
        <div class="col aql-flex-wrap-text">
          <div class="text-body2 text-weight-medium">{{ sku.variantLabel }}</div>
        </div>
        <!-- Status as an icon beside the figures, not a second line of prose: the
             figures already say how much, so the icon only has to say how that
             reads — and it does so without adding a row to every SKU block. -->
        <div class="col-auto row items-center no-wrap q-gutter-xs">
          <div class="text-body2 text-weight-medium">{{ sku.allocated }} / {{ sku.requested }} {{ sku.uom }}</div>
          <q-icon :name="statusIcon(sku)" :class="statusClass(sku)" size="18px">
            <q-tooltip>{{ statusLabel(sku) }}</q-tooltip>
          </q-icon>
        </div>
      </div>

      <div v-if="!sku.visibleBins.length" class="text-caption text-grey-6 q-py-xs">
        No warehouse stock is recorded for this SKU in the selected warehouses.
        Turn on “Show stock outside the selected warehouses” to look further, or
        leave the shortfall pending.
      </div>

      <!-- BIN GRID — at most three inputs per row, evenly divided. The column
           width is derived from the bin COUNT rather than fixed, so four bins
           split 2+2 instead of leaving a lone input stranded on a second row. -->
      <div v-else class="row q-col-gutter-sm">
        <div
          v-for="bin in sku.visibleBins"
          :key="bin.id"
          :class="binColumnClass(sku.visibleBins.length)"
        >
          <component
            :is="QtyField"
            :model-value="quantityIn(sku, bin)"
            :config="binFieldConfig(sku, bin)"
            @update:model-value="(value) => $emit('quantity', sku.code, bin, value)"
          />
        </div>
      </div>

      <!-- SHORTFALL — always rendered, so the block's height never changes as the
           numbers move. Toggling `v-if` on the remainder made every SKU jump by a
           row the moment it became fully covered, which shifted the bin inputs
           under the cursor mid-edit.

           The toggle is DISABLED rather than hidden when there is nothing left
           over: a control that is present but inert reads honestly, where an
           enabled one that silently does nothing does not. -->
      <div class="row items-center no-wrap q-gutter-sm q-mt-sm">
        <q-toggle
          :model-value="sku.cancelled"
          dense
          color="negative"
          :disable="sku.remainder <= 0"
          :data-testid="`restock-approve-cancel-${sku.code}`"
          @update:model-value="(value) => $emit('cancel', sku.code, value)"
        />
        <div class="col text-caption" :class="shortfallClass(sku)">{{ shortfallText(sku) }}</div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
/**
 * One PRODUCT's allocation card — the body of step 1's item list.
 *
 * Purely presentational: it owns no state and performs no arithmetic. Every
 * figure arrives already computed on the `group` projection, and every control
 * emits upward so `ItemAllocating.vue` routes it into `useRestockApproval`
 * (ARCHITECTURE RULES §5/§6). That is what keeps the numbers here identical to
 * the ones step 2 reviews and the payload carries.
 *
 * Split out of `ItemAllocating.vue` so the list stays a thin `v-for` and the card
 * itself is independently overridable at any of the 10 `_ui/` tiers.
 */
import { computed } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'

defineOptions({ name: 'OutletRestocksApproveSkuAllocatingCard', inheritAttrs: false })

const props = defineProps({
  // { productCode, productName, skus[], requested, allocated, remainder }
  group: { type: Object, required: true }
})

defineEmits(['allocate', 'clear', 'quantity', 'cancel'])

// Resolved once — the field registry is eager, so this is synchronous and the
// inputs never flash empty (UI_MODULE_DEVELOPER_GUIDE.md §2.3).
const QtyField = resolveFieldComponent('number', 'add')

// Truncated hard, because the label sits in a third-width column: an untruncated
// warehouse + storage pair wraps to three lines and breaks the grid's even rhythm.
const LABEL_MAX = 8

function short (value) {
  const text = String(value ?? '').trim()
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX)}…` : text
}

// The field controls declare `inheritAttrs: false` and do not re-bind `$attrs`
// (matching `_fields/select/`), so a plain attribute on the placeholder is
// dropped. `config` IS spread onto the inner control, which is why the test hook
// travels there rather than as a bare attribute.
function binFieldConfig (sku, bin) {
  // NOT `dense`. The bin quantities are the decision this page exists to record, and
  // a dense field made the primary control the smallest thing on the card. Standard
  // height also matches the inputs on every other page in the restock flow.
  return {
    label: `${short(bin.warehouseName)}: ${short(bin.storageName)}`,
    min: 0,
    hideBottomSpace: true,
    inputClass: 'text-right',
    // An outside bin is shown for reference only — allocation never draws from a
    // warehouse the approver has not selected.
    disable: bin.outside,
    suffix: `/${bin.available}`,
    'data-testid': `restock-approve-qty-${sku.code}-${bin.id}`
  }
}

/**
 * Column width from bin count — at most three per row, always evenly divided.
 *   1 → 12 | 2 → 6+6 | 3 → 4+4+4 | 4 → 6+6 over two rows | 5,6+ → 4+4+4
 * Four splits 2+2 rather than 3+1 so no row is left with a single stranded input.
 */
function binColumnClass (count) {
  if (count <= 1) return 'col-12'
  if (count === 2 || count === 4) return 'col-6'
  return 'col-4'
}

// The plan is keyed by bin, so an input reads its own line back rather than
// tracking a parallel per-input ref.
function quantityIn (sku, bin) {
  return sku.lines.find((line) => line.key === bin.id)?.quantity ?? 0
}

const canAllocate = computed(() =>
  props.group.skus.some((sku) => sku.visibleBins.length && sku.remainder > 0 && !sku.cancelled)
)

const totalClass = computed(() => {
  if (props.group.allocated === 0) return 'text-grey-6'
  return props.group.allocated >= props.group.requested ? 'text-positive' : 'text-warning'
})

// `cancelled` is checked FIRST in both: a cancelled line is a settled decision,
// and reporting it as merely "not allocated" would hide that the shortfall has
// already been written off.
function statusIcon (sku) {
  if (sku.cancelled) return 'cancel'
  if (sku.status === 'full') return 'check_circle'
  if (sku.status === 'partial') return 'pie_chart'
  return 'remove_circle_outline'
}

function statusClass (sku) {
  if (sku.cancelled) return 'text-negative'
  if (sku.status === 'full') return 'text-positive'
  if (sku.status === 'partial') return 'text-warning'
  return 'text-grey-6'
}

// Kept as the icon's tooltip — the icon carries the meaning at a glance, and this
// is what makes it readable to anyone who does not already know the palette.
function statusLabel (sku) {
  if (sku.cancelled) return 'Cancelled'
  if (sku.status === 'full') return 'Fully allocated'
  if (sku.status === 'partial') return 'Partially allocated'
  return 'Not allocated'
}

function shortfallText (sku) {
  if (sku.remainder <= 0) return 'Fully covered — nothing left pending.'
  return sku.cancelled
    ? `Cancelling ${sku.remainder} ${sku.uom}`
    : `Keep ${sku.remainder} ${sku.uom} pending`
}

function shortfallClass (sku) {
  if (sku.remainder <= 0) return 'text-grey-5'
  return sku.cancelled ? 'text-negative' : 'text-grey-7'
}
</script>
