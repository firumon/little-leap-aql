<template>
  <div class="column q-gutter-md">
    <q-card flat bordered>
      <q-card-section>
        <div class="row items-start justify-between q-col-gutter-md">
          <div>
            <div class="text-h6">{{ outletName(record.OutletCode) }}</div>
            <div class="text-caption text-grey-7">{{ formatDate(record.Date) }} · {{ record.Username }}</div>
            <div class="text-caption text-grey-7">Consumption {{ record.Code }}</div>
            <div v-if="record.OutletVisitCode" class="text-caption text-grey-7">Visit {{ visitLabel(record.OutletVisitCode) }}</div>
          </div>
          <q-btn color="primary" icon="receipt_long" label="Generate Invoice" :loading="acting" @click="$emit('generate-invoice')" />
        </div>
      </q-card-section>
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
defineOptions({ name: 'OutletConsumptionPendingInvoiceView' })
defineProps({
  record: { type: Object, required: true },
  items: { type: Array, default: () => [] },
  acting: { type: Boolean, default: false },
  outletName: { type: Function, required: true },
  visitLabel: { type: Function, required: true },
  formatDate: { type: Function, required: true }
})
defineEmits(['generate-invoice'])
</script>
