import { sortByDate } from 'src/utils/sortHelpers'
import { daysFromToday } from 'src/utils/dateHelpers'
import { leadName, leadPlace } from './leadCard'

// Past this age the day count stops reading as a number and starts reading as a delay.
const MONTH_THRESHOLD_DAYS = 99
const DAYS_PER_MONTH = 30

const ageDays = (lead) => {
  const days = daysFromToday(lead?.CreatedAt)
  return days === null || Number.isNaN(days) ? null : Math.max(0, -days)
}

function ageLabel (lead) {
  const days = ageDays(lead)
  if (days === null) return ''
  if (days > MONTH_THRESHOLD_DAYS) {
    const months = Math.round(days / DAYS_PER_MONTH)
    return `${months} ${months === 1 ? 'Month' : 'Months'}`
  }
  return `${days} ${days === 1 ? 'Day' : 'Days'}`
}

export default function (props) {
  return {
    ...props,
    items: sortByDate(props.items, 'CreatedAt', 'asc'),
    layout: ['label', 'caption'],
    label: leadName,
    caption: leadPlace,
    metaLayout: ['chip'],
    chip: ageLabel,
    chipColor: (lead) => ((ageDays(lead) ?? 0) > MONTH_THRESHOLD_DAYS ? 'negative' : 'amber-8')
  }
}
