<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <q-btn icon="arrow_back" flat round @click="cancel" class="q-mr-sm" />
      <div class="text-h6">Create Purchase Order</div>
    </div>

    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">Source Quotation</div>
        <q-select
          v-model="selectedQuotationCode"
          :options="eligibleQuotations"
          label="Select Eligible Quotation"
          outlined
          dense
          emit-value
          map-options
          clearable
          @update:model-value="selectQuotation"
        />
        <div v-if="selectedQuotationCode" class="q-mt-sm text-caption text-grey-8">
          <div v-if="hasBlockingFullPo" class="text-negative text-weight-bold">
            <q-icon name="warning" /> A full PO already exists for this quotation. Cannot create another full PO.
          </div>
          <div>Supplier: {{ supplierName }}</div>
          <div>Currency: {{ form.Currency }}</div>
          <div v-if="!allowPartial" class="text-info text-weight-medium">
            Partial PO is disabled by this quotation. All remaining items will be ordered.
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="selectedQuotationCode" class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">PO Details</div>
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-md-6">
            <q-input
              v-model="form.PODate"
              type="date"
              label="PO Date"
              outlined
              dense
            />
          </div>
          <div class="col-12 col-md-6">
            <q-select
              v-model="form.ShipToWarehouseCode"
              :options="warehouseOptions"
              label="Ship To Warehouse"
              outlined
              dense
              emit-value
              map-options
            />
          </div>
          <div class="col-12">
            <q-input
              v-model="form.Remarks"
              type="textarea"
              label="Remarks"
              outlined
              dense
              autogrow
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="selectedQuotationCode" class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">PO Items</div>
        <q-markup-table class="po-items-table rounded-borders overflow-hidden shadow-1">
          <thead>
            <tr>
              <th v-if="allowPartial" class="text-left" style="width: 50px"></th>
              <th class="text-left">SKU</th>
              <th class="text-left">Description</th>
              <th class="text-left">UOM</th>
              <th class="text-right">Unit Price</th>
              <th class="text-right">Remaining</th>
              <th class="text-right" style="width: 150px">Order Qty</th>
              <th class="text-right">Line Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in items" :key="idx" :class="!item.Selected ? 'bg-grey-2' : ''">
              <td v-if="allowPartial" class="text-center">
                <q-checkbox v-model="item.Selected" @update:model-value="toggleItem(item)" />
              </td>
              <td>{{ item.SKU }}</td>
              <td class="ellipsis" style="max-width: 200px" :title="item.Description">{{ item.Description }}</td>
              <td>{{ item.UOM }}</td>
              <td class="text-right">{{ item.UnitPrice }}</td>
              <td class="text-right">{{ item.RemainingQuantity }}</td>
              <td class="text-right">
                <q-input
                  v-model.number="item.OrderedQuantity"
                  type="number"
                  dense
                  outlined
                  min="0"
                  :max="item.RemainingQuantity"
                  :readonly="!allowPartial || !item.Selected"
                  style="width: 100px; display: inline-block"
                  input-class="text-right"
                />
              </td>
              <td class="text-right text-weight-medium">
                {{ (item.OrderedQuantity * item.UnitPrice).toFixed(2) }}
              </td>
            </tr>
          </tbody>
        </q-markup-table>
        <div v-if="items.length === 0" class="text-center q-pa-md text-grey">
          No items found for this quotation.
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="selectedQuotationCode" class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1 q-mb-sm">Totals</div>
        <div class="row justify-end q-col-gutter-sm">
          <div class="col-12 col-sm-6 col-md-4">
            <q-list dense>
              <q-item>
                <q-item-section>Item Subtotal:</q-item-section>
                <q-item-section side class="text-weight-bold">{{ itemSubtotal.toFixed(2) }}</q-item-section>
              </q-item>
              <q-item v-if="extraChargesTotal > 0">
                <q-item-section>Extra Charges:</q-item-section>
                <q-item-section side>{{ extraChargesTotal.toFixed(2) }}</q-item-section>
              </q-item>
              <q-separator />
              <q-item>
                <q-item-section class="text-weight-bold text-primary">PO Total:</q-item-section>
                <q-item-section side class="text-weight-bold text-primary text-h6">{{ suggestedTotal.toFixed(2) }} {{ form.Currency }}</q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <div class="row justify-end q-gutter-sm q-mt-md" v-if="selectedQuotationCode">
      <q-btn label="Cancel" flat color="grey-7" @click="cancel" />
      <q-btn label="Create Purchase Order" color="primary" @click="save" :loading="saving" :disable="hasBlockingFullPo && !allowPartial" />
    </div>

  </q-page>
</template>

<script>
import { defineComponent, onMounted } from 'vue';
import { usePurchaseOrderCreateFlow } from '../../../composables/operations/purchaseOrders/usePurchaseOrderCreateFlow.js';

export default defineComponent({
  name: 'PurchaseOrdersAddPage',
  setup() {
    const flow = usePurchaseOrderCreateFlow();

    onMounted(() => {
      flow.loadData();
    });

    return {
      ...flow
    };
  }
});
</script>

<style scoped>
.po-items-table :deep(thead th) {
  background: #f5f5f5;
  font-weight: 700;
}

.po-items-table :deep(tbody tr:not(:last-child) td) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.po-items-table :deep(tbody tr:hover td) {
  background: rgba(0, 0, 0, 0.02);
}
</style>
