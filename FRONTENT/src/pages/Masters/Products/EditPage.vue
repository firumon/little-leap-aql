<template>
  <div class="edit-page">
    <div v-if="loading" class="q-py-xl text-center">
      <q-spinner-dots color="primary" size="32px" />
    </div>

    <q-card v-else-if="!record" flat bordered class="page-card">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="search_off" size="48px" color="grey-5" />
        <div class="text-subtitle1 text-grey-7 q-mt-md">Record not found</div>
        <q-btn flat color="primary" label="Back to List" icon="arrow_back" class="q-mt-md" @click="navigateToList" />
      </q-card-section>
    </q-card>

    <template v-else>
      <q-card flat bordered class="page-card">
        <q-card-section class="q-pa-sm q-pa-md">
          <div class="text-h6 text-weight-bold">Edit Product - {{ code }}</div>
          <div class="text-caption text-grey-6">Update product and related SKU variants in one save.</div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="page-card q-mt-sm">
        <q-card-section class="q-pa-sm q-pa-md">
          <div class="text-subtitle2 text-weight-medium q-mb-sm">Product Details</div>
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-md-4">
              <q-input :model-value="code" outlined dense label="Code" readonly />
            </div>
            <div class="col-12 col-md-4">
              <q-input v-model="parentForm.Name" outlined dense label="Name *" />
            </div>
            <div class="col-12 col-md-4">
              <q-select
                v-model="parentForm.Status"
                outlined
                dense
                emit-value
                map-options
                :options="statusOptions"
                label="Status"
              />
            </div>
            <div class="col-12">
              <div class="row items-center q-col-gutter-sm">
                <div class="col">
                  <q-input
                    v-model="newVariantType"
                    outlined
                    dense
                    label="Variant Type"
                    placeholder="e.g. Color"
                    @keyup.enter.prevent="addVariantType"
                  />
                </div>
                <div class="col-auto">
                  <q-btn
                    color="primary"
                    unelevated
                    no-caps
                    label="Add Variant"
                    :disable="!newVariantType.trim() || variantTypeList.length >= 5"
                    @click="addVariantType"
                  />
                </div>
              </div>
              <div class="q-mt-sm">
                <q-chip
                  v-for="(variant, index) in variantTypeList"
                  :key="`${variant}-${index}`"
                  removable
                  dense
                  square
                  color="teal-1"
                  text-color="teal-10"
                  class="q-mr-xs q-mb-xs"
                  @remove="confirmRemoveVariantType(index)"
                >
                  {{ variant }}
                </q-chip>
                <span v-if="!variantTypeList.length" class="text-caption text-grey-6">No variant types</span>
              </div>
              <div class="text-caption text-grey-6 q-mt-xs">
                Removing a variant type will re-map following variant columns and clear trailing values.
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="page-card q-mt-sm">
        <q-card-section class="q-pa-sm q-pa-md">
          <div class="row items-center q-mb-sm">
            <div class="text-subtitle2 text-weight-medium">SKU Variants</div>
            <q-space />
            <q-btn color="primary" outline no-caps icon="add" label="Add SKU" @click="addSkuRow" />
          </div>

          <q-banner v-if="duplicateIssue" rounded class="bg-orange-1 text-orange-10 q-mb-sm">
            Duplicate variant set found in rows {{ duplicateIssue.row1 }} and {{ duplicateIssue.row2 }}.
          </q-banner>

          <q-table
            :rows="skuRecords"
            :columns="skuColumns"
            row-key="_key"
            flat
            bordered
            :rows-per-page-options="[0]"
            hide-pagination
          >
            <template #body="props">
              <q-tr :props="props" :class="{ 'row-inactive': isRowInactive(props.row) }">
                <q-td v-for="column in props.cols" :key="column.name" :props="props">
                  <template v-if="column.name === 'actions'">
                    <q-btn
                      v-if="isRowInactive(props.row)"
                      flat
                      round
                      dense
                      color="positive"
                      icon="undo"
                      @click="restoreSkuRow(props.rowIndex)"
                    >
                      <q-tooltip>Restore</q-tooltip>
                    </q-btn>
                    <q-btn
                      v-else
                      flat
                      round
                      dense
                      color="negative"
                      icon="delete"
                      @click="removeSkuRow(props.rowIndex)"
                    >
                      <q-tooltip>Delete</q-tooltip>
                    </q-btn>
                  </template>
                  <template v-else-if="column.name === 'Status'">
                    <q-badge :color="isRowInactive(props.row) ? 'grey-6' : 'positive'" outline>
                      {{ props.row.data.Status || 'Active' }}
                    </q-badge>
                  </template>
                  <template v-else>
                    <q-input
                      :model-value="props.row.data[column.field]"
                      outlined
                      dense
                      :disable="isRowInactive(props.row)"
                      @update:model-value="updateSkuField(props.rowIndex, column.field, $event)"
                    />
                  </template>
                </q-td>
              </q-tr>
            </template>
            <template #no-data>
              <div class="full-width text-center q-py-lg text-grey-7">No SKU rows available.</div>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="page-card q-mt-sm">
        <q-card-section class="row justify-end q-gutter-sm">
          <q-btn flat no-caps label="Cancel" @click="navigateBack" />
          <q-btn color="primary" unelevated no-caps label="Update" :loading="saving" @click="handleSave" />
        </q-card-section>
      </q-card>
    </template>
  </div>
</template>

<script setup>
import { useProductEditForm } from 'src/composables/masters/products/useProductEditForm'

const {
  code,
  parentForm,
  saving,
  statusOptions,
  newVariantType,
  record,
  skuRecords,
  variantTypeList,
  duplicateIssue,
  skuColumns,
  loading,
  addVariantType,
  confirmRemoveVariantType,
  addSkuRow,
  removeSkuRow,
  restoreSkuRow,
  updateSkuField,
  isRowInactive,
  handleSave,
  navigateBack,
  navigateToList
} = useProductEditForm()
</script>

<style scoped>
.edit-page {
  display: grid;
  gap: 8px;
}

.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
}

.row-inactive {
  opacity: 0.6;
}
</style>
