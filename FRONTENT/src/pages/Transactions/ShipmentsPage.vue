<template>
  <q-page class="q-pa-md">
    <div class="text-h5 q-mb-md">Shipments Dashboard</div>
    
    <q-card class="q-mb-md" flat bordered>
      <q-card-section>
        <div class="text-subtitle1">Inbound Logistics Tracking</div>
        <div class="text-body2 text-grey-7">
          Manage container shipments, port clearance, and expected variant quantities.
        </div>
      </q-card-section>
    </q-card>

    <q-table
      title="Shipments"
      :rows="shipments"
      :columns="columns"
      row-key="Code"
      :loading="loading"
      bordered
      flat
    >
      <template v-slot:top-right>
        <q-btn color="primary" icon="add" label="New Shipment" @click="openCreateDialog" />
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
const shipments = ref([])

const columns = [
  { name: 'Code', label: 'Shipment No', field: 'Code', sortable: true, align: 'left' },
  { name: 'SupplierCode', label: 'Supplier', field: 'SupplierCode', sortable: true, align: 'left' },
  { name: 'ETD', label: 'ETD', field: 'ETD', sortable: true, align: 'left' },
  { name: 'ETA', label: 'ETA', field: 'ETA', sortable: true, align: 'left' },
  { name: 'Status', label: 'Status', field: 'Status', sortable: true, align: 'center' },
  { name: 'CarrierCode', label: 'Carrier', field: 'CarrierCode', sortable: true, align: 'left' },
  { name: 'PortCode', label: 'Port', field: 'PortCode', sortable: true, align: 'left' }
]

function getStatusColor(status) {
  const map = {
    'Draft': 'grey',
    'InTransit': 'blue',
    'Arrived': 'orange',
    'Cleared': 'positive',
    'Received': 'purple'
  }
  return map[status] || 'grey'
}

async function fetchData() {
  loading.value = true
  try {
    const res = await callGasApi('get', { scope: 'transaction', resource: 'Shipments' })
    if (res.success && res.rows) {
      shipments.value = res.rows
    } else {
      $q.notify({ type: 'negative', message: res.message || 'Failed to fetch shipments.' })
    }
  } catch (err) {
    if (err.message.includes('403')) {
       $q.notify({ type: 'warning', message: 'You do not have permission to view Shipments.' })
    } else {
       $q.notify({ type: 'negative', message: 'Error fetching shipments.' })
    }
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  $q.notify({ type: 'info', message: 'Create Shipment dialog not implemented yet.' })
}

onMounted(() => {
  fetchData()
})
</script>
