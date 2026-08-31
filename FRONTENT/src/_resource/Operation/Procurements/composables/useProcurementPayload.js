import { textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import { canAdvanceTo, progressOf, PR_CREATED, COMPLETED, CANCELLED } from './useProcurementProgress'

const RESOURCE_NAME = 'Procurements'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

const MOVE = { update: 'You are not allowed to move this procurement.' }
const RAISE = { create: 'You are not allowed to raise a procurement.' }

export { RESOURCE_NAME }

export function todayDashed () {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// The one writer of a procurement stage change. Null when the move is not a real
// advance, so every caller can push the result unconditionally and filter nulls.
export function buildProcurementProgressNode (procurement, nextProgress, reload = []) {
  const row = asRow(procurement)
  const code = text(row.Code)
  if (!code) return null
  if (!canAdvanceTo(row, nextProgress)) return null
  return { resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: text(nextProgress).toUpperCase() }, permissions: MOVE, reload: reload }
}

// A rollback is the one move that goes backwards. It refuses to touch a COMPLETED
// procurement, which is settled.
export function buildProcurementRollbackNode (procurement, previousProgress, reload = []) {
  const row = asRow(procurement)
  const code = text(row.Code)
  const target = text(previousProgress).toUpperCase()
  if (!code || !target) return null
  const current = progressOf(row)
  if (!current || current === COMPLETED || current === target) return null
  return { resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: target }, permissions: MOVE, reload: reload }
}

export function buildProcurementCancelNode (procurement, reload = []) {
  const row = asRow(procurement)
  const code = text(row.Code)
  if (!code || progressOf(row) === CANCELLED || progressOf(row) === COMPLETED) return null
  return { resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: CANCELLED }, permissions: MOVE, reload: reload }
}

// Raised alongside the first Purchase Requisition. linkedPurchaseRequisitionCode rides
// on the request payload, not the record - the GAS post-write hook reads it there.
export function buildProcurementCreateNode (purchaseRequisitionCode, actorName = '', actorRole = '') {
  return { resource: RESOURCE_NAME, record: {
    Progress: PR_CREATED,
    InitiatedDate: todayDashed(),
    CreatedUser: text(actorName),
    CreatedRole: text(actorRole),
    Status: 'Active'
  }, permissions: RAISE, payload: { linkedPurchaseRequisitionCode: text(purchaseRequisitionCode) } }
}

export function procurementStamp (prefix, actorName = '', comment = '') {
  return {
    [`${prefix}At`]: toDateTime24(new Date()),
    [`${prefix}By`]: text(actorName),
    [`${prefix}Comment`]: text(comment)
  }
}

export function useProcurementPayload () {
  return {
    buildProcurementProgressNode,
    buildProcurementRollbackNode,
    buildProcurementCancelNode,
    buildProcurementCreateNode,
    procurementStamp,
    todayDashed
  }
}
