<template>
  <div class="sq-add">
    <q-card flat bordered>
      <q-card-section class="row items-center no-wrap q-pa-sm">
        <div class="col">
          <div class="text-h6">Record Supplier Quotation</div>
          <div class="text-caption text-grey-6">Capture normalized supplier response data from external quotations.</div>
        </div>
        <q-btn flat round icon="refresh" color="primary" :loading="loading" @click="loadData(true)">
          <q-tooltip>Refresh data</q-tooltip>
        </q-btn>
      </q-card-section>
    </q-card>

    <q-card flat bordered>
      <q-card-section class="q-pa-sm">
        <div class="text-subtitle2 q-mb-sm">RFQ</div>
        <q-input v-model="rfqSearch" dense outlined clearable placeholder="Search sent RFQs" class="q-mb-sm">
          <template #prepend><q-icon name="search" /></template>
        </q-input>
        <div class="sq-grid">
          <q-card
            v-for="rfq in sentRfqs"
            :key="rfq.Code"
            flat
            bordered
            class="cursor-pointer"
            :class="{ 'sq-selected': selectedRfq?.Code === rfq.Code }"
            @click="selectRfq(rfq)"
          >
            <q-card-section class="q-pa-sm">
              <q-chip dense color="primary" text-color="white">{{ rfq.Code }}</q-chip>
              <div class="text-subtitle2 q-mt-xs">{{ rfq.ProcurementCode || '-' }}</div>
              <div class="text-caption text-grey-7">Deadline {{ formatDate(rfq.SubmissionDeadline) }}</div>
            </q-card-section>
          </q-card>
        </div>
        <div v-if="!sentRfqs.length && !loading" class="text-caption text-grey-6">No sent RFQs available.</div>
      </q-card-section>
    </q-card>

    <q-card v-if="selectedRfq" flat bordered>
      <q-card-section class="q-pa-sm">
        <div class="text-subtitle2 q-mb-sm">Supplier</div>
        <div class="sq-grid">
          <q-card
            v-for="supplier in assignedSuppliers"
            :key="supplier.Code"
            flat
            bordered
            class="cursor-pointer"
            :class="{ 'sq-selected': selectedSupplierCode === supplier.SupplierCode }"
            @click="selectSupplier(supplier)"
          >
            <q-card-section class="q-pa-sm">
              <q-chip dense outline>{{ supplier.Progress || 'ASSIGNED' }}</q-chip>
              <div class="text-subtitle2 q-mt-xs">{{ supplier.SupplierName }}</div>
              <div class="text-caption text-grey-7">{{ supplier.SupplierCode }}</div>
            </q-card-section>
          </q-card>
        </div>
        <q-banner v-if="existingSupplierQuotations.length" rounded class="bg-orange-1 text-orange-10 q-mt-sm">
          This supplier already has {{ existingSupplierQuotations.length }} quotation response(s) for this RFQ.
        </q-banner>
      </q-card-section>
    </q-card>

    <q-card v-if="selectedSupplierCode" flat bordered>
      <q-card-section class="q-pa-sm">
        <div class="text-subtitle2 q-mb-sm">Response</div>
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-4">
            <q-select v-model="form.ResponseType" :options="optionSets.responseTypes" emit-value map-options dense outlined label="Response Type" />
          </div>
          <div class="col-12 col-sm-4">
            <q-input v-model="form.ResponseDate" dense outlined label="Response Date">
              <template #append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date v-model="form.ResponseDate" mask="YYYY-MM-DD">
                      <div class="row justify-end q-pa-sm"><q-btn v-close-popup flat color="primary" label="Done" /></div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
          <div class="col-12 col-sm-4">
            <q-input
              v-model="form.SupplierQuotationReference"
              dense
              outlined
              label="Supplier Quotation Reference"
            />
          </div>
          <div class="col-12" v-if="form.ResponseType === 'DECLINED'">
            <q-input v-model="form.DeclineReason" dense outlined autogrow label="Decline Reason" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <template v-if="selectedSupplierCode && form.ResponseType !== 'DECLINED'">
      <q-card flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-subtitle2 q-mb-sm">Terms</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-3"><q-input v-model.number="form.LeadTimeDays" type="number" min="0" dense outlined label="Lead Time Days" /></div>
            <div class="col-12 col-sm-3"><q-select v-model="form.LeadTimeType" :options="optionSets.leadTimeTypes" emit-value map-options dense outlined label="Lead Time Type" /></div>
            <div class="col-12 col-sm-3"><q-select v-model="form.DeliveryMode" :options="optionSets.deliveryModes" emit-value map-options dense outlined label="Delivery Mode" /></div>
            <div class="col-12 col-sm-3"><q-select v-model="form.Currency" :options="optionSets.currencies" emit-value map-options dense outlined label="Currency" /></div>
            <div class="col-12 col-sm-3"><q-select v-model="form.ShippingTerm" :options="optionSets.shippingTerms" emit-value map-options dense outlined label="Shipping Term" /></div>
            <div class="col-12 col-sm-3"><q-select v-model="form.PaymentTerm" :options="optionSets.paymentTerms" emit-value map-options dense outlined label="Payment Term" /></div>
            <div class="col-12 col-sm-3"><q-input v-model.number="form.QuotationValidityDays" type="number" min="0" dense outlined label="Validity Days" /></div>
            <div class="col-12 col-sm-3"><q-input v-model="form.ValidUntilDate" dense outlined label="Valid Until" /></div>
            <div class="col-12 col-sm-3 row items-center">
              <q-toggle
                v-model="form.AllowPartialPO"
                :label="form.AllowPartialPO ? 'Allow Partial PO: TRUE' : 'Allow Partial PO: FALSE'"
              />
            </div>
            <div class="col-12 col-sm-6 row items-center q-gutter-md">
              <q-toggle v-model="form.AllowPartialDelivery" label="Partial Delivery" />
              <q-toggle v-model="form.AllowSplitShipment" label="Split Shipment" />
            </div>
            <div class="col-12"><q-input v-model="form.PaymentTermDetail" dense outlined autogrow label="Payment Term Detail" /></div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-subtitle2 q-mb-sm">Items</div>
          <q-list bordered separator>
            <q-item v-for="item in items" :key="item.PurchaseRequisitionItemCode">
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ item.SKU }} · {{ item.Description || '-' }}</q-item-label>
                <q-item-label caption>PR Item {{ item.PurchaseRequisitionItemCode }} · Requested {{ item.RequestedQuantity || '-' }} {{ item.UOM || '' }}</q-item-label>
                <div class="row q-col-gutter-xs q-mt-xs">
                  <div class="col-6 col-sm-3"><q-input v-model.number="item.Quantity" dense outlined type="number" min="0" label="Qty" /></div>
                  <div class="col-6 col-sm-3"><q-input v-model.number="item.UnitPrice" dense outlined type="number" min="0" label="Unit Price" /></div>
                  <div class="col-6 col-sm-3"><q-input :model-value="item.Quantity * item.UnitPrice" dense outlined readonly label="Total" /></div>
                  <div class="col-6 col-sm-3"><q-input v-model.number="item.LeadTimeDays" dense outlined type="number" min="0" label="Lead Days" /></div>
                  <div class="col-12"><q-input v-model="item.Remarks" dense outlined label="Remarks" /></div>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <q-card flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-subtitle2 q-mb-sm">Charges And Summary</div>
          <div class="row q-col-gutter-sm">
            <div v-for="key in Object.keys(form.ExtraChargesBreakup)" :key="key" class="col-6 col-sm-2">
              <q-input v-model.number="form.ExtraChargesBreakup[key]" dense outlined type="number" min="0" :label="key" />
            </div>
            <div class="col-12 col-sm-4"><q-input :model-value="formatCurrency(itemSubtotal, form.Currency)" dense outlined readonly label="Item Subtotal" /></div>
            <div class="col-12 col-sm-4"><q-input :model-value="formatCurrency(extraChargesTotal, form.Currency)" dense outlined readonly label="Extra Charges" /></div>
            <div class="col-12 col-sm-4"><q-input v-model.number="form.TotalAmount" dense outlined type="number" min="0" label="Confirmed Total" /></div>
            <div class="col-12"><q-input v-model="form.Remarks" dense outlined autogrow label="Remarks" /></div>
          </div>
        </q-card-section>
      </q-card>
    </template>

    <q-card v-if="selectedSupplierCode" flat bordered>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" @click="cancel" />
        <q-btn color="primary" icon="save" label="Save" :loading="saving" :disable="!canSave" @click="save" />
      </q-card-actions>
    </q-card>
  </div>
</template>

<script setup>
import { useSupplierQuotationCreateFlow } from 'src/composables/operations/supplierQuotations/useSupplierQuotationCreateFlow'

const {
  loading,
  saving,
  rfqSearch,
  selectedSupplierCode,
  form,
  items,
  optionSets,
  sentRfqs,
  selectedRfq,
  assignedSuppliers,
  existingSupplierQuotations,
  itemSubtotal,
  extraChargesTotal,
  canSave,
  loadData,
  selectRfq,
  selectSupplier,
  save,
  cancel,
  formatDate,
  formatCurrency
} = useSupplierQuotationCreateFlow()
</script>

<style scoped>
.sq-add { display: grid; gap: 8px; }
.sq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}
.sq-selected {
  border-color: var(--q-primary);
  box-shadow: 0 0 0 1px var(--q-primary);
}
</style>
