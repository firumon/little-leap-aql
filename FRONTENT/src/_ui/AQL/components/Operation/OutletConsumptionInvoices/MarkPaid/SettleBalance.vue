<template>
  <div :class="gutterClass">
    <!-- The invoice moved on since the link was opened. Said ABOVE the form rather than at
         the sticky bar after the user has already chosen a reason (§13.4). -->
    <q-banner v-if="!gate.allowed" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      {{ gate.reason }}
    </q-banner>

    <!-- WHAT IS BEING WRITTEN OFF, before it is named. The whole reason this is a route. -->
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-medium">{{ code }}</div>
            <div class="text-caption text-grey-8">{{ outletName }}</div>
          </div>
          <div class="col-auto">
            <q-badge rounded :color="progressMeta.color" :label="progressMeta.label" />
          </div>
        </div>

        <q-list separator dense class="q-mt-sm">
          <q-item>
            <q-item-section>Billed</q-item-section>
            <q-item-section side>{{ money(gate.total) }}</q-item-section>
          </q-item>
          <q-item>
            <q-item-section>Collected</q-item-section>
            <q-item-section side>{{ money(gate.collected) }}</q-item-section>
          </q-item>
          <q-item>
            <q-item-section class="text-weight-medium">Outstanding</q-item-section>
            <q-item-section side class="text-weight-medium text-orange-9">
              {{ money(gate.balance) }}
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <!-- THE ONLY ACCENTED CARD ON THE PAGE (config.md). Closing a bill for less than it
         billed is a decision, not a formality. -->
    <q-card flat bordered :class="[ui.cardClass, ui.accentCardClass]" :style="ui.accentBorderStyle">
      <q-card-section :class="fieldGutterClass">
        <div class="text-subtitle1 text-weight-medium">Why is the difference accepted?</div>
        <div class="text-caption text-grey-8 q-pb-sm">
          The reason and the amount are stamped onto the invoice and are what a write-off
          report is filtered by.
        </div>

        <component
          :is="SelectField"
          :model-value="reason"
          :record="{}"
          :config="{ options: reasons, label: 'Settlement reason', required: true, clearable: false }"
          header="SettlementReason"
          :disable="!gate.allowed"
          @update:model-value="(value) => setControl('SettlementReason', value)"
        />

        <component
          :is="CurrencyField"
          :model-value="mismatch"
          :record="{}"
          :config="{ label: 'Amount written off' }"
          header="SettlementMismatchAmount"
          :disable="!gate.allowed"
          @update:model-value="setMismatch"
        />

        <!-- Pre-filled with the whole outstanding gap, which is what almost every settlement
             writes off. It stays editable because a part-waiver — settle 90, write off 10 —
             is a real case, and this line says what the current entry actually means. -->
        <div class="text-caption text-grey-8">{{ mismatchNote }}</div>

        <component
          :is="TextareaField"
          :model-value="comment"
          :record="{}"
          :config="{ label: commentRequired ? 'Explanation (required)' : 'Settlement note', required: commentRequired }"
          header="ProgressPaidComment"
          :disable="!gate.allowed"
          @update:model-value="(value) => setControl('SettlementComment', value)"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › MarkPaid › SettleBalance — the action route's only card.
 *
 * THE HYDRATION POINT for this route (§5.5): an `_action` resolver fetches the invoice
 * alone, so the payments the outstanding figure is derived from are opened here.
 *
 * Every number shown comes from `settlementGate` in Layer 2 — the same call the submit
 * handler vetoes on and the same one the builder writes from, so the figure the user reads
 * and the figure that lands on the sheet cannot drift.
 *
 * The three answers are written to CONTROL fields. `SettlementReason`,
 * `SettlementMismatchAmount` and `ProgressPaidComment` are workflow columns set by the
 * transition itself; a form that wrote them directly could back-date a settlement or
 * attribute it to someone else (§13.3, §13.5).
 *
 * Navigation and submission belong to the sticky bar (§8.3).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, ref, watch, useAttrs } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useInvoiceSettleContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/MarkPaid/useInvoiceSettleContext'

defineOptions({ name: 'OutletConsumptionInvoicesMarkPaidSettleBalance', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const fieldGutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui, code, record, gate, money, progressMeta,
  reasons, reason, comment, mismatch, commentRequired,
  setControl, hydrate
} = useInvoiceSettleContext()

hydrate()

const { getOutlet } = useOutletResource()

// `'add'`, because the mode follows the VALUE rather than the page: none of these answers
// exists yet. Resolved, never deep-imported, so the type's aliases and prepared-props
// branches keep applying (§2.4).
const SelectField = resolveFieldComponent('select', 'add')
const CurrencyField = resolveFieldComponent('currency', 'add')
const TextareaField = resolveFieldComponent('textarea', 'add')

const outletName = computed(() => {
  const outletCode = String(record.value?.OutletCode || '').trim()
  if (!outletCode) return ''
  return String(getOutlet(outletCode)?.Name || '').trim() || outletCode
})

/**
 * AUTO-FILLED WITH THE WHOLE OUTSTANDING GAP, and RE-filled while the user has not touched
 * it.
 *
 * A plain `onMounted` seed would be wrong here: an action route's resolver fetches the
 * invoice alone, so the payments the balance is derived from land AFTER this card mounts.
 * Seeding once at mount would write the full billed total onto a part-paid invoice and then
 * leave it there. Watching the Layer 2 suggestion instead means the field follows the
 * balance until the moment someone types over it.
 *
 * `touched` is what protects a deliberate entry — including a deliberate blank or zero,
 * which must not be re-filled behind the user's back.
 */
const touched = ref(false)

function setMismatch (value) {
  touched.value = true
  setControl('SettlementMismatchAmount', value)
}

watch(() => gate.value.suggestedMismatch, (value) => {
  if (touched.value) return
  setControl('SettlementMismatchAmount', value)
}, { immediate: true })

const mismatchNote = computed(() => {
  const raw = mismatch.value
  if (raw === undefined || raw === null || raw === '') {
    return `Blank writes off the whole outstanding ${money(gate.value.balance)}.`
  }
  const entered = Number(raw)
  if (!Number.isFinite(entered)) return `Enter a number, or leave blank for the whole outstanding balance.`
  const left = Number((gate.value.balance - entered).toFixed(2))
  if (left > 0) return `${money(entered)} written off, ${money(left)} treated as collected.`
  if (left < 0) return `More than the outstanding balance — recorded as an overpayment.`
  return `The whole outstanding balance is written off.`
})
</script>
