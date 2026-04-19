import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useWorkflowStore } from 'src/stores/workflow'
import { useResourceRelations } from './useResourceRelations'

/**
 * Manages parent + child records form state for Add/Edit pages.
 * Supports recursive nesting — each child group can have its own children.
 *
 * Usage:
 *   const { parentForm, childGroups, save, ... } = useCompositeForm(resourceConfig)
 */
export function useCompositeForm(configRef) {
  const $q = useQuasar()
  const workflowStore = useWorkflowStore()
  const { childResources } = useResourceRelations(
    () => (typeof configRef === 'function' ? configRef() : configRef?.value)?.name
  )

  const parentForm = ref({})
  const isEdit = ref(false)
  const saving = ref(false)
  const originalCode = ref('')

  // Child groups: keyed by resource name
  // Each group: { resource, records: [{data, _action, _key}], resolvedFields }
  const childGroups = ref([])

  const statusOptions = [
    { label: 'Active', value: 'Active' },
    { label: 'Inactive', value: 'Inactive' }
  ]

  function getConfig() {
    return typeof configRef === 'function' ? configRef() : configRef?.value
  }

  function getResolvedFields(resource) {
    const uiFields = resource?.ui?.fields
    if (Array.isArray(uiFields) && uiFields.length) return uiFields

    const headers = Array.isArray(resource?.headers) ? resource.headers : []
    return headers
      .filter((h) => !['Code', 'ParentCode', 'CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'].includes(h))
      .map((header) => ({
        header,
        label: header.replace(/([a-z])([A-Z])/g, '$1 $2'),
        type: header === 'Status' ? 'status' : 'text',
        required: false
      }))
  }

  function createEmptyForm(resource) {
    const result = {}
    const fields = getResolvedFields(resource)
    fields.forEach((field) => {
      if (field.type === 'status') {
        result[field.header] = 'Active'
      } else {
        result[field.header] = ''
      }
    })
    return result
  }

  function initializeForCreate() {
    const config = getConfig()
    isEdit.value = false
    originalCode.value = ''
    parentForm.value = createEmptyForm(config)
    initChildGroups()
  }

  function initializeForEdit(record, childRecordsByResource = {}) {
    isEdit.value = true
    originalCode.value = record?.Code || ''
    parentForm.value = { ...record }
    initChildGroups(childRecordsByResource)
  }

  function initChildGroups(existingChildRecords = {}) {
    const children = childResources.value || []
    childGroups.value = children.map((childResource) => {
      const existing = existingChildRecords[childResource.name] || []
      const records = existing.map((rec, i) => ({
        data: { ...rec },
        _action: 'update',
        _key: rec.Code || `existing-${i}`,
        _originalCode: rec.Code || ''
      }))

      return {
        resource: childResource,
        records,
        resolvedFields: getResolvedFields(childResource)
      }
    })
  }

  function addChildRecord(resourceName) {
    const group = childGroups.value.find((g) => g.resource.name === resourceName)
    if (!group) return

    const emptyForm = createEmptyForm(group.resource)
    group.records.push({
      data: emptyForm,
      _action: 'create',
      _key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      _originalCode: ''
    })
  }

  function removeChildRecord(resourceName, index) {
    const group = childGroups.value.find((g) => g.resource.name === resourceName)
    if (!group) return

    const record = group.records[index]
    if (!record) return

    if (record._action === 'create') {
      // New record — just remove from array
      group.records.splice(index, 1)
    } else {
      // Existing record — mark for deactivation
      record._action = 'deactivate'
      record.data.Status = 'Inactive'
    }
  }

  function updateChildField(resourceName, index, header, value) {
    const group = childGroups.value.find((g) => g.resource.name === resourceName)
    if (!group || !group.records[index]) return
    group.records[index].data[header] = value
  }

  function validateForm() {
    const config = getConfig()
    const fields = getResolvedFields(config)

    for (const field of fields) {
      if (!field.required) continue
      const value = (parentForm.value[field.header] || '').toString().trim()
      if (!value) {
        $q.notify({ type: 'negative', message: `${field.label} is required`, timeout: 2200 })
        return false
      }
    }

    // Validate child records
    for (const group of childGroups.value) {
      for (let i = 0; i < group.records.length; i++) {
        const rec = group.records[i]
        if (rec._action === 'deactivate') continue
        for (const field of group.resolvedFields) {
          if (!field.required) continue
          const value = (rec.data[field.header] || '').toString().trim()
          if (!value) {
            $q.notify({
              type: 'negative',
              message: `${group.resource.ui?.menus?.[0]?.pageTitle || group.resource.name} row ${i + 1}: ${field.label} is required`,
              timeout: 2200
            })
            return false
          }
        }
      }
    }

    return true
  }

  /**
   * Build the recursive payload for composite save.
   */
  function buildPayload() {
    const config = getConfig()
    const payload = {
      action: 'compositeSave',
      scope: config?.scope || 'master',
      resource: config?.name,
      data: { ...parentForm.value }
    }

    if (isEdit.value && originalCode.value) {
      payload.code = originalCode.value
    }

    // Build children payload recursively
    const children = buildChildrenPayload(childGroups.value)
    if (children.length) {
      payload.children = children
    }

    return payload
  }

  function buildChildrenPayload(groups) {
    return groups
      .filter((g) => g.records.length > 0)
      .map((group) => ({
        resource: group.resource.name,
        records: group.records
          .filter((r) => r._action !== 'deactivate' || r.data.Code) // keep deactivate only for existing
          .map((r) => ({
            data: { ...r.data },
            _action: r._action,
            _originalCode: r._originalCode || ''
          }))
      }))
  }

   async function save() {
     if (!validateForm()) return { success: false }

     saving.value = true
     try {
       const payload = buildPayload()
       return await workflowStore.saveComposite(payload)
     } catch (err) {
       $q.notify({ type: 'negative', message: `Save failed: ${err.message}`, timeout: 3000 })
       return { success: false, message: err.message }
     } finally {
       saving.value = false
     }
   }

  return {
    parentForm,
    childGroups,
    isEdit,
    saving,
    originalCode,
    statusOptions,
    initializeForCreate,
    initializeForEdit,
    addChildRecord,
    removeChildRecord,
    updateChildField,
    save
  }
}
