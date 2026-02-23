<template>
  <q-page class="q-pa-md bg-grey-1">
    <q-card flat bordered>
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col-12 col-md">
          <div class="text-h6 text-weight-bold">Products</div>
          <div class="text-caption text-grey-7">Manage product master (Code, Name, Status)</div>
        </div>

        <div class="col-12 col-md-auto row items-center q-gutter-sm">
          <q-toggle
            v-model="showInactive"
            label="Include Inactive"
            color="primary"
            @update:model-value="reload"
          />
          <q-btn color="primary" icon="add" label="New Product" @click="openCreateDialog" />
          <q-btn flat icon="refresh" @click="reload" :loading="products.loading" />
        </div>
      </q-card-section>

      <q-separator />

      <q-table
        :rows="products.items"
        :columns="columns"
        row-key="code"
        flat
        :loading="products.loading"
        :pagination="pagination"
      >
        <template #body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="props.row.status === 'Active' ? 'positive' : 'grey-6'" outline>
              {{ props.row.status }}
            </q-badge>
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" class="text-right">
            <q-btn
              flat
              round
              dense
              icon="edit"
              color="primary"
              @click="openEditDialog(props.row)"
            />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <q-dialog v-model="showDialog" persistent>
      <q-card style="min-width: 420px; width: 100%; max-width: 520px;">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ isEdit ? 'Edit Product' : 'Create Product' }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-none q-gutter-y-sm">
          <q-input
            v-if="isEdit"
            v-model="form.code"
            label="Code"
            dense
            outlined
            disable
          />

          <q-input
            v-model="form.name"
            label="Name"
            dense
            outlined
            autofocus
          />


          <q-select
            v-model="form.status"
            :options="statusOptions"
            label="Status"
            dense
            outlined
            emit-value
            map-options
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            :label="isEdit ? 'Update' : 'Create'"
            :loading="products.saving"
            @click="save"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useProductsStore } from 'src/stores/products'

const $q = useQuasar()
const products = useProductsStore()

const showInactive = ref(false)
const showDialog = ref(false)
const isEdit = ref(false)

const form = ref({
  code: '',
  name: '',
  status: 'Active'
})

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' }
]

const pagination = {
  rowsPerPage: 10
}

const columns = [
  { name: 'code', label: 'Code', field: 'code', align: 'left', sortable: true },
  { name: 'name', label: 'Name', field: 'name', align: 'left', sortable: true },
  { name: 'status', label: 'Status', field: 'status', align: 'left', sortable: true },
  { name: 'actions', label: '', field: 'actions', align: 'right' }
]

function notify(type, message) {
  $q.notify({ type, message, timeout: 2200 })
}

async function reload() {
  const result = await products.fetchProducts(showInactive.value)
  if (!result.success) {
    notify('negative', result.message || 'Failed to load products')
  }
}

function openCreateDialog() {
  isEdit.value = false
  form.value = {
    code: '',
    name: '',
    status: 'Active'
  }
  showDialog.value = true
}

function openEditDialog(row) {
  isEdit.value = true
  form.value = {
    code: row.code,
    name: row.name,
    status: row.status || 'Active'
  }
  showDialog.value = true
}

async function save() {
  const name = (form.value.name || '').trim()

  if (!name) {
    notify('negative', 'Name is required')
    return
  }

  const payload = {
    name,
    status: form.value.status || 'Active'
  }

  let result
  if (isEdit.value) {
    result = await products.updateProduct({ code: form.value.code, ...payload })
  } else {
    result = await products.createProduct(payload)
  }

  if (!result.success) {
    notify('negative', result.message || 'Save failed')
    return
  }

  notify('positive', isEdit.value ? 'Product updated' : 'Product created')
  showDialog.value = false
}

onMounted(async () => {
  await reload()
})
</script>
