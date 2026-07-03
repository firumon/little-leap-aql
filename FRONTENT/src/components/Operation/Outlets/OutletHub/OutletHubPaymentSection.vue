<template>
  <q-card flat bordered class="bg-white shadow-1">
    <q-card-section class="row items-center justify-between">
      <div class="row items-center">
        <q-icon name="payments" color="negative" size="22px" class="q-mr-sm" />
        <div>
          <div class="text-subtitle1 text-weight-bold text-negative">Unpaid Invoices &amp; Payments</div>
          <div class="text-caption text-grey-7">Collect payment for an invoice, or record an aggregated payment</div>
        </div>
      </div>
      <q-btn
        v-if="canCreatePayment"
        unelevated
        color="negative"
        icon="payments"
        label="Payment Collection"
        :disable="!selectedOutletCode"
        @click="$emit('payment-collection')"
      />
    </q-card-section>
    <q-separator />
    <q-card-section class="q-pa-none">
      <q-item v-if="!unpaidInvoices.length" class="empty-state-container q-py-lg text-center">
        <q-item-section>
          <q-icon name="check_circle" color="positive" size="36px" class="q-mb-xs block q-mx-auto" />
          <q-item-label class="text-subtitle2 text-weight-bold text-positive">All Settled</q-item-label>
          <q-item-label class="text-caption text-grey-6">No outstanding invoices for this outlet.</q-item-label>
        </q-item-section>
      </q-item>
      <AqlList
        v-else
        :items="unpaidInvoices"
        item-key="Code"
        icon="receipt_long"
        icon-color="negative"
        :content="[
          inv => inv.Code,
          inv => inv.Date ? formatDisplayDate(inv.Date) : 'No date'
        ]"
        :meta="[inv => `Bal: ${formatMoney(remainingFor(inv))}`]"
        :meta-layout="['label']"
      >
        <template #btn="{ item }">
          <q-btn
            v-if="canCreatePayment"
            unelevated
            dense
            color="negative"
            icon="payments"
            label="Collect"
            @click.stop="$emit('collect', item.Code)"
          />
        </template>
      </AqlList>
    </q-card-section>
    <q-separator />
    <q-card-section>
      <div class="text-caption text-grey-7 text-weight-bold q-mb-xs">Recent Payments</div>
      <AqlList
        :items="recentPayments"
        item-key="Code"
        icon="payments"
        icon-color="positive"
        :content="[
          pay => pay.Code,
          pay => pay.Date ? formatDisplayDate(pay.Date) : 'No date'
        ]"
        :meta="[pay => formatMoney(pay.Amount)]"
        :meta-layout="['label']"
        empty-text="No recent payments for this outlet."
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
import AqlList from '../../../shared/AqlList.vue'

defineOptions({ name: 'OutletHubPaymentSection' })

defineProps({
  selectedOutletCode: { type: String, default: '' },
  unpaidInvoices: { type: Array, required: true },
  recentPayments: { type: Array, required: true },
  canCreatePayment: { type: Boolean, required: true },
  formatMoney: { type: Function, required: true },
  formatDisplayDate: { type: Function, required: true },
  remainingFor: { type: Function, required: true }
})

defineEmits(['collect', 'payment-collection'])
</script>
