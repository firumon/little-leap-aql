<template>
  <div class="aql-file-preview">
    <div v-if="loading" class="flex items-center q-gutter-x-sm text-grey-6">
      <q-spinner size="18px" />
      <span class="text-caption">Loading file info...</span>
    </div>

    <div v-else-if="error" class="flex items-center q-gutter-x-sm text-negative">
      <q-icon name="error_outline" size="18px" />
      <span class="text-caption">{{ error }}</span>
    </div>

    <div v-else-if="meta" class="file-card flex items-center justify-between q-pa-sm" @click="handleCardClick">
      <div class="flex items-center q-gutter-x-sm overflow-hidden col">
        <template v-if="isImage">
          <q-avatar rounded size="36px" class="bg-grey-2 border-grey">
            <img :src="meta.downloadUrl" class="image-thumb" />
          </q-avatar>
        </template>
        <template v-else>
          <q-avatar rounded size="36px" :color="iconColor" text-color="white" class="flex flex-center">
            <q-icon :name="fileIcon" size="20px" />
          </q-avatar>
        </template>

        <div class="col overflow-hidden text-left">
          <div class="file-name text-weight-medium text-ellipsis">{{ meta.fileName }}</div>
          <div class="file-size text-caption text-grey-6">{{ formattedSize }}</div>
        </div>
      </div>

      <!-- Action slot (e.g. replace, delete buttons) -->
      <div class="action-section q-pl-sm flex items-center q-gutter-x-xs" @click.stop>
        <slot name="actions">
          <q-btn flat round color="primary" icon="cloud_download" size="sm" @click="downloadFile" />
        </slot>
      </div>
    </div>

    <!-- Image Fullscreen Preview Lightbox -->
    <q-dialog v-model="previewOpen" maximized transition-show="scale" transition-hide="scale">
      <q-card class="bg-black text-white column no-wrap">
        <q-card-section class="row items-center justify-between q-py-sm bg-grey-10 col-auto">
          <div class="text-subtitle1 text-weight-medium text-ellipsis col max-w-70">{{ meta?.fileName }}</div>
          <div class="row q-gutter-x-sm">
            <q-btn flat round icon="cloud_download" color="white" @click="downloadFile" />
            <q-btn flat round icon="close" color="white" v-close-popup />
          </div>
        </q-card-section>

        <q-card-section class="col flex flex-center q-pa-none overflow-hidden">
          <img :src="meta?.downloadUrl" class="fullscreen-image" />
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useStorageStore } from 'src/stores/storage'

const props = defineProps({
  uuid: { type: String, required: true },
  resourceName: { type: String, required: true },
  columnName: { type: String, required: true }
})

const storageStore = useStorageStore()

const meta = ref(null)
const loading = ref(false)
const error = ref(null)
const previewOpen = ref(false)

async function fetchMetadata() {
  if (!props.uuid) {
    meta.value = null
    return
  }

  loading.value = true
  error.value = null
  try {
    const response = await storageStore.getMetadata(props.uuid, props.resourceName, props.columnName)
    if (response.success) {
      meta.value = response.data
    } else {
      error.value = response.error || 'Failed to load info'
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const isImage = computed(() => {
  if (!meta.value) return false
  const type = (meta.value.contentType || '').toLowerCase()
  if (type.startsWith('image/')) return true
  const name = (meta.value.fileName || '').toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)
})

const fileIcon = computed(() => {
  if (!meta.value) return 'insert_drive_file'
  const name = (meta.value.fileName || '').toLowerCase()
  const type = (meta.value.contentType || '').toLowerCase()
  
  if (type.includes('pdf') || name.endsWith('.pdf')) return 'picture_as_pdf'
  if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return 'description'
  if (type.includes('sheet') || type.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx')) return 'table_chart'
  if (type.includes('zip') || type.includes('rar') || type.includes('tar') || name.endsWith('.zip') || name.endsWith('.rar')) return 'archive'
  if (type.includes('text') || name.endsWith('.txt')) return 'subject'
  
  return 'insert_drive_file'
})

const iconColor = computed(() => {
  const icon = fileIcon.value
  if (icon === 'picture_as_pdf') return 'red-8'
  if (icon === 'description') return 'blue-7'
  if (icon === 'table_chart') return 'green-7'
  if (icon === 'archive') return 'orange-8'
  return 'grey-7'
})

const formattedSize = computed(() => {
  if (!meta.value || !meta.value.size) return '0 B'
  const bytes = parseInt(meta.value.size)
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i]
})

function handleCardClick() {
  if (isImage.value) {
    previewOpen.value = true
  } else {
    downloadFile()
  }
}

function downloadFile() {
  if (!meta.value || !meta.value.downloadUrl) return
  
  // Creates a temporary link to force browser download dialog
  const link = document.createElement('a')
  link.href = meta.value.downloadUrl
  link.setAttribute('download', meta.value.fileName || 'download')
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

watch(() => props.uuid, (newVal) => {
  if (newVal) {
    fetchMetadata()
  } else {
    meta.value = null
  }
})

onMounted(() => {
  fetchMetadata()
})
</script>

<script>
// For register discovery
export default {
  name: 'AqlFilePreviewCard'
}
</script>

<style scoped>
.file-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 180ms ease;
  max-width: 100%;
}
.file-card:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}
.image-thumb {
  object-fit: cover;
  width: 100%;
  height: 100%;
}
.border-grey {
  border: 1px solid #cbd5e1;
}
.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-name {
  font-size: 13px;
  color: #1e293b;
}
.max-w-70 {
  max-width: 70%;
}
.fullscreen-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>
