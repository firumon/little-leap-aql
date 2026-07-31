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
        const header = resolveFieldHeader(f.name, col, valPascal, hdrs)
        if (!header) return null
        return {
          header,
          name: f.name,
          label: f.label || f.name.replace(/([a-z])([A-Z])/g, '$1 $2'),
          type: resolveFieldType(f),
          required: f.required || false,
          // Option sourcing for `select` fields — consumers resolve `source`
          // against the data store, or use a literal `options` array as-is.
          options: Array.isArray(f.options) ? f.options : null,
          source: f.source && typeof f.source === 'object' ? f.source : null
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

/**
 * Maps a configured field name onto the sheet header that backs it.
 *
 * The canonical authoring form is the SHORT name (`Comment`, `Reason`), which
 * derives to `{column}{PascalCase(columnValue)}{name}` — so `Progress` +
 * `Cancelled` + `Comment` → `ProgressCancelledComment`. Two fallbacks keep older
 * configs working:
 *   1. the name is already the fully-qualified header (legacy authoring style,
 *      e.g. `ProgressCancelledComment` written out in full), and
 *   2. the name is a plain resource column that is not outcome-scoped at all
 *      (e.g. `DestinationWarehouseCode` on Warehouse Transfers' Claim & Complete).
 *
 * Returns null when nothing matches, which hides the field.
 */
function resolveFieldHeader(name, column, valuePascal, headers) {
  if (!name) return null
  const derived = column + valuePascal + name
  if (headers.includes(derived)) return derived
  if (headers.includes(name)) return name
  return null
}

// Free-text field names that warrant a multiline control rather than a single-line
// input. A workflow comment is the common case (Approve/Reject/Revision Required
// all collect one), and users routinely type several sentences into it.
const TEXTAREA_NAME_HINTS = ['comment', 'reason', 'remark', 'note', 'description']

function isTextareaName(name) {
  const lower = (name || '').toLowerCase()
  // `date` wins so e.g. `CommentDate` stays a date picker, not a textarea.
  if (lower.includes('date')) return false
  return TEXTAREA_NAME_HINTS.some((hint) => lower.includes(hint))
}

/**
 * Resolves a configured field's control type.
 *
 * The Manage Actions admin dialog (GAS/actionManager.html `addField`) stamps
 * `type: 'text'` onto every field it creates, so `'text'` is its DEFAULT rather
 * than a deliberate authoring choice — which is why a field named `Comment` used
 * to render as a cramped single-line input. A comment-ish name is therefore
 * allowed to upgrade `'text'` to `'textarea'`. An explicit `date` / `number` /
 * `select` / `textarea` selection is always respected as-is.
 *
 * A field carrying option sourcing (`options[]` or `source`) is a select by
 * construction, so it upgrades the stamped `'text'` default too.
 */
function resolveFieldType(field) {
  const configured = (field?.type || '').toLowerCase()
  if (hasOptionSource(field) && (!configured || configured === 'text')) return 'select'
  if (!configured) return guessFieldType(field?.name)
  if (configured === 'text' && isTextareaName(field?.name)) return 'textarea'
  return configured
}

function hasOptionSource(field) {
  if (Array.isArray(field?.options) && field.options.length) return true
  return !!(field?.source?.resource && field?.source?.field)
}

function guessFieldType(name) {
  const lower = (name || '').toLowerCase()
  if (lower.includes('date')) return 'date'
  if (isTextareaName(name)) return 'textarea'
  if (lower.includes('amount') || lower.includes('qty') || lower.includes('quantity')) return 'number'
  return 'text'
}
