import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  uploadTempFile,
  confirmUploadedFile,
  deleteUploadedFile,
  getFileMetadata
} from 'src/services/StorageService'

export const useStorageStore = defineStore('storage', () => {
  // Set of UUIDs that were uploaded during this session and need confirmation
  const pendingConfirmUuids = ref(new Set())

  async function uploadTemp(file, resource, column) {
    const res = await uploadTempFile(file, resource, column)
    if (res.success && res.data?.uuid) {
      pendingConfirmUuids.value.add(res.data.uuid)
    }
    return res
  }

  async function confirmUpload(uuid, resource, column) {
    const res = await confirmUploadedFile(uuid, resource, column)
    if (res.success) {
      pendingConfirmUuids.value.delete(uuid)
    }
    return res
  }

  async function deleteFile(uuid, resource, column) {
    const res = await deleteUploadedFile(uuid, resource, column)
    pendingConfirmUuids.value.delete(uuid)
    return res
  }

  async function getMetadata(uuid, resource, column) {
    return await getFileMetadata(uuid, resource, column)
  }

  function isPendingConfirm(uuid) {
    return pendingConfirmUuids.value.has(uuid)
  }

  function clearPendingConfirms() {
    pendingConfirmUuids.value.clear()
  }

  return {
    pendingConfirmUuids,
    uploadTemp,
    confirmUpload,
    deleteFile,
    getMetadata,
    isPendingConfirm,
    clearPendingConfirms
  }
})
