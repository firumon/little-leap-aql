<template>
  <div class="rfq-add">
    <q-card flat bordered class="q-mb-sm">
      <q-card-section class="row items-center no-wrap q-pa-sm">
        <div class="col">
          <div class="text-h6">Create RFQ</div>
          <div class="text-caption text-grey-6">Select an approved PR and confirm RFQ terms.</div>
        </div>
        <q-btn flat round icon="refresh" color="primary" :loading="loading" @click="loadData">
          <q-tooltip>Refresh data</q-tooltip>
        </q-btn>
      </q-card-section>
    </q-card>

    <q-stepper v-model="currentStep" color="primary" animated flat bordered header-nav>
      <q-step :name="1" title="PR" icon="assignment_turned_in" :done="!!selectedPr">
        <q-input v-model="searchTerm" dense outlined clearable placeholder="Search approved PRs" class="q-mb-sm">
          <template #prepend><q-icon name="search" /></template>
        </q-input>

        <div v-if="loading" class="text-center q-py-xl">
          <q-spinner-dots color="primary" size="36px" />
        </div>
        <div v-else-if="!approvedPrs.length" class="text-center q-py-xl text-grey-6">
          <q-icon name="inbox" size="42px" color="grey-4" />
          <div class="q-mt-sm">No approved PRs available for RFQ.</div>
        </div>
        <div v-else class="rfq-grid">
          <q-card
            v-for="pr in approvedPrs"
            :key="pr.Code"
            flat
            bordered
            class="cursor-pointer"
            :class="{ 'rfq-selected-card': selectedPr?.Code === pr.Code }"
            @click="selectPr(pr)"
          >
            <q-card-section class="q-pa-sm">
              <div class="row items-center q-gutter-xs">
                <q-chip dense color="primary" text-color="white">{{ pr.Code }}</q-chip>
                <q-chip dense outline color="positive">Approved</q-chip>
              </div>
              <div class="text-subtitle2 q-mt-xs">{{ pr.ProcurementCode || 'Procurement will be created' }}</div>
              <div class="text-caption text-grey-7 q-mt-xs">
                Required {{ formatDate(pr.RequiredDate) }} · {{ pr.WarehouseCode || 'No warehouse' }}
              </div>
            </q-card-section>
          </q-card>
        </div>

        <q-card v-if="selectedPr" flat bordered class="q-mt-md">
          <q-card-section class="q-pa-sm">
            <div class="text-subtitle2 q-mb-xs">PR items included automatically</div>
            <div class="row q-col-gutter-xs">
              <div v-for="item in selectedPrItems" :key="item.Code" class="col-12 col-sm-6 col-md-4">
                <q-chip square class="full-width">
                  {{ item.Code }} · Qty {{ item.Quantity || 0 }}
                </q-chip>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-stepper-navigation>
          <q-btn color="primary" label="Continue" :disable="!canGoTiming" @click="goTo(2)" />
        </q-stepper-navigation>
      </q-step>

      <q-step :name="2" title="Timing" icon="schedule" :done="currentStep > 2">
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-6">
            <q-input v-model.number="form.LeadTimeDays" type="number" min="0" dense outlined label="Lead Time Days" />
          </div>
          <div class="col-12 col-sm-6">
            <q-select v-model="form.LeadTimeType" :options="optionSets.leadTimeTypes" emit-value map-options dense outlined label="Lead Time Type">
              <template #option="scope"><OptionRow v-bind="scope" /></template>
            </q-select>
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model.number="form.QuotationValidityDays" type="number" min="0" dense outlined label="Quotation Validity Days" />
          </div>
          <div class="col-12 col-sm-6">
            <q-select v-model="form.QuotationValidityMode" :options="optionSets.quotationValidityModes" emit-value map-options dense outlined label="Validity Mode">
              <template #option="scope"><OptionRow v-bind="scope" /></template>
            </q-select>
          </div>
          <div class="col-12 col-sm-6">
            <q-input v-model="form.SubmissionDeadline" dense outlined label="Submission Deadline" readonly>
              <template #append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                    <q-date v-model="form.SubmissionDeadline" mask="YYYY-MM-DD">
                      <div class="row items-center justify-end"><q-btn v-close-popup label="Done" color="primary" flat /></div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
        </div>
        <q-banner v-if="leadTimeChanged" rounded class="bg-orange-1 text-orange-10 q-mt-sm">
          PR required date is {{ formatDate(selectedPr?.RequiredDate) }}. Default lead time is {{ calculatedLeadTimeDays }} days.
        </q-banner>
        <q-stepper-navigation>
          <q-btn flat label="Back" class="q-mr-sm" @click="goTo(1)" />
          <q-btn color="primary" label="Continue" @click="goTo(3)" />
        </q-stepper-navigation>
      </q-step>

      <q-step :name="3" title="Terms" icon="local_shipping" :done="currentStep > 3">
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-6">
            <q-select v-model="form.ShippingTermMode" :options="optionSets.shippingTermModes" emit-value map-options dense outlined label="Shipping Mode" />
          </div>
          <div class="col-12 col-sm-6">
            <q-select v-model="form.ShippingTerm" :options="optionSets.shippingTerms" :disable="form.ShippingTermMode === 'ANY'" emit-value map-options dense outlined label="Shipping Term">
              <template #option="scope"><OptionRow v-bind="scope" /></template>
            </q-select>
          </div>
          <div class="col-12 col-sm-6">
            <q-select v-model="form.PaymentTermMode" :options="optionSets.paymentTermModes" emit-value map-options dense outlined label="Payment Mode" />
          </div>
          <div class="col-12 col-sm-6">
            <q-select v-model="form.PaymentTerm" :options="optionSets.paymentTerms" :disable="form.PaymentTermMode === 'ANY'" emit-value map-options dense outlined label="Payment Term">
              <template #option="scope"><OptionRow v-bind="scope" /></template>
            </q-select>
          </div>
          <div class="col-12">
            <q-input v-model="form.PaymentTermDetail" dense outlined autogrow label="Payment Term Detail" />
          </div>
          <div class="col-12 col-sm-6">
            <q-select v-model="form.DeliveryMode" :options="optionSets.deliveryModes" emit-value map-options dense outlined label="Delivery Mode">
              <template #option="scope"><OptionRow v-bind="scope" /></template>
            </q-select>
          </div>
          <div class="col-12 col-sm-6 row items-center q-gutter-md">
            <q-toggle v-model="form.AllowPartialDelivery" label="Allow Partial Delivery" />
            <q-toggle v-model="form.AllowSplitShipment" label="Allow Split Shipment" />
          </div>
        </div>
        <q-stepper-navigation>
          <q-btn flat label="Back" class="q-mr-sm" @click="goTo(2)" />
          <q-btn color="primary" label="Review" @click="goTo(4)" />
        </q-stepper-navigation>
      </q-step>

      <q-step :name="4" title="Summary" icon="fact_check">
        <q-list bordered separator class="rounded-borders">
          <q-item>
            <q-item-section>
              <q-item-label>{{ selectedPr?.Code }} · {{ selectedPr?.ProcurementCode || 'New Procurement' }}</q-item-label>
              <q-item-label caption>PR {{ formatDate(selectedPr?.PRDate) }} · {{ selectedPr?.WarehouseCode || 'No warehouse' }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>Items</q-item-label>
              <q-item-label caption>
                <q-chip v-for="item in selectedPrItems" :key="item.Code" dense>{{ item.Code.slice(0, 12) }} · Qty {{ item.Quantity || 0 }}</q-chip>
              </q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>Terms</q-item-label>
              <q-item-label caption>
                Lead {{ form.LeadTimeDays }} days · Valid {{ form.QuotationValidityDays }} days · Deadline {{ formatDate(form.SubmissionDeadline) }}
              </q-item-label>
              <q-item-label caption>
                {{ form.ShippingTermMode }} {{ form.ShippingTerm || '' }} · {{ form.PaymentTermMode }} {{ form.PaymentTerm || '' }} · Delivery {{ form.DeliveryMode }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <q-stepper-navigation>
          <q-btn flat label="Back" class="q-mr-sm" @click="goTo(3)" />
          <q-btn color="primary" icon="check" label="Create RFQ" :loading="saving" :disable="!canConfirm" @click="confirmCreate" />
        </q-stepper-navigation>
      </q-step>
    </q-stepper>
  </div>
</template>

<script setup>
import { h } from 'vue'
import { QItem, QItemSection, QItemLabel } from 'quasar'
import { useRFQCreateFlow } from 'src/composables/operations/rfqs/useRFQCreateFlow'

const OptionRow = (props) => h(QItem, props.itemProps, () => [
  h(QItemSection, () => [
    h(QItemLabel, () => props.opt.label),
    props.opt.description ? h(QItemLabel, { caption: true }, () => props.opt.description) : null
  ])
])

const {
  currentStep,
  loading,
  saving,
  searchTerm,
  form,
  optionSets,
  approvedPrs,
  selectedPr,
  selectedPrItems,
  calculatedLeadTimeDays,
  leadTimeChanged,
  canGoTiming,
  canConfirm,
  formatDate,
  selectPr,
  goTo,
  loadData,
  confirmCreate
} = useRFQCreateFlow()
</script>

<style scoped>
.rfq-add { display: grid; gap: 8px; }
.rfq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 8px;
}
.rfq-selected-card {
  border-color: var(--q-primary);
  box-shadow: 0 0 0 1px var(--q-primary);
}
</style>
