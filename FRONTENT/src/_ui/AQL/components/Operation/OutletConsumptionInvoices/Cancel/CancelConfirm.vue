<template>
  <div :class="gutterClass">
    <q-banner v-if="!eligible" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      {{ blockedMessage }}
    </q-banner>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-caption text-grey-7">CANCELLING</div>
            <div class="text-subtitle1 text-weight-medium">{{ code }}</div>
          </div>
          <div class="col-auto">
            <q-badge rounded :color="progressMeta.color" :label="progressMeta.label" />
          </div>
        </div>

        <q-list separator dense class="q-mt-sm">
          <q-item>
            <q-item-section>Billed</q-item-section>
            <q-item-section side>{{ money(total) }}</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>Consumptions on this bill</q-item-section>
            <q-item-section side>{{ consumptionCodes.length }}</q-item-section>
          </q-item>
          <q-item v-if="returnRows.length">
            <q-item-section>Return credits to reverse</q-item-section>
            <q-item-section side>{{ returnRows.length }}</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <q-card flat bordered :class="[ui.cardClass, ui.accentCardClass]" :style="ui.accentBorderStyle">
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Why is this invoice cancelled?</div>
        <div class="text-caption text-grey-8">{{ outcome }}</div>

        <component
          :is="TextareaField"
          :model-value="comment"
          :record="{}"
          :config="{ label: 'Cancellation Comment *', required: true }"
          header="CancelledComment"
          :disable="!eligible"
          @update:model-value="(value) => setControl('CancelComment', value)"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Cancel › CancelConfirm — the cancel route's only card.
 *
 * The HYDRATION POINT (§5.5): an `_action` resolver fetches the invoice alone, so the
 * consumptions, the return credits and the tax rows the cancellation touches are opened
 * here — the same rows the submit handler hands to the builder.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, inject, useAttrs } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataStore } from 'src/stores/data'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { grandTotalOf, invoiceCurrencyOf } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import { canCancelInvoice, isCancelled, isPaid, progressMetaOf } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'
import { consumptionCodesOf } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'

defineOptions({ name: 'OutletConsumptionInvoicesCancelConfirm', inheritAttrs: false })

const NODE = 'OutletConsumptionInvoices'

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const pageState = inject('pageState', null)
const resourceRecord = inject('resourceRecord', null)

useRecord('OutletConsumptions')
useRecord('OutletReturns')
useRecord('TaxTransactions')

const ui = useAQLConfig()
const dataStore = useDataStore()
const { _C } = useCurrencyResource()

const text = (value) => (value == null ? '' : String(value).trim())

const record = computed(() => resourceRecord?.record?.value || null)
const code = computed(() => text(record.value?.Code))
const total = computed(() => grandTotalOf(record.value || {}))
const progressMeta = computed(() => progressMetaOf(record.value))

const money = (value) => _C(Number(value) || 0, true, invoiceCurrencyOf(record.value?.PriceListCode))

const consumptionCodes = computed(() => consumptionCodesOf(record.value || {}))

const returnRows = computed(() => (dataStore.getRecords('OutletReturns') || [])
  .filter((row) => text(row?.ConsumptionInvoiceCode) === code.value))

const eligible = computed(() => !!record.value && canCancelInvoice(record.value))

const blockedMessage = computed(() => {
  const row = record.value
  if (!row) return ''
  if (isCancelled(row)) return 'This invoice is already cancelled.'
  if (isPaid(row)) return 'This invoice is paid and cannot be cancelled.'
  return 'This invoice can no longer be cancelled.'
})

const outcome = computed(() => {
  const count = consumptionCodes.value.length
  if (!count) return 'The invoice is voided. No consumption goes back to the queue.'
  return `The invoice is voided and ${count} consumption${count === 1 ? '' : 's'} return to the invoiceable queue.`
})

const TextareaField = resolveFieldComponent('textarea', 'add')

const setControl = (key, value) => pageState?.setControls(key, value, NODE)
const comment = computed(() => pageState?.getControls('CancelComment', undefined, NODE))
</script>
