import { sortByDate } from 'src/utils/sortHelpers'
import { dueInLabel, plannedCard } from './followUpCard'

export default function (props) {
  return {
    ...props,
    items: sortByDate(props.items, 'Date', 'asc'),
    ...plannedCard,
    metaLayout: ['chip'],
    chip: dueInLabel,
    chipColor: 'indigo-6'
  }
}
