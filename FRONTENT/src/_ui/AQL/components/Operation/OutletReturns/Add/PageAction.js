import { validateReturnDraft } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'

// The live nodes ARE the batch: the return and, when stock actually moves, its shelf
// movement are both kept true by the node's derivations. So submit builds nothing and
// reloads nothing — it only refuses a draft the domain says is not submittable.
const NODE = 'OutletReturns'

export default (props, { pageState }) => ({
  actions: ['cancel', 'submit'],
  submitLabel: 'Submit Return',
  successMessage: 'Return logged.',

  cancel: (name, { nav }) => {
    nav.goTo('index')
    return false
  },

  submit: () => {
    const problem = validateReturnDraft(pageState.getRecord(null, NODE))
    if (problem) return { valid: false, message: problem }
  },

  // Land on the record just created, so the officer sees which tracks are now open.
  successRoute: 'view'
})
