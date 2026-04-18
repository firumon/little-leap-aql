import { computed } from 'vue'
import { toPascalCase } from 'src/utils/appHelpers'

/**
 * Resolves form fields for an additional action page (Approve, Reject, etc.)
 * based on the resource headers and AdditionalActions config.
 *
 * Rules:
 * - Column derived as: {column}{PascalCase(columnValue)}{name}
 *   (e.g., Progress + "Revision Required" + Comment → ProgressRevisionRequiredComment)
 * - A field renders ONLY when BOTH are true:
 *     (a) it is listed in action.fields[] (JSON is authoritative — no auto-detect)
 *     (b) its derived header exists in the resource's sheet headers
 * - If either is missing, the field is hidden.
 * - If columnValueOptions exists, user picks the outcome; fields derived per selection.
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
   * Resolve fields — intersection of JSON-configured fields and sheet headers.
   * No auto-detect: if action.fields is not an array, no fields render.
   */
  const resolvedFields = computed(() => {
    const col = column.value
    const val = selectedValue.value
    const hdrs = headers.value
    if (!val) return []

    const configFields = actionConfig.value.fields
    if (!Array.isArray(configFields)) return []

    const valPascal = toPascalCase(val)
    return configFields
      .map((f) => {
        const derivedHeader = col + valPascal + f.name
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
  })

  /**
   * The auto-fill columns (backend handles these).
   */
  const autoFillColumns = computed(() => {
    const col = column.value
    const val = selectedValue.value
    if (!col || !val) return {}
    const valPascal = toPascalCase(val)
    return {
      [`${col}`]: val,
      [`${col}${valPascal}At`]: '__auto__',
      [`${col}${valPascal}By`]: '__auto__'
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
