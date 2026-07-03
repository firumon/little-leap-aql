<template>
  <q-card flat bordered>
    <q-card-section>
      <q-list>
        <q-item>
          <q-item-section>
            <q-item-label caption>Restocking Outlet</q-item-label>
            <q-item-label class="text-weight-bold">{{ outletName }}</q-item-label>
          </q-item-section>
          <q-item-section side><q-icon name="store" color="primary" size="md" /></q-item-section>
        </q-item>
        <template v-if="visitOptions && visitOptions.length">
          <q-item-label header class="text-weight-bold q-pb-none">Active Visit</q-item-label>
          <q-item
            v-for="opt in visitOptions" :key="opt.value"
            clickable :active="selectedVisitCode === opt.value"
            active-class="bg-grey-3 text-primary text-weight-bold rounded-borders"
            class="q-my-xs transition-all shadow-2 rounded-borders"
            @click="$emit('update-visit', opt.value === selectedVisitCode ? '' : opt.value)"
          >
            <q-item-section side>
              <q-checkbox
                :model-value="selectedVisitCode === opt.value"
                dense
                color="primary"
                @update:model-value="val => $emit('update-visit', val ? opt.value : '')"
              />
            </q-item-section>
            <q-item-section><q-item-label>{{ opt.label }}</q-item-label></q-item-section>
          </q-item>
        </template>
      </q-list>

    </q-card-section>
  </q-card>

  <template v-if="rows && rows.length">
    <!-- Items in Outlet -->
    <template v-if="existingItems.length">
      <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-lg">Items in Outlet</div>
      <AqlGroupedList
        :items="existingItems" header-label="productName" group-key="productCode"
        :header-chip="group => 'Final Qty: ' + group.items.map(item => item.OutletQuantity + item.Quantity).reduce((a, b) => a + b, 0)"
        label="skuLabel" :caption="item => `Warehouse: ${item.WarehouseQuantity - item.Quantity}`"
        chip="OutletQuantity"
      >
        <template #btn="{ item:row }">
          <div class="flex items-center q-gutter-x-xs items-stretch">
            <q-btn outline padding="sm" color="secondary" icon="remove" :disable="row.Quantity <= 0" @click="$emit('adjust-qty', row.SKU, -1)" @dblclick="$emit('adjust-qty', row.SKU, -5)"/>
            <q-input :model-value="row.Quantity" type="number" outlined dense @update:model-value="val => $emit('update-qty', row.SKU, val)" style="width: 48px;" input-class="text-center text-bold" />
            <q-btn outline padding="sm" color="secondary" icon="add" :disable="row.Quantity >= row.WarehouseQuantity" @click="$emit('adjust-qty', row.SKU, 1)" @dblclick="$emit('adjust-qty', row.SKU, 5)" />
          </div>

        </template>
      </AqlGroupedList>
    </template>
    <template v-if="newItems.length">
      <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-lg">New Items</div>
      <AqlGroupedList
        :items="newItems" header-label="productName" group-key="productCode"
        :header-chip="group => 'Final Qty: ' + group.items.map(item => item.OutletQuantity + item.Quantity).reduce((a, b) => a + b, 0)"
        label="skuLabel" :caption="item => `Warehouse Qty: ${item.WarehouseQuantity - item.Quantity}`"
      >
        <template #btn="{ item:row }">
          <div class="flex items-center q-gutter-x-xs items-stretch">
            <q-btn outline padding="sm" color="secondary" icon="remove" :disable="row.Quantity <= 0" @click="$emit('adjust-qty', row.SKU, -1)" @dblclick="$emit('adjust-qty', row.SKU, -5)"/>
            <q-input :model-value="row.Quantity" type="number" outlined dense @update:model-value="val => $emit('update-qty', row.SKU, val)" style="width: 48px;" input-class="text-center text-bold" />
            <q-btn outline padding="sm" color="secondary" icon="add" :disable="row.Quantity >= row.WarehouseQuantity" @click="$emit('adjust-qty', row.SKU, 1)" @dblclick="$emit('adjust-qty', row.SKU, 5)" />
          </div>

        </template>
      </AqlGroupedList>
<!--      <AqlList
        :items="newItems"
        item-key="SKU"
        highlight="true"
        :highlight-color="item => item.Quantity > 0 ? 'primary' : 'grey-3'"
        class="bg-white rounded-borders"
      >
        <template #item="{ item: row }">
          <div class="row items-center no-wrap full-width q-py-xs">
            &lt;!&ndash; Left side content &ndash;&gt;
            <div class="col q-pr-sm">
              <div class="text-subtitle2 text-weight-bold text-grey-9 q-mb-xs">
                {{ row.productName }}
              </div>
              <div class="row items-center q-gutter-x-xs text-caption text-grey-5 q-mb-xs">
                <q-icon name="tag" size="12px" />
                <span>SKU: {{ row.SKU }}</span>
              </div>
            </div>

          </div>
        </template>
      </AqlList>-->
    </template>
  </template>

  <template v-else>
    <div class="text-subtitle2 text-weight-bold q-mb-sm q-mt-lg">Adjust Items to Restock</div>
    <AqlList
      :items="[]"
      item-key="SKU"
      empty-text="No stock items available in selected Warehouse."
      class="bg-white rounded-borders"
    />
  </template>
</template>

<script setup>
import { computed } from 'vue'
import AqlList from '../../../shared/AqlList.vue'
import AqlGroupedList from "../../../shared/AqlGroupedList.vue";

defineOptions({ name: 'DirectRestockStockMatchStep' })

const props = defineProps({
  rows: { type: Array, default: () => [] },
  visitOptions: { type: Array, default: () => [] },
  selectedVisitCode: { type: String, default: '' },
  outletName: { type: String, default: '' }
})

const emit = defineEmits(['update-qty', 'adjust-qty', 'update-visit'])

const existingItems = computed(() => {
  return props.rows.filter(row => (row.OutletQuantity || 0) > 0)
})

const newItems = computed(() => {
  return props.rows.filter(row => (row.OutletQuantity || 0) <= 0)
})
</script>

<style scoped>
.border-grey {
  border: 1px solid #e2e8f0;
}
.bg-grey-0 {
  background-color: #f8fafc;
}
.text-green-9 {
  color: #1b5e20;
}
.bg-green-1 {
  background-color: #e8f5e9;
}
.border-green {
  border: 1px solid #c8e6c9;
}
.border-dashed {
  border-style: dashed;
}
.counter-btn {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
}
.animate-scale-up {
  animation: scaleUp 0.15s ease-out;
}
@keyframes scaleUp {
  from { transform: scale(0.97); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
