<template>
  <q-card flat bordered class="sticky-card">
    <q-card-section>
      <div class="text-h6 q-mb-md">
        <q-icon name="cloud_upload" class="q-mr-sm" />
        Bulk Upload Masters
      </div>

      <q-select
        :model-value="selectedResourceName"
        :options="resourceOptions"
        label="Target Resource"
        outlined
        emit-value
        map-options
        class="q-mb-md"
        @update:model-value="onResourceChange"
      />

      <q-input
        :model-value="headersDisplay"
        label="Resource Headers"
        outlined
        class="q-mb-md"
        hint="Comma-separated headers - editable if you need to adjust"
        @update:model-value="$emit('update:headersDisplay', $event)"
      />

      <div class="row q-gutter-sm q-mb-md">
        <q-btn
          label="Download Template"
          color="secondary"
          icon="download"
          no-caps
          class="col"
          :disable="!selectedResourceName"
          @click="$emit('downloadTemplate')"
        />
        <q-file
          :model-value="csvFile"
          label="Upload CSV"
          outlined
          dense
          accept=".csv"
          class="col"
          @update:model-value="onFileSelected"
        >
          <template #prepend>
            <q-icon name="attach_file" />
          </template>
        </q-file>
      </div>

      <q-input
        :model-value="rawContent"
        type="textarea"
        label="Data (Tab Separated)"
        outlined
        rows="12"
        placeholder="Paste data rows from Excel here (no headers)"
        class="q-mb-md"
        hint="Format: Tab-separated values, one record per line"
        @update:model-value="$emit('update:rawContent', $event)"
      />

      <q-btn
        label="Plot Table"
        color="primary"
        class="full-width"
        size="lg"
        icon="table_chart"
        no-caps
        :disable="!rawContent || !selectedResourceName"
        @click="$emit('plotTable')"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
const props = defineProps({
  selectedResourceName: { type: String, default: '' },
  resourceOptions: { type: Array, default: () => [] },
  headersDisplay: { type: String, default: '' },
  rawContent: { type: String, default: '' },
  csvFile: { type: Object, default: null }
})

const emit = defineEmits([
  'update:selectedResourceName',
  'update:headersDisplay',
  'update:rawContent',
  'update:csvFile',
  'resourceSelected',
  'fileUpload',
  'downloadTemplate',
  'plotTable'
])

function onResourceChange(value) {
  emit('update:selectedResourceName', value)
  emit('resourceSelected', value)
}

function onFileSelected(file) {
  emit('update:csvFile', file)
  emit('fileUpload', file)
}
</script>

<style scoped>
.sticky-card {
  position: sticky;
  top: 80px;
}
</style>
