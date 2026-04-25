<template>
  <q-card flat bordered>
    <q-card-section v-if="loading && !record" class="text-center q-py-xl">
      <q-spinner-dots color="primary" size="36px" />
    </q-card-section>

    <q-card-section v-else-if="!record" class="text-center q-py-xl text-grey-6">
      <q-icon name="search_off" size="48px" color="grey-4" />
      <div class="q-mt-sm">RFQ not found</div>
      <q-btn flat color="primary" label="Back to RFQs" class="q-mt-sm" @click="goToList" />
    </q-card-section>

    <template v-else>
      <q-card-section class="q-pa-sm">
        <div class="row items-start no-wrap q-col-gutter-sm">
          <div class="col">
            <div class="text-overline text-primary">Request for Quotation</div>
            <div class="text-h6">{{ form.Code }}</div>
            <div class="row q-gutter-xs q-mt-xs">
              <q-chip dense outline color="primary">{{ form.Progress || 'DRAFT' }}</q-chip>
              <q-chip v-if="isDraft" dense :color="hasUnsavedChanges ? 'warning' : 'positive'" text-color="white">
                {{ hasUnsavedChanges ? 'Unsaved changes' : 'Up to date' }}
              </q-chip>
            </div>
          </div>
          <q-btn flat round icon="list" color="primary" @click="goToList">
            <q-tooltip>Back to RFQs</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-pa-sm">
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-sm-6 col-md-3">
            <q-input v-model="form.Code" label="RFQ Code" dense outlined readonly />
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <q-input v-model="form.ProcurementCode" label="Procurement Code" dense outlined readonly />
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <q-input v-model="form.PurchaseRequisitionCode" label="PR Code" dense outlined readonly />
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <q-input :model-value="itemCodes.length" label="PR Items" dense outlined readonly />
          </div>
        </div>
      </q-card-section>

      <q-separator />

      <template v-if="isDraft">
        <q-card-section class="q-pa-sm">
          <div class="text-subtitle2 q-mb-sm">RFQ Terms</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6 col-md-3">
              <q-input v-model="form.RFQDate" dense outlined label="RFQ Date">
                <template #append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="form.RFQDate" mask="YYYY-MM-DD">
                        <div class="row items-center justify-end q-pa-sm">
                          <q-btn v-close-popup flat dense label="Close" color="primary" />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-input v-model="form.SubmissionDeadline" dense outlined label="Submission Deadline">
                <template #append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date v-model="form.SubmissionDeadline" mask="YYYY-MM-DD">
                        <div class="row items-center justify-end q-pa-sm">
                          <q-btn v-close-popup flat dense label="Close" color="primary" />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-input v-model.number="form.LeadTimeDays" type="number" min="0" dense outlined label="Lead Time Days" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-select v-model="form.LeadTimeType" :options="optionSets.leadTimeTypes" emit-value map-options dense outlined label="Lead Time Type" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-input v-model.number="form.QuotationValidityDays" type="number" min="0" dense outlined label="Quotation Validity Days" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-select v-model="form.QuotationValidityMode" :options="optionSets.quotationValidityModes" emit-value map-options dense outlined label="Validity Mode" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-select v-model="form.ShippingTermMode" :options="optionSets.shippingTermModes" emit-value map-options dense outlined label="Shipping Mode" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-select v-model="form.ShippingTerm" :options="optionSets.shippingTerms" :disable="form.ShippingTermMode === 'ANY'" emit-value map-options dense outlined label="Shipping Term" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-select v-model="form.PaymentTermMode" :options="optionSets.paymentTermModes" emit-value map-options dense outlined label="Payment Mode" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-select v-model="form.PaymentTerm" :options="optionSets.paymentTerms" :disable="form.PaymentTermMode === 'ANY'" emit-value map-options dense outlined label="Payment Term" />
            </div>
            <div class="col-12 col-sm-6 col-md-3">
              <q-select v-model="form.DeliveryMode" :options="optionSets.deliveryModes" emit-value map-options dense outlined label="Delivery Mode" />
            </div>
            <div class="col-12">
              <q-input v-model="form.PaymentTermDetail" dense outlined autogrow label="Payment Term Detail" />
            </div>
            <div class="col-12 row q-gutter-md">
              <q-toggle v-model="form.AllowPartialDelivery" label="Allow Partial Delivery" />
              <q-toggle v-model="form.AllowSplitShipment" label="Allow Split Shipment" />
            </div>
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section class="q-pa-sm">
          <div class="text-subtitle2 q-mb-xs">PR Items</div>
          <q-chip v-for="itemCode in itemCodes" :key="itemCode" dense square>{{ itemCode }}</q-chip>
          <div v-if="!itemCodes.length" class="text-caption text-grey-6">No PR item codes linked.</div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-sm">
          <q-btn
            v-if="hasUnsavedChanges"
            color="primary"
            icon="save"
            label="Save"
            :disable="!canSave"
            :loading="saving"
            @click="saveDraft"
          />
          <q-btn
            v-else
            color="primary"
            icon="group_add"
            label="Assign Supplier"
            :disable="!canAssignSupplier"
            @click="assignSupplier"
          />
        </q-card-actions>
      </template>

      <template v-else>
        <q-card-section v-if="sentLoading" class="text-center q-py-xl">
          <q-spinner-dots color="secondary" size="36px" />
        </q-card-section>

        <template v-else>
          <q-card-section class="q-pa-sm">
            <div class="row q-col-gutter-sm">
              <InfoCell
                v-for="field in sentHeaderFields"
                :key="field.label"
                :label="field.label"
                :value="field.value"
              />
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section class="q-pa-sm">
            <div class="text-subtitle2 q-mb-xs">PR Items</div>
            <q-chip v-for="itemCode in sentItemCodes" :key="itemCode" dense square>{{ itemCode }}</q-chip>
            <div v-if="!sentItemCodes.length" class="text-caption text-grey-6">No PR item codes linked.</div>
          </q-card-section>

          <q-separator />

            <q-card-section class="q-pa-sm">
              <div class="row q-col-gutter-md">
                <div class="col-12 col-lg-6">
                  <div class="text-subtitle2 q-mb-sm">Assigned Suppliers</div>
                  <q-banner v-if="!assignedSuppliers.length" rounded class="bg-grey-2 text-grey-8 q-mb-md">
                    No assigned suppliers found.
                  </q-banner>
                  <q-list v-else bordered separator>
                    <q-item
                      v-for="row in assignedSuppliers"
                      :key="row.Code"
                      clickable
                      @click="openDispatchPage(row)"
                    >
                      <q-item-section>
                        <q-item-label class="text-weight-medium">{{ row.SupplierName }}</q-item-label>
                        <q-item-label caption>
                          {{ row.Country || '-' }} · {{ row.Province || '-' }}
                          <span v-if="row.ContactPerson"> · {{ row.ContactPerson }}</span>
                        </q-item-label>
                      </q-item-section>
                      <q-item-section side top>
                        <q-chip dense :color="row.Progress === 'SENT' ? 'positive' : 'warning'" text-color="white">
                          {{ row.Progress }}
                        </q-chip>
                        <q-btn flat round icon="chevron_right" color="secondary">
                          <q-tooltip>Open dispatch page</q-tooltip>
                        </q-btn>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>

                <div class="col-12 col-lg-6">
                  <div class="text-subtitle2 q-mb-sm">Available Suppliers</div>
                  <q-banner v-if="!availableSuppliers.length" rounded class="bg-grey-2 text-grey-8 q-mb-md">
                    No available suppliers to show.
                  </q-banner>
                  <template v-else>
                    <q-table
                      v-model:selected="selectedSupplierRows"
                      :rows="availableSuppliers"
                      :columns="supplierColumns"
                      row-key="Code"
                      selection="multiple"
                      :loading="isSupplierSaving"
                      flat
                      bordered
                      dense
                      :pagination="{ rowsPerPage: 8 }"
                    />
                    <q-card-actions align="right" class="q-px-none q-pb-none">
                      <q-btn
                        color="primary"
                        icon="save"
                        label="Save Suppliers"
                        :loading="isSupplierSaving"
                        :disable="!canAddAvailableSuppliers || !selectedSupplierRows.length"
                        @click="saveAvailableSuppliers"
                      />
                    </q-card-actions>
                  </template>
                </div>
              </div>
            </q-card-section>
          </template>
      </template>
    </template>
  </q-card>
</template>

<script setup>
import { computed, h, ref, watch } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRFQSupplierFlow } from 'src/composables/operations/rfqs/useRFQSupplierFlow'
import { useRFQEditableFlow } from 'src/composables/operations/rfqs/useRFQEditableFlow'

const InfoCell = (props) => h('div', { class: 'col-12 col-sm-6 col-md-4' }, [
  h('div', { class: 'text-caption text-grey-6' }, props.label),
  h('div', { class: 'text-subtitle2' }, props.value || '-')
])

const nav = useResourceNav()
const { code: rfqCode } = useResourceConfig()
const supplierFlow = useRFQSupplierFlow(rfqCode)

const {
  loading,
  saving,
  record,
  form,
  itemCodes,
  optionSets,
  isDraft,
  hasUnsavedChanges,
  canSave,
  canAssignSupplier,
  saveDraft,
  assignSupplier,
  goToList
} = useRFQEditableFlow()

const sentLoading = computed(() =>
  !isDraft.value && (supplierFlow.isHeaderLoading.value || supplierFlow.isSuppliersLoading.value)
)

const sentHeaderFields = computed(() =>
  (supplierFlow.headerDisplayFields.value || []).filter((field) => field && field.label)
)

const sentItemCodes = computed(() => supplierFlow.itemCodes.value || [])
const assignedSuppliers = computed(() => supplierFlow.assignedSupplierDetails.value || [])
const availableSuppliers = computed(() => supplierFlow.availableSuppliers.value || [])
const selectedSupplierRows = ref([])
const selectedSupplierCodes = computed(() => selectedSupplierRows.value.map((row) => row.Code))
const canAddAvailableSuppliers = computed(() => supplierFlow.canAddAvailableSuppliers.value)
const isSupplierSaving = computed(() => supplierFlow.isSaving.value)

const supplierColumns = [
  { name: 'Name', label: 'Supplier Name', field: 'Name', sortable: true, align: 'left' },
  { name: 'Province', label: 'Province', field: 'Province', sortable: true, align: 'left' },
  { name: 'Country', label: 'Country', field: 'Country', sortable: true, align: 'left' },
  { name: 'ContactPerson', label: 'Contact Person', field: 'ContactPerson', sortable: true, align: 'left' }
]

watch(() => form.value.Progress, async (progress) => {
  if ((progress || '').toString().trim() && (progress || '').toString().trim().toUpperCase() !== 'DRAFT') {
    await supplierFlow.loadData()
  }
}, { immediate: true })

watch(availableSuppliers, (rows) => {
  const availableCodes = new Set(rows.map((row) => row.Code).filter(Boolean))
  selectedSupplierRows.value = selectedSupplierRows.value.filter((row) => availableCodes.has(row.Code))
})

function openDispatchPage(row) {
  nav.goTo('record-page', {
    pageSlug: 'mark-as-sent',
    query: { supplierRowCode: row?.Code || '' }
  })
}

async function saveAvailableSuppliers() {
  await supplierFlow.addAvailableSuppliers(selectedSupplierCodes.value)
  selectedSupplierRows.value = []
}
</script>
