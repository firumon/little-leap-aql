import { useDataStore } from 'src/stores/data'
import { buildAssignSuppliersChainNodes } from 'src/_resource/Operation/RFQs/composables/useRFQPayload'

const NODE = 'RFQs'
const SELECTED = 'SelectedSupplierCodes'

const text = (value) => String(value ?? '').trim()

// [ Cancel ] [ Assign Suppliers ]
export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const dataStore = useDataStore()
  pageState.useNode(NODE)

  const rfq = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const selected = () => {
    const value = pageState.getControls(SELECTED, null, NODE)
    return Array.isArray(value) ? value : []
  }

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Assign Suppliers',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const result = buildAssignSuppliersChainNodes({
        rfq: rfq(),
        supplierCodes: selected(),
        existingSupplierRows: dataStore.getRecords('RFQSuppliers')
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'view'
  }
}
