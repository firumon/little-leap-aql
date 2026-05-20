import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useResourceIoStore } from 'src/stores/resourceIo'

export function useMasterActions() {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
  const submitting = ref(false)

  async function submitAction({ resourceName, code, actionConfig, selectedOutcome, fields = {}, resolvedFields = [], onSuccess = null }) {
    for (const field of resolvedFields) {
      if (field.required && !(fields[field.header] || '').toString().trim()) {
        $q.notify({ type: 'negative', message: `${field.label} is required`, timeout: 2200 })
        return { success: false, error: `${field.label} is required` }
      }
    }

    submitting.value = true
    try {
      const response = await resourceIoStore.executeResourceAction(resourceName, code, {
        ...actionConfig,
        columnValue: selectedOutcome || actionConfig?.columnValue || ''
      }, fields)

      if (response.success) {
        $q.notify({
          type: 'positive',
          message: `${actionConfig?.label || actionConfig?.action || 'Action'} completed successfully`
        })
        await onSuccess?.(response)
      } else {
        $q.notify({ type: 'negative', message: response.error || 'Action failed', timeout: 3000 })
      }

      return response
    } finally {
      submitting.value = false
    }
  }

  return {
    submitting,
    submitAction
  }
}

