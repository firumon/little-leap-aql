<template>
  <q-page class="q-pa-md">
    <q-card flat bordered class="mark-as-sent-page">
      <q-card-section class="row items-start justify-between q-col-gutter-md">
        <div class="col">
          <div class="text-overline text-secondary">Request for Quotation</div>
          <div class="text-h6 text-weight-bold">Dispatch RFQ</div>
          <div class="text-caption text-grey-6">{{ rfqRecord?.Code || rfqCode }}</div>
        </div>
        <div class="col-auto">
          <q-btn flat round icon="arrow_back" color="secondary" @click="nav.goTo('view')">
            <q-tooltip>Back to RFQ</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>

      <q-separator />

      <q-card-section v-if="isHeaderLoading || isSuppliersLoading" class="text-center q-py-xl">
        <q-spinner-dots color="secondary" size="36px" />
      </q-card-section>

      <q-card-section v-else>
        <q-banner v-if="!supplierFlow.assignedSupplierDetails.length" rounded class="bg-grey-2 text-grey-8 q-mb-md">
          No assigned suppliers are available for dispatch.
        </q-banner>

        <div class="row q-col-gutter-md q-mb-md">
          <InfoCell
            v-for="field in safeHeaderDisplayFields"
            :key="field.label"
            :label="field.label"
            :value="field.value"
          />
        </div>

        <div class="text-subtitle2 q-mb-xs">Assigned Supplier</div>
        <q-select
          v-model="selectedSupplierCode"
          :options="assignedSupplierOptions"
          emit-value
          map-options
          dense
          outlined
          class="q-mb-md"
          label="Select supplier"
        >
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
                <q-item-label caption>{{ scope.opt.caption }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-banner v-if="!selectedSupplier" rounded class="bg-orange-1 text-orange-10 q-mb-md">
          Select an assigned supplier to prepare the dispatch message.
        </q-banner>

        <template v-else>
          <q-card flat bordered class="q-mb-md">
            <q-card-section class="q-pa-sm">
              <div class="row q-col-gutter-sm">
                <InfoCell label="Supplier Name" :value="selectedSupplier.SupplierName" />
                <InfoCell label="Supplier Code" :value="selectedSupplier.SupplierCode" />
                <InfoCell label="Province" :value="selectedSupplier.Province || '-'" />
                <InfoCell label="Country" :value="selectedSupplier.Country || '-'" />
                <InfoCell label="Contact Person" :value="selectedSupplier.ContactPerson || '-'" />
                <InfoCell label="Current Status" :value="selectedSupplier.Progress || '-'" />
              </div>
            </q-card-section>
          </q-card>

          <div class="text-subtitle2 q-mb-xs">Message Template</div>
          <div class="row q-gutter-sm q-mb-md">
            <q-btn
              outline
              color="secondary"
              :unelevated="dispatchMode !== 'download'"
              :flat="dispatchMode === 'download'"
              icon="download"
              label="Download RFQ Document"
              @click="dispatchMode = 'download'"
            />
            <q-btn
              outline
              color="green"
              :unelevated="dispatchMode !== 'whatsapp'"
              :flat="dispatchMode === 'whatsapp'"
              icon="chat"
              label="Send Via WhatsApp"
              @click="dispatchMode = 'whatsapp'"
            />
            <q-btn
              outline
              color="blue"
              :unelevated="dispatchMode !== 'email-without'"
              :flat="dispatchMode === 'email-without'"
              icon="mail_outline"
              label="Email Without Attachment"
              @click="dispatchMode = 'email-without'"
            />
            <q-btn
              outline
              color="indigo"
              :unelevated="dispatchMode !== 'email-with'"
              :flat="dispatchMode === 'email-with'"
              icon="email"
              label="Email With Attachment"
              @click="dispatchMode = 'email-with'"
            />
          </div>

          <q-input
            :model-value="dispatchText"
            type="textarea"
            autogrow
            outlined
            readonly
            label="Dispatch text"
            class="q-mb-md"
          />

          <q-card-actions align="right" class="q-pa-sm">
            <q-btn flat label="Cancel" color="secondary" @click="nav.goTo('view')" />
            <q-btn
              color="secondary"
              icon="send"
              label="Mark As Sent"
              :loading="isSaving"
              :disable="!canMarkSelected"
              @click="onMarkAsSent"
            />
          </q-card-actions>
        </template>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRFQSupplierFlow } from 'src/composables/operations/rfqs/useRFQSupplierFlow'

const InfoCell = (props) => h('div', { class: 'col-12 col-sm-6 col-md-4' }, [
  h('div', { class: 'text-caption text-grey-6' }, props.label),
  h('div', { class: 'text-subtitle2' }, props.value || '-')
])

const nav = useResourceNav()
const route = useRoute()
const { code: rfqCode } = useResourceConfig()

const supplierFlow = useRFQSupplierFlow(rfqCode)
const {
  isHeaderLoading,
  isSuppliersLoading,
  isSaving,
  rfqRecord,
  headerDisplayFields,
  assignedSupplierDetails,
  loadData,
  markSelectedAsSent
} = supplierFlow

const selectedSupplierCode = ref('')
const dispatchMode = ref('whatsapp')
const requestedSupplierRowCode = computed(() => (route.query.supplierRowCode || '').toString())

const assignedSupplierOptions = computed(() =>
  assignedSupplierDetails.value.map((row) => ({
    label: row.SupplierName,
    caption: `${row.Country || '-'} · ${row.Province || '-'}${row.ContactPerson ? ` · ${row.ContactPerson}` : ''}`,
    value: row.Code
  }))
)

const safeHeaderDisplayFields = computed(() =>
  (headerDisplayFields.value || []).filter((field) => field && field.label)
)

const selectedSupplier = computed(() =>
  assignedSupplierDetails.value.find((row) => row.Code === selectedSupplierCode.value) || null
)

const canMarkSelected = computed(() =>
  !!selectedSupplier.value &&
  selectedSupplier.value.Progress === 'ASSIGNED' &&
  !!rfqRecord.value &&
  (rfqRecord.value.Progress || '').toString().trim().toUpperCase() === 'SENT'
)

function buildDispatchText(mode, rfq, supplier) {
  if (!rfq || !supplier) return ''

  const supplierName = supplier.SupplierName || supplier.Name || supplier.SupplierCode || ''
  const rfqLabel = rfq.Code || rfqCode.value || ''
  const procurementLabel = rfq.ProcurementCode || '-'

  if (mode === 'download') {
    return [
      `RFQ Document`,
      `RFQ Code: ${rfqLabel}`,
      `Procurement Code: ${procurementLabel}`,
      `Supplier: ${supplierName}`,
      `Supplier Code: ${supplier.SupplierCode || '-'}`,
      `Document will be downloaded or generated here.`
    ].join('\n')
  }

  if (mode === 'whatsapp') {
    return [
      `Hello ${supplierName},`,
      '',
      `Please review RFQ ${rfqLabel}.`,
      `Procurement: ${procurementLabel}`,
      `Supplier Code: ${supplier.SupplierCode || '-'}`,
      '',
      'Reply if you need any clarification.'
    ].join('\n')
  }

  if (mode === 'email-without') {
    return [
      `Subject: RFQ ${rfqLabel}`,
      '',
      `Dear ${supplierName},`,
      '',
      `Please review the RFQ details for ${rfqLabel}.`,
      `Procurement Code: ${procurementLabel}`,
      `Supplier Code: ${supplier.SupplierCode || '-'}`,
      '',
      'Regards,',
      'Procurement Team'
    ].join('\n')
  }

  return [
    `Subject: RFQ ${rfqLabel} with Attachment`,
    '',
    `Dear ${supplierName},`,
    '',
    `Please find attached the RFQ document for ${rfqLabel}.`,
    `Procurement Code: ${procurementLabel}`,
    `Supplier Code: ${supplier.SupplierCode || '-'}`,
    '',
    'Regards,',
    'Procurement Team'
  ].join('\n')
}

const dispatchText = computed(() => buildDispatchText(dispatchMode.value, rfqRecord.value, selectedSupplier.value))

watch(assignedSupplierOptions, (options) => {
  if (!options.length) {
    selectedSupplierCode.value = ''
    return
  }
  if (requestedSupplierRowCode.value && options.some((option) => option.value === requestedSupplierRowCode.value)) {
    selectedSupplierCode.value = requestedSupplierRowCode.value
    return
  }
  const hasSelection = options.some((option) => option.value === selectedSupplierCode.value)
  if (!hasSelection) {
    selectedSupplierCode.value = options[0].value
  }
}, { immediate: true })

watch(selectedSupplier, (supplier) => {
  if (!supplier) return
  if (supplier.Progress !== 'ASSIGNED') {
    dispatchMode.value = 'email-with'
  }
}, { immediate: true })

onMounted(async () => {
  await loadData()
})

async function onMarkAsSent() {
  if (!selectedSupplier.value) return
  await markSelectedAsSent([selectedSupplier.value.Code])
}
</script>

<style scoped>
.mark-as-sent-page {
  max-width: 1080px;
  margin: 0 auto;
}
</style>
