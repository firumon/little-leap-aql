import FollowUpActionButtons from './FollowUpActionButtons.vue'
import { plannedCard } from './followUpCard'

export default function (props) {
  return {
    ...props,
    ...plannedCard,
    btn: FollowUpActionButtons
  }
}
