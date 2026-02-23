<template>
  <q-page class="q-pa-md">
    <div class="text-h5 q-mb-md">Goods Receipts (GRN)</div>

    <q-card class="q-mb-md" flat bordered>
      <q-card-section>
        <div class="text-subtitle1">Warehouse Putaway</div>
        <div class="text-body2 text-grey-7">
          Receive shipments into the designated warehouse and allocate stock.
        </div>
      </q-card-section>
    </q-card>

    <q-table
      title="Goods Receipts"
      :rows="receipts"
      :columns="columns"
      row-key="Code"
      :loading="loading"
      bordered
      flat
    >
      <template v-slot:top-right>
        <q-btn color="primary" icon="add" label="New GRN" @click="openCreateDialog" />
        <q-btn outline color="primary" icon="sync" class="q-ml-sm" label="Refresh" @click="fetchData" />
      </template>
      <template v-slot:body-cell-Status="props">
        <q-td :props="props">
          <q-chip :color="getStatusColor(props.row.Status)" text-color="white" dense>
            {{ props.row.Status }}
          </q-chip>
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { callGasApi } from 'src/services/gasApi'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const loading = ref(false)
const receipts = ref([])

const columns = [
  { name: 'Code', label: 'GRN No', field: 'Code', sortable: true, align: 'left' },
  { name: 'ShipmentCode', label: 'Shipment No', field: 'ShipmentCode', sortable: true, align: 'left' },
  { name: 'ReceivedDate', label: 'Received Date', field: 'ReceivedDate', sortable: true, align: 'left' },
  { name: 'WarehouseCode', label: 'Warehouse', field: 'WarehouseCode', sortable: true, align: 'left' },
  { name: 'Status', label: 'Status', field: 'Status', sortable: true, align: 'center' }
]

function getStatusColor(status) {
  const map = {
    'Draft': 'grey',
    'Verified': 'blue',
    'Accepted': 'positive'
  }
  return map[status] || 'grey'
}

async function fetchData() {
  loading.value = true
  try {
    const res = await callGasApi('get', { scope: 'transaction', resource: 'GoodsReceipts' })
    if (res.success && res.rows) {
      receipts.value = res.rows
    } else {
      $q.notify({ type: 'negative', message: res.message || 'Failed to fetch GRNs.' })
    }
  } catch (err) {
    if (err.message.includes('403')) {
       $q.notify({ type: 'warning', message: 'You do not have permission to view Goods Receipts.' })
    } else {
       $q.notify({ type: 'negative', message: 'Error fetching Goods Receipts.' })
    }
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  $q.notify({ type: 'info', message: 'Create GRN dialog not implemented yet.' })
}

onMounted(() => {
  fetchData()
})
</script>
