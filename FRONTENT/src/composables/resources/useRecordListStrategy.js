import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { useCurrency } from 'src/composables/useCurrency'

// Headers that never carry list-worthy meaning on their own.
const AUDIT_HEADERS = new Set(['Code', 'CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy', 'AccessRegion'])

const VARIANT_HEADERS = ['Variant1', 'Variant2', 'Variant3', 'Variant4', 'Variant5']

// Priority order for the "secondary attribute" shown in the caption when the label
// borrowed a parent's name.
const SECONDARY_ATTR_HEADERS = ['UOM', 'Type', 'Priority']

// Priority order for the caption's date/user pairing (used once the label has already
// consumed the resource's only descriptive field(s)).
const CAPTION_DATE_HEADERS = ['Date', 'TransactionDate', 'CreatedAt']
const CAPTION_USER_HEADERS = ['CreatedBy', 'UpdatedBy', 'User', 'Agent']

const AMOUNT_HEADER_PRIORITY = [
  'TotalAmount', 'SubtotalAmount', 'Amount', 'Total', 'TotalPrice',
  'Price', 'RSP', 'UnitPrice', 'EstimatedRate'
]

const QUANTITY_HEADER_PRIORITY = ['Quantity', 'Qty', 'Count', 'ItemCount']

// A resource with more than this many columns gets richer cards (meta-label + meta-caption)
// so the extra data isn't lost.
const LARGE_RESOURCE_HEADER_COUNT = 7

const POSITIVE_STATES = new Set([
  'ACTIVE', 'APPROVED', 'COMPLETED', 'DELIVERED', 'PAID', 'CONFIRMED', 'RECEIVED', 'DONE'
])
const NEGATIVE_STATES = new Set([
  'INACTIVE', 'REJECTED', 'CANCELLED', 'CANCELED', 'DECLINED', 'FAILED'
])
const WARNING_STATES = new Set([
  'PENDING', 'DRAFT', 'INITIATED', 'SENT', 'ASSIGNED', 'CREATED', 'PARTIAL'
])

function isDateHeader(header) {
  return /date/i.test(header)
}

function isForeignKeyHeader(header) {
  return header !== 'Code' && header.endsWith('Code')
}

function pickFirst(headers, candidates) {
  return candidates.find((c) => headers.includes(c)) || null
}

function statusColor(rawValue) {
  const val = (rawValue ?? '').toString().trim().toUpperCase()
  if (!val) return 'grey'
  if (POSITIVE_STATES.has(val)) return 'positive'
  if (NEGATIVE_STATES.has(val)) return 'negative'
  if (WARNING_STATES.has(val)) return 'warning'
  return 'primary'
}

/**
 * Derives label / caption / meta / highlight resolvers for a resource's record list from
 * its headers, parent relations, and current list-view state — so `contents/RecordList.vue`
 * doesn't need to know per-resource which column is "the name" (Products) vs. which one has
 * to borrow a parent's name (SKUs, PriceListItems) vs. which one has neither (StockMovements),
 * nor whether the active list-view filter already makes a status chip redundant.
 *
 * @param {ReturnType<typeof import('./useResourceConfig').useResourceConfig>} resourceConfig
 * @param {ReturnType<typeof import('./useRecord').useRecord>} resourceRecord
 */
export function useRecordListStrategy(resourceConfig, resourceRecord) {
  const dataStore = useDataStore()
  const { _C } = useCurrency()

  const headers = computed(() => resourceConfig?.resourceHeaders?.value || [])
  const relations = computed(() => resourceRecord?.relations?.value || { parents: [], children: [], linkRefs: {} })
  const activeView = computed(() => resourceRecord?.activeView?.value || null)

  const hasProgress = computed(() => headers.value.includes('Progress'))
  const hasStatus = computed(() => headers.value.includes('Status'))
  const hasType = computed(() => headers.value.includes('Type'))
  const isLargeResource = computed(() => headers.value.length > LARGE_RESOURCE_HEADER_COUNT)

  // ── Label strategy ──────────────────────────────────────────────────────────
  //
  // 1. Own Name column.
  // 2. First parent relation whose resource has a Name column (e.g. SKU → Product).
  // 3. Single descriptive (non-audit, non-status, non-foreign-key) column.
  // 4. Two-or-more descriptive columns → combine the first two: "header2 - header3".
  // 5. Code.
  //
  const hasOwnName = computed(() => headers.value.includes('Name'))

  const nameParent = computed(() => {
    if (hasOwnName.value) return null
    for (const parent of relations.value.parents) {
      const parentHeaders = dataStore.headers[parent.resourceName] || []
      if (parentHeaders.includes('Name')) return parent
    }
    return null
  })

  const variantHeaders = computed(() => VARIANT_HEADERS.filter((v) => headers.value.includes(v)))

  const descriptiveHeaders = computed(() => {
    if (hasOwnName.value || nameParent.value) return []
    return headers.value.filter((h) => !AUDIT_HEADERS.has(h) && h !== 'Status' && !isForeignKeyHeader(h))
  })

  const primaryField = computed(() => descriptiveHeaders.value[0] || null)
  const combinedFields = computed(() => descriptiveHeaders.value.slice(0, 2))

  // 'name' | 'parent' | 'combined' | 'primary' | 'code'
  const labelMode = computed(() => {
    if (hasOwnName.value) return 'name'
    if (nameParent.value) return 'parent'
    if (descriptiveHeaders.value.length >= 2) return 'combined'
    if (descriptiveHeaders.value.length === 1) return 'primary'
    return 'code'
  })

  function parentLabel(item) {
    const parent = nameParent.value
    if (!parent) return ''
    const parentRecord = item?.[`$${parent.singular.toLowerCase()}`]
    const baseName = parentRecord?.Name || ''
    const variantSuffix = variantHeaders.value
      .map((v) => item?.[v])
      .filter(Boolean)
      .join(' ')
    return [baseName, variantSuffix].filter(Boolean).join(' - ') || item?.Code || ''
  }

  const label = computed(() => {
    switch (labelMode.value) {
      case 'name':
        return (item) => item?.Name || item?.Code || ''
      case 'parent':
        return (item) => parentLabel(item) || item?.Code || ''
      case 'combined': {
        const [h1, h2] = combinedFields.value
        return (item) => {
          const parts = [item?.[h1], item?.[h2]].filter((v) => v !== undefined && v !== null && v !== '')
          return parts.join(' - ') || item?.Code || ''
        }
      }
      case 'primary':
        return (item) => item?.[primaryField.value] || item?.Code || ''
      default:
        return (item) => item?.Code || ''
    }
  })

  // ── Caption strategy ────────────────────────────────────────────────────────
  //
  // Whatever the label didn't use becomes the caption. Two extra signals take priority
  // over the label-mode default once a resource is complex enough to have them:
  //   1. Multiple parent relations → join every parent's name/code with " • ".
  //   2. A date + "who did it" pair (audit trail) → "date • user".
  //
  const secondaryHeader = computed(() => {
    const fromPriority = pickFirst(headers.value, SECONDARY_ATTR_HEADERS)
    if (fromPriority) return fromPriority
    return headers.value.find(isDateHeader) || null
  })

  const captionDateHeader = computed(() =>
    pickFirst(headers.value, CAPTION_DATE_HEADERS) || headers.value.find(isDateHeader) || null
  )
  const captionUserHeader = computed(() => pickFirst(headers.value, CAPTION_USER_HEADERS))

  function multiParentCaption(item) {
    const parts = relations.value.parents
      .map((p) => {
        const parentRecord = item?.[`$${p.singular.toLowerCase()}`]
        return parentRecord?.Name || parentRecord?.Code || ''
      })
      .filter(Boolean)
    return parts.join(' • ')
  }

  function dateUserCaption(item) {
    const dateH = captionDateHeader.value
    const userH = captionUserHeader.value
    return [dateH ? item?.[dateH] : null, userH ? item?.[userH] : null].filter(Boolean).join(' • ')
  }

  const hasMultipleParents = computed(() => relations.value.parents.length > 1)
  const hasDateUserPair = computed(() => !!(captionDateHeader.value || captionUserHeader.value))

  const caption = computed(() => {
    switch (labelMode.value) {
      case 'name':
        return (item) => item?.Code || ''
      case 'parent': {
        if (hasMultipleParents.value) {
          return (item) => multiParentCaption(item) || item?.Code || ''
        }
        const secondary = secondaryHeader.value
        return (item) => [item?.Code, secondary ? item?.[secondary] : null].filter(Boolean).join(' · ')
      }
      case 'combined':
      case 'primary': {
        if (hasMultipleParents.value) {
          return (item) => multiParentCaption(item) || item?.Code || ''
        }
        if (hasDateUserPair.value) {
          return (item) => dateUserCaption(item) || item?.Status || ''
        }
        return (item) => item?.Status || ''
      }
      default: {
        if (hasMultipleParents.value) {
          return (item) => multiParentCaption(item) || item?.Code || ''
        }
        if (hasDateUserPair.value) {
          return (item) => dateUserCaption(item) || item?.Status || ''
        }
        return (item) => item?.Status || ''
      }
    }
  })

  // ── Active-view / highlight / meta-chip strategy ────────────────────────────
  //
  // The column driving the chip + card highlight when no list view is active:
  // Progress (operation-scope workflows) → Status (master-scope Active/Inactive) → Type.
  // Master resources never have a Progress header, so this naturally resolves per-scope
  // without needing to branch on `resourceConfig.scope` directly.
  //
  const stateColumn = computed(() => {
    if (hasProgress.value) return 'Progress'
    if (hasStatus.value) return 'Status'
    if (hasType.value) return 'Type'
    return null
  })

  // While a list view is active, its own filter column (usually the same as stateColumn)
  // is already communicated by the selected view chip — showing it again on every card
  // is redundant, so highlight still reflects it but the meta-chip does not.
  const activeViewColumn = computed(() => {
    const conditions = activeView.value?.filter?.items || []
    const condition = conditions.find((i) => i?.type === 'condition')
    return condition?.column || null
  })

  const highlightHeader = computed(() => {
    if (activeView.value) {
      return (hasProgress.value ? 'Progress' : activeViewColumn.value) || stateColumn.value
    }
    return stateColumn.value
  })

  const highlight = computed(() => !!highlightHeader.value)
  const highlightColor = computed(() => {
    const h = highlightHeader.value
    return h ? (item) => statusColor(item?.[h]) : null
  })

  const amountHeader = computed(() => {
    const fromPriority = pickFirst(headers.value, AMOUNT_HEADER_PRIORITY)
    if (fromPriority) return fromPriority
    return headers.value.find((h) => /amount|total|price/i.test(h) && !/quantity|qty/i.test(h)) || null
  })

  const quantityHeader = computed(() => pickFirst(headers.value, QUANTITY_HEADER_PRIORITY))

  function amountResolver(header) {
    return (item) => (item?.[header] !== undefined && item?.[header] !== '' ? _C(item[header]) : '')
  }
  function plainResolver(header) {
    return (item) => item?.[header] ?? ''
  }

  // Meta-chip: state (Status/Progress/Type) when no view is active; once a view is active
  // that field would be redundant, so the amount (or, for data-dense resources, a quantity
  // column) takes the chip slot instead — or the chip is omitted entirely.
  const chip = computed(() => {
    if (activeView.value) {
      if (amountHeader.value) return amountResolver(amountHeader.value)
      if (isLargeResource.value && quantityHeader.value) return plainResolver(quantityHeader.value)
      return null
    }
    const h = stateColumn.value
    return h ? (item) => item?.[h] || '' : null
  })

  const chipColor = computed(() => {
    if (activeView.value) return 'primary'
    const h = stateColumn.value
    return h ? (item) => statusColor(item?.[h]) : 'grey'
  })

  // Meta-label: the amount column, unless it was already promoted into the chip slot
  // (active-view case) — then large resources still surface a quantity column here so
  // the card doesn't lose data density.
  const metaLabel = computed(() => {
    if (activeView.value) {
      if (!amountHeader.value && isLargeResource.value && quantityHeader.value) {
        return plainResolver(quantityHeader.value)
      }
      return null
    }
    if (amountHeader.value) return amountResolver(amountHeader.value)
    if (isLargeResource.value && quantityHeader.value) return plainResolver(quantityHeader.value)
    return null
  })

  // Meta-caption: for data-dense resources, surface one more descriptive column (not
  // already used by label/caption/chip/meta-label) so nothing useful is left off the card.
  const metaCaption = computed(() => {
    if (!isLargeResource.value) return null
    const used = new Set(
      ['Code', 'Name', primaryField.value, ...combinedFields.value, secondaryHeader.value,
        stateColumn.value, amountHeader.value, quantityHeader.value].filter(Boolean)
    )
    const candidate = headers.value.find((h) => !AUDIT_HEADERS.has(h) && !isForeignKeyHeader(h) && !used.has(h))
    return candidate ? plainResolver(candidate) : null
  })

  const metaLayout = computed(() => {
    const layoutArr = []
    if (chip.value) layoutArr.push('chip')
    if (metaLabel.value) layoutArr.push('label')
    if (metaCaption.value) layoutArr.push('caption')
    return layoutArr
  })

  return {
    layout: computed(() => ['caption', 'label']),
    label,
    caption,
    metaLayout,
    chip,
    chipColor,
    chipOutline: computed(() => true),
    metaLabel,
    metaCaption,
    highlight,
    highlightColor,
    clickable: computed(() => true)
  }
}
