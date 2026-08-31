import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { buildRequisitionReviewChainNodes } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import { isPendingApproval } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

const NODE = 'PurchaseRequisitions'

const text = (value) => String(value ?? '').trim()

// [ Cancel ] [ Request Revision ] [ Reject ] [ Approve ]
export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const dataStore = useDataStore()
  pageState.useNode(NODE)

  const { user } = useAuth()

  const requisition = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const procurement = () => {
    const code = text(requisition()?.ProcurementCode)
    if (!code) return null
    return dataStore.getRecords('Procurements').find((row) => text(row?.Code) === code) || null
  }

  const comment = () => text(pageState.getControls('ReviewComment', null, NODE))

  function run (action) {
    const record = requisition()
    if (!record) return { valid: false, message: 'This requisition could not be loaded.' }
    if (!isPendingApproval(record)) {
      return { valid: false, message: 'This requisition is no longer awaiting approval.' }
    }

    const result = buildRequisitionReviewChainNodes({
      requisition: record,
      action,
      comment: comment(),
      actorName: user.value?.name || user.value?.email || '',
      procurement: procurement()
    })

    return result
  }

  return {
    actions: ['cancel', 'sendBack', 'reject', 'submit'],
    submitLabel: 'Approve',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const result = run('approve')
      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false
      return { successMsg: applied.successMsg }
    },

    sendBack: (name, { nav }) => {
      const result = run('sendBack')
      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false
      return {
        successMsg: applied.successMsg,
        onSuccess: () => { pageState.reset(); nav.goTo('view') }
      }
    },

    reject: (name, { nav }) => {
      const result = run('reject')
      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false
      return {
        successMsg: applied.successMsg,
        onSuccess: () => { pageState.reset(); nav.goTo('view') }
      }
    },

    successRoute: 'view'
  }
}
