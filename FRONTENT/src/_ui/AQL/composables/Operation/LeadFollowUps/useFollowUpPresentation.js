// LeadFollowUps — Layer 3 wording for numbers the domain layer already produced.
// The Leads View page reads these too, so both pages phrase a follow-up the same way.

const dayNoun = (count) => (count === 1 ? 'day' : 'days')

/** "Today" | "Tomorrow" | "In 3 days" | "Overdue by 2 days". */
export function countdownLabel (days) {
  if (days === null || days === undefined) return ''
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 0) {
    const late = Math.abs(days)
    return `Overdue by ${late} ${dayNoun(late)}`
  }
  return `In ${days} ${dayNoun(days)}`
}

/** Overdue reads negative, the next two days read warning, anything further is neutral. */
export function countdownColor (days) {
  if (days === null || days === undefined) return 'grey-6'
  if (days < 0) return 'negative'
  if (days <= 1) return 'warning'
  return 'primary'
}

/** "Ontime" | "Late by 3 days" | "2 days Early". Positive days means late. */
export function timelinessLabel (days) {
  if (days === null || days === undefined) return ''
  if (days === 0) return 'Ontime'
  const magnitude = Math.abs(days)
  return days > 0
    ? `Late by ${magnitude} ${dayNoun(magnitude)}`
    : `${magnitude} ${dayNoun(magnitude)} Early`
}

// A short slip is a warning, a long one is a miss; on time or early is good news.
export function timelinessColor (days) {
  if (days === null || days === undefined) return 'grey-6'
  if (days <= 0) return 'positive'
  return days <= 5 ? 'warning' : 'negative'
}

export function useFollowUpPresentation () {
  return { countdownLabel, countdownColor, timelinessLabel, timelinessColor }
}
