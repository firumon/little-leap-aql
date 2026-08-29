import { textOrRef } from 'src/utils/appHelpers'
import { addDays, toDateOnly } from 'src/utils/dateHelpers'
import { stampFields } from 'src/utils/workflowStamp'
import { visitFrequencyFor } from './useVisitCadence'
import { COMPLETED, PLANNED } from './useVisitProgress'

// The only source of truth for creating, scheduling or completing a visit, whichever
// module triggers it. Every export returns Node Objects (UI_PAGE_STATE.md §5).

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
    resource: RESOURCE_NAME,
    ...(options.role ? { role: options.role } : {}),
    record: {
      OutletCode: outletCode,
      Date: date,
      Progress: PLANNED,
      ProgressPlannedComment: text(entry.ProgressPlannedComment) || text(options.comment),
      ...(text(entry.Username) ? { Username: text(entry.Username) } : {}),
      Status: 'Active'
    },
    permissions: { create: 'You are not allowed to schedule a visit.' },
    reload: [RESOURCE_NAME]
  }
}

export function buildVisitScheduleChainNodes ({ visit = {}, comment = '', role = '' } = {}) {
  const node = buildVisitCreateNode(visit, { comment, role })
  if (!node) {
    return [{ valid: false, message: 'Select an outlet and a visit date to schedule a visit.' }]
  }
  return [{ ...node, successMsg: 'Visit scheduled.' }]
}

// Routed through executeAction, not a plain update, so GAS applies the same Progress
// stamping the standalone Visits page gets. A visit's rules are not a caller's to redo.
// `nextVisit` rides along as the action's own `nextVisit` TARGET, not as a second node:
// the Complete action already declares that target, so GAS plans the next visit as part
// of closing this one.
export function buildVisitCompleteNode (visitCode, actorName = '', comment = '', nextVisit = {}) {
  const code = text(visitCode)
  if (!code) return null
  const planned = asRow(nextVisit)
  const plannedDate = toDateOnly(text(planned.Date)) || text(planned.Date)
  return {
    resource: RESOURCE_NAME,
    permissions: { complete: 'You are not allowed to complete this visit.' },
    actions: [{
      action: 'Complete',
      column: 'Progress',
      columnValue: COMPLETED,
      code: textOrRef(code),
      data: {
        fields: {
          RespondDate: todayISO(),
          // The DERIVED header only. `Comment` is the authored short name and would land
          // beside this one as a second, conflicting answer to the same question.
          ProgressCompletedComment: text(comment) || `Completed from outlet consumption by ${text(actorName) || 'Unknown'}.`
        },
        ...(plannedDate
          ? {
              targets: {
                nextVisit: {
                  Date: plannedDate,
                  ProgressPlannedComment: text(planned.ProgressPlannedComment)
                }
              }
            }
          : {})
      }
    }],
    reload: [RESOURCE_NAME]
  }
}

// A blank code yields NO nodes. A consumption recorded against no planned visit has
// nothing to complete, and refusing there would block a real submission.
export function buildVisitCompletionChainNodes ({ visitCode = '', actorName = '', comment = '', nextVisit = {} } = {}) {
  const node = buildVisitCompleteNode(visitCode, actorName, comment, nextVisit)
  if (!node) return []
  const planned = !!text(asRow(nextVisit).Date)
  return [{ ...node, successMsg: planned ? 'Visit completed and the next one planned.' : 'Visit completed.' }]
}

// frequencyDays is required and never defaulted here. A cadence invented in this file
// would schedule every outlet on a number nobody configured.
export function buildNextVisitNode (form = {}, frequencyDays = 0, actorName = '', visit = {}) {
  const entry = asRow(form)
  const seed = asRow(visit)
  const frequency = num(frequencyDays)
  const outletCode = text(seed.OutletCode) || text(entry.OutletCode)
  const base = text(entry.Date) || todayISO()

  // A date the officer set on the seeded node wins; otherwise the cadence decides. With
  // neither there is no visit to plan.
  const nextDate = toDateOnly(text(seed.Date)) ||
    (frequency > 0 ? toDateOnly(addDays(base, frequency)) : '')
  if (!outletCode || !nextDate) return null

  const planner = text(seed.Username) || text(actorName) || text(entry.Username) || 'Unknown'
  const comment = text(seed.ProgressPlannedComment) ||
    `Auto-planned ${frequency} days after the consumption recorded by ${planner} on ${base}.`

  return {
    resource: RESOURCE_NAME,
    // Its own role: the same batch may also complete a visit, and a next visit is a
    // different record from the one being closed.
    role: 'next',
    record: {
      OutletCode: outletCode,
      Date: nextDate,
      Username: planner,
      Progress: PLANNED,
      ...stampFields('ProgressPlanned', planner, comment),
      Status: 'Active'
    },
    permissions: { create: 'You are not allowed to schedule the next visit.' },
    reload: [RESOURCE_NAME]
  }
}

// The cadence rule belongs to OutletVisits, so a caller that only knows "schedule the
// next one" never has to know how often that is. Unresolvable yields a valid, empty one.
export function buildNextVisitChainNodes ({
  form = {},
  frequencyDays = null,
  operatingRules = [],
  actorName = '',
  visit = {}
} = {}) {
  const frequency = frequencyDays === null || frequencyDays === undefined
    ? visitFrequencyFor(asRow(form).OutletCode, operatingRules)
    : num(frequencyDays)

  const node = buildNextVisitNode(form, frequency, actorName, visit)
  if (!node) return []

  return [{ ...node, successMsg: 'Next visit scheduled.' }]
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
