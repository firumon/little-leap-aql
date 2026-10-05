<template>
  <div>
    <SectionDividerLabel label="Payment" />

    <q-card :class="ui.cardClass">
      <q-card-section class="text-center q-py-md">
        <div class="text-caption text-grey-7 text-uppercase">Amount collected</div>
        <div class="text-h4 text-weight-bolder" :class="amountColorClass">
          {{ money(amount) }}
        </div>
        <div class="text-caption text-grey-7 q-mt-xs">{{ record?.Code || record?.code }}</div>
        <div class="q-mt-sm">
          <q-chip
            dense
            outline
            :color="progressMeta.color"
            :icon="progressMeta.icon"
            class="q-my-none text-weight-medium"
          >
            {{ progressMeta.label }}
          </q-chip>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-py-sm">
        <div class="aql-detail-grid">
          <div v-for="line in details" :key="line.key" class="aql-detail-line">
            <div class="aql-detail-key">{{ line.label }}</div>
            <div class="aql-detail-val">
              <template v-if="line.key === 'progress'">
                <q-chip
                  dense
                  square
                  :color="progressMeta.color"
                  text-color="white"
                  class="q-my-none"
                >
                  {{ line.value }}
                </q-chip>
              </template>
              <template v-else>
                {{ line.value }}
              </template>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentViewContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/View/useOutletPaymentViewContext'

defineOptions({ name: 'OutletPaymentsViewPaymentSummary', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Payment' }
})

const {
  ui, money, record, outletName, progressMeta, isPaymentCancelled, isPaymentApproved
} = useOutletPaymentViewContext()

const amount = computed(() => Number(record.value?.Amount ?? record.value?.amount) || 0)

const amountColorClass = computed(() => {
  if (isPaymentCancelled.value) return 'text-grey-6'
  if (isPaymentApproved.value) return 'text-positive'
  return 'text-warning'
})

const details = computed(() => {
  const entry = record.value || {}
  const lines = [
    { key: 'progress', label: 'Progress', value: progressMeta.value?.label || 'Submitted' },
    { key: 'outlet', label: 'Outlet', value: outletName.value },
    { key: 'date', label: 'Date', value: entry.Date || entry.date || '—' },
    { key: 'mode', label: 'Mode', value: entry.Mode || entry.mode || '—' },
    { key: 'user', label: 'Collected by', value: entry.Username || entry.username || '—' }
  ]
  const reference = String(entry.Reference || entry.reference || '').trim()
  if (reference) lines.push({ key: 'reference', label: 'Reference', value: reference })

  return lines
})
</script>
