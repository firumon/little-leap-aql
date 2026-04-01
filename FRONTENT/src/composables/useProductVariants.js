import { computed } from 'vue'

const MAX_VARIANTS = 5

function toRecord(source) {
  if (!source) return {}
  if (typeof source === 'function') return source() || {}
  if (source.value !== undefined) return source.value || {}
  return source
}

function toRowData(row) {
  if (!row) return {}
  return row.data && typeof row.data === 'object' ? row.data : row
}

function isActiveRow(row) {
  if (!row) return false
  if (row._action === 'deactivate') return false
  const data = toRowData(row)
  return (data.Status || 'Active') !== 'Inactive'
}

/**
 * Parse CSV variant types and map to SKU variant keys.
 * Example: "Color, Size" -> [{ key: 'Variant1', label: 'Color' }, { key: 'Variant2', label: 'Size' }]
 */
export function parseVariantTypes(csv) {
  if (!csv || typeof csv !== 'string') return []
  return csv
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, MAX_VARIANTS)
    .map((label, index) => ({
      key: `Variant${index + 1}`,
      label
    }))
}

export function useProductVariants(productOrRef) {
  const variantColumns = computed(() => {
    const product = toRecord(productOrRef)
    return parseVariantTypes(product?.VariantTypes || '')
  })

  return { variantColumns }
}

/**
 * Returns duplicate position pair when two active SKU rows share the same variant set.
 */
export function hasDuplicateVariantSet(records = [], variantColumns = []) {
  if (!Array.isArray(records) || !Array.isArray(variantColumns) || !variantColumns.length) {
    return null
  }

  const seen = new Map()
  for (let index = 0; index < records.length; index += 1) {
    const row = records[index]
    if (!isActiveRow(row)) continue

    const data = toRowData(row)
    const signature = variantColumns
      .map((column) => (data[column.key] || '').toString().trim().toLowerCase())
      .join('||')

    if (seen.has(signature)) {
      return {
        isDuplicate: true,
        row1: seen.get(signature) + 1,
        row2: index + 1
      }
    }
    seen.set(signature, index)
  }

  return null
}

/**
 * Validates one SKU row against required variant values.
 */
export function validateSkuVariants(record, variantColumns = []) {
  if (!Array.isArray(variantColumns) || !variantColumns.length) return null
  const data = toRowData(record)
  for (const column of variantColumns) {
    const value = (data[column.key] || '').toString().trim()
    if (!value) {
      return `${column.label} is required`
    }
  }
  return null
}
