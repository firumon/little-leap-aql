<template>
  <div>
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!quotation" class="text-center q-py-lg">
        <q-icon name="request_quote" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No quotation</div>
        <div :class="ui.emptyCaptionClass">This record could not be loaded.</div>
      </q-card-section>

      <q-card-section v-else>
        <div :class="ui.detailGridClass">
          <div class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(0)">
            <span :class="ui.detailKeyClass">Progress</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <q-icon :name="statusIcon" size="16px" :color="statusColor" class="q-mr-xs" />
              <q-badge rounded :color="statusColor" :label="statusLabel" />
            </span>
          </div>

          <div class="items-center" :class="[ui.detailLineClass, ui.detailRowClass]" :style="rowDelay(1)">
            <span :class="ui.detailKeyClass">Response</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              <q-badge rounded outline :color="responseColor(quotation.ResponseType)" :label="responseLabel(quotation.ResponseType)" />
            </span>
          </div>

          <div
            v-for="(line, index) in facts"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index + 2)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">{{ line.value }}</span>
          </div>
        </div>

        <q-banner v-if="declined" dense rounded class="bg-grey-2 q-mt-sm text-caption">
          {{ quotation.DeclineReason || 'The supplier declined to quote.' }}
        </q-banner>

        <q-banner v-else-if="expired" dense rounded class="bg-orange-2 q-mt-sm text-caption">
          This quotation has passed its validity date. Confirm prices before ordering.
        </q-banner>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useQuotationView } from 'src/_ui/AQL/composables/Operation/SupplierQuotations/View/useQuotationView'
import { useQuotationViewContext } from 'src/_ui/AQL/composables/Operation/SupplierQuotations/View/useQuotationViewContext'

defineOptions({ name: 'SupplierQuotationsViewQuotationHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Quotation Details' },
  color: { type: [String, Function], default: null }
})

const { evaluate, ui } = useQuotationViewContext()
const {
  quotation,
  pending,
  supplierName,
  declined,
  expired,
  expiryDays,
  partialAllowed,
  progressColor,
  progressIcon,
  progressLabel,
  responseColor,
  responseLabel
} = useQuotationView()

const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() => evaluate(props.color) || progressColor(quotation.value?.Progress))
const statusIcon = computed(() => progressIcon(quotation.value?.Progress))
const statusLabel = computed(() => progressLabel(quotation.value?.Progress))

const facts = computed(() => {
  const record = quotation.value
  if (!record) return []
  const days = expiryDays.value
  const validUntil = record.ValidUntilDate
    ? `${record.ValidUntilDate}${Number.isFinite(days) && days >= 0 ? ` (${days} days left)` : ''}`
    : ''
  return [
    { label: 'Supplier', value: supplierName.value },
    { label: 'Supplier Ref', value: record.SupplierQuotationReference },
    { label: 'Response Date', value: record.ResponseDate },
    { label: 'Valid Until', value: validUntil },
    { label: 'Lead Time', value: record.LeadTimeDays ? `${record.LeadTimeDays} days` : '' },
    { label: 'Shipping', value: record.ShippingTerm },
    { label: 'Payment', value: record.PaymentTerm },
    { label: 'Partial PO', value: partialAllowed.value ? 'Allowed' : 'Not allowed' },
    { label: 'RFQ', value: record.RFQCode }
  ].filter((line) => String(line.value ?? '').trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
