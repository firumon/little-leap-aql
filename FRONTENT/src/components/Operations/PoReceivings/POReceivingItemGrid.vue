<template>
  <div>
    <div class="gt-xs po-receiving-table-wrap">
      <q-markup-table class="po-receiving-table" flat bordered>
        <thead>
          <tr>
            <th class="text-left">Product</th>
            <th class="text-right">Expected</th>
            <th class="text-right">Received</th>
            <th class="text-right">Damaged</th>
            <th class="text-right">Rejected</th>
            <th class="text-right">Accepted</th>
            <th class="text-right">Short</th>
            <th class="text-right">Excess</th>
            <th class="text-left">Rejected Reason</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in items" :key="itemKey(item, index)">
            <td class="po-receiving-product-cell">
              <div class="text-weight-medium">{{ item.ProductName || item.SKU || '-' }}</div>
              <div class="text-caption text-grey-7">{{ item.VariantCaption || item.SKU || '-' }}</div>
            </td>
            <td class="text-right">{{ item.ExpectedQty }}</td>
            <td class="text-right"><q-input v-if="editable" :model-value="item.ReceivedQty" type="number" dense outlined input-class="text-right" @update:model-value="value => update(index, { ReceivedQty: value })" /><span v-else>{{ item.ReceivedQty }}</span></td>
            <td class="text-right"><q-input v-if="editable" :model-value="item.DamagedQty" type="number" dense outlined input-class="text-right" @update:model-value="value => update(index, { DamagedQty: value })" /><span v-else>{{ item.DamagedQty }}</span></td>
            <td class="text-right"><q-input v-if="editable" :model-value="item.RejectedQty" type="number" dense outlined input-class="text-right" @update:model-value="value => update(index, { RejectedQty: value })" /><span v-else>{{ item.RejectedQty }}</span></td>
            <td class="text-right text-positive text-weight-bold">{{ item.AcceptedQty }}</td>
            <td class="text-right text-warning">{{ item.ShortQty }}</td>
            <td class="text-right text-info">{{ item.ExcessQty }}</td>
            <td class="po-receiving-reason-cell"><q-input v-if="editable" :model-value="item.RejectedReason" dense outlined @update:model-value="value => update(index, { RejectedReason: value })" /><span v-else>{{ item.RejectedReason || '-' }}</span></td>
          </tr>
        </tbody>
      </q-markup-table>
    </div>

    <q-list class="lt-sm po-receiving-mobile-list" separator>
      <q-item v-for="(item, index) in items" :key="itemKey(item, index)" class="q-px-none">
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ item.ProductName || item.SKU || '-' }}</q-item-label>
          <q-item-label caption>{{ item.VariantCaption || item.SKU || '-' }}</q-item-label>

          <div class="row q-col-gutter-sm q-mt-sm">
            <div class="col-6">
              <div class="text-caption text-grey-7">Expected</div>
              <div class="text-weight-medium">{{ item.ExpectedQty }}</div>
            </div>
            <div class="col-6">
              <div class="text-caption text-grey-7">Accepted</div>
              <div class="text-positive text-weight-bold">{{ item.AcceptedQty }}</div>
            </div>
            <div class="col-6">
              <div class="text-caption text-grey-7">Short</div>
              <div class="text-warning">{{ item.ShortQty }}</div>
            </div>
            <div class="col-6">
              <div class="text-caption text-grey-7">Excess</div>
              <div class="text-info">{{ item.ExcessQty }}</div>
            </div>
          </div>

          <div class="row q-col-gutter-sm q-mt-sm">
            <div class="col-12">
              <q-input v-if="editable" :model-value="item.ReceivedQty" type="number" label="Received" dense outlined @update:model-value="value => update(index, { ReceivedQty: value })" />
              <div v-else><span class="text-caption text-grey-7">Received</span><div>{{ item.ReceivedQty }}</div></div>
            </div>
            <div class="col-6">
              <q-input v-if="editable" :model-value="item.DamagedQty" type="number" label="Damaged" dense outlined @update:model-value="value => update(index, { DamagedQty: value })" />
              <div v-else><span class="text-caption text-grey-7">Damaged</span><div>{{ item.DamagedQty }}</div></div>
            </div>
            <div class="col-6">
              <q-input v-if="editable" :model-value="item.RejectedQty" type="number" label="Rejected" dense outlined @update:model-value="value => update(index, { RejectedQty: value })" />
              <div v-else><span class="text-caption text-grey-7">Rejected</span><div>{{ item.RejectedQty }}</div></div>
            </div>
            <div class="col-12">
              <q-input v-if="editable" :model-value="item.RejectedReason" label="Rejected Reason" dense outlined autogrow @update:model-value="value => update(index, { RejectedReason: value })" />
              <div v-else><span class="text-caption text-grey-7">Rejected Reason</span><div>{{ item.RejectedReason || '-' }}</div></div>
            </div>
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup>
defineProps({ items: { type: Array, default: () => [] }, editable: { type: Boolean, default: false } })
const emit = defineEmits(['update:item'])
function update(index, patch) { emit('update:item', index, patch) }
function itemKey(item, index) { return item.PurchaseOrderItemCode || item.Code || index }
</script>

<style scoped>
.po-receiving-table-wrap {
  max-height: 62vh;
  overflow: auto;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
}

.po-receiving-table {
  min-width: 980px;
}

.po-receiving-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fff;
}

.po-receiving-product-cell {
  min-width: 220px;
  white-space: normal;
}

.po-receiving-reason-cell {
  min-width: 220px;
}

.po-receiving-mobile-list {
  max-height: 68vh;
  overflow-y: auto;
}
</style>
