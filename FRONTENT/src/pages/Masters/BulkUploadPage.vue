<template>
  <q-page padding>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-4">
        <bulk-upload-controls-card
          v-model:selected-resource-name="selectedResourceName"
          v-model:headers-display="headersDisplay"
          v-model:raw-content="rawContent"
          v-model:csv-file="csvFile"
          :resource-options="resourceOptions"
          @resource-selected="onResourceSelected"
          @file-upload="handleFileUpload"
          @download-template="downloadTemplate"
          @plot-table="plotTable"
        />
      </div>

      <div class="col-12 col-md-8">
        <bulk-upload-preview-table
          v-if="rows.length"
          :rows="rows"
          :columns="columns"
          :is-uploading="isUploading"
          @clear-all="confirmClearAll"
          @upload-all="confirmUpload"
          @delete-row="deleteRow"
          @cell-edited="onCellEdited"
        />
        <bulk-upload-empty-state v-else />
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { useBulkUpload } from 'src/composables/useBulkUpload'
import BulkUploadControlsCard from 'src/components/Masters/BulkUpload/BulkUploadControlsCard.vue'
import BulkUploadPreviewTable from 'src/components/Masters/BulkUpload/BulkUploadPreviewTable.vue'
import BulkUploadEmptyState from 'src/components/Masters/BulkUpload/BulkUploadEmptyState.vue'

const $q = useQuasar()

const {
  selectedResourceName,
  rawContent,
  csvFile,
  headersDisplay,
  rows,
  isUploading,
  resourceOptions,
  columns,
  onResourceSelected,
  downloadTemplate,
  handleFileUpload,
  plotTable,
  onCellEdited,
  deleteRow,
  clearAll,
  uploadAll
} = useBulkUpload()

function confirmClearAll() {
  $q.dialog({
    title: 'Clear All Data',
    message: 'This will remove all rows from the table and delete the saved draft. Continue?',
    cancel: true,
    persistent: true,
    ok: { label: 'Clear All', color: 'negative', flat: true }
  }).onOk(async () => {
    await clearAll()
    $q.notify({ color: 'info', message: 'Table cleared.', icon: 'check' })
  })
}

function confirmUpload() {
  $q.dialog({
    title: 'Confirm Bulk Upload',
    message: `Upload ${rows.value.length} records to ${selectedResourceName.value}? Existing records with matching Codes will be updated.`,
    cancel: true,
    persistent: true,
    ok: { label: 'Upload Now', color: 'positive' }
  }).onOk(() => {
    uploadAll()
  })
}
</script>
