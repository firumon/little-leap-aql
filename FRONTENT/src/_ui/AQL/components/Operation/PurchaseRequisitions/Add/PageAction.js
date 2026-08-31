import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { buildRequisitionSaveChainNodes } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'

const NODE = 'PurchaseRequisitions'
const CHILD = 'PurchaseRequisitionItems'

const text = (value) => String(value ?? '').trim()

// Child entries carry `{ _action, data }`; the domain builder wants plain rows.
function toRows (entries) {
  return (entries || [])
    .filter((entry) => entry._action !== 'deactivate')
    .map(({ _action, _originalCode, ...data }) => ({ ...data, Code: text(_originalCode) }))
}

export default (props, { pageState, resourceConfig }) => {
  const dataStore = useDataStore()
  const parent = pageState.useNode(NODE)
  const entries = parent.children(CHILD)
  const { user } = useAuth()

  const isDraft = () => pageState.getControls('isDraft', null, NODE) === true

  return {
    actions: ['cancel', 'submit'],

    get submitLabel () {
      return isDraft() ? 'Save Draft' : 'Submit for Approval'
    },

    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    submit: () => {
      const form = parent.record.value
      const procurementCode = text(form.ProcurementCode)
      const procurement = procurementCode
        ? dataStore.getRecords('Procurements').find((row) => text(row?.Code) === procurementCode) || null
        : null

      const result = buildRequisitionSaveChainNodes({
        form,
        items: toRows(entries.value),
        draft: isDraft(),
        procurement,
        actorName: user.value?.name || user.value?.email || '',
        actorRole: user.value?.role || ''
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'index'
  }
}
