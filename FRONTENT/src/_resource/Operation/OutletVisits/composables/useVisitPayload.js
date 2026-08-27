import { addDays, toDateOnly } from 'src/utils/dateHelpers'
import { actionNode, createNode } from 'src/composables/resources/nodePayloads'
import { visitFrequencyFor } from './useVisitCadence'
import { COMPLETED, PLANNED } from './useVisitProgress'

// The only source of truth for creating, scheduling or completing a visit, whichever
// module triggers it. Every export returns { valid, nodes, permissions, successMsg }.

const RESOURCE_NAME = 'OutletVisits'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

// Null when the outlet or the date is missing. That is not a half-filled row to fix
// later, it is a row nothing can ever act on.
export function buildVisitCreateNode (visit = {}, options = {}) {
  const entry = asRow(visit)
  const outletCode = text(entry.OutletCode)
  const date = toDateOnly(text(entry.Date)) || text(entry.Date)
  if (!outletCode || !date) return null

  return {
    ...createNode(RESOURCE_NAME, {
      OutletCode: outletCode,
      Date: date,
      Progress: PLANNED,
      ProgressPlannedComment: text(entry.ProgressPlannedComment) || text(options.comment),
      ...(text(entry.Username) ? { Username: text(entry.Username) } : {}),
      Status: 'Active'
    }, [RESOURCE_NAME]),
    ...(options.role ? { role: options.role } : {})
  }
}

export function buildVisitScheduleChainNodes ({ visit = {}, comment = '', role = '' } = {}) {
  const node = buildVisitCreateNode(visit, { comment, role })
  if (!node) {
    return { valid: false, nodes: [], permissions: {}, message: 'Select an outlet and a visit date to schedule a visit.' }
  }
  return {
    valid: true,
    nodes: [node],
    permissions: { [RESOURCE_NAME]: 'create' },
    successMsg: 'Visit scheduled.'
  }
}

// Routed through executeAction, not a plain update, so GAS applies the same Progress
// stamping the standalone Visits page gets. A visit's rules are not a caller's to redo.
export function buildVisitCompleteNode (visitCode, actorName = '', comment = '') {
  const code = text(visitCode)
  if (!code) return null
  return actionNode(RESOURCE_NAME, code, {
    action: 'Complete', column: 'Progress', columnValue: COMPLETED
  }, {
    RespondDate: todayISO(),
    ProgressCompletedComment: text(comment) || `Completed from outlet consumption by ${text(actorName) || 'Unknown'}.`
  }, { reload: [RESOURCE_NAME] })
}

// A blank code yields a VALID, EMPTY envelope. A consumption recorded against no planned
// visit has nothing to complete, and refusing there would block a real submission.
export function buildVisitCompletionChainNodes ({ visitCode = '', actorName = '', comment = '' } = {}) {
  const node = buildVisitCompleteNode(visitCode, actorName, comment)
  if (!node) return { valid: true, nodes: [], permissions: {} }
  return {
    valid: true,
    nodes: [node],
    permissions: { [RESOURCE_NAME]: 'complete' },
    successMsg: 'Visit completed.'
  }
}

// frequencyDays is required and never defaulted here. A cadence invented in this file
// would schedule every outlet on a number nobody configured.
export function buildNextVisitNode (form = {}, frequencyDays = 0, actorName = '') {
  const entry = asRow(form)
  const frequency = num(frequencyDays)
  const outletCode = text(entry.OutletCode)
  if (!outletCode || frequency <= 0) return null

  const base = text(entry.Date) || todayISO()
  const nextDate = toDateOnly(addDays(base, frequency))
  if (!nextDate) return null

  return {
    ...createNode(RESOURCE_NAME, {
      OutletCode: outletCode,
      Date: nextDate,
      Progress: PLANNED,
      ProgressPlannedComment: `Auto-planned ${frequency} days after the consumption recorded by ${text(actorName) || text(entry.Username) || 'Unknown'} on ${base}.`,
      Status: 'Active'
    }, [RESOURCE_NAME]),
    // Its own role: the same batch may also complete a visit, and a next visit is a
    // different record from the one being closed.
    role: 'next'
  }
}

// The cadence rule belongs to OutletVisits, so a caller that only knows "schedule the
// next one" never has to know how often that is. Unresolvable yields a valid, empty one.
export function buildNextVisitChainNodes ({
  form = {},
  frequencyDays = null,
  operatingRules = [],
  actorName = ''
} = {}) {
  const frequency = frequencyDays === null || frequencyDays === undefined
    ? visitFrequencyFor(asRow(form).OutletCode, operatingRules)
    : num(frequencyDays)

  const node = buildNextVisitNode(form, frequency, actorName)
  if (!node) return { valid: true, nodes: [], permissions: {} }

  return {
    valid: true,
    nodes: [node],
    permissions: { [RESOURCE_NAME]: 'create' },
    successMsg: 'Next visit scheduled.'
  }
}

export function useVisitPayload () {
  return {
    buildVisitCreateNode,
    buildVisitScheduleChainNodes,
    buildVisitCompleteNode,
    buildVisitCompletionChainNodes,
    buildNextVisitNode,
    buildNextVisitChainNodes
  }
}
