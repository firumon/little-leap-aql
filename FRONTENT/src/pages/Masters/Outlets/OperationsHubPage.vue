<template>
  <q-page padding>
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <HeaderPanel
          title="Outlet Hub"
          :subtitle="selectedOutlet ? selectedOutletLabel : 'Select an outlet to view stock, planned visits, pending restocks, returns, invoices, and payments.'"
        />
      </div>
      <div class="q-ml-sm self-center">
        <ReloadButton />
      </div>
    </div>

    <q-select v-model="selectedOutletCode" :options="outletOptionsList"
      outlined emit-value map-options
      input-debounce="200" label="Select Outlet *" class="q-mb-md">
      <template #no-option>
        <q-item><q-item-section class="text-grey">No active outlets found</q-item-section></q-item>
      </template>
      <template #prepend><q-icon name="storefront" /></template>
    </q-select>

    <div v-if="!selectedOutletCode" class="flex flex-center">
      <q-card flat bordered class="q-pa-xl text-center">
        <q-icon name="storefront" size="xl" color="grey-5" />
        <div class="text-h6 text-grey-7 q-mt-md">No outlet selected</div>
        <div class="text-caption text-grey-6 q-mt-xs">Pick an outlet above to see its pending work, recent invoices, and payments in one place.</div>
      </q-card>
    </div>

    <template v-else>
      <OutletHubSummaryStats
        :planned-visits="plannedVisits"
        :pending-restocks="pendingRestocks"
        :pending-returns="pendingReturns"
        :total-outstanding="totalOutstanding"
        :format-money="formatMoney"
      />

      <SectionDividerLabel label="VISITS" />

      <q-card flat class="q-mb-md bg-transparent">
        <AqlList icon="event" item-key="Code" :items="plannedVisits"
          :content="[
            v => v.Date ? formatDisplayDate(v.Date) : 'No date',
            v => v.ProgressPlannedComment || 'Planned visit'
          ]"
          :meta="[v => visitUrgencyChip(v).label]" :meta-layout="['chip']"
          :color="v => visitUrgencyChip(v).color" :clickable="canCreateVisit"
          @click="onVisitClick"
        >
          <template #empty>
            <q-item class="empty-state-container text-center bg-white">
              <q-item-section>
                <q-icon name="event_busy" size="36px" color="grey-5" class="q-mb-xs block q-mx-auto" />
                <q-item-label class="text-subtitle2 text-weight-bold text-grey-7">No planned visits</q-item-label>
                <q-item-label class="text-caption text-grey-6 q-mt-xs">Schedule the next visit for this outlet.</q-item-label>
                <div class="q-mt-md">
                  <q-btn v-if="canCreateVisit" unelevated color="primary" icon="event_available" label="Plan Visit" @click.stop="openPlanDialog" />
                </div>
              </q-item-section>
            </q-item>
          </template>
        </AqlList>
      </q-card>

      <SectionDividerLabel label="RESTOCKS" />

      <q-card flat class="q-mb-md bg-transparent">
        <AqlList item-key="Code" icon="inventory"
          :color="r => restockChip(r).color"
          :items="pendingRestocks"
          :content="[
            r => r.Date ? formatDisplayDate(r.Date) : 'No date',
            'RequestedUser'
          ]"
          :chip="r => restockChip(r).label"
          :clickable="canCreateRestock" @click="onRestockClick"
        >
          <template #empty>
            <q-item class="empty-state-container text-center bg-white">
              <q-item-section>
                <q-icon name="inventory_2" size="36px" color="grey-5" class="q-mb-xs block q-mx-auto" />
                <q-item-label class="text-subtitle2 text-weight-bold text-grey-7">No pending restocks</q-item-label>
                <q-item-label class="text-caption text-grey-6 q-mt-xs">Raise a restock request for this outlet.</q-item-label>
                <div class="q-mt-md">
                  <q-btn v-if="canCreateRestock" unelevated color="primary" icon="add_business" label="New Restock" @click.stop="goToNewRestock" />
                </div>
              </q-item-section>
            </q-item>
          </template>
        </AqlList>
      </q-card>

      <SectionDividerLabel label="RETURNS" />

      <q-card flat class="q-mb-xs bg-transparent">
        <AqlList item-key="Code" icon="assignment_return"
          :color="r => returnChip(r).color"
          :items="pendingReturns"
          :content="[
            r => r.Date ? formatDisplayDate(r.Date) : 'No date',
            'Reason'
          ]"
          :chip="r => returnChip(r).label"
          :clickable="canCreateReturn" @click="onReturnClick"
        >
          <template #empty>
            <q-item class="empty-state-container text-center bg-white">
              <q-item-section>
                <q-icon name="assignment_returned" size="36px" color="grey-5" class="q-mb-xs block q-mx-auto" />
                <q-item-label class="text-subtitle2 text-weight-bold text-grey-7">No open returns</q-item-label>
                <q-item-label class="text-caption text-grey-6 q-mt-xs">Submit a return for this outlet.</q-item-label>
                <div class="q-mt-md">
                  <q-btn v-if="canCreateReturn" unelevated color="primary" icon="assignment_return" label="New Return" @click.stop="goToNewReturn" />
                </div>
              </q-item-section>
            </q-item>
          </template>
        </AqlList>
        <q-card-section class="text-center q-py-xs" v-if="pendingReturns.length">
          <q-btn v-if="canCreateReturn" color="primary" label="Add More Returns" size="sm" flat @click="goToNewReturn" />
        </q-card-section>
      </q-card>

      <SectionDividerLabel label="STOCK" />

      <q-card flat class="q-mb-md bg-transparent">
        <AqlGroupedList
          item-key="Code" :items="outletStock" group-key="productCode" header-label="productName"
          :header-badge="group => 'Total: ' + group.items.map(item => Number(item.Quantity)).reduce((a,b) => a+b,0).toLocaleString()"
          :content="[
            r => r.productName,
            r => [r.skuCode,(r.variantValues || []).filter(Boolean).join(' / ')].filter(Boolean).join(': ')
          ]"
          :chip="r => Number(r.Quantity).toLocaleString()"
        >
          <template #empty>
            <q-item class="empty-state-container text-center bg-white">
              <q-item-section>
                <q-icon name="inventory_2" size="36px" color="grey-5" class="q-mb-xs block q-mx-auto" />
                <q-item-label class="text-subtitle2 text-weight-bold text-grey-7">No stock records</q-item-label>
                <q-item-label class="text-caption text-grey-6 q-mt-xs">No stock found for this outlet.</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </AqlGroupedList>
      </q-card>

      <SectionDividerLabel label="INVOICES" />

      <q-card flat class="q-mb-md bg-transparent">
        <AqlList item-key="Code" icon="receipt_long"
          :color="inv => invoiceStatus(inv).color"
          :items="hubInvoices"
          :content="[
            inv => inv.Code,
            inv => [inv.Username,formatDisplayDate(inv.Date)].join(' . '),
          ]"
          :chip="inv => formatMoney(remainingFor(inv))"
          @click="inv => goToCollectPayment(inv.Code)"
        >
          <template #empty>
            <q-item class="empty-state-container text-center bg-white">
              <q-item-section>
                <q-icon name="receipt_long" size="36px" color="grey-5" class="q-mb-xs block q-mx-auto" />
                <q-item-label class="text-subtitle2 text-weight-bold text-grey-7">No invoices</q-item-label>
                <q-item-label class="text-caption text-grey-6 q-mt-xs">No invoices found for this outlet.</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </AqlList>
      </q-card>

      <SectionDividerLabel label="PAYMENTS" />

      <q-card flat class="q-mb-md bg-transparent">
        <AqlList item-key="Code" icon="payments"
          :items="recentPayments"
          :content="[
            pay => pay.Mode,
            pay => [formatDisplayDate(pay.Date),pay.Username].filter(Boolean).join(' . ')
          ]"
          :chip="pay => formatMoney(pay.Amount)"
        >
          <template #empty>
            <q-item class="empty-state-container text-center bg-white">
              <q-item-section>
                <q-icon name="payments" size="36px" color="grey-5" class="q-mb-xs block q-mx-auto" />
                <q-item-label class="text-subtitle2 text-weight-bold text-grey-7">No payments</q-item-label>
                <q-item-label class="text-caption text-grey-6 q-mt-xs">No recent payments recorded for this outlet.</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </AqlList>
      </q-card>

      <!-- Sticky FAB for Actions -->
      <q-page-sticky position="bottom-right" :offset="[18, 18]">
        <q-fab
          icon="add"
          active-icon="close"
          direction="up"
          color="primary"
          vertical-actions-align="right"
        >
          <q-fab-action
            color="primary"
            icon="point_of_sale"
            label="New Consumption"
            :disable="!canCreateConsumption"
            @click="goToStartConsumption"
          />
          <q-fab-action
            color="negative"
            icon="payments"
            label="New Payment"
            :disable="!canCreatePayment || !unpaidInvoices.length"
            @click="goToPaymentCollection"
          />
          <q-fab-action
            color="purple"
            icon="assignment_return"
            label="New Return"
            :disable="!canCreateReturn"
            @click="goToNewReturn"
          />
        </q-fab>
      </q-page-sticky>
    </template>

    <OutletVisitActionDialog
      v-model="actionDialog"
      :visit="selectedVisit"
      :outlet-label="selectedVisitOutletLabel"
      :saving="saving"
      @confirm="handleVisitActionConfirm"
      @cancel="actionDialog = false"
    />

    <ActionCommentDialog
      v-model="planDialog"
      title="Plan Visit"
      label="Comment (optional)"
      submit-label="Plan Visit"
      submit-color="primary"
      submit-icon="event_available"
      :saving="saving"
      :disable-submit="!planForm.date"
      action="create"
      target-resource="outletVisit"
      @confirm="handlePlanConfirm"
      @cancel="planDialog = false"
    >
      <template #fields>
        <q-input :model-value="outletName(selectedOutletCode)" label="Outlet" outlined readonly />
        <AppDate v-model="planForm.date" label="Visit Date" outlined :rules="[val => !!val || 'Date is required']" hide-bottom-space />
      </template>
    </ActionCommentDialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useOutletHub } from '../../../composables/operations/outlets/useOutletHub.js'
import { useOutletVisits } from '../../../composables/operations/outlets/useOutletVisits.js'
import { getInvoiceRemaining } from '../../../composables/operations/outlets/outletConsumptionPricing.js'
import { progressMeta } from '../../../composables/operations/outlets/outletOperationsMeta.js'
import { useCurrency } from '../../../composables/useCurrency.js'
import HeaderPanel from '../../../components/shared/HeaderPanel.vue'
import OutletHubSummaryStats from '../../../components/Operations/Outlets/OutletHub/OutletHubSummaryStats.vue'
import OutletHubSimpleListSection from '../../../components/Operations/Outlets/OutletHub/OutletHubSimpleListSection.vue'
import OutletHubPaymentSection from '../../../components/Operations/Outlets/OutletHub/OutletHubPaymentSection.vue'
import OutletVisitActionDialog from '../../../components/Operations/Outlets/OutletVisitActionDialog.vue'
import SectionDividerLabel from '../../../components/shared/SectionDividerLabel.vue'
import ActionCommentDialog from '../../../components/shared/ActionCommentDialog.vue'
import AppDate from '../../../components/shared/AppDate.vue'
import AqlList from '../../../components/shared/AqlList.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import AqlGroupedList from "components/shared/AqlGroupedList.vue";

defineOptions({ name: 'OutletsOperationsHubPage' })

const route = useRoute()
const flow = useOutletHub()
const visitsFlow = useOutletVisits()
const { _C } = useCurrency()

const {
  selectedOutletCode, selectedOutlet, outletOptions,
  plannedVisits, pendingRestocks, pendingReturns, outletStock, recentInvoices, recentPayments, unpaidInvoices, totalOutstanding,
  canCreateVisit, canCreateRestock, canCreateReturn, canCreateConsumption, canCreatePayment,
  payments, reload, outletName, outletInvoices,
  goToNewRestock, navigateToRestock, goToNewReturn, navigateToReturn,
  goToStartConsumption, goToCollectPayment, goToPaymentCollection,
  RECENT_WINDOW_DAYS, RECENT_RECORD_LIMIT
} = flow
const { saving, completeVisit, postponeVisit, cancelVisit, planVisit } = visitsFlow

const outletFilter = ref('')
const filteredOutletOptions = ref([])

function filterOutlets(needle, update) {
  outletFilter.value = needle
  update(() => {
    const value = (needle || '').toLowerCase()
    filteredOutletOptions.value = outletOptions.value.filter(
      (opt) => opt.label.toLowerCase().includes(value) || String(opt.value).toLowerCase().includes(value)
    )
  })
}

const outletOptionsList = computed(() => {
  if (!outletFilter.value) return outletOptions.value
  return filteredOutletOptions.value
})

const selectedOutletLabel = computed(() => {
  if (!selectedOutlet.value) return ''
  return outletName(selectedOutlet.value.Code)
})

function formatMoney(value) {
  return _C(value, true)
}

function formatDisplayDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function remainingFor(invoice) {
  return getInvoiceRemaining(invoice, payments.items.value)
}

const hubInvoices = computed(() => {
  const pending = outletInvoices.value.filter(inv => remainingFor(inv) > 0.01)
  const paid = outletInvoices.value.filter(inv => remainingFor(inv) <= 0.01)
  return [...pending, ...paid].slice(0, 8)
})

function invoiceStatus(invoice = {}) {
  return progressMeta(invoice.Progress)
}

function restockChip(restock = {}) {
  return progressMeta(restock.Progress)
}

function returnChip(ret = {}) {
  return progressMeta(ret.Progress)
}

function visitUrgencyChip(visit = {}) {
  const raw = visit.Date || visit.ScheduledAt
  if (!raw) return { label: 'No date', color: 'grey' }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return { label: 'No date', color: 'grey' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: `Overdue ${Math.abs(diff)} day${diff>-2?'':'s'}`, color: 'negative' }
  if (diff === 0) return { label: 'Today', color: 'positive' }
  if (diff === 1) return { label: 'Tomorrow', color: 'secondary' }
  return { label: `In ${diff} day${diff>1?'s':''}`, color: 'grey' }
}

function tomorrowISO() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

const actionDialog = ref(false)
const selectedVisit = ref(null)

const selectedVisitOutletLabel = computed(() => {
  if (!selectedVisit.value) return ''
  return outletName(selectedVisit.value.OutletCode)
})

function onVisitClick(visit) {
  if (!canCreateVisit.value) return
  selectedVisit.value = visit
  actionDialog.value = true
}

function onRestockClick(restock) {
  if (!restock?.Code) return
  navigateToRestock(restock.Code)
}

function onReturnClick(ret) {
  if (!ret?.Code) return
  navigateToReturn(ret.Code)
}

async function handleVisitActionConfirm({ action, fields }) {
  if (!selectedVisit.value) return
  let result = false
  if (action === 'complete') result = await completeVisit(selectedVisit.value, { ProgressCompletedComment: fields.comment })
  else if (action === 'postpone') result = await postponeVisit(selectedVisit.value, { Date: fields.date, ProgressPostponedComment: fields.reason })
  else if (action === 'cancel') result = await cancelVisit(selectedVisit.value, { ProgressCancelledComment: fields.reason, Date: fields.nextDate || undefined })
  if (result) {
    actionDialog.value = false
    await reload()
  }
}

const planDialog = ref(false)
const planForm = ref({ date: tomorrowISO(), comment: '' })

function openPlanDialog() {
  planForm.value = { date: tomorrowISO(), comment: '' }
  planDialog.value = true
}

async function handlePlanConfirm(comment) {
  if (!selectedOutletCode.value) return
  const result = await planVisit(selectedOutletCode.value, planForm.value.date, comment)
  if (result) {
    planDialog.value = false
    await reload()
  }
}

onMounted(async () => {
  const preset = String(route.query.outletCode || route.query.outletcode || '').trim()
  await reload()
  if (preset) selectedOutletCode.value = preset
})
</script>
