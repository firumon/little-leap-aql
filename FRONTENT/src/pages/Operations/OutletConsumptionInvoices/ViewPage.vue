<template>
  <q-page padding>
    <OutletHeaderPanel :subtitle="formatDisplayDate(invoice?.Date) + (' · ') + (invoice?.Code || 'Consumption Invoice')" :title="invoice ? `${outletName(invoice.OutletCode)}` : ''" class="q-mb-md">
      <template #side>
        <div class="row items-center q-gutter-xs">
          <OutletProgressChip :progress="invoice?.Progress" />
        </div>
      </template>
    </OutletHeaderPanel>

    <div v-if="canEdit" class="row items-center justify-end q-gutter-xs q-mb-md">
      <span class="text-caption" :class="!editing ? 'text-primary text-weight-bold' : 'text-grey-6'">View</span>
      <q-toggle :model-value="editing" @update:model-value="onEditToggle" color="primary" dense size="sm" />
      <span class="text-caption" :class="editing ? 'text-primary text-weight-bold' : 'text-grey-6'">Edit</span>
    </div>

    <div v-if="loading && !invoice" class="flex flex-center q-pa-xl"><q-spinner color="primary" size="3em" /></div>
    <q-banner v-else-if="!invoice" rounded class="bg-grey-2 text-grey-8">Invoice not found.</q-banner>

    <div v-else class="column">
      <q-card flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-3"><div class="text-caption text-grey-6">Outlet</div><div class="text-subtitle2">{{ outletName(invoice.OutletCode) }}</div></div>
            <div class="col-12 col-md-3"><div class="text-caption text-grey-6">Date</div><div class="text-subtitle2">{{ formatDisplayDate(invoice.Date) }}</div></div>
            <div class="col-12 col-md-3"><div class="text-caption text-grey-6">Username</div><div class="text-subtitle2">{{ invoice.Username }}</div></div>
            <div class="col-12 col-md-3"><div class="text-caption text-grey-6">Consumption</div><q-btn flat dense color="primary" :label="invoice.OutletConsumptionCode" @click="navigateToConsumption(invoice.OutletConsumptionCode)" /></div>
          </div>
        </q-card-section>
      </q-card>

      <div class="text-subtitle1 text-weight-medium q-px-xs q-mt-md">Price List</div>
      <q-card flat bordered>
        <q-card-section class="q-pa-sm">
          <div v-if="!editing" class="text-subtitle2">{{ plName }}</div>
          <q-select v-else v-model="editForm.priceListCode" :options="priceListOptions" dense outlined emit-value map-options />
        </q-card-section>
      </q-card>

      <div class="text-subtitle1 text-weight-medium q-px-xs q-mt-md">Line Items</div>
      <q-card flat bordered>
        <q-card-section v-if="!editing">
          <div class="row text-caption text-grey-6 text-weight-bold q-mb-sm q-col-gutter-md">
            <div class="col">Product</div>
            <div class="col-1 text-right">Qty</div>
            <div class="col-2 text-right">Price</div>
            <div class="col-2 text-right">Total</div>
          </div>
          <div v-for="(item, i) in editLineItems" :key="item.SKU" class="row q-py-xs q-col-gutter-md items-center" :class="{ 'bg-grey-1': i % 2 }">
            <div class="col text-body2">{{ item.displayLabel }}</div>
            <div class="col-1 text-right text-body2">{{ item.Qty }}</div>
            <div class="col-2 text-right text-body2">{{ item.Price }}</div>
            <div class="col-2 text-right text-body2 text-weight-medium">{{ item.Qty * item.Price }}</div>
          </div>
        </q-card-section>
        <q-list separator v-else>
          <q-item v-for="(item, i) in editLineItems" :key="item.SKU" class="q-pa-sm">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ item.displayLabel }}</q-item-label>
              <q-item-label caption>Qty: {{ item.Qty }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-input v-model.number="item.Price" dense outlined type="number" label="Price" style="width: 130px" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>

      <div class="text-subtitle1 text-weight-medium q-px-xs q-mt-md">Amounts</div>
      <q-card flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row q-col-gutter-md">
            <div class="col-4"><div class="text-caption text-grey-6">Subtotal</div><div class="text-subtitle2">{{ invoice.Subtotal || 0 }}</div></div>
            <div class="col-4">
              <div class="text-caption text-grey-6">Discount</div>
              <div v-if="!editing" class="text-subtitle2">-{{ invoice.Discount || 0 }}</div>
              <q-input v-else v-model.number="editForm.discount" dense outlined type="number" label="Discount" class="q-mt-xs" />
            </div>
            <div class="col-4">
              <div class="text-caption text-grey-6">Tax</div>
              <div v-if="!editing" class="text-subtitle2">+{{ invoice.Tax || 0 }}</div>
              <q-input v-else v-model.number="editForm.tax" dense outlined type="number" label="Tax" class="q-mt-xs" />
            </div>
          </div>
          <q-separator class="q-my-sm" />
          <div class="row items-center justify-between">
            <span class="text-subtitle1 text-weight-medium">Total</span>
            <span class="text-h6 text-weight-bold text-primary">{{ total }}</span>
          </div>
        </q-card-section>
      </q-card>

      <div class="row q-gutter-sm justify-end q-mt-md">
        <q-btn v-if="editing" flat label="Cancel" color="primary" @click="cancelEdit" />
        <q-btn v-if="editing" unelevated color="primary" icon="save" label="Save Changes" :loading="saving" @click="saveEdit" />

        <q-btn v-if="!editing && showPaymentButton" unelevated color="positive" icon="payments" label="Add Payment" @click="handlePayment">
          <q-tooltip>Payment page coming soon</q-tooltip>
        </q-btn>

        <q-btn flat color="primary" icon="arrow_back" label="Back to List" @click="cancel" />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'

defineOptions({ name: 'OutletConsumptionInvoicesViewPage' })
const $q = useQuasar()
const route = useRoute()
const flow = useOutletConsumption()
const { loading, saving, reload, getInvoice, childInvoiceItems, outletName, formatDisplayDate, navigateToConsumption, updateInvoice, productDisplayName, cancel, text, priceLists } = flow

const invoice = computed(() => getInvoice(route.params.code))
const editing = ref(false)
const editForm = ref({ priceListCode: '', discount: 0, tax: 0 })
const editLineItems = ref([])

const priceListOptions = computed(() => priceLists.items.value.map(p => ({ label: `${p.Code} - ${p.Name || ''}`, value: p.Code })))

const plName = computed(() => {
  if (!invoice.value?.PriceListCode) return 'Not priced'
  const pl = priceLists.items.value.find(p => p.Code === invoice.value.PriceListCode)
  return pl ? `${pl.Code} - ${pl.Name}` : invoice.value.PriceListCode
})

const total = computed(() => {
  const inv = invoice.value
  if (!inv) return 0
  return (inv.Subtotal || 0) - (inv.Discount || 0) + (inv.Tax || 0)
})

const canEdit = computed(() => {
  const p = text(invoice.value?.Progress)
  return p === 'PENDING_PAYMENT'
})

const showPaymentButton = computed(() => {
  const p = text(invoice.value?.Progress)
  return p !== 'PAID' && p !== 'CANCELLED'
})

function loadLineItems() {
  if (!invoice.value) return
  editForm.value = {
    priceListCode: invoice.value.PriceListCode || '',
    discount: invoice.value.Discount || 0,
    tax: invoice.value.Tax || 0
  }
  editLineItems.value = childInvoiceItems(invoice.value.Code).map(row => ({
    Code: row.Code,
    SKU: row.SKU,
    Qty: row.Qty,
    Price: row.Price || 0,
    displayLabel: productDisplayName(row.SKU)
  }))
}

function onEditToggle(val) {
  if (val) {
    editing.value = true
  } else {
    editing.value = false
  }
}

function cancelEdit() {
  editing.value = false
  loadLineItems()
}

async function saveEdit() {
  const result = await updateInvoice(invoice.value.Code, {
    PriceListCode: editForm.value.priceListCode,
    Discount: editForm.value.discount,
    Tax: editForm.value.tax,
    items: editLineItems.value
  })
  if (result.error) {
    $q.notify({ type: 'negative', message: result.error, position: 'top' })
    return
  }
  $q.notify({ type: 'positive', message: 'Invoice updated.', position: 'top' })
  editing.value = false
}

function handlePayment() {
  $q.dialog({
    title: 'Add Payment',
    message: 'Payment functionality will be available in a future update.',
    persistent: true,
    ok: { label: 'OK', color: 'primary' }
  })
}

onMounted(async () => {
  await reload()
  loadLineItems()
})
</script>
