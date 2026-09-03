import { sortByDate } from 'src/utils/sortHelpers'
import { stampedLeadCard } from './leadCard'

export default function (props) {
  return {
    ...props,
    items: sortByDate(props.items, 'ProgressApprovedAt', 'desc'),
    ...stampedLeadCard('ProgressApprovedComment')
  }
}
