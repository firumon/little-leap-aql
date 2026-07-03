<template>
  <q-page class="column no-scroll">
    <q-card flat bordered class="q-ma-md q-mb-none">
      <q-card-section class="q-pa-md">
        <div class="row items-center q-col-gutter-sm">
          <div class="col">
            <div class="text-h6 text-weight-bold">{{ outletName(record.OutletCode) }}</div>
            <div class="text-caption text-grey-7">{{ formatDisplayDate(record.Date) }} · {{ record.Username }}</div>
          </div>
          <div class="col-auto">
            <OutletProgressChip :progress="record?.Progress" size="md" />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <div v-if="loading && !record" class="col flex flex-center"><q-spinner color="primary" size="3em" /></div>
    <q-banner v-else-if="!record" rounded class="bg-grey-2 text-grey-8 q-mx-md q-mt-md">Consumption not found.</q-banner>

    <template v-else>
      <ResourceReports class="q-px-md" />

      <div class="col scroll q-px-md q-pb-md">
        <!-- Dependent Invoice Section -->
        <q-card v-if="record.Progress === 'INVOICE_GENERATED' && invoice" flat bordered class="q-mt-md q-mb-md">
          <q-card-section class="q-pa-md">
            <div class="row items-center justify-between q-mb-sm">
              <span class="text-subtitle1 text-weight-bold">Invoice</span>
              <q-chip dense square :color="invoiceProgressColor(invoice.Progress)" text-color="white">{{ invoice.Progress }}</q-chip>
            </div>
            <div class="text-caption q-mb-sm">
              <template v-if="canReadInvoice">
                <a class="text-primary" style="cursor:pointer;text-decoration:none" @click="navigateToInvoice(invoice.Code)">{{ invoice.Code }}</a>
              </template>
              <template v-else>
                <span class="text-grey-7">{{ invoice.Code }}</span>
              </template>
            </div>
            <q-separator class="q-mb-sm" />
            <div class="row q-col-gutter-sm text-body2">
              <div class="col-4">
                <div class="text-grey-6">Price List</div>
                <div class="text-weight-medium">{{ invoice.PriceListCode || 'Not priced' }}</div>
              </div>
              <div class="col-4">
                <div class="text-grey-6">Subtotal</div>
                <div class="text-weight-medium">{{ invoice.Subtotal || 0 }}</div>
              </div>
              <div class="col-4">
                <div class="text-grey-6">Discount</div>
                <div class="text-weight-medium">{{ invoice.Discount || 0 }}</div>
              </div>
              <div class="col-4">
                <div class="text-grey-6">Taxable Amount</div>
                <div class="text-weight-medium">{{ invoice.TotalTaxableAmount || 0 }}</div>
              </div>
              <div class="col-4">
                <div class="text-grey-6">Tax</div>
                <div class="text-weight-medium">{{ invoice.TotalTaxAmount || 0 }}</div>
              </div>
              <div class="col-4">
                <div class="text-grey-6">Returns</div>
                <div class="text-weight-medium text-negative">-{{ invoice.ReturnDeductionTotal || 0 }}</div>
              </div>
              <div class="col-4">
                <div class="text-grey-6">Total</div>
                <div class="text-weight-bold text-primary">{{ getInvoiceTotal(invoice) }}</div>
              </div>
            </div>
            <q-linear-progress :value="invoiceProgressPercent(invoice.Progress)" color="primary" class="q-mt-sm" rounded />
          </q-card-section>
        </q-card>

        <!-- Restock Section -->
        <q-card v-if="dependentRestocks.length" flat bordered class="q-mb-md">
          <q-card-section class="q-pa-md">
            <div class="text-subtitle1 text-weight-bold q-mb-sm">Restocks</div>
            <q-list separator>
              <q-item v-for="r in dependentRestocks" :key="r.Code" class="q-pa-sm">
                <q-item-section :class="{ 'cursor-pointer': canReadRestock }" @click="canReadRestock && navigateToRestock(r.Code)">
                  <q-item-label class="text-weight-medium" :class="{ 'text-primary': canReadRestock }">{{ r.Code }}</q-item-label>
                  <q-item-label caption>{{ formatDisplayDate(r.Date) }}</q-item-label>
                  <q-linear-progress :value="restockProgressPercent(r.Progress)" :color="restockProgressColor(r.Progress)" class="q-mt-xs" rounded size="xs" />
                </q-item-section>
                <q-item-section side>
                  <q-chip dense square :color="restockProgressColor(r.Progress)" text-color="white">{{ r.Progress }}</q-chip>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>

        <!-- Consumed Items Section -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section class="q-pa-md">
            <div class="text-subtitle1 text-weight-bold q-mb-sm">Consumed Items</div>
            <AqlList dense :items="consumptionItemRows(record.Code)"
              :content="['productName',item => item.variantValues.join(' / ') || item.skuCode]"
              :chip="item => item.Qty"
            />
          </q-card-section>
        </q-card>

        <!-- Cancel Action -->
        <q-card v-if="canCancel" flat bordered class="q-mb-md">
          <q-card-section class="q-pa-md">
            <q-btn unelevated size="md" color="negative" icon="cancel" label="Cancel Consumption" :loading="acting" class="full-width" @click="openCancelDialog" />
          </q-card-section>
        </q-card>
      </div>
    </template>

    <!-- Cancel Confirmation Dialog -->
    <q-dialog v-model="cancelDialogOpen" persistent>
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center q-pb-none">
          <q-icon name="warning" color="negative" size="md" class="q-mr-sm" />
          <span class="text-h6">Cancel Consumption</span>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>

        <q-card-section>
          <p class="text-body2 text-grey-8 q-mt-none">This will cancel the consumption, its dependent invoice, and reject any pending restocks. This action cannot be undone.</p>
          <q-input v-model="cancelReason" outlined type="textarea" label="Cancellation reason" :rules="[val => !!val || 'Reason is required']" rows="3" class="q-mt-md" />
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn unelevated label="Confirm Cancel" color="negative" :disable="!cancelReason" :loading="acting" @click="confirmCancel" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useOutletConsumption } from '../../../composables/operation/outlets/useOutletConsumption.js'
import OutletProgressChip from '../../../components/operation/Outlets/OutletProgressChip.vue'
import AqlList from "components/shared/AqlList.vue";
import ResourceReports from 'components/Reports/ResourceReports.vue'

defineOptions({ name: 'OutletConsumptionViewPage' })
const route = useRoute()
const flow = useOutletConsumption()
const { loading, acting, reload, getConsumption, childInvoice, childRestocks, consumptionItemRows, generateInvoiceForConsumption, cancelConsumption, navigateToInvoice, navigateToRestock, outletName, visitLabel, formatDisplayDate, canReadInvoice, canReadRestock, getInvoiceTotal, allowed } = flow

const record = computed(() => getConsumption(route.params.code))
const invoice = computed(() => record.value ? childInvoice(record.value.Code) : null)
const dependentRestocks = computed(() => record.value ? childRestocks(record.value.Code) : [])

const canCancel = computed(() => {
  if (!record.value) return false
  if (!allowed('CANCEL')) return false
  if (record.value.Progress === 'CANCELLED') return false
  if (invoice.value && invoice.value.Progress === 'PAID') return false
  if (dependentRestocks.value.some(r => ['APPROVED', 'DELIVERED', 'PARTIALLY_DELIVERED'].includes(r.Progress))) return false
  return true
})

const cancelDialogOpen = ref(false)
const cancelReason = ref('')

function openCancelDialog() {
  cancelReason.value = ''
  cancelDialogOpen.value = true
}

async function confirmCancel() {
  if (!cancelReason.value) return
  const ok = await cancelConsumption(record.value, cancelReason.value)
  if (ok) cancelDialogOpen.value = false
}

function invoiceProgressColor(progress) {
  const map = { PENDING_PAYMENT: 'warning', PARTIALLY_PAID: 'info', PAID: 'positive', CANCELLED: 'negative' }
  return map[progress] || 'grey'
}

function invoiceProgressPercent(progress) {
  const map = { PENDING_PAYMENT: 0.25, PARTIALLY_PAID: 0.5, PAID: 1, CANCELLED: 0 }
  return map[progress] || 0
}

function restockProgressColor(progress) {
  const map = { DRAFT: 'grey', PENDING_APPROVAL: 'warning', APPROVED: 'positive', REJECTED: 'negative', REVISION_REQUIRED: 'orange', DELIVERED: 'positive', PARTIALLY_DELIVERED: 'info' }
  return map[progress] || 'grey'
}

function restockProgressPercent(progress) {
  const map = { DRAFT: 0.1, PENDING_APPROVAL: 0.3, APPROVED: 0.6, REJECTED: 0, REVISION_REQUIRED: 0.4, DELIVERED: 1, PARTIALLY_DELIVERED: 0.8 }
  return map[progress] || 0
}

onMounted(() => reload())
</script>

