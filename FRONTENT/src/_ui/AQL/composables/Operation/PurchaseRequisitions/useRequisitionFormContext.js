import { computed, inject } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import {
  progressOf,
  isEditable,
  isRevisionRequired,
  DRAFT
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

const NODE = 'PurchaseRequisitions'
const CHILD = 'PurchaseRequisitionItems'

// Shared by Add and Edit, which both provide pageState and both resolve SubmitOptions.
export function useRequisitionFormContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user } = useAuth()

  const parent = pageState?.useNode(NODE)

  const record = computed(() => parent?.record?.value || {})
  const progress = computed(() => progressOf(record.value))
  const editable = computed(() => !record.value.Code || isEditable(record.value))
  const isRevision = computed(() => isRevisionRequired(record.value))
  const isNew = computed(() => !record.value.Code)
  const isDraftState = computed(() => isNew.value || progress.value === DRAFT)

  const isDraft = computed(() => pageState?.getControls('isDraft', null, NODE) === true)
  const comment = computed(() => record.value.ProgressSubmittedComment || '')

  const items = computed(() => (parent?.children(CHILD)?.value || [])
    .filter((entry) => entry._action !== 'deactivate'))

  function setDraft (value) {
    pageState?.setControls('isDraft', value === true, NODE)
  }

  function setComment (value) {
    pageState?.setRecord('ProgressSubmittedComment', value, NODE)
  }

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    ui,
    user,
    parent,
    record,
    progress,
    editable,
    isRevision,
    isNew,
    isDraftState,
    isDraft,
    comment,
    items,
    setDraft,
    setComment
  }
}
