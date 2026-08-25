<template>
  <div v-if="invoice">
    <SectionDividerLabel :label="finalTitle" />

    <q-card :class="ui.cardClass">
      <q-card-section class="q-py-sm">
        <div class="aql-detail-grid">
          <div class="aql-detail-line">
            <div class="aql-detail-key">Invoice</div>
            <div class="aql-detail-val">{{ invoiceCode }}</div>
          </div>
          <div class="aql-detail-line">
            <div class="aql-detail-key">Issued</div>
            <div class="aql-detail-val">{{ invoice.Date || '—' }}</div>
          </div>
          <div class="aql-detail-line">
            <div class="aql-detail-key">Status</div>
            <div class="aql-detail-val">
              <q-chip
                dense square
                :color="invoiceMeta.color"
                text-color="white"
                class="q-my-none"
              >
                {{ invoiceMeta.label }}
              </q-chip>
            </div>
          </div>
          <div class="aql-detail-line">
            <div class="aql-detail-key">Invoice total</div>
            <div class="aql-detail-val">{{ invoiceTotalText }}</div>
          </div>
          <div class="aql-detail-line">
            <div class="aql-detail-key">Received to date</div>
            <div class="aql-detail-val text-positive">{{ money(invoicePaidSoFar) }}</div>
          </div>
          <div class="aql-detail-line">
            <div class="aql-detail-key">Balance due</div>
            <div class="aql-detail-val" :class="isOpen ? 'text-negative' : 'text-positive'">
              {{ money(invoiceBalance) }}
            </div>
          </div>
        </div>
      </q-card-section>

      <!-- The shortcut exists because the balance above is the reason anyone reads this card:
           a collector who sees money still owed will act on it in the next gesture. -->
      <template v-if="isOpen">
        <q-separator />
        <q-card-section class="row justify-end q-py-sm">
          <q-btn
            flat no-caps
            color="primary"
            icon="add"
            label="Pay remaining balance"
            @click="onPay"
          />
        </q-card-section>
      </template>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletPayments › View › InvoiceSummary — Section (tier CP: resource + page).
 *
 * The invoice this receipt credited, and where it now stands. A payment on its own says how
 * much changed hands; only the invoice beside it says whether that closed the debt.
 *
 * Every figure — total, received, balance — is read from the page context's aggregate, the
 * same one the Index queues project. The balance shown here and the balance shown on the
 * Pending pill are the same computation, not two that happen to agree (ARCHITECTURE RULES §6).
 *
 * The card carries no title and no icon; the divider above it names the section once
 * (UI_MODULE_DEVELOPER_GUIDE.md §10).
 *
 * Hides itself entirely when the invoice cannot be resolved — a card whose every row reads
 * "—" is worse than no card.
 *
 * No `<style>` block; `.aql-detail-*` are the canonical shared classes (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentViewContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/View/useOutletPaymentViewContext'

defineOptions({ name: 'OutletPaymentsViewInvoiceSummary', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Credited Invoice' }
})

const {
  evaluate, ui, money, invoice, invoiceCode, invoiceTotalText,
  invoicePaidSoFar, invoiceBalance, invoiceProgressMetaOf, payInvoice
} = useOutletPaymentViewContext()

const finalTitle = computed(() => evaluate(props.title))

const invoiceMeta = computed(() => invoiceProgressMetaOf(invoice.value))
const isOpen = computed(() => invoiceBalance.value > 0.01)

const onPay = () => payInvoice(invoiceCode.value)
</script>
