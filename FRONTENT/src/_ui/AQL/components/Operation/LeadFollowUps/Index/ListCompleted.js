import { sortByDate } from 'src/utils/sortHelpers'
import { delayColor, delayLabel, respondedCard } from './followUpCard'

export default function (props) {
  return {
    ...props,
    items: sortByDate(props.items, 'RespondDate', 'desc'),
    ...respondedCard(),
    metaLayout: ['chip'],
    chip: delayLabel,
    chipColor: delayColor
  }
}
