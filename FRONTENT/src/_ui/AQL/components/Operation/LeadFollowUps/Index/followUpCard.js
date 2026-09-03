// The LeadFollowUps card contract shared by every list view.
// Rows here are raw sheet records, so the lead name comes off the `$lead` relation.

import { COMPLETED, progressComment, respondDelayDays } from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpProgress'
import { daysFromToday, relativeTimeLabel } from 'src/utils/dateHelpers'

export const leadLabel = (row) => row?.$lead?.Name || row?.LeadCode || ''

export const purpose = (row) => row?.Purpose || ''

export const purposeDetail = (row) => row?.PurposeDetail || ''

export const username = (row) => row?.Username || ''

export const outcome = (row) => row?.Outcome || ''

/**
 * What an answered follow-up says happened. A completed one carries its result in
 * `Outcome`; every other outcome carries it in that progress's own stamp comment.
 */
export function respondBody (row) {
  if (String(row?.Progress ?? '').trim() === COMPLETED) return outcome(row)
  return progressComment(row) || ''
}

/** How late the response was against the planned date. '' until it is answered. */
export function delayLabel (row) {
  const days = respondDelayDays(row)
  if (days === null) return ''
  if (days === 0) return 'On time'
  const count = Math.abs(days)
  return `${count} ${count === 1 ? 'day' : 'days'} ${days > 0 ? 'late' : 'early'}`
}

export function delayColor (row) {
  const days = respondDelayDays(row)
  if (days === null) return 'grey-6'
  if (days > 0) return 'negative'
  return days === 0 ? 'positive' : 'primary'
}

/** How far off a still-planned follow-up is. '' when the date will not parse. */
export function dueInLabel (row) {
  const days = daysFromToday(row?.Date)
  if (Number.isNaN(days)) return ''
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days} ${days === 1 ? 'day' : 'days'}`
}

/** How long ago the follow-up was answered, as a chip. */
export const respondedAgo = (row) => relativeTimeLabel(row?.RespondDate)

/** The planned work card: lead on top, purpose and its detail below. */
export const plannedCard = {
  layout: ['label', 'caption', 'caption'],
  content: [leadLabel, purpose, purposeDetail]
}

/** The answered card: who answered, which lead, and what came of it. */
export function respondedCard (bodyReader = respondBody) {
  return {
    layout: ['caption', 'label', 'caption'],
    content: [username, leadLabel, bodyReader]
  }
}
