import { buildMarkAsSentChainNodes } from 'src/_resource/Operation/RFQs/composables/useRFQPayload'

const NODE = 'RFQs'
const DISPATCH = 'SelectedSupplierRowCodes'

const text = (value) => String(value ?? '').trim()

// [ Cancel ] [ Mark As Sent ]
export default (props, { pageState, resourceConfig, resourceRecord }) => {
  pageState.useNode(NODE)

  const rfq = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const procurement = () => rfq()?.$procurement || rfq()?.$Procurement || null

  const selected = () => {
    const value = pageState.getControls(DISPATCH, null, NODE)
    return Array.isArray(value) ? value : []
  }

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Mark As Sent',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const result = buildMarkAsSentChainNodes({
        rfq: rfq(),
        supplierRowCodes: selected(),
        supplierRows: rfq()?.$RFQSuppliers || rfq()?.$rfqsuppliers || [],
        procurement: procurement()
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'view'
  }
}
