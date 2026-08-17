<template>
  <div v-if="settlement" :class="spacingClass">
    <q-banner dense rounded class="bg-orange-1 text-orange-10">
      <template #avatar>
        <q-icon name="price_check" color="orange-9" />
      </template>

      <div class="text-weight-bold">
        Settled with a {{ money(settlement.amount) }} difference
      </div>
      <div class="text-caption">
        Reason: {{ settlement.reason }}
      </div>
      <div v-if="settlement.comment" class="text-caption q-mt-xs">
        &ldquo;{{ settlement.comment }}&rdquo;
      </div>
      <div v-if="settlement.by" class="text-caption text-grey-8 q-mt-xs">
        {{ settlement.by }}<span v-if="settlement.at"> &bull; {{ settlement.at }}</span>
      </div>
    </q-banner>
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › View › SettlementBanner — Section (tier CP: resource + page).
 *
 * Renders ONLY when an invoice was force-settled for less (or more) than it billed. That
 * gap is the single most surprising thing about an invoice's history — a PAID chip on a bill
 * that never collected its full value looks like a data error until the reason is stated —
 * so it is announced at the top rather than buried in the audit trail.
 *
 * `settlementOf` in Layer 2 decides what counts as a settlement worth announcing (a zero
 * mismatch is just an ordinary payment), so this card holds no rule of its own and vanishes
 * entirely when there is nothing to say.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import { useInvoiceViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/View/useInvoiceViewContext'

defineOptions({ name: 'OutletConsumptionInvoicesViewSettlementBanner', inheritAttrs: false })

const props = defineProps({
  padding: { type: String, default: 'sm' }
})

const { settlement, money } = useInvoiceViewContext()

const spacingClass = computed(() => `q-px-${props.padding} q-mb-sm`)
</script>

