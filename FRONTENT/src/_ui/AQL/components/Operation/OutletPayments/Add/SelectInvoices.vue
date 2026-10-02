<template>
  <div v-if="outletCode && outletInvoices.length" :class="gutterClass">
    <SectionDividerLabel label="OPEN INVOICES" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section class="row items-center justify-end q-py-xs q-px-sm">
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          label="Invert selection"
          @click="invertSelection"
        />
      </q-card-section>
      <q-separator />
      <q-card-section>
        <AppList
          v-model="selectedCodes"
          :items="outletInvoices"
          item-key="code"
          clickable
          selectable
          itemClass="bg-transparent"
          :layout="['caption', 'label', 'caption']"
          :content="[
          (row) => `${row.code} · ${row.date}`,
          (row) => `${row.username || 'System'} · ${formatDueText(row)}`,
          (row) => `Billed: ${_C(row.total, true)} · Paid: ${_C(row.collected, true)}`
        ]"
          :meta-layout="['chip']"
          :chip="(row) => _C(row.balance, true)"
          :chip-color="(row) => (row.isOverdue ? 'negative' : 'primary')"
          :chip-outline="true"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs, watch } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentAddContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Add/useOutletPaymentAddContext'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

defineOptions({ name: 'OutletPaymentsAddSelectInvoices', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => 'q-gutter-y-' + (attrs.gutter || 'sm'))

const node = 'OutletPayments'
const { pageState, ui, outletInvoices } = useOutletPaymentAddContext()
const { _C, roundToDecimals } = useCurrencyResource()

const outletCode = pageState.useRecord('OutletCode', node)
const selectedCodes = pageState.useControls('SelectedInvoices', [], node)

function formatDueText (row) {
  const days = row?.dueInDays
  if (days === null || days === undefined) return 'No due date'
  if (days < 0) return `Due ${Math.abs(days)} days ago`
  if (days === 0) return 'Due today'
  return `Due in ${days} days`
}

function updatePayingAmount () {
  const selectedSet = new Set(selectedCodes.value || [])
  const sum = outletInvoices.value
    .filter(inv => selectedSet.has(String(inv.code)))
    .reduce((acc, inv) => acc + (Number(inv.balance) || 0), 0)
  pageState.setRecord('Amount', roundToDecimals(sum), node)
}

function invertSelection () {
  const selected = new Set(selectedCodes.value)
  selectedCodes.value = outletInvoices.value
    .map(inv => (selected.has(String(inv.code)) ? null : String(inv.code)))
    .filter(Boolean)
}

watch(selectedCodes, () => {
  updatePayingAmount()
}, { deep: true })

watch(outletCode, (value) => {
  if (!value) {
    selectedCodes.value = []
    return
  }
  selectedCodes.value = outletInvoices.value.map(inv => String(inv.code))
}, { immediate: true })

watch(outletInvoices, (rows) => {
  if (!rows.length) {
    selectedCodes.value = []
    return
  }
  if (!selectedCodes.value || selectedCodes.value.length === 0) {
    selectedCodes.value = rows.map(inv => String(inv.code))
    return
  }
  const present = new Set(rows.map(inv => String(inv.code)))
  selectedCodes.value = selectedCodes.value.filter(code => present.has(code))
})
</script>
