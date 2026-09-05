import { validateReturnDraft } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'

// The live node IS the batch: the corrected row and, when the correction moves stock, the
// DELTA shelf movement are both kept true by the node's derivations. Submit only refuses a
// draft the domain says cannot be saved.
const NODE = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceRecord }) => ({
  actions: ['cancel', 'submit'],
  submitLabel: 'Save Changes',

  cancel: (name, { nav }) => {
    nav.goTo('view', { code: text(resourceRecord?.record?.value?.Code) })
    return false
  },

  submit: () => {
    const problem = validateReturnDraft(pageState.getRecord(null, NODE))
    if (problem) return { valid: false, message: problem }
  },

  // Land back on the record, so the officer sees the corrected row and its open tracks.
  successRoute: 'view'
})
