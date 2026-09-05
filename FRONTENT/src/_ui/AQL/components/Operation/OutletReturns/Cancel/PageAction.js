import {
  validateReturnCancelDraft
} from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { canCancel } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

// The cancellation and its compensating shelf movement stand on the live nodes from the
// moment the card mounts. Submit builds nothing — it refuses a missing reason, and a return
// that came to rest while this page was open.
const NODE = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceRecord }) => ({
  actions: ['cancel', 'submit'],
  submitLabel: 'Cancel Return',
  submitColor: 'negative',

  // Abandoning goes back to the return, not `goBack()` — the reader may have arrived from
  // the index. Returning `false` stops the dispatcher popping a second history entry.
  cancel: (name, { nav }) => {
    nav.goTo('view')
    return false
  },

  submit: () => {
    const row = resourceRecord?.record?.value || {}
    if (!text(row.Code)) return { valid: false, message: 'This return could not be loaded.' }
    if (!canCancel(row)) {
      return { valid: false, message: 'This return has already come to rest and can no longer be cancelled.' }
    }

    const problem = validateReturnCancelDraft(pageState.getRecord(null, NODE))
    if (problem) return { valid: false, message: problem }
  },

  // Back to the ledger rather than to the cancelled record: there is nothing left to do
  // with it, and the reader's next action is almost always the next return.
  successRoute: 'index'
})
