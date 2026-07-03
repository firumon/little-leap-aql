import { computed } from 'vue'

/**
 * Outputs default AqlList props based on resolvedFields.
 * @param {Array|import('vue').Ref<Array>} fieldsRef
 */
export function useDefaultListProps(fields) {
  const resolvedFields = Array.isArray(fields) ? fields : (fields?.value || [])

  // Find columns
  const codeField = resolvedFields.find(f => f.header === 'Code' || f.header?.toLowerCase() === 'code')
  const nameField = resolvedFields.find(f => f.header === 'Name' || f.header?.toLowerCase() === 'name')
  const dateField = resolvedFields.find(f => f.type === 'date' || f.header?.toLowerCase()?.includes('date'))
  const progressField = resolvedFields.find(f => f.type === 'progress' || f.header?.toLowerCase()?.includes('progress') || f.header?.toLowerCase()?.includes('percentage'))

  // Identify fallback primary field (excluding code, name, date, progress)
  const specialHeaders = new Set([
    codeField?.header,
    nameField?.header,
    dateField?.header,
    progressField?.header
  ].filter(Boolean))

  const primaryField = resolvedFields.find(f => !specialHeaders.has(f.header))

  // Determine main layout and content
  const layout = []
  const content = []

  if (codeField && nameField) {
    layout.push('caption', 'label')
    content.push(codeField.header, nameField.header)
  } else if (codeField) {
    layout.push('label')
    content.push(codeField.header)
  } else if (nameField) {
    layout.push('label')
    content.push(nameField.header)
  } else if (primaryField) {
    layout.push('label')
    content.push(primaryField.header)
  } else {
    // Ultimate fallback
    layout.push('label')
    content.push('Code')
  }

  // If there is a date field, add it as caption in main content
  if (dateField) {
    layout.push('caption')
    content.push(dateField.header)
  }

  // Determine meta layout and meta values
  const metaLayout = []
  const meta = []

  // Add progress if exists
  if (progressField) {
    metaLayout.push('chip')
    meta.push(progressField.header)
  }

  // Define default chip styles/colors
  const chip = progressField ? progressField.header : null
  const chipOutline = true
  const chipColor = (item) => {
    if (!item || !progressField) return 'primary'
    const val = parseFloat(item[progressField.header])
    if (isNaN(val)) return 'grey'
    if (val >= 100) return 'positive'
    if (val > 50) return 'warning'
    return 'negative'
  }

  return {
    layout,
    content,
    metaLayout,
    meta,
    chip,
    chipOutline,
    chipColor,
    clickable: true
  }
}
