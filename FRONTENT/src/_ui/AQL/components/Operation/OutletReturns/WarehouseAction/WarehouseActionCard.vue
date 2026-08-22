<template>
  <div :class="gutterClass">
    <!-- The return has moved on since the link was opened. Said ABOVE the form rather than
         failing at the sticky bar after a disposal reason has been typed. -->
    <q-banner v-if="record && !eligible" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      {{ blockedMessage }}
    </q-banner>

    <!-- Read-only context. The operator is deciding what to do with physical units in front
         of them, so the card states which units, from where, and why they came back. -->
    <SectionDividerLabel label="RETURNED STOCK" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-medium">{{ skuName || '—' }}</div>
            <div class="text-caption text-grey-8">
              {{ outletName }}<template v-if="reasonText"> • {{ reasonText }}</template>
            </div>
          </div>
          <div class="col-auto text-right">
            <div class="text-h6 text-weight-bold">{{ quantity }}</div>
            <div class="text-caption text-grey-8">units</div>
          </div>
        </div>
        <div v-if="reasonComment" class="q-mt-sm text-body2" style="white-space: pre-line">
          {{ reasonComment }}
        </div>
      </q-card-section>
    </q-card>

    <!-- The decision. -->
    <SectionDividerLabel label="DISPOSITION" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <q-option-group
          :model-value="actionType"
          :options="actionOptions"
          color="primary"
          type="radio"
          @update:model-value="setActionType"
        />

        <div class="text-caption text-grey-8">{{ dispositionCaption }}</div>

        <!-- Stocked: which bin the units land in. -->
        <FieldTextAdd
          v-if="isStocked"
          :model-value="storageName"
          :record="{}"
          :config="{ label: 'Storage Bin' }"
          header="StorageName"
          @update:model-value="setStorageName"
        />

        <!-- Disposed: why they were written off. Mandatory — a write-off nobody can account
             for later is worse than no write-off at all. -->
        <FieldTextareaAdd
          v-if="!isStocked"
          :model-value="disposalReason"
          :record="{}"
          :config="{ label: 'Disposal Reason *', rows: 3 }"
          header="WarehouseActionDisposedReason"
          @update:model-value="setDisposalReason"
        />
      </q-card-section>
    </q-card>

    <!-- What the commit will do to the two ledgers, stated before it happens. -->
    <q-banner v-if="eligible" dense rounded class="bg-blue-1 text-body2">
      <template #avatar><q-icon name="info" color="primary" /></template>
      {{ outcomeText }}
    </q-banner>
  </div>
</template>

<script setup>
/**
 * OutletReturns › WarehouseAction › WarehouseActionCard — the whole action route's content.
 *
 * Confirms what physically became of units that left an outlet shelf: they either went into
 * a warehouse bin, or they were written off. The two answers write different columns and
 * only one of them touches warehouse stock, which is why the card says which before the
 * operator commits.
 *
 * This card is the HYDRATION POINT (§5.5): an `_action` route has no `Create`/`Update`
 * content to seed the node, so `onMounted` here seeds the control fields the sticky bar
 * reads back and preloads the master rows the context lines need.
 *
 * Eligibility is `canConfirmWarehouseAction`, the same predicate that decides whether the
 * FAB offers this route at all and that `PageAction.js` re-checks on submit — three
 * consumers, one rule (§8.6).
 *
 * Navigation and submission belong to the sticky bar. This card collects; it never
 * dispatches (§8.3).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import FieldTextAdd from 'src/_fields/text/Add.vue'
import FieldTextareaAdd from 'src/_fields/textarea/Add.vue'
import { useReturnFormContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormContext'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import {
  STOCKED,
  DISPOSED,
  canConfirmWarehouseAction,
  warehouseActionCompleted,
  warehouseActionRequired,
  isCancelled,
  reasonLabel
} from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

defineOptions({ name: 'OutletReturnsWarehouseActionCard', inheritAttrs: false })

const NODE = 'OutletReturns'
const DEFAULT_STORAGE = '_default'

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, resourceRecord, resource, ui } = useReturnFormContext()

// Opened through the relay so the master rows are in the store before the lines below read
// them — the card renders names, not codes.
const outlets = resource('Outlets')
const skus = resource('SKUs')
const products = resource('Products')
const warehouses = resource('Warehouses')

const { getOutlet } = useOutletResource()
const { skuLabelText } = useSkuResource()
const { getWarehouse } = useWarehouseResource()

const text = (value) => (value == null ? '' : String(value).trim())

const record = computed(() => resourceRecord?.record?.value || null)

const eligible = computed(() => !!record.value && canConfirmWarehouseAction(record.value))

const blockedMessage = computed(() => {
  const row = record.value
  if (!row) return ''
  if (isCancelled(row)) return 'This return was cancelled — there is no warehouse action to confirm.'
  if (!warehouseActionRequired(row)) return 'This return moves no physical stock, so there is nothing for a warehouse to confirm.'
  if (warehouseActionCompleted(row)) return 'The warehouse action on this return has already been confirmed.'
  return 'This return no longer needs a warehouse action.'
})

// ─── Context lines ────────────────────────────────────────────────────────────

const outletName = computed(() => {
  const code = text(record.value?.OutletCode)
  if (!code) return ''
  return text(getOutlet(code)?.Name) || code
})

const skuName = computed(() => {
  const code = text(record.value?.SKU)
  if (!code) return ''
  return text(skuLabelText(code)) || code
})

const warehouseName = computed(() => {
  const code = text(record.value?.WarehouseCode)
  if (!code) return ''
  return text(getWarehouse(code)?.Name) || code
})

const quantity = computed(() => Math.abs(Number(record.value?.Qty) || 0))
const reasonText = computed(() => reasonLabel(record.value?.Reason))
const reasonComment = computed(() => text(record.value?.ReasonComment))

// ─── The decision ─────────────────────────────────────────────────────────────

const actionOptions = [
  { label: 'Stocked — received back into the warehouse', value: STOCKED },
  { label: 'Disposed — written off, not re-stocked', value: DISPOSED }
]

const actionType = computed(() => pageState?.getControlField(NODE, 'WarehouseActionType') || STOCKED)
const isStocked = computed(() => actionType.value === STOCKED)
const storageName = computed(() => pageState?.getControlField(NODE, 'WarehouseStorageName') || '')
const disposalReason = computed(() => pageState?.getControlField(NODE, 'WarehouseDisposalReason') || '')

const setActionType = (value) => pageState?.setControlField(NODE, 'WarehouseActionType', value)
const setStorageName = (value) => pageState?.setControlField(NODE, 'WarehouseStorageName', value)
const setDisposalReason = (value) => pageState?.setControlField(NODE, 'WarehouseDisposalReason', value)

const dispositionCaption = computed(() => isStocked.value
  ? `Adds ${quantity.value} units back to ${warehouseName.value || 'the target warehouse'}.`
  : 'Writes the units off. No warehouse stock is added.')

/**
 * What the commit will actually do, including whether it closes the return.
 *
 * The completion half is worth saying out loud: an operator confirming the physical side of
 * a return that also owes an invoice credit should not be surprised that it stays open.
 */
const outcomeText = computed(() => {
  const row = record.value
  if (!row) return ''
  const ledger = isStocked.value
    ? `${quantity.value} units will be added to ${warehouseName.value || 'the warehouse'}.`
    : 'No stock movement will be written.'
  const stillOwed = text(row.InvoiceAdjustmentRequired).toUpperCase() === 'TRUE' &&
    text(row.InvoiceAdjustmentDone).toUpperCase() !== 'TRUE'
  const closing = stillOwed
    ? 'The return stays open until the invoice credit is settled.'
    : 'This closes the return.'
  return `${ledger} ${closing}`
})

onMounted(async () => {
  // Control fields only — this route changes no field the user typed into a form, so the
  // node holds working state and nothing else (§13.5).
  pageState.setControlField(NODE, 'WarehouseActionType', STOCKED)
  pageState.setControlField(NODE, 'WarehouseStorageName', DEFAULT_STORAGE)
  pageState.setControlField(NODE, 'WarehouseDisposalReason', '')

  await Promise.all([outlets, skus, products, warehouses].map((res) => res.reload()))
})
</script>
