<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" color="primary" @click="$router.push('/operations/prs')" />
      <h1 class="text-h5 q-mt-none q-mb-none q-ml-sm">Purchase Requisition: {{ prCode }}</h1>
      <q-space />
      <q-chip :color="progressColor(prForm.Progress)" text-color="white" class="text-weight-bold">
        {{ prForm.Progress }}
      </q-chip>
      <q-btn
        v-if="prForm.Progress === 'New'"
        color="negative"
        label="Reject"
        class="q-ml-sm"
        @click="showActionDialog('Reject')"
      />
      <q-btn
        v-if="prForm.Progress === 'New'"
        color="warning"
        label="Review"
        class="q-ml-sm"
        text-color="black"
        @click="showActionDialog('Review')"
      />
      <q-btn
        v-if="prForm.Progress === 'New'"
        color="positive"
        label="Approve"
        class="q-ml-sm"
        @click="showActionDialog('Approve')"
      />
    </div>

    <!-- Full Read-Only Header -->
    <q-card bordered flat class="q-mb-md bg-grey-1">
      <q-card-section>
        <div class="text-h6 q-mb-sm text-grey-8">Header Details</div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-3">
            <div class="text-caption text-grey">PR Date</div>
            <div class="text-body1 text-weight-medium">{{ prForm.PRDate }}</div>
          </div>
          <div class="col-12 col-md-3">
            <div class="text-caption text-grey">Type</div>
            <div class="text-body1 text-weight-medium">{{ prForm.Type }}</div>
          </div>
          <div class="col-12 col-md-3">
            <div class="text-caption text-grey">Priority</div>
            <div class="text-body1 text-weight-medium">{{ prForm.Priority }}</div>
          </div>
          <div class="col-12 col-md-3">
            <div class="text-caption text-grey">Warehouse</div>
            <div class="text-body1 text-weight-medium">{{ prForm.WarehouseCode }}</div>
          </div>
          <div class="col-12 col-md-3">
            <div class="text-caption text-grey">Required Date</div>
            <div class="text-body1 text-weight-medium">{{ prForm.RequiredDate }}</div>
          </div>
          <div class="col-12 col-md-3" v-if="prForm.TypeReferenceCode">
            <div class="text-caption text-grey">Reference Code</div>
            <div class="text-body1 text-weight-medium">{{ prForm.TypeReferenceCode }}</div>
          </div>
          <div class="col-12 col-md-3" v-if="prForm.ProcurementCode">
            <div class="text-caption text-grey">Procurement Code</div>
            <div class="text-body1 text-weight-medium text-primary cursor-pointer" @click="$router.push(`/operations/procurements/${prForm.ProcurementCode}/view`)">
              {{ prForm.ProcurementCode }}
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Progress History Section -->
    <q-card bordered flat class="q-mb-md" v-if="hasHistory">
      <q-card-section>
        <div class="text-h6 q-mb-sm text-grey-8">History & Comments</div>
        <q-list bordered separator>
          <q-item v-if="prForm.ProgressReviewBy">
            <q-item-section>
              <q-item-label>Review Requested by {{ prForm.ProgressReviewBy }} at {{ formatDateTime(prForm.ProgressReviewAt) }}</q-item-label>
              <q-item-label caption class="whitespace-pre-wrap">{{ prForm.ProgressReviewComment }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="prForm.ProgressApprovedBy">
            <q-item-section>
              <q-item-label class="text-positive">Approved by {{ prForm.ProgressApprovedBy }} at {{ formatDateTime(prForm.ProgressApprovedAt) }}</q-item-label>
              <q-item-label caption class="whitespace-pre-wrap">{{ prForm.ProgressApprovedComment }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item v-if="prForm.ProgressRejectedBy">
            <q-item-section>
              <q-item-label class="text-negative">Rejected by {{ prForm.ProgressRejectedBy }} at {{ formatDateTime(prForm.ProgressRejectedAt) }}</q-item-label>
              <q-item-label caption class="whitespace-pre-wrap">{{ prForm.ProgressRejectedComment }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <!-- Read-Only Items Table -->
    <q-card bordered flat>
      <q-card-section>
        <div class="text-h6">Items</div>
      </q-card-section>

      <q-table
        :rows="items"
        :columns="itemColumns"
        row-key="SKU"
        flat
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
      >
        <template v-slot:bottom>
          <div class="full-width text-right text-subtitle1 q-pa-sm text-weight-bold">
            Total Estimated Value: {{ items.reduce((acc, row) => acc + (row.Quantity * row.EstimatedRate), 0).toFixed(2) }}
          </div>
        </template>
      </q-table>
    </q-card>

    <!-- Action Dialog -->
    <q-dialog v-model="actionDialog.show">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">{{ actionDialog.type }} PR</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="actionDialog.comment"
            type="textarea"
            label="Comment"
            outlined
            autofocus
            :rules="[val => (actionDialog.type === 'Approve' || !!val) || 'Comment is mandatory']"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat :label="actionDialog.type" :color="actionDialog.type === 'Reject' ? 'negative' : (actionDialog.type === 'Review' ? 'warning' : 'positive')" @click="confirmAction" :loading="acting" />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { callGasApi } from 'src/services/gasApi'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()

const prCode = route.params.code
const prForm = ref({})
const items = ref([])
const loading = ref(true)
const acting = ref(false)

const actionDialog = ref({
  show: false,
  type: '',
  comment: ''
})

const itemColumns = [
  { name: 'SKU', label: 'SKU', field: 'SKU', align: 'left' },
  { name: 'UOM', label: 'UOM', field: 'UOM', align: 'left' },
  { name: 'Quantity', label: 'Quantity', field: 'Quantity', align: 'right' },
  { name: 'EstimatedRate', label: 'Est. Rate', field: 'EstimatedRate', align: 'right' },
  { name: 'Total', label: 'Total', field: row => (row.Quantity * row.EstimatedRate).toFixed(2), align: 'right' }
]

const progressColor = (progress) => {
  if (progress === 'Draft') return 'grey'
  if (progress === 'Review') return 'warning'
  if (progress === 'Approved') return 'positive'
  if (progress === 'Rejected') return 'negative'
  if (progress === 'New') return 'info'
  return 'primary'
}

const hasHistory = computed(() => {
  return prForm.value.ProgressReviewBy || prForm.value.ProgressApprovedBy || prForm.value.ProgressRejectedBy
})

const formatDateTime = (timestamp) => {
  if (!timestamp) return ''
  try {
    return new Date(timestamp).toLocaleString()
  } catch (e) {
    return timestamp
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const [prRes, itemsRes] = await Promise.all([
      callGasApi('getRecords', { resourceName: 'PurchaseRequisitions', filters: JSON.stringify([{ field: 'Code', operator: 'eq', value: prCode }]) }),
      callGasApi('getRecords', { resourceName: 'PurchaseRequisitionItems', filters: JSON.stringify([{ field: 'PurchaseRequisitionCode', operator: 'eq', value: prCode }]) })
    ])

    if (prRes.success && prRes.records.length > 0) {
      prForm.value = prRes.records[0]
      // Prevent editing access to this page if Draft/Review
      if (['Draft', 'Review'].includes(prForm.value.Progress)) {
        router.replace(`/operations/purchase-requisitions/${prCode}/draft`)
      }
    } else {
      $q.notify({ type: 'negative', message: 'PR not found' })
      router.push('/operations/prs')
      return
    }

    if (itemsRes.success) {
      items.value = itemsRes.records
    }
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Failed to load PR details' })
  } finally {
    loading.value = false
  }
}

const showActionDialog = (type) => {
  actionDialog.value = {
    show: true,
    type,
    comment: ''
  }
}

const confirmAction = async () => {
  if (actionDialog.value.type !== 'Approve' && !actionDialog.value.comment.trim()) {
    $q.notify({ type: 'warning', message: 'Comment is required' })
    return
  }

  acting.value = true

  const type = actionDialog.value.type
  const updateData = { Code: prCode, Progress: type === 'Review' ? 'Review' : (type === 'Approve' ? 'Approved' : 'Rejected') }

  // Get current user details from Auth Context if available. In pure client, the backend sets "By" and "At".
  // But since we just pass the comment, let the backend handle the Audit stamps if configured,
  // OR we can pass it from frontend if the backend allows standard updates.
  // Standard AQL `handleUpsertRecord` doesn't auto-set custom audit fields, so frontend should pass them.
  const auth = JSON.parse(localStorage.getItem('auth') || '{}')
  const userName = auth.user?.Name || auth.user?.Email || 'System'
  const now = new Date().toISOString()

  if (type === 'Review') {
    // Append comment
    const existingComment = prForm.value.ProgressReviewComment ? prForm.value.ProgressReviewComment + '\n' : ''
    updateData.ProgressReviewComment = existingComment + `[${now}] ${userName}: ` + actionDialog.value.comment
    updateData.ProgressReviewAt = now
    updateData.ProgressReviewBy = userName
  } else if (type === 'Approve') {
    updateData.ProgressApprovedComment = actionDialog.value.comment
    updateData.ProgressApprovedAt = now
    updateData.ProgressApprovedBy = userName
  } else if (type === 'Reject') {
    updateData.ProgressRejectedComment = actionDialog.value.comment
    updateData.ProgressRejectedAt = now
    updateData.ProgressRejectedBy = userName
  }

  try {
    const response = await callGasApi('upsertRecord', {
      resource: 'PurchaseRequisitions',
      scope: 'operation',
      data: updateData
    }, {
      showLoading: true,
      loadingMessage: `Processing ${type}...`,
      successMessage: `PR ${type}d successfully`
    })

    if (response.success) {
      actionDialog.value.show = false
      await loadData()
    }
  } catch (error) {
    $q.notify({ type: 'negative', message: `Failed to process action: ${error.message}` })
  } finally {
    acting.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>
