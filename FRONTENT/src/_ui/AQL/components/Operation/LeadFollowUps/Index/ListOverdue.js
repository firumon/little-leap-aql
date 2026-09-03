import { sortByDate } from 'src/utils/sortHelpers'
import { daysFromToday } from 'src/utils/dateHelpers'
import FollowUpActionButtons from './FollowUpActionButtons.vue'
import { plannedCard } from './followUpCard'

const overdueDays = (row) => {
  const days = daysFromToday(row?.Date)
  return days === null || Number.isNaN(days) ? 0 : Math.max(0, -days)
}

export default function (props) {
  return {
    ...props,
    items: sortByDate(props.items, 'Date', 'asc'),
    ...plannedCard,
    metaLayout: ['chip'],
    chip: (row) => `${overdueDays(row)} ${overdueDays(row) === 1 ? 'day' : 'days'}`,
    chipColor: (row) => (overdueDays(row) >= 7 ? 'negative' : 'warning'),
    btn: FollowUpActionButtons
  }
}
