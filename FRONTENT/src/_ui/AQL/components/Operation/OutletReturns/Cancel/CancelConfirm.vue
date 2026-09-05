<template>
  <div :class="gutterClass">
    <q-banner v-if="record && !eligible" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      This return has already come to rest and can no longer be cancelled.
    </q-banner>

    <SectionDividerLabel label="CANCELLING" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-medium">{{ skuName || '—' }}</div>
            <div class="text-caption text-grey-8">{{ outletName }}</div>
          </div>
          <div class="col-auto text-right text-h6 text-weight-bold no-wrap">
            {{ quantity }} {{ uomCode }}
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- What physically moves back. Stated first, because it is the part of a cancellation
         people most often get wrong. -->
    <q-banner dense rounded :class="reversalClass">
      <template #avatar><q-icon :name="reversalIcon" :color="reversalColor" /></template>
      {{ reversalText }}
    </q-banner>

    <SectionDividerLabel label="REASON" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <FieldTextareaAdd
          v-model="reason"
          :record="{}"
          :config="{ label: 'Cancellation Reason *', rows: 3 }"
          header="ReasonComment"
        />
        <div class="text-caption text-grey-7 q-mt-xs">
          Saved on the return's Reason Comment for audit.
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// Cancel a return and reverse whatever it moved. The reversal preview leads: a return the
// outlet was credited for ADDED stock to the shelf, so cancelling takes stock back OFF.
// No `<style>` block (ARCHITECTURE RULES §7).
import { computed, onMounted, watch, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import FieldTextareaAdd from 'src/_fields/textarea/Add.vue'
import { useReturnFormContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormContext'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { canCancel } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'
import { storedQtyChange, buildReturnCancelInitNodes } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'

defineOptions({ name: 'OutletReturnsCancelConfirm', inheritAttrs: false })

const NODE = 'OutletReturns'

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, resourceRecord, resource, ui } = useReturnFormContext()

const outlets = resource('Outlets')
const skus = resource('SKUs')
const products = resource('Products')

const { getOutlet } = useOutletResource()
const { skuLabelText, skuLabelOf } = useSkuResource()

const text = (value) => (value == null ? '' : String(value).trim())

const node = pageState.useNode(NODE)
const record = computed(() => resourceRecord?.record?.value || null)
const eligible = computed(() => !!record.value && canCancel(record.value))

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

const quantity = computed(() => Math.abs(Number(record.value?.Qty) || 0))

// The SKU's own unit of measure, from the one function that names a SKU anywhere.
const uomCode = computed(() => skuLabelOf(text(record.value?.SKU)).uom)

/**
 * The movement the cancellation will write — the exact inverse of what creation wrote.
 *
 * `storedQtyChange` reads the truth table off the stored flags; the batch negates it. Both
 * sides of the reversal therefore come from one function, which is what makes it balance.
 */
const reversal = computed(() => -storedQtyChange(record.value))

const reversalText = computed(() => {
  const change = reversal.value
  if (!change) return 'No stock movement was written when this return was logged, so nothing moves back.'
  return change > 0
    ? `${Math.abs(change)} units will be added back to the outlet shelf, reversing the removal this return recorded.`
    : `${Math.abs(change)} units will be taken back off the outlet shelf, reversing the credit this return recorded.`
})

const reversalColor = computed(() => (reversal.value === 0 ? 'grey-7' : 'primary'))
const reversalIcon = computed(() => (reversal.value === 0 ? 'info' : 'swap_vert'))
const reversalClass = computed(() => (reversal.value === 0 ? 'bg-grey-2 text-body2' : 'bg-blue-1 text-body2'))

// The live node record, not a control: the reason IS a column (§5B.5).
const reason = pageState.useRecord('ReasonComment', NODE)

// The cancellation and its reversal movement are mounted by Layer 2 and stand from here on;
// the reason is the only thing this card collects. Keyed on the record LANDING, because the
// page contract's `ready` has already flushed whatever the previous page left behind.
watch(record, (row) => {
  const code = text(row?.Code)
  // The contract's `ready` already flushed the previous page, so a plain attach is enough —
  // a second `reset` here would detach the nodes this same pass is about to create.
  if (!code || pageState.hasNode(NODE)) return
  pageState.initResource(NODE, { isPrimaryKey: true, code })
  pageState.applyNodes(buildReturnCancelInitNodes({ record: row }))
}, { immediate: true })

onMounted(async () => {
  await Promise.all([outlets, skus, products].map((res) => res.reload()))
})
</script>
