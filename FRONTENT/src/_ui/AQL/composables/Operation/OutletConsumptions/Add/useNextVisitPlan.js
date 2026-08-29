import { NODE, CTRL } from './nodes'
import { visitFrequencyFor, visitDateFrom } from 'src/_resource/Operation/OutletVisits/composables/useVisitCadence'

// The next visit's answers, derived once. Two cards need them — the scheduling card that
// edits them, and the completion card that carries them on its action target — so the
// cadence maths lives here rather than in whichever card happens to be mounted.

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const unset = (value) => value === null || value === undefined || value === ''

export function nextVisitPlan (pageState, operatingRules = []) {
  const record = pageState.getRecord(null, NODE.CONSUMPTION) || {}
  const outletCode = text(record.OutletCode)
  // The audit's own date is day zero — the same base the visit domain counts from.
  const base = text(record.Date) || new Date().toISOString().slice(0, 10)

  const frequency = visitFrequencyFor(outletCode, operatingRules)
  const storedDays = pageState.getControls(CTRL.NEXT_VISIT_DAYS.header, null)
  const days = unset(storedDays) ? num(frequency) : num(storedDays)

  const storedComment = pageState.getControls(CTRL.NEXT_VISIT_COMMENT.header, null)
  const comment = storedComment === null
    ? `Planned after consumption on ${base}`
    : text(storedComment)

  // 0 days plans nothing, but is a legitimate thing to type on the way to another number.
  const date = days > 0 ? visitDateFrom(base, days) : ''
  const wanted = pageState.getControls(CTRL.SCHEDULE_NEXT.header, true) === true

  return { outletCode, base, frequency, days, date, comment, wanted, willSchedule: wanted && !!date }
}
