<template>
  <div v-if="autoApprove && outletCode && amount > 0 && outletInvoices.length" :class="gutterClass">
    <SectionDividerLabel label="ALLOCATION" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section class="row items-center justify-between">
        <div class="text-caption">Applied {{ _C(totalApplied, true) }} of {{ _C(amount, true) }}</div>
        <q-btn flat dense no-caps color="primary" label="Auto-distribute" @click="autoDistribute" />
      </q-card-section>
      <q-separator />
      <q-card-section>
        <AppList
          :items="outletInvoices"
          item-key="code"
          itemClass="bg-transparent"
          :layout="['label', 'caption', 'caption']"
          :content="[
            (row) => `${row.code} · ${row.date}`,
            (row) => `${row.username || 'System'} · ${formatDueText(row)}`,
            (row) => `Balance: ${_C(row.balance, true)}`
          ]"
        >
          <template #btn="{ item }">
            <component
              :is="CurrencyField"
              :model-value="allocations[item.code] || 0"
              :config="{ label: 'Applied', min: 0, max: item.balance }"
              @update:model-value="(value) => setAllocation(item.code, value)"
            />
          </template>
        </AppList>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, useAttrs, watch } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useOutletPaymentAddContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Add/useOutletPaymentAddContext'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

defineOptions({ name: 'OutletPaymentsAddInvoiceAllocation', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const node = 'OutletPayments'
const { pageState, ui, outletInvoices, syncAllocations } = useOutletPaymentAddContext()
const { _C, roundToDecimals } = useCurrencyResource()
const CurrencyField = resolveFieldComponent('currency', 'add')

const autoApprove = pageState.useControls('AutoApprove', false)
const outletCode = pageState.useRecord('OutletCode', node)
const amount = pageState.useRecord('Amount', node)
const selectedCodes = pageState.useControls('SelectedInvoices', [], node)
const allocations = ref({})

const totalApplied = computed(() => Object.values(allocations.value).reduce((sum, v) => sum + (Number(v) || 0), 0))

function setAllocation (code, value) {
  allocations.value[String(code)] = Number(value) || 0
  syncAllocations(allocations.value)
}

function autoDistribute () {
  const selected = new Set((selectedCodes.value || []).map(String))
  const targetInvoices = selected.size > 0
    ? outletInvoices.value.filter(inv => selected.has(String(inv.code)))
    : outletInvoices.value
  const otherInvoices = selected.size > 0
    ? outletInvoices.value.filter(inv => !selected.has(String(inv.code)))
    : []

  let remaining = Number(amount.value) || 0
  const next = {}
  outletInvoices.value.forEach(inv => { next[String(inv.code)] = 0 })

  targetInvoices.forEach(inv => {
    const balance = Number(inv.balance) || 0
    const applied = Math.max(0, Math.min(remaining, balance))
    next[String(inv.code)] = roundToDecimals(applied)
    remaining = roundToDecimals(remaining - applied)
  })

  if (remaining > 0 && otherInvoices.length > 0) {
    otherInvoices.forEach(inv => {
      const balance = Number(inv.balance) || 0
      const applied = Math.max(0, Math.min(remaining, balance))
      next[String(inv.code)] = roundToDecimals(applied)
      remaining = roundToDecimals(remaining - applied)
    })
  }

  allocations.value = next
  syncAllocations(allocations.value)
}

function formatDueText (row) {
  const days = row?.dueInDays
  if (days === null || days === undefined) return 'No due date'
  if (days < 0) return `Due ${Math.abs(days)} days ago`
  if (days === 0) return 'Due today'
  return `Due in ${days} days`
}

onMounted(() => {
  autoDistribute()
})

watch([amount, autoApprove, selectedCodes], ([newAmount, isApprove]) => {
  if (isApprove && Number(newAmount) > 0 && outletCode.value) {
    autoDistribute()
  } else if (!isApprove) {
    syncAllocations({})
  }
}, { deep: true })
</script>
