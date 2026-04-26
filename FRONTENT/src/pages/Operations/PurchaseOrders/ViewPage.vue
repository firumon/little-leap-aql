<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <q-btn icon="arrow_back" flat round @click="goToList" class="q-mr-sm" />
      <div class="text-h6">Purchase Order {{ record?.Code }}</div>
      <q-space />
      <q-chip :color="progress.color" text-color="white" :icon="progress.icon" class="text-weight-bold">
        {{ progress.label }}
      </q-chip>
    </div>

    <div v-if="loading && !record" class="flex flex-center q-py-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <div v-else-if="!record" class="text-center q-pa-xl text-grey">
      <q-icon name="error_outline" size="4em" color="negative" class="q-mb-sm" />
      <div class="text-h6">Purchase Order Not Found</div>
      <q-btn label="Back to List" flat color="primary" @click="goToList" class="q-mt-md" />
    </div>

    <div v-else>
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-md-8">
          <q-card class="h-100">
            <q-card-section>
              <div class="text-subtitle1 q-mb-md text-weight-bold">Order Details</div>
              <div class="row q-col-gutter-sm">
                <div class="col-6 col-sm-4">
                  <div class="text-caption text-grey">Supplier</div>
                  <div class="text-body2 text-weight-medium">{{ supplier?.Name || record.SupplierCode }}</div>
                </div>
                <div class="col-6 col-sm-4">
                  <div class="text-caption text-grey">PO Date</div>
                  <div class="text-body2">{{ formatDate(record.PODate) }}</div>
                </div>
                <div class="col-6 col-sm-4">
                  <div class="text-caption text-grey">Ship To Warehouse</div>
                  <div class="text-body2">{{ warehouse?.Name || record.ShipToWarehouseCode }}</div>
                </div>
                <div class="col-6 col-sm-4 q-mt-md">
                  <div class="text-caption text-grey">Quotation Code</div>
                  <div class="text-body2">{{ record.SupplierQuotationCode }}</div>
                </div>
                <div class="col-6 col-sm-6 q-mt-md">
                  <div class="text-caption text-grey">Procurement Code</div>
                  <div class="text-body2">{{ record.ProcurementCode }}</div>
                </div>
              </div>
              <div v-if="record.Remarks" class="q-mt-md bg-grey-2 q-pa-sm rounded-borders">
                <div class="text-caption text-grey text-weight-bold">Remarks</div>
                <div class="text-body2">{{ record.Remarks }}</div>
              </div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-md-4">
          <q-card class="h-100">
            <q-card-section>
              <div class="text-subtitle1 q-mb-md text-weight-bold">Actions</div>
              <div class="q-gutter-y-sm">
                <q-btn
                  v-for="action in availableActions"
                  :key="action.action"
                  :label="action.label"
                  :icon="action.icon"
                  :color="action.color"
                  outline
                  class="full-width justify-start"
                  @click="runAction(action)"
                  :loading="acting"
                />
              </div>
              <div v-if="availableActions.length > 0" class="q-mt-md">
                <q-input
                  v-model="actionComment"
                  type="textarea"
                  label="Action Comment (Required for Cancel)"
                  dense
                  outlined
                  autogrow
                />
              </div>
              <div v-if="availableActions.length === 0" class="text-grey text-center q-pa-md">
                No actions available for current status.
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <q-card class="q-mb-md" v-if="quotation">
        <q-card-section>
          <div class="text-subtitle1 q-mb-md text-weight-bold">Source Quotation Terms</div>
          <div class="row q-col-gutter-sm">
            <div class="col-6 col-sm-3">
              <div class="text-caption text-grey">Payment Term</div>
              <div class="text-body2">{{ quotation.PaymentTerm }}</div>
              <div class="text-caption text-grey ellipsis" :title="quotation.PaymentTermDetail">{{ quotation.PaymentTermDetail }}</div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="text-caption text-grey">Shipping Term</div>
              <div class="text-body2">{{ quotation.ShippingTerm }}</div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="text-caption text-grey">Lead Time</div>
              <div class="text-body2">{{ quotation.LeadTimeDays }} Days ({{ quotation.LeadTimeType }})</div>
            </div>
            <div class="col-6 col-sm-3">
              <div class="text-caption text-grey">Delivery Mode</div>
              <div class="text-body2">{{ quotation.DeliveryMode }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-subtitle1 q-mb-md text-weight-bold">Order Items</div>
          <q-markup-table class="po-items-table rounded-borders overflow-hidden shadow-1">
            <thead>
              <tr>
                <th class="text-left">SKU</th>
                <th class="text-left">Description</th>
                <th class="text-left">UOM</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Quoted Qty</th>
                <th class="text-right">Ordered Qty</th>
                <th class="text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in items" :key="idx">
                <td>{{ item.SKU }}</td>
                <td class="ellipsis" style="max-width: 200px" :title="item.Description">{{ item.Description }}</td>
                <td>{{ item.UOM }}</td>
                <td class="text-right">{{ formatCurrency(item.UnitPrice, record.Currency) }}</td>
                <td class="text-right">{{ item.QuotedQuantity }}</td>
                <td class="text-right text-weight-bold">{{ item.OrderedQuantity }}</td>
                <td class="text-right text-weight-medium">
                  {{ formatCurrency(lineTotal(item), record.Currency) }}
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </q-card-section>
      </q-card>

      <q-card>
        <q-card-section>
          <div class="text-subtitle1 q-mb-md text-weight-bold">Order Totals</div>
          <div class="row justify-end">
            <div class="col-12 col-sm-6 col-md-4">
              <q-list dense>
                <q-item>
                  <q-item-section>Item Subtotal:</q-item-section>
                  <q-item-section side class="text-weight-bold">{{ formatCurrency(subtotalAmount, record.Currency) }}</q-item-section>
                </q-item>
                <template v-for="(val, key) in extraCharges" :key="key">
                  <q-item v-if="normalizeNumber(val) > 0">
                    <q-item-section class="text-capitalize">{{ labelFor(key) }}:</q-item-section>
                    <q-item-section side>{{ formatCurrency(val, record.Currency) }}</q-item-section>
                  </q-item>
                </template>
                <q-separator />
                <q-item>
                  <q-item-section class="text-weight-bold text-primary">Grand Total:</q-item-section>
                  <q-item-section side class="text-weight-bold text-primary text-h6">{{ formatCurrency(record.TotalAmount, record.Currency) }}</q-item-section>
                </q-item>
              </q-list>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue';
import { usePurchaseOrderView } from '../../../composables/operations/purchaseOrders/usePurchaseOrderView.js';

defineOptions({
  name: 'PurchaseOrdersViewPage'
});

const viewFlow = usePurchaseOrderView();
const {
  record,
  progress,
  loading,
  supplier,
  warehouse,
  availableActions,
  acting,
  actionComment,
  quotation,
  items,
  subtotalAmount,
  extraCharges,
  goToList,
  formatDate,
  runAction,
  formatCurrency,
  lineTotal,
  normalizeNumber,
  labelFor
} = viewFlow;

onMounted(() => {
  viewFlow.loadData();
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
