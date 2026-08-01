import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { useAuthStore } from 'src/stores/auth'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { enrichRecord } from 'src/composables/resources/useRecord'
import { singularize, pluralize } from 'src/utils/appHelpers'
import AqlFileUpload from 'components/shared/AqlFileUpload.vue'
import AppDate from 'components/app/Date.vue'
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

// Matches either a parent path (`$product.Name`) or a bare word (`Variant1`)
// inside a `labelHeader` template. Everything else is literal text.
const LABEL_TOKEN_RE = /\$?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g

function resolvePath(source, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), source)
}

/**
 * Renders an `APP.Resources.Relations` `labelHeader` against a target row.
 * A plain target column name resolves directly; anything containing a `$`
 * parent path is interpolated against the enriched record so nested getters
 * (`$product`, `$supplier`, `$parent`) resolve reactively.
 * Returns null when nothing in the expression resolved.
 */
function renderLabelExpression(expr, row, targetResource, targetHeaders, dataStore) {
  if (targetHeaders.includes(expr)) return row[expr] ?? null

  const source = expr.includes('$') ? enrichRecord(targetResource, row.Code, dataStore) : row
  if (!source) return null

  let resolvedAny = false
  const text = expr.replace(LABEL_TOKEN_RE, (token) => {
    const isPath = token.startsWith('$')
    if (!isPath && !targetHeaders.includes(token)) return token
    const value = isPath ? resolvePath(source, token) : source[token]
    if (value == null || value === '') return ''
    resolvedAny = true
    return value.toString()
  })

  if (!resolvedAny) return null
  return text.replace(/\s+/g, ' ').replace(/^[\s\-–—|/,]+|[\s\-–—|/,]+$/g, '').trim() || null
}

export function isToggleField(field) {
  if (field.type === 'toggle' || field.type === 'boolean') return true
  if (Array.isArray(field.options) && field.options.length === 2) {
    return TOGGLE_PAIRS.some(([a, b]) => field.options[0] === a && field.options[1] === b)
  }
  return false
}

export function mapField(field, { resourceName, linkRefs = {}, crossRefOptions = {}, appOptions = {} } = {}) {
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

  // Date fields: explicit type, or any header ending in "Date" (TransactionDate, ...).
  if (field.type === 'date' || field.type === 'datetime' || /Date$/.test(field.header)) {
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
      label: 'Code'
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

  // AppOptions-driven select — a matching `<ResourceName><Column>` option group was
  // found in authStore.appOptionsMap (resolved to {label,value} pairs upstream).
  if (Array.isArray(appOptions[field.header]) && appOptions[field.header].length) {
    return {
      header: field.header,
      componentName: 'q-select',
      ...baseProps,
      options: appOptions[field.header],
      emitValue: true,
      mapOptions: true,
      clearable: !field.required
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

  const relationRefs = computed(() => {
    const name = resolvedName.value
    if (!name) return {}
    return dataStore.getRelations(name).refs || {}
  })

  // Picker options for relation columns. `targetHeader` decides the stored value;
  // `labelHeader` (from APP.Resources.Relations) decides the display text and may
  // be a target column, a parent path (`$product.Name`), or a template
  // (`$product.Name - Variant1`). Falls back to Code/Name heuristics when absent.
  const crossRefOptionsMap = computed(() => {
    const map = {}
    for (const [header, rel] of Object.entries(relationRefs.value)) {
      const targetResource = rel.resource
      const records = dataStore.getRecords(targetResource) || []
      const active = records.filter((r) => (r.Status || 'Active') === 'Active')
      const targetHeaders = dataStore.headers[targetResource] || []

      const valueField = rel.targetHeader && targetHeaders.includes(rel.targetHeader)
        ? rel.targetHeader
        : 'Code'
      const fallbackField = targetHeaders.includes('Name')
        ? 'Name'
        : targetHeaders.find((h) => h !== valueField && h !== 'Status') || valueField

      map[header] = active.map((r) => {
        const value = r[valueField]
        const display = rel.labelHeader
          ? renderLabelExpression(rel.labelHeader, r, targetResource, targetHeaders, dataStore)
          : (fallbackField === valueField ? null : r[fallbackField])

        return {
          label: display && display !== value ? `${display} (${value})` : value,
          value
        }
      })
    }
    return map
  })

  // Per-header AppOptions lookup. For each header, probe appOptionsMap for a
  // `<ResourceName><Column>` group, trying the resource name as-is, singular,
  // and plural (e.g. Products/Type → ProductsType, ProductType). First hit wins;
  // string values become {label,value} pairs for QSelect.
  const appOptionsMap = computed(() => {
    const map = {}
    const cfg = config.value
    const name = resolvedName.value
    if (!cfg || !name) return map

    const options = authStore.appOptionsMap || {}
    const headers = Array.isArray(cfg.headers) ? cfg.headers : []
    const nameVariants = [...new Set([name, singularize(name), pluralize(name)])]

    for (const header of headers) {
      for (const variant of nameVariants) {
        const key = `${variant}${header}`
        const group = options[key]
        if (Array.isArray(group) && group.length) {
          map[header] = group.map((v) => ({ label: String(v), value: v }))
          break
        }
      }
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
        crossRefOptions: crossRefOptionsMap.value,
        appOptions: appOptionsMap.value
      }))
  })

  return { formFields, mapField }
}
