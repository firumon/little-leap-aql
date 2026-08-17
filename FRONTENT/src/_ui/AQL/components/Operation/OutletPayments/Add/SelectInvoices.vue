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
      </q-card-section>
    </q-card>

    <template v-if="outletCode">
      <SectionDividerLabel label="OPEN INVOICES" />

      <q-card flat bordered :class="ui.cardClass">
        <q-card-section v-if="!outletInvoices.length" class="text-center q-py-lg">
          <q-icon name="task_alt" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">Nothing outstanding</div>
          <div :class="ui.emptyCaptionClass">
            This outlet has no open invoices. Pick another outlet to record a collection.
          </div>
        </q-card-section>

        <template v-else>
          <q-card-section class="row items-center justify-between no-wrap q-py-sm">
            <div class="text-caption text-grey-8">
              {{ outletInvoices.length }} open invoice{{ outletInvoices.length === 1 ? '' : 's' }} ·
              {{ money(outletBalance) }} outstanding
            </div>
            <q-btn
              flat no-caps
              color="primary"
              :label="isAllSelected ? 'Clear all' : 'Select all'"
              @click="toggleSelectAll"
            />
          </q-card-section>

          <q-separator />

          <q-list separator>
            <q-item v-for="row in outletInvoices" :key="row.code" v-ripple tag="label" clickable>
              <q-item-section side top>
                <q-checkbox
                  :model-value="selectedCodes.includes(row.code)"
                  @update:model-value="toggleInvoice(row.code)"
                />
              </q-item-section>

              <q-item-section :class="ui.flexWrapTextClass">
                <q-item-label class="text-weight-medium">{{ row.code }}</q-item-label>
                <q-item-label caption>{{ row.date }} · {{ dueText(row) }}</q-item-label>
                <q-item-label caption>
                  {{ money(row.total) }} billed · {{ money(row.collected) }} received
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <q-chip
                  dense square outline
                  :color="row.isOverdue ? 'negative' : 'primary'"
                  class="q-my-none"
                >
                  {{ money(row.balance) }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </template>
      </q-card>

      <!-- THE FIGURE THIS STEP EXISTS TO PRODUCE. Live, because ticking an invoice is a
           financial decision and the running total is the only feedback that makes it one. -->
      <q-card v-if="selectedCodes.length" flat bordered :class="ui.cardClass">
        <q-card-section class="row items-center justify-between q-py-sm">
          <div class="text-subtitle2 text-weight-bold">
            Payable now
            <div class="text-caption text-grey-7 text-weight-regular">
              {{ selectedCodes.length }} invoice{{ selectedCodes.length === 1 ? '' : 's' }} selected
            </div>
          </div>
          <div class="text-h6 text-weight-bolder text-primary">{{ money(selectedBalance) }}</div>
        </q-card-section>
      </q-card>
    </template>
  </div>
</template>

<script setup>
/**
 * OutletPayments › Add › Step 1 — the paying outlet, and what this collection settles.
 *
 * ── WHY THE INVOICES ARE A MULTI-SELECT ──
 * An outlet handing over cash rarely hands it over per document. One envelope settles
 * whatever is outstanding, and forcing one payment per invoice would make the collector
 * re-enter the same mode, reference and date three times for one real-world event. Step 2
 * splits the single amount back across whatever is ticked here.
 *
 * Rows carry no leading icon: every row in this list is an invoice, so a receipt glyph
 * repeated down the column is decoration in the space the balance needs.
 *
 * The outlet field mounts through `resolveFieldComponent` rather than as a raw `q-select`, so
 * it inherits the app's field behaviour instead of restating it (§2.4). It is not `dense` —
 * it is the primary input of this step.
 *
 * Spacing comes from `pageProps.gutter` via `$attrs` — never a hardcoded margin (§10.2).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useOutletPaymentAddContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Add/useOutletPaymentAddContext'
import { dueText } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/usePaymentRowPresets'

defineOptions({ name: 'OutletPaymentsAddSelectInvoices', inheritAttrs: false })

// Which wizard step this card belongs to. A prop rather than a hardcoded number, so the page
// contract owns the running order.
const props = defineProps({
  step: { type: [Number, String], default: 1 }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const SelectField = resolveFieldComponent('select', 'add')

const {
  ui, money, outletCode, outletOptions, outletInvoices, outletBalance,
  selectedCodes, selectedBalance, isAllSelected,
  toggleInvoice, toggleSelectAll, step: currentStep,
  initNode, loadSources, reseedAmount
} = useOutletPaymentAddContext()

const isActive = computed(() =>
  props.step == null || Number(props.step) === currentStep.value)

/**
 * Register the page's form node, on the FIRST step.
 *
 * The wizard writes no record through `pageState` — its answers are control fields and its
 * requests are built in Layer 2 — but the node must exist, because the sticky form-actions bar
 * is gated on `pageState.hasNodes`. Step 1 owns the call because it always mounts first.
 *
 * The node is created FIRST and the fetch awaited after it, so the bar is never missing for
 * the length of a round trip. `reseedAmount` then fills in the default the seeded invoice
 * could not supply while the aggregate was still empty.
 */
onMounted(async () => {
  initNode()
  await loadSources()
  reseedAmount()
})
</script>
