<template>
  <div class="sq-view">
    <q-card flat bordered>
      <q-card-section v-if="loading && !record" class="text-center q-py-xl">
        <q-spinner-dots color="primary" size="36px" />
      </q-card-section>

      <q-card-section v-else-if="!record" class="text-center q-py-xl text-grey-6">
        <q-icon name="search_off" size="48px" color="grey-4" />
        <div class="q-mt-sm">Supplier quotation not found</div>
        <q-btn flat color="primary" label="Back to Supplier Quotations" class="q-mt-sm" @click="goToList" />
      </q-card-section>

      <template v-else>
        <q-card-section class="q-pa-sm">
          <div class="row items-start no-wrap">
            <div class="col">
              <div class="text-overline text-primary">Supplier Quotation</div>
              <div class="text-h6">{{ form.Code }}</div>
              <div class="row q-gutter-xs q-mt-xs">
                <q-chip dense color="primary" text-color="white">{{ form.Progress }}</q-chip>
                <q-chip dense outline>{{ form.ResponseType }}</q-chip>
                <q-chip dense outline>{{ formatCurrency(form.TotalAmount, form.Currency) }}</q-chip>
              </div>
            </div>
            <q-btn flat round icon="list" color="primary" @click="goToList">
              <q-tooltip>Back to Supplier Quotations</q-tooltip>
            </q-btn>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section class="q-pa-sm">
          <div class="row q-col-gutter-sm">
            <InfoCell label="RFQ" :value="form.RFQCode" />
            <InfoCell label="Supplier" :value="supplier?.Name || form.SupplierCode" />
            <InfoCell label="Procurement" :value="form.ProcurementCode" />
            <InfoCell label="Response Date" :value="formatDate(form.ResponseDate)" />
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section class="q-pa-sm">
          <div class="text-subtitle2 q-mb-sm">{{ isEditable ? 'Editable Response' : 'Response Details' }}</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-3">
              <q-select v-model="form.ResponseType" :options="optionSets.responseTypes" emit-value map-options dense outlined label="Response Type" :readonly="isReadonly" />
            </div>
            <div class="col-12 col-sm-3"><q-input v-model="form.ResponseDate" dense outlined label="Response Date" :readonly="isReadonly" /></div>
            <div v-if="form.ResponseType === 'DECLINED'" class="col-12"><q-input v-model="form.DeclineReason" dense outlined autogrow label="Decline Reason" :readonly="isReadonly" /></div>
            <template v-else>
              <div class="col-12 col-sm-3"><q-input v-model.number="form.LeadTimeDays" dense outlined type="number" min="0" label="Lead Days" :readonly="isReadonly" /></div>
              <div class="col-12 col-sm-3"><q-select v-model="form.LeadTimeType" :options="optionSets.leadTimeTypes" emit-value map-options dense outlined label="Lead Type" :readonly="isReadonly" /></div>
              <div class="col-12 col-sm-3"><q-select v-model="form.DeliveryMode" :options="optionSets.deliveryModes" emit-value map-options dense outlined label="Delivery" :readonly="isReadonly" /></div>
              <div class="col-12 col-sm-3"><q-select v-model="form.ShippingTerm" :options="optionSets.shippingTerms" emit-value map-options dense outlined label="Shipping" :readonly="isReadonly" /></div>
              <div class="col-12 col-sm-3"><q-select v-model="form.PaymentTerm" :options="optionSets.paymentTerms" emit-value map-options dense outlined label="Payment" :readonly="isReadonly" /></div>
              <div class="col-12 col-sm-3"><q-input v-model.number="form.QuotationValidityDays" dense outlined type="number" min="0" label="Validity Days" :readonly="isReadonly" /></div>
              <div class="col-12 col-sm-3"><q-input v-model="form.ValidUntilDate" dense outlined label="Valid Until" :readonly="isReadonly" /></div>
              <div class="col-12 col-sm-3"><q-select v-model="form.Currency" :options="optionSets.currencies" emit-value map-options dense outlined label="Currency" :readonly="isReadonly" /></div>
              <div class="col-12"><q-input v-model="form.PaymentTermDetail" dense outlined autogrow label="Payment Detail" :readonly="isReadonly" /></div>
            </template>
            <div class="col-12"><q-input v-model="form.Remarks" dense outlined autogrow label="Remarks" :readonly="isReadonly" /></div>
          </div>
        </q-card-section>

        <q-card-section v-if="form.ResponseType !== 'DECLINED'" class="q-pa-sm">
          <div class="text-subtitle2 q-mb-sm">Items</div>
          <q-list bordered separator>
            <q-item v-for="item in items" :key="item.PurchaseRequisitionItemCode">
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ item.SKU }} · {{ item.Description || '-' }}</q-item-label>
                <q-item-label caption>PR Item {{ item.PurchaseRequisitionItemCode }} · Requested {{ item.RequestedQuantity || '-' }} {{ item.UOM || '' }}</q-item-label>
                <div class="row q-col-gutter-xs q-mt-xs">
                  <div class="col-6 col-sm-3"><q-input v-model.number="item.Quantity" dense outlined type="number" min="0" label="Qty" :readonly="isReadonly" /></div>
                  <div class="col-6 col-sm-3"><q-input v-model.number="item.UnitPrice" dense outlined type="number" min="0" label="Unit Price" :readonly="isReadonly" /></div>
                  <div class="col-6 col-sm-3"><q-input :model-value="item.Quantity * item.UnitPrice" dense outlined readonly label="Total" /></div>
                  <div class="col-6 col-sm-3"><q-input v-model.number="item.LeadTimeDays" dense outlined type="number" min="0" label="Lead Days" :readonly="isReadonly" /></div>
                  <div class="col-12"><q-input v-model="item.Remarks" dense outlined label="Remarks" :readonly="isReadonly" /></div>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-section class="q-pa-sm">
          <div class="row q-col-gutter-sm">
            <div v-for="key in Object.keys(form.ExtraChargesBreakup)" :key="key" class="col-6 col-sm-2">
              <q-input v-model.number="form.ExtraChargesBreakup[key]" dense outlined type="number" min="0" :label="key" :readonly="isReadonly" />
            </div>
            <div class="col-12 col-sm-4"><q-input :model-value="formatCurrency(itemSubtotal, form.Currency)" dense outlined readonly label="Item Subtotal" /></div>
            <div class="col-12 col-sm-4"><q-input v-model.number="form.TotalAmount" dense outlined type="number" min="0" label="Confirmed Total" :readonly="isReadonly" /></div>
          </div>
        </q-card-section>

        <q-card-section v-if="progress === 'REJECTED'" class="q-pa-sm">
          <q-banner rounded class="bg-red-1 text-red-10">
            <div class="text-weight-medium">Rejected</div>
            <div>{{ form.ProgressRejectedComment || 'No rejection comment recorded.' }}</div>
            <div class="text-caption q-mt-xs">{{ formatDate(record.ProgressRejectedAt) }} · {{ record.ProgressRejectedBy || '-' }}</div>
          </q-banner>
        </q-card-section>

        <q-card-section v-if="isEditable" class="q-pa-sm">
          <q-input v-model="rejectComment" dense outlined autogrow label="Reject Comment" class="q-mb-sm" />
          <q-card-actions align="right" class="q-pa-none">
            <q-btn flat label="Cancel" @click="goToList" />
            <q-btn color="negative" icon="block" label="Reject" :disable="!canReject" :loading="rejecting" @click="reject" />
            <q-btn color="primary" icon="save" label="Save" :disable="!canSave" :loading="saving" @click="save" />
          </q-card-actions>
        </q-card-section>
      </template>
    </q-card>
  </div>
</template>

<script setup>
import { h } from 'vue'
import { useSupplierQuotationView } from 'src/composables/operations/supplierQuotations/useSupplierQuotationView'

const InfoCell = (props) => h('div', { class: 'col-12 col-sm-6 col-md-3' }, [
  h('div', { class: 'text-caption text-grey-6' }, props.label),
  h('div', { class: 'text-subtitle2' }, props.value || '-')
])

const {
  loading,
  saving,
  rejecting,
  rejectComment,
  record,
  form,
  items,
  supplier,
  progress,
  isEditable,
  isReadonly,
  optionSets,
  itemSubtotal,
  canSave,
  canReject,
  save,
  reject,
  goToList,
  formatDate,
  formatCurrency
} = useSupplierQuotationView()
</script>

<style scoped>
.sq-view { display: grid; gap: 8px; }
</style>
