<template>
  <div class="add-page">
    <q-card flat bordered class="page-card">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="text-h6 text-weight-bold">Create Product</div>
        <div class="text-caption text-grey-6">Define variant dimensions, then add SKU rows.</div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section class="q-pa-sm q-pa-md">
        <div class="text-subtitle2 text-weight-medium q-mb-sm">Product Details</div>
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-md-6">
            <q-input
              v-model="parentForm.Name"
              outlined
              dense
              label="Name *"
              placeholder="e.g. Baby Bottle"
            />
          </div>
          <div class="col-12 col-md-6">
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
                @remove="removeVariantType(index)"
              >
                {{ variant }}
              </q-chip>
              <span v-if="!variantTypeList.length" class="text-caption text-grey-6">No variant types added yet</span>
            </div>
            <div class="text-caption text-grey-6 q-mt-xs">
              Maximum 5 variant types. Order maps to SKU columns: Variant1 to Variant5.
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
          <q-btn
            color="primary"
            outline
            no-caps
            icon="add"
            label="Add SKU"
            @click="addSkuRow"
          />
        </div>

        <q-banner v-if="!variantColumns.length" rounded class="bg-blue-1 text-blue-10 q-mb-sm">
          You can save without variant types, but SKU duplicate validation will be skipped.
        </q-banner>

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
            <div class="full-width text-center q-py-lg text-grey-7">
              No SKU rows yet. Click "Add SKU" to create one.
            </div>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="page-card q-mt-sm">
      <q-card-section class="row justify-end q-gutter-sm">
        <q-btn flat no-caps label="Cancel" @click="navigateBack" />
        <q-btn color="primary" unelevated no-caps label="Create" :loading="saving" @click="handleSave" />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { useProductCreateForm } from 'src/composables/masters/products/useProductCreateForm'

const {
  parentForm,
  saving,
  statusOptions,
  newVariantType,
  variantTypeList,
  variantColumns,
  skuRecords,
  skuColumns,
  duplicateIssue,
  addVariantType,
  removeVariantType,
  addSkuRow,
  removeSkuRow,
  restoreSkuRow,
  updateSkuField,
  isRowInactive,
  handleSave,
  navigateBack
} = useProductCreateForm()
</script>

<style scoped>
.add-page {
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
