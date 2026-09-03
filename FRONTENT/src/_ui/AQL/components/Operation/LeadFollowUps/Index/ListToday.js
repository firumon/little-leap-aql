import { isResponded, progressColor, progressIcon } from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpProgress'
import { sortByDate } from 'src/utils/sortHelpers'
import FollowUpActionButtons from './FollowUpActionButtons.vue'
import { leadLabel, purpose, purposeDetail, respondBody, respondedAgo, username } from './followUpCard'

// One card shape, read two ways. An awaiting row still describes work to do, so it
// leads with the purpose; an answered one is a record of what happened, so it leads
// with who answered.
const topCaption = (row) => (isResponded(row) ? username(row) : purpose(row))

const bottomCaption = (row) => (isResponded(row) ? respondBody(row) : purposeDetail(row))

export default function (props) {
  return {
    ...props,
    items: sortByDate(props.items, 'Date', 'asc'),
    layout: ['caption', 'label', 'caption'],
    content: [topCaption, leadLabel, bottomCaption],
    icon: (row) => (isResponded(row) ? progressIcon(row) : null),
    iconColor: (row) => progressColor(row),
    highlight: true,
    highlightColor: (row) => progressColor(row),
    // An awaiting row carries action buttons instead, and an empty chip resolver
    // drops the whole meta section for that row.
    metaLayout: ['chip'],
    chip: (row) => (isResponded(row) ? respondedAgo(row) : ''),
    chipColor: (row) => progressColor(row),
    btn: FollowUpActionButtons
  }
}
