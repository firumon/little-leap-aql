import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { useAuthStore } from 'src/stores/auth'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import AqlFileUpload from 'components/shared/AqlFileUpload.vue'
import AppDate from 'components/shared/AppDate.vue'
import AqlStatusToggle from 'components/shared/AqlStatusToggle.vue'

export const STATUS_OPTIONS = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' }
]

const TOGGLE_PAIRS = [
  ['Yes', 'No'],
  ['Active', 'Inactive'],
  ['True', 'False']
]

const ignoredFields = ['AccessRegion', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy']

export function isToggleField(field) {
  if (field.type === 'toggle' || field.type === 'boolean') return true
  if (Array.isArray(field.options) && field.options.length === 2) {
    return TOGGLE_PAIRS.some(([a, b]) => field.options[0] === a && field.options[1] === b)
  }
  return false
}

export function mapField(field, { resourceName, linkRefs = {}, crossRefOptions = {} } = {}) {
  const baseProps = {
    label: field.label || field.header,
    hint: field.hint || undefined,
    outlined: true,
    required: !!field.required,
    readonly: !!field.readonly,
    placeholder: field.placeholder || undefined,
  }

  if (field.type === 'file') {
    return {
      header: field.header,
      component: AqlFileUpload,
      componentName: 'aql-file-upload',
      ...baseProps,
      accept: field.accept || '*',
      maxSize: field.maxSize || 10,
      resourceName: resourceName || '',
      columnName: field.header
    }
  }

  if (field.type === 'date' || field.type === 'datetime') {
    return {
      header: field.header,
      component: AppDate,
      componentName: 'app-date',
      ...baseProps
    }
  }

  if (field.header === 'Code') {
    return {
      header: field.header,
      componentName: 'q-input',
      ...baseProps,
      label: 'Code',
      disable: true
    }
  }

  if (isToggleField(field)) {
    return {
      header: field.header,
      componentName: 'q-toggle',
      ...baseProps,
      'true-value': field.options?.[0] || 'Yes',
      'false-value': field.options?.[1] || 'No'
    }
  }

  if (field.header.toLowerCase() === 'status') {
    return {
      header: field.header,
      component: AqlStatusToggle,
      componentName: 'aql-status-toggle',
      ...baseProps,
      'true-value': 'Active',
      'false-value': 'Inactive',
      'true-label': 'Active'
    }
  }

  if (field.type === 'status') {
    return {
      header: field.header,
      componentName: 'q-select',
      ...baseProps,
      options: STATUS_OPTIONS,
      emitValue: true,
      mapOptions: true
    }
  }

  if (field.type === 'select' || field.type === 'dropdown') {
    return {
      header: field.header,
      componentName: 'q-select',
      ...baseProps,
      options: field.options || [],
      emitValue: true,
      mapOptions: true
    }
  }

  if (linkRefs[field.header]) {
    return {
      header: field.header,
      componentName: 'q-select',
      ...baseProps,
      options: crossRefOptions[field.header] || [],
      emitValue: true,
      mapOptions: true,
      clearable: !field.required
    }
  }

  const inputType = field.type === 'number' ? 'number'
    : field.type === 'textarea' ? 'textarea' : 'text'

  return {
    header: field.header,
    componentName: 'q-input',
    ...baseProps,
    type: inputType,
    autogrow: field.type === 'textarea'
  }
}

export function useFormFields(resourceName) {
  const dataStore = useDataStore()
  const authStore = useAuthStore()
  const routeConfig = useResourceConfig()

  const resolvedName = computed(() => {
    if (resourceName) {
      return typeof resourceName === 'function' ? resourceName() : resourceName
    }
    return routeConfig.resourceName.value
  })

  const config = computed(() => {
    const name = resolvedName.value
    if (!name) return null
    return authStore.resources?.find(r => r.name === name) || null
  })

  const linkRefs = computed(() => {
    const name = resolvedName.value
    if (!name) return {}
    return dataStore.getRelations(name).linkRefs || {}
  })

  const crossRefOptionsMap = computed(() => {
    const map = {}
    const refs = linkRefs.value
    for (const [header, targetResource] of Object.entries(refs)) {
      const records = dataStore.getRecords(targetResource) || []
      const active = records.filter((r) => (r.Status || 'Active') === 'Active')
      const targetHeaders = dataStore.headers[targetResource] || []
      const labelField = targetHeaders.includes('Name')
        ? 'Name'
        : targetHeaders.find((h) => h !== 'Code' && h !== 'Status') || 'Code'
      map[header] = active.map((r) => ({
        label: labelField === 'Code' ? r.Code : `${r[labelField] || r.Code} (${r.Code})`,
        value: r.Code
      }))
    }
    return map
  })

  const formFields = computed(() => {
    const cfg = config.value
    if (!cfg) return []

    const uiFields = Array.isArray(cfg.ui?.fields) ? cfg.ui.fields : []
    const headers = Array.isArray(cfg.headers) ? cfg.headers : []

    const existingHeaders = new Set(uiFields.map(f => f.header))
    const merged = [
      ...uiFields,
      ...headers
        .filter(h => !existingHeaders.has(h))
        .map(h => ({ header: h, label: h, type: 'text' }))
    ]

    return merged
      .filter(f => f && f.header)
      .filter(field => !ignoredFields.includes(field.header))
      .map(field => mapField(field, {
        resourceName: resolvedName.value,
        linkRefs: linkRefs.value,
        crossRefOptions: crossRefOptionsMap.value
      }))
  })

  return { formFields,mapField }
}
