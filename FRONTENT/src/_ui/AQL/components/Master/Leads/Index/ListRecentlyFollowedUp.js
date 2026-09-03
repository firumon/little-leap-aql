import { useFollowUpIndex } from 'src/_resource/Operation/LeadFollowUps/composables/useFollowUpIndex'
import { relativeTimeLabel } from 'src/utils/dateHelpers'
import { leadName, leadPlace } from './leadCard'

// Leads is upstream of LeadFollowUps, so the join that answers "who was answered
// last" is owned by the follow-up module and only read here.
export default function (props) {
  const { sortLeadsByLastResponse, lastRespondAtByLead } = useFollowUpIndex()

  const lastRespondAt = (lead) => lastRespondAtByLead.value.get(lead?.code ?? lead?.Code)

  return {
    ...props,
    items: sortLeadsByLastResponse(props.items),
    layout: ['label', 'caption'],
    label: leadName,
    caption: leadPlace,
    // A lead nobody has answered yet has nothing to date, so it shows no chip.
    metaLayout: ['chip'],
    chip: (lead) => relativeTimeLabel(lastRespondAt(lead)),
    chipColor: 'primary'
  }
}
