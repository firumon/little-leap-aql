import {
  validateReturnWarehouseActionDraft
} from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { canConfirmWarehouseAction } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

// The disposition, its stamps and the warehouse receipt node stand on the live nodes from
// the moment the card mounts. Submit builds nothing — it refuses a disposal with no reason,
// and a receipt another operator confirmed while this page was open.
const NODE = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceRecord }) => ({
  actions: ['cancel', 'submit'],
  submitLabel: 'Confirm Action',

  cancel: (name, { nav }) => {
    nav.goTo('view')
    return false
  },

  submit: () => {
    const row = resourceRecord?.record?.value || {}
    if (!text(row.Code)) return { valid: false, message: 'This return could not be loaded.' }
    if (!canConfirmWarehouseAction(row)) {
      return { valid: false, message: 'This return no longer needs a warehouse action.' }
    }

    const problem = validateReturnWarehouseActionDraft(pageState.getRecord(null, NODE))
    if (problem) return { valid: false, message: problem }
  },

  successRoute: 'view'
})
