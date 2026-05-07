<template>
  <div class="column q-gutter-md">
    <q-card flat bordered>
      <q-card-section>
        <div class="text-h6">{{ outletName(record.OutletCode) }}</div>
        <div class="text-caption text-grey-7">{{ formatDate(record.Date) }} · {{ record.Username }}</div>
        <div class="text-caption text-grey-7">Consumption {{ record.Code }}</div>
        <div v-if="record.OutletVisitCode" class="text-caption text-grey-7">Visit {{ visitLabel(record.OutletVisitCode) }}</div>
      </q-card-section>
    </q-card>
    <q-card flat bordered>
      <q-card-section class="row items-center justify-between">
        <div>
          <div class="text-subtitle1 text-weight-medium">Invoice</div>
          <div class="text-caption text-grey-7">{{ invoice?.Code || 'No active invoice found' }}</div>
        </div>
        <q-btn v-if="invoice?.Code" flat color="primary" icon="open_in_new" label="Open" @click="$emit('open-invoice', invoice.Code)" />
      </q-card-section>
      <q-separator />
      <q-list dense>
        <q-item><q-item-section><q-item-label caption>Price List</q-item-label><q-item-label>{{ invoice?.PriceListCode || 'Not priced' }}</q-item-label></q-item-section></q-item>
        <q-item><q-item-section><q-item-label caption>Subtotal / Discount / Tax</q-item-label><q-item-label>{{ invoice?.Subtotal || 0 }} / {{ invoice?.Discount || 0 }} / {{ invoice?.Tax || 0 }}</q-item-label></q-item-section></q-item>
        <q-item><q-item-section><q-item-label caption>Progress</q-item-label><q-item-label>{{ invoice?.Progress || '-' }}</q-item-label></q-item-section></q-item>
      </q-list>
    </q-card>
    <q-card flat bordered>
      <q-card-section><div class="text-subtitle1 text-weight-medium">Sold Items</div></q-card-section>
      <q-list separator>
        <q-item v-for="item in items" :key="item.Code">
          <q-item-section>
            <q-item-label>{{ item.displayName }}</q-item-label>
            <q-item-label caption>{{ item.SKU }}</q-item-label>
          </q-item-section>
          <q-item-section side><q-chip dense color="positive" text-color="white">{{ item.Qty }}</q-chip></q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </div>
</template>

<script setup>
defineOptions({ name: 'OutletConsumptionInvoiceGeneratedView' })
defineProps({
  record: { type: Object, required: true },
  invoice: { type: Object, default: null },
  items: { type: Array, default: () => [] },
  outletName: { type: Function, required: true },
  visitLabel: { type: Function, required: true },
  formatDate: { type: Function, required: true }
})
defineEmits(['open-invoice'])
</script>
