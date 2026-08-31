import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { buildRequisitionSaveChainNodes } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import { requisitionEditableProgress, DRAFT } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

const NODE = 'PurchaseRequisitions'
const CHILD = 'PurchaseRequisitionItems'

const text = (value) => String(value ?? '').trim()

function toRows (entries) {
  return (entries || [])
    .filter((entry) => entry._action !== 'deactivate')
    .map(({ _action, _originalCode, ...data }) => ({ ...data, Code: text(_originalCode) }))
}

function removedCodes (entries) {
  return (entries || [])
    .filter((entry) => entry._action === 'deactivate')
    .map((entry) => text(entry._originalCode))
    .filter(Boolean)
}

export default (props, { pageState, resourceConfig }) => {
  const dataStore = useDataStore()
  const parent = pageState.useNode(NODE)
  const entries = parent.children(CHILD)
  const { user } = useAuth()

  const isDraft = () => pageState.getControls('isDraft', null, NODE) === true

  // Latched on first sight: submit rewrites the field the label reads, and a live
  // read would flip the verb while the request is still in flight.
  let entryProgress = null
  const enteredAsDraft = () => {
    if (entryProgress === null) {
      const current = text(parent.record.value.Progress)
      if (!current) return false
      entryProgress = current
    }
    return entryProgress === DRAFT
  }

  return {
    actions: ['cancel', 'submit'],

    get submitLabel () {
      if (isDraft()) return 'Save Draft'
      return enteredAsDraft() ? 'Submit for Approval' : 'Resubmit'
    },

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const form = parent.record.value
      if (!requisitionEditableProgress(form.Progress)) {
        return { valid: false, message: 'Only a draft or returned requisition can be edited.' }
      }

      const procurementCode = text(form.ProcurementCode)
      const procurement = procurementCode
        ? dataStore.getRecords('Procurements').find((row) => text(row?.Code) === procurementCode) || null
        : null

      const result = buildRequisitionSaveChainNodes({
        code: text(form.Code),
        form,
        items: toRows(entries.value),
        deactivatedCodes: removedCodes(entries.value),
        draft: isDraft(),
        procurement,
        actorName: user.value?.name || user.value?.email || '',
        actorRole: user.value?.role || ''
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'view'
  }
}
