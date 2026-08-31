import { textOrRef } from 'src/utils/appHelpers'
import {
  buildProcurementCreateNode,
  buildProcurementProgressNode,
  buildProcurementCancelNode
} from 'src/_resource/Operation/Procurements/composables/useProcurementPayload'
import {
  PR_APPROVED,
  PR_CREATED,
  INITIATED
} from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import {
  DRAFT,
  PENDING_APPROVAL,
  REVISION_REQUIRED,
  APPROVED,
  REJECTED,
  RFQ_PROCESSED,
  progressOf,
  isPendingApproval
} from './usePurchaseRequisitionProgress'

import { stampFields } from 'src/utils/workflowStamp'
const RESOURCE_NAME = 'PurchaseRequisitions'
const ITEMS_RESOURCE = 'PurchaseRequisitionItems'
const REFRESH_RESOURCES = ['PurchaseRequisitions', 'PurchaseRequisitionItems', 'Procurements']

export { RESOURCE_NAME, ITEMS_RESOURCE }

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// A `_fields` select hands back `{ label, value }`; a plain input hands back a string.
function unwrap (value) {
  if (value && typeof value === 'object' && 'value' in value) return text(value.value)
  return text(value)
}


export function buildRequisitionFormData (form = {}, { targetProgress = '', extraFields = {} } = {}) {
  const record = asRow(form)
  return {
    Type: unwrap(record.Type),
    Priority: unwrap(record.Priority),
    WarehouseCode: unwrap(record.WarehouseCode),
    PRDate: text(record.PRDate),
    RequiredDate: text(record.RequiredDate),
    TypeReferenceCode: text(record.TypeReferenceCode),
    Progress: text(targetProgress) || progressOf(record) || DRAFT,
    Status: text(record.Status) || 'Active',
    ...extraFields
  }
}

/** Normalizes a line by SKU, keeping the active row when a hydration produced both. */
export function dedupeItemLines (items = []) {
  const bySku = new Map()
  for (const entry of (Array.isArray(items) ? items : []).map(asRow)) {
    const key = text(entry.SKU)
    if (!key) continue
    const existing = bySku.get(key)
    if (!existing || (!isActive(existing) && isActive(entry))) bySku.set(key, entry)
  }
  return Array.from(bySku.values())
}

export function buildRequisitionItemRecords (items = [], deactivatedCodes = []) {
  const lines = dedupeItemLines(items).map((entry) => ({
    _action: text(entry.Code) ? 'update' : 'create',
    ...(text(entry.Code) ? { _originalCode: text(entry.Code) } : {}),
    data: {
      SKU: text(entry.SKU),
      UOM: text(entry.UOM),
      Quantity: num(entry.Quantity ?? entry.requiredQuantity),
      EstimatedRate: num(entry.EstimatedRate),
      Status: 'Active'
    }
  }))

  const removals = (Array.isArray(deactivatedCodes) ? deactivatedCodes : [])
    .map(text)
    .filter(Boolean)
    .map((code) => ({ _action: 'deactivate', _originalCode: code, data: { Status: 'Inactive' } }))

  return [...lines, ...removals]
}

export function buildRequisitionCompositeNode ({ code = '', form = {}, targetProgress = '', extraFields = {}, items = [], deactivatedCodes = [] } = {}) {
  return {
    resource: RESOURCE_NAME,
    ...(text(code) ? { code: text(code) } : {}),
    data: buildRequisitionFormData(form, { targetProgress, extraFields }),
    children: [{ resource: ITEMS_RESOURCE, records: buildRequisitionItemRecords(items, deactivatedCodes) }]
  , successMsg: draft ? 'Requisition saved as draft.' : 'Requisition submitted for approval.'}
}

// Save a draft, or submit for approval. Submitting also raises or advances the
// procurement record, through the Procurements domain builder.
export function buildRequisitionSaveChainNodes ({
  code = '',
  form = {},
  items = [],
  deactivatedCodes = [],
  draft = false,
  procurement = null,
  actorName = '',
  actorRole = ''
} = {}) {
  const record = asRow(form)
  const lines = dedupeItemLines(items).filter((entry) => num(entry.Quantity ?? entry.requiredQuantity) > 0)

  if (!unwrap(record.Type)) {
    return [{ valid: false, message: 'Select a requisition type.' }]
  }
  if (!unwrap(record.Priority)) {
    return [{ valid: false, message: 'Select a priority.' }]
  }
  if (!lines.length) {
    return [{ valid: false, message: 'Add at least one item with a quantity greater than zero.' }]
  }

  const targetProgress = draft ? DRAFT : PENDING_APPROVAL
  const nodes = [buildRequisitionCompositeNode({
    code,
    form,
    targetProgress,
    items: lines,
    deactivatedCodes
  })]

  if (!draft) {
    const procurementCode = text(asRow(procurement).Code) || text(record.ProcurementCode)
    if (procurementCode) {
      const advance = buildProcurementProgressNode(
        asRow(procurement).Code ? procurement : { Code: procurementCode, Progress: INITIATED },
        PR_CREATED
      )
      if (advance) {
        nodes.push(advance)
      }
    } else if (text(code)) {
      nodes.push(buildProcurementCreateNode(code, actorName, actorRole))
    }
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

// An approver's verdict: `approve`, `sendBack` or `reject`. The procurement
// side-effect for each verdict is delegated to the Procurements domain builder.
export function buildRequisitionReviewChainNodes ({
  requisition = null,
  action = '',
  comment = '',
  actorName = '',
  procurement = null
} = {}) {
  const record = asRow(requisition)
  const code = text(record.Code)
  const verdict = text(action)
  const note = text(comment)

  if (!code) {
    return [{ valid: false, message: 'No requisition loaded.' }]
  }
  if (!isPendingApproval(record)) {
    return [{ valid: false, message: 'This requisition is no longer awaiting approval.' }]
  }

  let nextProgress = ''
  let stamp = {}
  let permission = ''
  let successMsg = ''

  if (verdict === 'approve') {
    nextProgress = APPROVED
    stamp = stampFields('ProgressApproved', actorName, note)
    permission = 'approve'
    successMsg = 'Requisition approved.'
  } else if (verdict === 'sendBack') {
    if (!note) return [{ valid: false, message: 'A comment is required to send this back for revision.' }]
    nextProgress = REVISION_REQUIRED
    stamp = stampFields('ProgressRevisionRequired', actorName, note)
    permission = 'sendBack'
    successMsg = 'Requisition sent back for revision.'
  } else if (verdict === 'reject') {
    if (!note) return [{ valid: false, message: 'A comment is required to reject this requisition.' }]
    nextProgress = REJECTED
    stamp = stampFields('ProgressRejected', actorName, note)
    permission = 'reject'
    successMsg = 'Requisition rejected.'
  } else {
    return [{ valid: false, message: 'Unsupported review action.' }]
  }

  const nodes = [{ resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: nextProgress, ...stamp } }]

  const target = asRow(procurement)
  if (text(target.Code)) {
    const chained = verdict === 'reject'
      ? buildProcurementCancelNode(target)
      : verdict === 'approve'
        ? buildProcurementProgressNode(target, PR_APPROVED)
        : null
    if (chained) {
      nodes.push(chained)
    }
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

/** Marks the requisition consumed once an RFQ has been generated from it. */
export function buildRequisitionRfqProcessedNode (requisitionCode) {
  const code = text(requisitionCode)
  if (!code) return null
  return { resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: RFQ_PROCESSED } }
}

export function usePurchaseRequisitionPayload () {
  return {
    buildRequisitionFormData,
    buildRequisitionItemRecords,
    buildRequisitionCompositeNode,
    buildRequisitionSaveChainNodes,
    buildRequisitionReviewChainNodes,
    buildRequisitionRfqProcessedNode,
    dedupeItemLines
  }
}
