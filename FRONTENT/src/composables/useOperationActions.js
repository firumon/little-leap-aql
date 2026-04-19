import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useWorkflowStore } from 'src/stores/workflow'

export function useOperationActions() {
  const $q = useQuasar()
  const workflowStore = useWorkflowStore()
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
      const response = await workflowStore.executeResourceAction(resourceName, code, {
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

