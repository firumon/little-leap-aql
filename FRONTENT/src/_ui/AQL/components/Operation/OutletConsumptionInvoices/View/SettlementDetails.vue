<template>
  <div v-if="settlement">
    <SectionDividerLabel :label="finalTitle" />

    <q-card :class="ui.cardClass">
      <q-card-section class="q-py-sm">
        <div class="aql-detail-grid">
          <div class="aql-detail-line">
            <div class="aql-detail-key">Difference Settled</div>
            <div class="aql-detail-val" :class="settlement.amount > 0 ? 'text-negative' : ''">
              {{ money(settlement.amount) }}
            </div>
          </div>
          <div class="aql-detail-line">
            <div class="aql-detail-key">Reason</div>
            <div class="aql-detail-val">{{ settlement.reason }}</div>
          </div>
          <div v-if="settlement.by" class="aql-detail-line">
            <div class="aql-detail-key">Settled By</div>
            <div class="aql-detail-val">{{ settlement.by }}</div>
          </div>
          <div v-if="settlement.at" class="aql-detail-line">
            <div class="aql-detail-key">Settled At</div>
            <div class="aql-detail-val">{{ settlement.at }}</div>
          </div>
        </div>
      </q-card-section>

      <!-- The note gets its own section rather than a grid row: it is free text and wraps,
           and squeezing a sentence into the value column of a key/value grid breaks the
           alignment every other line depends on. -->
      <template v-if="settlement.comment">
        <q-separator />

        <q-card-section class="q-py-sm">
          <div class="text-caption text-grey-8">{{ settlement.comment }}</div>
        </q-card-section>
      </template>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › View › SettlementDetails — Section (tier CP: resource + page).
 *
 * Renders ONLY when an invoice was force-settled for less (or more) than it billed. That gap
 * is the most surprising thing about an invoice's history — a PAID chip on a bill that never
 * collected its full value reads as a data error until the reason is stated — so it sits
 * directly under the header card, before the reader reaches the figures it explains.
 *
 * An ordinary card, not an alert: by the time anyone reads this the decision is already made
 * and recorded, so it is a fact about the invoice like any other, and it is read alongside
 * the billing lines rather than shouted over them.
 *
 * `settlementOf` in Layer 2 decides what counts as a settlement worth announcing (a zero
 * mismatch is just an ordinary payment), so this card holds no rule of its own and vanishes
 * entirely when there is nothing to say.
 *
 * No `<style>` block; `.aql-detail-*` are the canonical shared classes (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useInvoiceViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/View/useInvoiceViewContext'

defineOptions({ name: 'OutletConsumptionInvoicesViewSettlementDetails', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Settlement' }
})

const { evaluate, ui, settlement, money } = useInvoiceViewContext()

const finalTitle = computed(() => evaluate(props.title))
</script>
