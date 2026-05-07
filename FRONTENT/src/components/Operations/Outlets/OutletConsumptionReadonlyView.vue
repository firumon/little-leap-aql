<template>
  <div class="column q-gutter-md">
    <q-card flat bordered>
      <q-card-section>
        <div class="text-h6">{{ outletName(record.OutletCode) }}</div>
        <div class="text-caption text-grey-7">{{ formatDate(record.Date) }} · {{ record.Username }}</div>
        <div class="text-caption text-grey-7">Consumption {{ record.Code }} · {{ record.Progress }}</div>
        <div v-if="record.OutletVisitCode" class="text-caption text-grey-7">Visit {{ visitLabel(record.OutletVisitCode) }}</div>
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
          <q-item-section side>{{ item.Qty }}</q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </div>
</template>

<script setup>
defineOptions({ name: 'OutletConsumptionReadonlyView' })
defineProps({
  record: { type: Object, required: true },
  items: { type: Array, default: () => [] },
  outletName: { type: Function, required: true },
  visitLabel: { type: Function, required: true },
  formatDate: { type: Function, required: true }
})
</script>
