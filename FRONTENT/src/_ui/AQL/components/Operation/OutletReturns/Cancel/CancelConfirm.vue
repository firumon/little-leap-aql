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
          <div class="col-auto text-right">
            <div class="text-h6 text-weight-bold">{{ quantity }}</div>
            <div class="text-caption text-grey-8">units</div>
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
          :model-value="reason"
          :record="{}"
          :config="{ label: 'Cancellation Reason *', rows: 3 }"
          header="ReasonComment"
          @update:model-value="setReason"
        />
        <!-- Honest about a schema gap rather than silently discarding what is typed. -->
        <div class="text-caption text-grey-7 q-mt-xs">
          Recorded with the cancellation for audit.
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletReturns › Cancel › CancelConfirm — the cancellation route's content.
 *
 * Voids a return and reverses whatever it moved. The reversal preview leads, because a
 * cancellation's ledger effect is the thing readers most often misjudge: a return the
 * outlet was credited for ADDED stock to the shelf, so cancelling it takes stock back OFF —
 * the opposite direction from what "cancel a return" intuitively suggests.
 *
 * The direction is read from the domain's `storedQtyChange`, the same function the batch
 * inverts, so the sentence on screen and the movement written cannot disagree. Deriving the
 * preview independently is exactly how a reversal ends up describing one thing and doing
 * another.
 *
 * The reason is MANDATORY and is validated by the sticky bar. Worth knowing while reading
 * this card: `OutletReturns` declares no comment column, and `buildNewResourceRow` silently
 * drops keys that are not sheet headers — so the reason is collected and sent but does not
 * yet persist. It is still required, because the person cancelling should have to state one
 * even while the system cannot keep it, and the payload already writes it for the day the
 * column exists. See `useReturnProgress.workflowStamps`.
 *
 * This card is the HYDRATION POINT (§5.5): it seeds the reason control field and preloads
 * the master rows its context lines need.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import FieldTextareaAdd from 'src/_fields/textarea/Add.vue'
import { useReturnFormContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormContext'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { canCancel } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'
import { storedQtyChange } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'

defineOptions({ name: 'OutletReturnsCancelConfirm', inheritAttrs: false })

const NODE = 'OutletReturns'

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, resourceRecord, resource, ui } = useReturnFormContext()

const outlets = resource('Outlets')
const skus = resource('SKUs')
const products = resource('Products')

const { getOutlet } = useOutletResource()
const { skuLabelText } = useSkuResource()

const text = (value) => (value == null ? '' : String(value).trim())

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

const reason = computed(() => pageState?.getControlField(NODE, 'CancelReason') || '')
const setReason = (value) => pageState?.setControlField(NODE, 'CancelReason', value)

onMounted(async () => {
  pageState.setControlField(NODE, 'CancelReason', '')
  await Promise.all([outlets, skus, products].map((res) => res.reload()))
})
</script>
