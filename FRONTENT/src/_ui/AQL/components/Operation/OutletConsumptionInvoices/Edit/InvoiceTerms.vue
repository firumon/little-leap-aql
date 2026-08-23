<template>
  <div :class="gutterClass">
    <SectionDividerLabel label="INVOICE" />

    <!-- Read-only facts, not disabled inputs: a greyed box invites a dead click. -->
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section class="q-py-sm">
        <div class="aql-detail-grid">
          <div v-for="line in fixed" :key="line.key" class="aql-detail-line">
            <div class="aql-detail-key">{{ line.label }}</div>
            <div class="aql-detail-val">{{ line.value }}</div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <SectionDividerLabel label="TERMS" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <component
          :is="SelectField"
          :model-value="priceListCode"
          :record="{}"
          :config="priceListConfig"
          header="PriceListCode"
          @update:model-value="(value) => (priceListCode = value)"
        />

        <q-banner v-if="priceListSwitched" dense rounded class="bg-blue-1 text-body2">
          <template #avatar><q-icon name="sync_alt" color="primary" /></template>
          Every line you have not re-priced by hand is now billed at
          <strong>{{ priceListName }}</strong> prices, and this list's own tax and discount
          rules apply. Check the totals below before saving.
        </q-banner>

        <component
          :is="DateField"
          :model-value="dueDate"
          :record="{}"
          :config="dueDateConfig"
          header="DueDate"
          @update:model-value="(value) => (dueDate = value)"
        />

        <component
          :is="SelectField"
          :model-value="discountType"
          :record="{}"
          :config="discountTypeConfig"
          header="DiscountType"
          @update:model-value="(value) => (discountType = value)"
        />

        <component
          :is="discountType === 'PERCENT' ? NumberField : CurrencyField"
          :model-value="discountValue"
          :record="{}"
          :config="discountConfig"
          header="Discount"
          @update:model-value="(value) => (discountValue = value)"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useInvoiceEditContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Edit/useInvoiceEditContext'

defineOptions({ name: 'OutletConsumptionInvoicesEditInvoiceTerms', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const DateField = resolveFieldComponent('date', 'edit')
const SelectField = resolveFieldComponent('select', 'edit')
const NumberField = resolveFieldComponent('number', 'edit')
const CurrencyField = resolveFieldComponent('currency', 'edit')

const {
  ui, record, locked, outletName, priceListName, priceListSwitched, priceListOptions,
  dueDate, discountType, discountValue, priceListCode, loadSources
} = useInvoiceEditContext()

// Pulls the tax-ledger rows the submit needs but no card shows. Once, here.
onMounted(loadSources)

const text = (value) => (value == null ? '' : String(value).trim())

// OutletConsumptionCode is left out on purpose: some rows hold an unresolved batch ref.
const fixed = computed(() => {
  const row = record.value || {}

  return [
    { key: 'code', label: 'Invoice', value: text(row.Code) || '—' },
    { key: 'outlet', label: 'Outlet', value: outletName.value || '—' },
    { key: 'date', label: 'Issued', value: text(row.Date) || '—' }
  ]
})

const priceListConfig = computed(() => ({
  options: priceListOptions.value,
  label: 'Price list',
  clearable: false,
  disable: locked.value
}))

const dueDateConfig = computed(() => ({
  label: 'Due date',
  clearable: false,
  disable: locked.value
}))

const discountTypeConfig = computed(() => ({
  options: [
    { value: 'FLAT', label: 'Flat amount' },
    { value: 'PERCENT', label: 'Percentage' }
  ],
  label: 'Discount type',
  clearable: false,
  disable: locked.value
}))

const discountConfig = computed(() => (discountType.value === 'PERCENT'
  ? { label: 'Discount %', suffix: '%', min: 0, max: 100, disable: locked.value }
  : { label: 'Discount amount', min: 0, disable: locked.value }))
</script>
