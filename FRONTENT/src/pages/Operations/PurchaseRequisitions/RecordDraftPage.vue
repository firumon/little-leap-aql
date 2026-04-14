<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" color="primary" @click="goBack" />
      <h1 class="text-h5 q-mt-none q-mb-none q-ml-sm">Draft Purchase Requisition: {{ prCode }}</h1>
      <q-space />
      <q-chip :color="progressColor(prForm.Progress)" text-color="white" class="text-weight-bold">
        {{ prForm.Progress }}
      </q-chip>
    </div>

    <!-- Review Comments prominently displayed if in Review state -->
    <q-card v-if="prForm.Progress === 'Review'" class="bg-warning text-white q-mb-md">
      <q-card-section>
        <div class="text-h6">Review Required</div>
        <div class="text-body2 whitespace-pre-wrap q-mt-sm">{{ prForm.ProgressReviewComment || 'No comments provided.' }}</div>

        <q-input
          v-model="responseComment"
          type="textarea"
          outlined
          dense
          bg-color="white"
          label="Your Response (Appended to comments)"
          class="q-mt-md"
        />
      </q-card-section>
    </q-card>

    <q-card bordered flat class="q-mb-md">
      <q-card-section>
        <div class="text-h6 q-mb-sm">Header Details</div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-3">
            <q-input v-model="prForm.PRDate" label="PR Date" outlined dense readonly bg-color="grey-2" />
          </div>
          <div class="col-12 col-md-3">
            <q-select
              v-model="prForm.Type"
              :options="['STOCK', 'PROJECT', 'SALES', 'ASSET']"
              label="Type"
              outlined
              dense
            />
          </div>
          <div class="col-12 col-md-3">
            <q-select
              v-model="prForm.Priority"
              :options="['Low', 'Medium', 'High', 'Urgent']"
              label="Priority"
              outlined
              dense
            />
          </div>
          <div class="col-12 col-md-3">
            <q-select
              v-model="prForm.WarehouseCode"
              :options="warehouseOptions"
              label="Warehouse"
              outlined
              dense
            />
          </div>
          <div class="col-12 col-md-3">
            <q-input
              v-model="prForm.RequiredDate"
              label="Required Date"
              type="date"
              outlined
              dense
            />
          </div>
          <div class="col-12 col-md-3" v-if="['PROJECT', 'SALES'].includes(prForm.Type)">
            <q-input
              v-model="prForm.TypeReferenceCode"
              label="Reference Code"
              outlined
              dense
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card bordered flat>
      <q-card-section class="row items-center justify-between">
        <div class="text-h6">Items</div>
        <q-btn color="primary" icon="add" label="Add Item" @click="showAddItemDialog = true" outline />
      </q-card-section>

      <q-table
        :rows="items"
        :columns="itemColumns"
        row-key="SKU"
        flat
        bordered
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
      >
        <template v-slot:body-cell-Quantity="props">
          <q-td :props="props">
            <q-input
              v-model.number="props.row.Quantity"
              type="number"
              dense
              outlined
              min="1"
            />
          </q-td>
        </template>
        <template v-slot:body-cell-EstimatedRate="props">
          <q-td :props="props">
            <q-input
              v-model.number="props.row.EstimatedRate"
              type="number"
              dense
              outlined
              min="0"
              step="0.01"
            />
          </q-td>
        </template>
        <template v-slot:body-cell-Actions="props">
          <q-td :props="props" class="text-right">
            <q-btn flat icon="delete" color="negative" @click="removeItem(props.rowIndex)" dense />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <div class="row justify-end q-mt-lg q-gutter-sm">
      <q-btn outline color="primary" label="Save Draft" @click="saveDraft" :loading="saving" />
      <q-btn color="primary" label="Confirm & Submit" @click="submitPR" :loading="submitting" />
    </div>

    <!-- Add Item Dialog -->
    <q-dialog v-model="showAddItemDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Add Item</div>
        </q-card-section>
        <q-card-section>
          <q-select
            v-model="newItem.SKU"
            :options="skuOptions"
            label="Select SKU"
            outlined
            dense
            use-input
            @filter="filterSkus"
            class="q-mb-md"
          >
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption>UOM: {{ scope.opt.UOM || 'N/A' }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <q-input v-model.number="newItem.Quantity" type="number" label="Quantity" outlined dense min="1" class="q-mb-md" />
          <q-input v-model.number="newItem.EstimatedRate" type="number" label="Estimated Rate" outlined dense min="0" step="0.01" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat label="Add" color="primary" @click="confirmAddItem" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { callGasApi } from 'src/services/gasApi'
import { useStockMovements } from 'src/composables/useStockMovements'
import { useResourceNav } from 'src/composables/useResourceNav'

const route = useRoute()
const nav = useResourceNav()
const $q = useQuasar()
const { loadWarehouses } = useStockMovements()

const prCode = route.params.code
const prForm = ref({})
const items = ref([])
const originalItems = ref([])
const deletedItemCodes = ref([])

const saving = ref(false)
const submitting = ref(false)
const loading = ref(true)

const responseComment = ref('')

const warehouses = ref([])
const warehouseOptions = computed(() => warehouses.value.map(w => ({ label: `${w.Name} (${w.Code})`, value: w.Code })))

const allSkus = ref([])
const skuOptions = ref([])

const showAddItemDialog = ref(false)
const newItem = ref({ SKU: null, Quantity: 1, EstimatedRate: 0 })

const itemColumns = [
  { name: 'SKU', label: 'SKU', field: 'SKU', align: 'left' },
  { name: 'UOM', label: 'UOM', field: 'UOM', align: 'left' },
  { name: 'Quantity', label: 'Quantity', field: 'Quantity', align: 'left' },
  { name: 'EstimatedRate', label: 'Estimated Rate', field: 'EstimatedRate', align: 'left' },
  { name: 'Total', label: 'Total', field: row => (row.Quantity * row.EstimatedRate).toFixed(2), align: 'left' },
  { name: 'Actions', label: 'Actions', align: 'right' }
]

const progressColor = (progress) => {
  if (progress === 'Draft') return 'grey'
  if (progress === 'Review') return 'warning'
  return 'primary'
}

function goBack() {
  nav.goTo('list')
}

const loadData = async () => {
  loading.value = true
  try {
    const [prRes, itemsRes, whRes, skuRes] = await Promise.all([
      callGasApi('getRecords', { resourceName: 'PurchaseRequisitions', filters: JSON.stringify([{ field: 'Code', operator: 'eq', value: prCode }]) }),
      callGasApi('getRecords', { resourceName: 'PurchaseRequisitionItems', filters: JSON.stringify([{ field: 'PurchaseRequisitionCode', operator: 'eq', value: prCode }]) }),
      loadWarehouses(),
      callGasApi('getRecords', { resourceName: 'SKUs', limit: 3000 })
    ])

    if (prRes.success && prRes.records.length > 0) {
      prForm.value = prRes.records[0]
      // Ensure only Draft/Review access
      if (!['Draft', 'Review'].includes(prForm.value.Progress)) {
        nav.goTo('view')
      }
    } else {
      $q.notify({ type: 'negative', message: 'PR not found' })
      nav.goTo('list')
      return
    }

    if (itemsRes.success) {
      items.value = itemsRes.records.map(i => ({ ...i }))
      originalItems.value = JSON.parse(JSON.stringify(itemsRes.records))
    }

    warehouses.value = whRes

    if (skuRes.success) {
      allSkus.value = skuRes.records.filter(s => s.Status === 'Active')
      skuOptions.value = allSkus.value.map(s => ({ label: s.Code, value: s.Code, ...s }))
    }
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Failed to load PR details' })
  } finally {
    loading.value = false
  }
}

const filterSkus = (val, update) => {
  update(() => {
    const needle = val.toLowerCase()
    skuOptions.value = allSkus.value.filter(s => s.Code.toLowerCase().includes(needle)).map(s => ({ label: s.Code, value: s.Code, ...s }))
  })
}

const confirmAddItem = () => {
  if (!newItem.value.SKU || newItem.value.Quantity <= 0) {
    $q.notify({ type: 'warning', message: 'Please select a valid SKU and positive quantity' })
    return
  }

  // Check if exists
  const existing = items.value.find(i => i.SKU === newItem.value.SKU.value)
  if (existing) {
    existing.Quantity += newItem.value.Quantity
  } else {
    items.value.push({
      SKU: newItem.value.SKU.value,
      UOM: newItem.value.SKU.UOM || '',
      Quantity: newItem.value.Quantity,
      EstimatedRate: newItem.value.EstimatedRate
    })
  }

  showAddItemDialog.value = false
  newItem.value = { SKU: null, Quantity: 1, EstimatedRate: 0 }
}

const removeItem = (index) => {
  const item = items.value[index]
  if (item.Code) {
    // Has a backend code, mark for deletion or track it
    deletedItemCodes.value.push(item.Code)
  }
  items.value.splice(index, 1)
}

const buildPayload = (targetProgress = prForm.value.Progress) => {
  const updatedComment = prForm.value.Progress === 'Review' && responseComment.value
    ? `${prForm.value.ProgressReviewComment || ''}\n[Response]: ${responseComment.value}`
    : prForm.value.ProgressReviewComment

  const payload = {
    action: 'compositeSave',
    resource: 'PurchaseRequisitions',
    scope: 'operation',
    code: prCode,
    data: {
      Type: prForm.value.Type.value || prForm.value.Type,
      Priority: prForm.value.Priority.value || prForm.value.Priority,
      WarehouseCode: prForm.value.WarehouseCode.value || prForm.value.WarehouseCode,
      RequiredDate: prForm.value.RequiredDate,
      TypeReferenceCode: prForm.value.TypeReferenceCode,
      Progress: targetProgress,
      ProgressReviewComment: updatedComment || ''
    },
    children: [
      {
        resource: 'PurchaseRequisitionItems',
        records: []
      }
    ]
  }

  // Handle active/updated/new items
  items.value.forEach(item => {
    payload.children[0].records.push({
      _action: item.Code ? 'update' : 'create',
      _originalCode: item.Code || '',
      data: {
        SKU: item.SKU,
        UOM: item.UOM,
        Quantity: item.Quantity,
        EstimatedRate: item.EstimatedRate,
        Status: 'Active'
      }
    })
  })

  // Handle deleted items
  deletedItemCodes.value.forEach(code => {
    payload.children[0].records.push({
      _action: 'deactivate', // Use standard AQL convention for soft delete in composite
      _originalCode: code,
      data: { Status: 'Inactive' }
    })
  })

  return payload
}

const saveDraft = async () => {
  saving.value = true
  try {
    const payload = buildPayload()
    const response = await callGasApi('compositeSave', payload, {
      showLoading: true,
      loadingMessage: 'Saving Draft...'
    })

    if (response.success) {
      $q.notify({ type: 'positive', message: 'Draft saved successfully' })
      deletedItemCodes.value = [] // Reset
      await loadData() // Reload to get new codes
    }
  } catch (error) {
    $q.notify({ type: 'negative', message: 'Failed to save draft: ' + error.message })
  } finally {
    saving.value = false
  }
}

const submitPR = async () => {
  if (items.value.length === 0) {
    $q.notify({ type: 'warning', message: 'Add at least one item before submitting' })
    return
  }

  $q.dialog({
    title: 'Confirm Submit',
    message: 'Are you sure you want to submit this Purchase Requisition? It will move out of Draft status.',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    submitting.value = true
    try {
      const payload = buildPayload('New')
      const response = await callGasApi('compositeSave', payload, {
        showLoading: true,
        loadingMessage: 'Submitting PR...',
        successMessage: 'PR Submitted successfully'
      })

      if (response.success) {
        nav.goTo('view')
      }
    } catch (error) {
      $q.notify({ type: 'negative', message: 'Failed to submit PR: ' + error.message })
    } finally {
      submitting.value = false
    }
  })
}

onMounted(() => {
  loadData()
})
</script>
