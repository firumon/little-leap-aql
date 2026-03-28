import { computed } from 'vue'

/**
 * Resolves form fields for an additional action page (Approve, Reject, etc.)
 * based on the resource headers and AdditionalActions config.
 *
 * Rules:
 * - Column derived as: {column}{columnValue}{name} (e.g., ProgressApprovedComment)
 * - Only show fields whose derived column EXISTS in resource headers (sheet = source of truth)
 * - *At and *By suffixed columns are auto-filled by backend, never shown in form
 * - If columnValueOptions exists, user picks the outcome; fields derived per selection
 */
export function useActionFields(resourceHeadersRef, actionConfigRef, selectedValueRef) {

  const actionConfig = computed(() => {
    const ref = typeof actionConfigRef === 'function' ? actionConfigRef() : actionConfigRef?.value
    return ref || {}
  })

  const headers = computed(() => {
    const ref = typeof resourceHeadersRef === 'function' ? resourceHeadersRef() : resourceHeadersRef?.value
    return Array.isArray(ref) ? ref : []
  })

  const selectedValue = computed(() => {
    const ref = typeof selectedValueRef === 'function' ? selectedValueRef() : selectedValueRef?.value
    return ref || actionConfig.value.columnValue || ''
  })

  const column = computed(() => actionConfig.value.column || 'Progress')
  const isMultiOutcome = computed(() => Array.isArray(actionConfig.value.columnValueOptions) && actionConfig.value.columnValueOptions.length > 0)
  const outcomeOptions = computed(() => actionConfig.value.columnValueOptions || [])

  /**
   * Auto-detect fields from headers when no explicit fields defined.
   * Scans headers matching {column}{selectedValue}* pattern,
   * excluding *At and *By suffixes.
   */
  function autoDetectFields(col, val, hdrs) {
    if (!col || !val || !hdrs.length) return []
    const prefix = col + val
    return hdrs
      .filter((h) => h.startsWith(prefix) && h !== col)
      .filter((h) => !h.endsWith('At') && !h.endsWith('By'))
      .map((h) => {
        const name = h.slice(prefix.length)
        return {
          header: h,
          name,
          label: name.replace(/([a-z])([A-Z])/g, '$1 $2'),
          type: guessFieldType(name),
          required: false
        }
      })
  }

  /**
   * Resolve fields — combines explicit config fields with column existence check.
   */
  const resolvedFields = computed(() => {
    const col = column.value
    const val = selectedValue.value
    const hdrs = headers.value
    if (!val) return []

    const configFields = actionConfig.value.fields
    if (Array.isArray(configFields) && configFields.length) {
      // Explicit fields: derive header from {column}{value}{name}, check existence
      return configFields
        .map((f) => {
          const derivedHeader = col + val + f.name
          if (!hdrs.includes(derivedHeader)) return null
          return {
            header: derivedHeader,
            name: f.name,
            label: f.label || f.name.replace(/([a-z])([A-Z])/g, '$1 $2'),
            type: f.type || guessFieldType(f.name),
            required: f.required || false
          }
        })
        .filter(Boolean)
    }

    // No explicit fields — auto-detect from headers
    return autoDetectFields(col, val, hdrs)
  })

  /**
   * The auto-fill columns (backend handles these).
   */
  const autoFillColumns = computed(() => {
    const col = column.value
    const val = selectedValue.value
    if (!col || !val) return {}
    return {
      [`${col}`]: val,
      [`${col}${val}At`]: '__auto__',
      [`${col}${val}By`]: '__auto__'
    }
  })

  return {
    column,
    selectedValue,
    isMultiOutcome,
    outcomeOptions,
    resolvedFields,
    autoFillColumns,
    actionConfig
  }
}

function guessFieldType(name) {
  const lower = (name || '').toLowerCase()
  if (lower.includes('date')) return 'date'
  if (lower.includes('comment') || lower.includes('reason') || lower.includes('note')) return 'textarea'
  if (lower.includes('amount') || lower.includes('qty') || lower.includes('quantity')) return 'number'
  return 'text'
}
