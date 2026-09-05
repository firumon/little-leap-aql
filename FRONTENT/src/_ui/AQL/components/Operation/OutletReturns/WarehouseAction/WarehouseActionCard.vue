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
        <!-- The item names itself in full; the count sits beside it with its own UOM, so a
             long product name never squeezes the figure out of the row. -->
        <div class="row items-start no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-medium">{{ skuName || '—' }}</div>
          </div>
          <div class="col-auto text-right text-h6 text-weight-bold no-wrap">
            {{ quantity }} {{ uomCode }}
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section>
        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in contextLines"
            :key="line.label"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <div :class="ui.detailKeyClass">{{ line.label }}</div>
            <div :class="ui.detailValClass" style="white-space: pre-line">{{ line.value }}</div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- The decision. -->
    <SectionDividerLabel label="DISPOSITION" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <q-option-group
          v-model="actionType"
          :options="actionOptions"
          color="primary"
          type="radio"
        />

        <div class="text-caption text-grey-8">{{ dispositionCaption }}</div>

        <!-- Stocked: which bin the units land in. -->
        <FieldTextAdd
          v-if="isStocked"
          v-model="storageName"
          :record="{}"
          :config="{ label: 'Storage Bin' }"
          header="StorageName"
        />

        <!-- Disposed: why they were written off. Mandatory — a write-off nobody can account
             for later is worse than no write-off at all. -->
        <FieldTextareaAdd
          v-if="!isStocked"
          v-model="disposalReason"
          :record="{}"
          :config="{ label: 'Disposal Reason *', rows: 3 }"
          header="WarehouseActionDisposedReason"
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
// Confirm what became of units that left an outlet shelf: stocked into a warehouse bin, or
// written off. This card is the HYDRATION POINT — it mounts the node and preloads masters.
// No `<style>` block (ARCHITECTURE RULES §7).
import { computed, onMounted, watch, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import FieldTextAdd from 'src/_fields/text/Add.vue'
import FieldTextareaAdd from 'src/_fields/textarea/Add.vue'
import { useReturnFormContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormContext'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { useAuth } from 'src/composables/core/useAuth'
import { buildReturnWarehouseActionInitNodes } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
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
const { skuLabelText, skuLabelOf } = useSkuResource()
const { getWarehouse } = useWarehouseResource()
const { user } = useAuth()

const text = (value) => (value == null ? '' : String(value).trim())

const node = pageState.useNode(NODE)
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
  return text(getWarehouse(code)?.name) || code
})

const quantity = computed(() => Math.abs(Number(record.value?.Qty) || 0))

// The SKU's own unit of measure, from the one function that names a SKU anywhere.
const uomCode = computed(() => skuLabelOf(text(record.value?.SKU)).uom)

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
// Outlet, Reason and Reason Comment are the three facts the operator judges by, so each
// gets its own labelled row rather than being packed into a caption.
const contextLines = computed(() => [
  { label: 'Outlet', value: outletName.value },
  { label: 'Reason', value: reasonLabel(record.value?.Reason) },
  { label: 'Reason Comment', value: text(record.value?.ReasonComment) },
  { label: 'Target Warehouse', value: warehouseName.value }
].filter((line) => String(line.value ?? '').trim()))

// ─── The decision ─────────────────────────────────────────────────────────────

const actionOptions = [
  { label: 'Stocked — received back into the warehouse', value: STOCKED },
  { label: 'Disposed — written off, not re-stocked', value: DISPOSED }
]

// Every answer is a column on the return, so it binds to the live node, not to controls.
const actionType = pageState.useRecord('WarehouseAction', NODE)
const storageName = pageState.useRecord('StorageName', NODE)
const disposalReason = pageState.useRecord('WarehouseActionDisposedReason', NODE)

const isStocked = computed(() => actionType.value !== DISPOSED)

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

// The disposition, its stamp pair and the warehouse receipt node are all mounted by Layer 2
// and follow the operator's choice from here on. Keyed on the record LANDING, because the
// page contract's `ready` has already flushed whatever the previous page left behind.
watch(record, (row) => {
  const code = text(row?.Code)
  // The contract's `ready` already flushed the previous page, so a plain attach is enough —
  // a second `reset` here would detach the nodes this same pass is about to create.
  if (!code || pageState.hasNode(NODE)) return
  pageState.initResource(NODE, { isPrimaryKey: true, code })
  pageState.applyNodes(buildReturnWarehouseActionInitNodes({
    record: row,
    actorName: text(user.value?.name || user.value?.email)
  }))
}, { immediate: true })

onMounted(async () => {
  await Promise.all([outlets, skus, products, warehouses].map((res) => res.reload()))
})
</script>
