<template>
  <div
    v-for="group in visibleGroups"
    :key="group.title"
    class="aql-metrics"
    :class="[`q-mb-${gutter}`, `aql-metrics--gutter-${gutter}`]"
  >
    <SectionDividerLabel :label="group.title" />
    <div
      v-if="group.rows"
      :class="[`q-gutter-y-${gutter}`, `aql-metrics--gutter-${gutter}`]"
    >
      <MetricCardsWidget
        v-for="(rowItems, rIdx) in group.rows"
        :key="rIdx"
        :items="rowItems"
      />
    </div>
    <MetricCardsWidget v-else :items="group.items" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import MetricCardsWidget from 'components/_dashboard_widgets/MetricCards.vue'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

defineOptions({ name: 'OutletConsumptionInvoicesIndexMetricCards', inheritAttrs: false })

defineProps({
  gutter: {
    type: String,
    default: 'sm',
    validator: (value) => ['xs', 'sm', 'md'].includes(value)
  }
})

const { collections, todayCollection, pendingInvoiceGeneration, invoiceableOutlets } = useInvoiceIndex()
const { _C } = useCurrencyResource()

const visibleGroups = computed(() => {
  const open = collections.value
  const today = todayCollection.value
  const toInvoice = pendingInvoiceGeneration.value.length
  const toInvoiceOutlets = invoiceableOutlets.value.length

  const groups = [
    {
      title: 'Overdue',
      show: open.overdueOutletCount > 0 || open.overdueCount > 0,
      items: [
        {
          label: 'Outlets',
          number: open.overdueOutletCount,
          color: open.overdueOutletCount > 0 ? 'negative' : 'grey-6'
        },
        {
          label: 'Invoices',
          number: open.overdueCount,
          color: open.overdueCount > 0 ? 'negative' : 'grey-6'
        }
      ]
    },
    {
      title: 'Amount',
      show: open.amount > 0 || open.overdueAmount > 0 || today.total > 0,
      rows: [
        [
          {
            label: 'Receivable',
            number: _C(open.amount, true),
            color: open.amount > 0 ? 'info' : 'grey-6'
          },
          {
            label: 'Overdue',
            number: _C(open.overdueAmount, true),
            color: open.overdueAmount > 0 ? 'negative' : 'grey-6'
          }
        ],
        [
          {
            label: 'Today Collected',
            number: _C(today.total, true),
            color: 'positive'
          }
        ]
      ]
    },
    {
      title: 'Invoiceable',
      show: toInvoice > 0 || toInvoiceOutlets > 0,
      items: [
        {
          label: 'Consumptions',
          number: toInvoice,
          color: toInvoice > 0 ? 'warning' : 'grey-6'
        },
        {
          label: 'Outlets',
          number: toInvoiceOutlets,
          color: toInvoiceOutlets > 0 ? 'warning' : 'grey-6'
        }
      ]
    }
  ]

  return groups.filter((group) => group.show)
})
</script>
