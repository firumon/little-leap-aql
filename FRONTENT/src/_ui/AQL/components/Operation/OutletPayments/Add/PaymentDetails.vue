<template>
  <div v-if="isActive" :class="gutterClass">
    <SectionDividerLabel label="AMOUNT COLLECTED" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <component
          :is="CurrencyField"
          :model-value="amount"
          :record="{}"
          :config="{ label: 'Amount collected', min: 0 }"
          header="Amount"
          @update:model-value="(value) => (amount = value)"
        />

        <!-- QUICK TAPS, not a convenience. A collector standing in an outlet is typing on a
             phone with one hand; the four amounts below cover almost every real collection,
             and each one re-splits the allocation grid as it lands. -->
        <div class="row " :class="'q-col-gutter-' + (attrs.gutter || 'sm') + ` q-mt-` + (attrs.gutter || 'sm')">
          <div v-for="tap in quickTaps" :key="tap.key" class="col-6 col-sm-3">
            <q-btn
              outline no-caps
              color="primary"
              class="full-width"
              :label="tap.label"
              :style="ui.tapTargetStyle"
              @click="tap.apply"
            >
              <q-tooltip>{{ tap.hint }}</q-tooltip>
            </q-btn>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <SectionDividerLabel label="ALLOCATION" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section class="row items-center justify-between no-wrap q-py-sm">
        <div class="text-caption text-grey-8">
          How the collection is applied across the {{ selectedInvoices.length }}
          selected invoice{{ selectedInvoices.length === 1 ? '' : 's' }}.
        </div>
        <q-btn
          flat no-caps
          color="primary"
          icon="auto_awesome"
          label="Auto-distribute"
          @click="distribute(amount)"
        >
          <q-tooltip>Settle the oldest invoice first, then the next</q-tooltip>
        </q-btn>
      </q-card-section>

      <q-separator />

      <q-list separator>
        <q-item v-for="row in selectedInvoices" :key="row.code">
          <q-item-section :class="ui.flexWrapTextClass">
            <q-item-label class="text-weight-medium">{{ row.code }}</q-item-label>
            <q-item-label caption>{{ row.date }} · {{ money(row.balance) }} outstanding</q-item-label>
          </q-item-section>

          <q-item-section side style="min-width: 160px">
            <component
              :is="CurrencyField"
              :model-value="allocations[row.code] ?? 0"
              :record="{}"
              :config="{ label: 'Applied', min: 0 }"
              :header="`Allocation-${row.code}`"
              @update:model-value="(value) => setAllocation(row.code, value)"
            />
          </q-item-section>
        </q-item>
      </q-list>

      <!-- The reconciliation. A split that does not add up to the amount is the one error this
           step can produce, so it is stated with the fix attached rather than left to the
           veto on Continue. -->
      <template v-if="allocationDiff !== 0">
        <q-separator />
        <q-card-section class="row items-center justify-between no-wrap q-py-sm">
          <div class="text-caption text-negative text-weight-medium" :class="ui.flexWrapTextClass">
            Applied {{ money(totalAllocated) }} of {{ money(amount) }} collected —
            {{ money(Math.abs(allocationDiff)) }} {{ allocationDiff > 0 ? 'unapplied' : 'over-applied' }}.
          </div>
          <q-btn flat no-caps color="primary" label="Match total" @click="reconcileToAllocations" />
        </q-card-section>
      </template>
    </q-card>

    <SectionDividerLabel label="HOW IT WAS PAID" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <component
          :is="SelectField"
          :model-value="mode"
          :record="{}"
          :config="{ options: MODE_OPTIONS, label: 'Payment mode', clearable: false }"
          header="Mode"
          @update:model-value="(value) => (mode = value)"
        />

        <component
          :is="TextareaField"
          :model-value="reference"
          :record="{}"
          :config="{ label: 'Reference / memo (optional)', hint: 'Cheque number, bank reference, or a note for whoever reconciles this.' }"
          header="Reference"
          @update:model-value="(value) => (reference = value)"
        />
      </q-card-section>
    </q-card>

    <!-- THE ONLY ACCENTED CARD ON THE PAGE (config.md — at most one, and only when it asks
         the reader to do something). Writing off a balance is a decision, not a formality. -->
    <template v-if="canWaiveResidual">
      <SectionDividerLabel label="RESIDUAL BALANCE" />

      <q-card flat bordered :class="[ui.cardClass, ui.accentCardClass]" :style="ui.accentBorderStyle">
        <q-card-section>
          <div class="row items-center no-wrap q-col-gutter-sm">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-subtitle1 text-weight-medium">
                Waive {{ money(residualBalance) }} and mark as fully paid
              </div>
              <div class="text-caption text-grey-8">
                Under the {{ money(waiverLimit) }} write-off limit. Left unticked, the invoices
                stay partially paid for the difference.
              </div>
            </div>
            <div class="col-auto">
              <q-toggle v-model="waiveModel" color="primary" />
            </div>
          </div>
        </q-card-section>

        <template v-if="waiveModel">
          <q-separator />
          <q-card-section :class="gutterClass">
            <component
              :is="SelectField"
              :model-value="waiverReason"
              :record="{}"
              :config="{ options: WAIVER_REASONS, label: 'Reason', clearable: false }"
              header="WaiverReason"
              @update:model-value="(value) => (waiverReason = value)"
            />

            <component
              :is="TextareaField"
              :model-value="waiverComment"
              :record="{}"
              :config="{ label: 'Audit note (optional)' }"
              header="WaiverComment"
              @update:model-value="(value) => (waiverComment = value)"
            />

            <!-- What the waiver will actually write onto each invoice, before it writes it. -->
            <div class="text-caption text-grey-8">
              Recorded as: &ldquo;{{ waiverComment || waiverAuditComment }}&rdquo;
            </div>
          </q-card-section>
        </template>
      </q-card>
    </template>
  </div>
</template>

<script setup>
/**
 * OutletPayments › Add › Step 2 — how much was taken, how it splits, and how it arrived.
 *
 * ── THE SPLIT IS THE POINT OF THIS STEP ──
 * One collection settling three invoices is three payment rows and three invoice transitions,
 * and which invoice gets which share decides which of them closes. The default is OLDEST
 * FIRST, applied by `autoDistribute` in Layer 2 rather than here, because "settle the oldest
 * debt first" is an accounting policy that has to hold identically however the split was
 * produced. Typing over a cell is allowed; the reconciliation line below the grid is what
 * stops a hand-edited split from being submitted against a total it does not add up to.
 *
 * ── WHY THE WAIVER IS OPT-IN, GATED AND NARRATED ──
 * A short payment normally leaves the invoice partially paid, which is the honest state. The
 * waiver exists for the case where the shortfall is a rounding artefact nobody will ever
 * collect — so it appears ONLY when every selected invoice's remainder is under the currency's
 * own write-off limit (`isWaiverEligible`, Layer 2), it is never pre-ticked, and the audit
 * sentence it will store is shown before it is stored.
 *
 * Every field mounts through `resolveFieldComponent` (§2.4) and NOTHING here is `dense` —
 * these are the primary inputs of the step, including the per-invoice allocation cells. The
 * quick-tap buttons bind `ui.tapTargetStyle` so they stay reliably tappable on a phone.
 *
 * Spacing is `pageProps.gutter` throughout, never a hardcoded margin (§10.2).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useOutletPaymentAddContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Add/useOutletPaymentAddContext'

defineOptions({ name: 'OutletPaymentsAddPaymentDetails', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: 2 }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const SelectField = resolveFieldComponent('select', 'add')
const CurrencyField = resolveFieldComponent('currency', 'add')
const TextareaField = resolveFieldComponent('textarea', 'add')

const {
  ui, money, MODE_OPTIONS, WAIVER_REASONS,
  amount, allocations, setAllocation, distribute,
  totalAllocated, allocationDiff, reconcileToAllocations,
  selectedInvoices, selectedBalance, outletBalance, outletInvoices, setSelectedCodes,
  mode, reference,
  waiveResidual, waiverReason, waiverComment,
  canWaiveResidual, residualBalance, waiverLimit, waiverAuditComment,
  step: currentStep
} = useOutletPaymentAddContext()

const isActive = computed(() =>
  props.step == null || Number(props.step) === currentStep.value)

/**
 * `q-toggle` needs a writable model. The context exposes a writable computed already, but
 * `v-model` on a destructured computed cannot assign through — this thin wrapper restores the
 * write.
 */
const waiveModel = computed({
  get: () => waiveResidual.value,
  set: (value) => { waiveResidual.value = value }
})

/**
 * The four amounts that cover almost every real collection.
 *
 * "Full outstanding" widens the selection to every open invoice first — it is the "they paid
 * off everything" case, and leaving the tick list behind would produce an amount the
 * allocation grid could not absorb. "Selected balance" is the same gesture scoped to what is
 * already ticked, which is how a partial settlement is reset after experimenting.
 */
const quickTaps = computed(() => [
  {
    key: 'full',
    label: 'Full outstanding',
    hint: 'Everything this outlet owes, across every open invoice',
    apply: () => {
      setSelectedCodes(outletInvoices.value.map((row) => row.code))
      amount.value = outletBalance.value
    }
  },
  {
    key: 'selected',
    label: 'Selected balance',
    hint: 'What the invoices selected on the previous step still owe',
    apply: () => { amount.value = selectedBalance.value }
  },
  {
    key: 'half',
    label: '50%',
    hint: 'Half of the selected balance',
    apply: () => { amount.value = Number((selectedBalance.value * 0.5).toFixed(2)) }
  },
  {
    key: 'quarter',
    label: '25%',
    hint: 'A quarter of the selected balance',
    apply: () => { amount.value = Number((selectedBalance.value * 0.25).toFixed(2)) }
  }
])
</script>
