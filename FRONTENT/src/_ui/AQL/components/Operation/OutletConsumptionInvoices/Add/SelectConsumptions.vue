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
/**
 * OutletConsumptionInvoices › Add › Step 1 — outlet, price list, and which counts to bill.
 *
 * ── WHY CONSUMPTIONS ARE OPTIONAL ──
 * The list may be left entirely unticked. Most invoices bill recorded counts, but a
 * legitimate case exists for billing something never counted — a delivery charge, an agreed
 * adjustment — and forcing a tick would make that impossible. Step 2 is where the bill gets
 * its lines, from ticks or by hand or both.
 *
 * Several counts may be ticked at once: an outlet audited weekly and invoiced monthly should
 * receive ONE bill, not four. Step 2 groups their lines by SKU for exactly that reason.
 *
 * Fields are mounted through `resolveFieldComponent` rather than as raw `q-select`s, so they
 * inherit the app's field behaviour instead of restating it (§2.4). Neither is `dense`: both
 * are primary inputs for this step.
 *
 * Spacing comes from `pageProps.gutter` via `$attrs` — never a hardcoded margin (§10.2).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
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

/**
 * `selectedCodes` writes through a control field, and `q-checkbox`'s array `val` binding
 * mutates its bound array in place — which would never reach the setter. Re-wrapping assigns
 * a NEW array so the write actually happens.
 */
const selected = computed({
  get: () => selectedCodes.value,
  set: (value) => { selectedCodes.value = [...(value || [])] }
})

/**
 * Register the page's form node, on the FIRST step.
 *
 * The wizard writes no record through `pageState` — its answers are control fields and its
 * requests are built in Layer 2 — but the node must exist, because the sticky form-actions
 * bar is gated on `pageState.hasNodes`. Step 1 owns the call because it always mounts first,
 * the same arrangement `OutletSelection.vue` uses in the restock wizard.
 */
onMounted(async () => {
  initNode()
  // Loaded HERE, at step 1, so step 2's grouped lines already have the consumptions' item
  // rows the moment the user advances — rather than step 2 rendering an empty bill while its
  // own fetch is still in flight.
  await loadSources()
})
</script>
