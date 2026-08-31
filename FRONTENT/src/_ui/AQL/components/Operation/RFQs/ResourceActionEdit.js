import { isDraft } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'

// An RFQ is only editable while it is still a draft.
export default {
  show: (record) => isDraft(record),
  label: 'Edit RFQ'
}
