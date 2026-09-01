<template>
  <div v-if="isActive" :class="gutterClass">
    <SectionDividerLabel label="OUTLET" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <!-- The primary, flow-anchoring field of this step — never `dense`
             (UI_MODULE_DEVELOPER_GUIDE.md §10.4). -->
        <component
          :is="SelectField"
          :model-value="outletCode"
          :record="{}"
          :config="{ options: outletOptions, label: 'Outlet', clearable: false }"
          header="OutletCode"
          @update:model-value="(value) => (outletCode = value)"
        />

        <component
          :is="SelectField"
          v-if="outletCode"
          :model-value="priceListCode"
          :record="{}"
          :config="{ options: priceListOptions, label: 'Price List', clearable: false, hint: priceListHint }"
          header="PriceListCode"
          @update:model-value="(value) => (priceListCode = value)"
        />
      </q-card-section>
    </q-card>

    <template v-if="outletCode">
      <SectionDividerLabel label="UNINVOICED CONSUMPTIONS" />

      <q-card flat bordered :class="ui.cardClass">
        <q-card-section v-if="!availableConsumptions.length" class="text-center q-py-lg">
          <q-icon name="fact_check" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">Nothing to bill</div>
          <div :class="ui.emptyCaptionClass">
            This outlet has no uninvoiced consumptions. You can still continue and add items
            by hand on the next step.
          </div>
        </q-card-section>

        <q-list v-else separator>
          <q-item v-for="entry in availableConsumptions" :key="entry.code" v-ripple tag="label" clickable>
            <q-item-section side top>
              <q-checkbox v-model="selected" :val="entry.code" />
            </q-item-section>

            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label class="text-weight-medium">{{ entry.date }}</q-item-label>
              <q-item-label caption>{{ entry.username || '—' }} · {{ entry.code }}</q-item-label>
              <q-item-label caption>
                {{ entry.itemCount }} item{{ entry.itemCount === 1 ? '' : 's' }} ·
                {{ entry.totalQty }} qty
                <span v-if="entry.daysSince !== null"> · {{ entry.daysSince }}d ago</span>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </template>
  </div>
</template>

<script setup>
// Step 1 - outlet, price list, and which counts to bill. Ticking is optional: an invoice
// may bill something that was never counted, and step 2 is where the lines are settled.
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useInvoiceAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Add/useInvoiceAddContext'

defineOptions({ name: 'OutletConsumptionInvoicesAddSelectConsumptions', inheritAttrs: false })

// Which wizard step this card belongs to. A prop rather than a hardcoded number, so the page
// contract owns the running order.
const props = defineProps({
  step: { type: [Number, String], default: 1 }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const SelectField = resolveFieldComponent('select', 'add')

const {
  ui, outletCode, priceListCode, selectedCodes,
  outletOptions, priceListOptions, availableConsumptions, step: currentStep,
  initNode, loadSources
} = useInvoiceAddContext()

const isActive = computed(() =>
  props.step == null || Number(props.step) === currentStep.value)

const priceListHint = 'Resolved from this outlet’s operating rule, or the default.'

// `q-checkbox`'s array `val` binding mutates in place, which never reaches the setter.
// Re-wrapping assigns a new array so the write actually happens.
const selected = computed({
  get: () => selectedCodes.value,
  set: (value) => { selectedCodes.value = [...(value || [])] }
})

// Step 1 always mounts first, so it creates the page node the sticky bar is gated on, and
// pulls the sources here so step 2 is never an empty bill waiting on its own fetch.
onMounted(async () => {
  initNode()
  await loadSources()
})
</script>
