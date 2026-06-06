<template>
  <div class="aql-file-upload q-mb-sm">
    <div class="field-label text-weight-medium text-grey-8 q-mb-xs" v-if="label">
      {{ label }} <span v-if="required" class="text-negative">*</span>
    </div>

    <!-- 1. Display Preview Card if file is already uploaded -->
    <div v-if="modelValue" class="relative-position">
      <AqlFilePreviewCard
        :uuid="modelValue"
        :resource-name="resourceName"
        :column-name="columnName"
      >
        <template #actions>
          <q-btn
            flat round
            color="negative"
            icon="delete_outline"
            size="sm"
            :loading="deleting"
            @click="confirmAndRemove"
          />
        </template>
      </AqlFilePreviewCard>
    </div>

    <!-- 2. Display Loader if uploading in background -->
    <div v-else-if="uploading" class="upload-area flex flex-center q-pa-md text-center">
      <div class="q-gutter-y-xs">
        <q-spinner-oval color="primary" size="32px" />
        <div class="text-caption text-weight-medium text-grey-7">Uploading file...</div>
        <div class="text-caption text-grey-5">{{ progressFileName }}</div>
      </div>
    </div>

    <!-- 3. Display Selection Trigger Area if no file -->
    <div
      v-else
      class="upload-area flex flex-center q-pa-md text-center cursor-pointer"
      @click="triggerFileSelect"
    >
      <input
        type="file"
        ref="fileInput"
        :accept="accept"
        style="display: none"
        @change="onFileSelected"
      />
      <div class="q-gutter-y-xs">
        <q-icon name="cloud_upload" size="32px" color="primary" />
        <div class="text-caption text-weight-medium text-primary">Browse or Drag File</div>
        <div class="text-caption text-grey-5 text-xs">{{ allowedTypesText }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useStorageStore } from 'src/stores/storage'
import AqlFilePreviewCard from './AqlFilePreviewCard.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  required: { type: Boolean, default: false },
  accept: { type: String, default: '*' },
  maxSize: { type: Number, default: 10 }, // Maximum size in MB
  resourceName: { type: String, required: true },
  columnName: { type: String, required: true }
})

const emit = defineEmits(['update:modelValue'])

const $q = useQuasar()
const storageStore = useStorageStore()

const fileInput = ref(null)
const uploading = ref(false)
const deleting = ref(false)
const progressFileName = ref('')

const allowedTypesText = computed(() => {
  const sizeText = `Max size: ${props.maxSize}MB`
  if (!props.accept || props.accept === '*') {
    return `Any file type • ${sizeText}`
  }
  return `${props.accept.replace(/\./g, '').toUpperCase()} • ${sizeText}`
})

function triggerFileSelect() {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

async function onFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return

  // 1. Validation - File Type
  if (props.accept && props.accept !== '*') {
    const fileName = file.name.toLowerCase()
    const allowedExtensions = props.accept.toLowerCase().split(',').map(ext => ext.trim())
    const matchesExtension = allowedExtensions.some(ext => {
      if (ext.startsWith('.')) {
        return fileName.endsWith(ext)
      }
      if (ext.endsWith('/*')) {
        // e.g. image/* -> matches image/png
        const baseMime = ext.split('/')[0]
        return file.type.startsWith(baseMime + '/')
      }
      return file.type === ext
    })

    if (!matchesExtension) {
      $q.notify({
        type: 'negative',
        message: `Invalid file type. Allowed formats: ${props.accept}`,
        position: 'top',
        timeout: 3000
      })
      if (fileInput.value) fileInput.value.value = ''
      return
    }
  }

  // 2. Validation - File Size
  const maxSizeBytes = props.maxSize * 1024 * 1024
  if (file.size > maxSizeBytes) {
    $q.notify({
      type: 'negative',
      message: `File size exceeds the limit of ${props.maxSize}MB.`,
      position: 'top',
      timeout: 3000
    })
    if (fileInput.value) fileInput.value.value = ''
    return
  }

  // 3. Start Upload Immediately
  uploading.value = true
  progressFileName.value = file.name

  try {
    const response = await storageStore.uploadTemp(file, props.resourceName, props.columnName)
    if (response.success && response.data?.uuid) {
      emit('update:modelValue', response.data.uuid)
      $q.notify({
        type: 'positive',
        message: 'File uploaded successfully',
        position: 'top',
        timeout: 2000
      })
    } else {
      $q.notify({
        type: 'negative',
        message: response.error || 'Failed to upload file. Please try again.',
        position: 'top',
        timeout: 3000
      })
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: `Upload failed: ${err.message}`,
      position: 'top',
      timeout: 3000
    })
  } finally {
    uploading.value = false
    progressFileName.value = ''
    if (fileInput.value) fileInput.value.value = ''
  }
}

function confirmAndRemove() {
  $q.dialog({
    title: 'Replace File',
    message: 'Replacing or clearing this file will permanently delete the current file from the server. Do you want to continue?',
    cancel: true,
    persistent: true,
    ok: {
      color: 'negative',
      label: 'Yes, Delete'
    }
  }).onOk(async () => {
    deleting.value = true
    try {
      const response = await storageStore.deleteFile(props.modelValue, props.resourceName, props.columnName)
      if (response.success) {
        emit('update:modelValue', '')
        $q.notify({
          type: 'positive',
          message: 'File deleted from server',
          position: 'top',
          timeout: 2000
        })
      } else {
        $q.notify({
          type: 'negative',
          message: response.error || 'Failed to delete file from server',
          position: 'top',
          timeout: 3000
        })
      }
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: `Deletion failed: ${err.message}`,
        position: 'top',
        timeout: 3000
      })
    } finally {
      deleting.value = false
    }
  })
}
</script>

<script>
// For register discovery
export default {
  name: 'AqlFileUpload'
}
</script>

<style scoped>
.upload-area {
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  min-height: 100px;
  transition: all 180ms ease;
}
.upload-area:hover {
  background: #f1f5f9;
  border-color: var(--q-primary);
}
.field-label {
  font-size: 13px;
}
.text-xs {
  font-size: 11px;
}
</style>
