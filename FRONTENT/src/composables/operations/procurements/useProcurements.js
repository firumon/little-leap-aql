import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { todayIsoSlash } from 'src/utils/appHelpers'
import {
  buildPurchaseRequisitionFormData,
  buildPurchaseRequisitionPayload
} from 'src/composables/operations/purchaseRequisitions/purchaseRequisitionPayload'

const FALLBACK_PR_PROGRESS = [
  'Draft',
  'Pending Approval',
  'Revision Required',
  'Approved',
  'Rejected',
  'RFQ Processed'
]

const FALLBACK_PROCUREMENT_PROGRESS = [
  'INITIATED',
  'PR_CREATED',
  'PR_APPROVED',
  'RFQ_GENERATED',
  'RFQ_SENT_TO_SUPPLIERS',
  'QUOTATIONS_RECEIVED',
  'PO_ISSUED',
  'IN_TRANSIT',
  'ARRIVED_AT_PORT',
  'COMPLETED',
  'CANCELLED'
]

export function useProcurements() {
  const auth = useAuthStore()

  const purchaseRequisitionProgress = computed(() => {
    const values = auth.appOptionsMap.PurchaseRequisitionProgress
    return Array.isArray(values) && values.length ? values : FALLBACK_PR_PROGRESS
  })

  const procurementProgress = computed(() => {
    const values = auth.appOptionsMap.ProcurementProgress
    return Array.isArray(values) && values.length ? values : FALLBACK_PROCUREMENT_PROGRESS
  })

  const progress = computed(() => ({
    draft: purchaseRequisitionProgress.value.find((value) => value === 'Draft') || 'Draft',
    pendingApproval: purchaseRequisitionProgress.value.find((value) => value === 'Pending Approval') || 'Pending Approval',
    revisionRequired: purchaseRequisitionProgress.value.find((value) => value === 'Revision Required') || 'Revision Required',
    approved: purchaseRequisitionProgress.value.find((value) => value === 'Approved') || 'Approved',
    rejected: purchaseRequisitionProgress.value.find((value) => value === 'Rejected') || 'Rejected',
    rfqProcessed: purchaseRequisitionProgress.value.find((value) => value === 'RFQ Processed') || 'RFQ Processed'
  }))

  const procurementStage = computed(() => ({
    initiated: procurementProgress.value.find((value) => value === 'INITIATED') || 'INITIATED',
    prCreated: procurementProgress.value.find((value) => value === 'PR_CREATED') || 'PR_CREATED',
    prApproved: procurementProgress.value.find((value) => value === 'PR_APPROVED') || 'PR_APPROVED',
    rfqGenerated: procurementProgress.value.find((value) => value === 'RFQ_GENERATED') || 'RFQ_GENERATED',
    rfqSentToSuppliers: procurementProgress.value.find((value) => value === 'RFQ_SENT_TO_SUPPLIERS') || 'RFQ_SENT_TO_SUPPLIERS',
    cancelled: procurementProgress.value.find((value) => value === 'CANCELLED') || 'CANCELLED'
  }))

  function currentUserName() {
    return auth.user?.name || auth.user?.email || 'Unknown User'
  }

  function currentUserRole() {
    return auth.user?.role || auth.userRole || ''
  }

  function currentTimestampLabel(date = new Date()) {
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  function appendWorkflowComment(existingValue = '', comment = '', actorName = currentUserName(), date = new Date()) {
    const trimmedComment = (comment || '').toString().trim()
    if (!trimmedComment) {
      return (existingValue || '').toString().trim()
    }

    const nextEntry = `${actorName} wrote at ${currentTimestampLabel(date)}:\n${trimmedComment}`

    const base = (existingValue || '').toString().trim()
    return base ? `${base}\n\n${nextEntry}` : nextEntry
  }

  function formatWorkflowCommentHtml(value = '') {
    const text = (value || '').toString().trim()
    if (!text) return ''

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>')
  }

  function isDraftProgress(value) {
    return value === progress.value.draft
  }

  function isRevisionRequiredProgress(value) {
    return value === progress.value.revisionRequired
  }

  function isPendingApprovalProgress(value) {
    return value === progress.value.pendingApproval
  }

  function isEditableProgress(value) {
    return isDraftProgress(value) || isRevisionRequiredProgress(value)
  }

  function isReadOnlyProgress(value) {
    return [progress.value.approved, progress.value.rejected, progress.value.rfqProcessed].includes(value)
  }

  function resolveViewMode(value) {
    if (isEditableProgress(value)) return 'editable'
    if (isPendingApprovalProgress(value)) return 'review'
    return 'readonly'
  }

  function buildProcurementCreateRequest(prCode) {
    return {
      action: 'create',
      resource: 'Procurements',
      payload: {
        linkedPurchaseRequisitionCode: prCode,
        data: {
          Progress: procurementStage.value.prCreated,
          InitiatedDate: todayIsoSlash().replace(/\//g, '-'),
          CreatedUser: currentUserName(),
          CreatedRole: currentUserRole(),
          Status: 'Active'
        }
      }
    }
  }

  function buildProcurementUpdateRequest(procurementCode, nextProgress) {
    if (!procurementCode || !nextProgress) return null
    return {
      action: 'update',
      resource: 'Procurements',
      payload: {
        code: procurementCode,
        data: {
          Progress: nextProgress
        }
      }
    }
  }

  function buildEditableSubmitRequests({
    prCode,
    form,
    items = [],
    deletedItemCodes = []
  }) {
    const prRequest = {
      action: 'compositeSave',
      resource: 'PurchaseRequisitions',
      payload: buildPurchaseRequisitionPayload({
        prCode,
        form,
        targetProgress: progress.value.pendingApproval,
        items,
        deletedItemCodes,
        extraFields: {
          ProgressRevisionRequiredComment: form?.ProgressRevisionRequiredComment || '',
          ProgressRejectedComment: form?.ProgressRejectedComment || ''
        }
      })
    }

    const procurementRequest = form?.ProcurementCode
      ? buildProcurementUpdateRequest(form.ProcurementCode, procurementStage.value.prCreated)
      : buildProcurementCreateRequest(prCode)

    return {
      success: true,
      requests: procurementRequest ? [prRequest, procurementRequest] : [prRequest]
    }
  }

  function buildPendingApprovalRequests({
    prCode,
    form,
    action,
    comment = ''
  }) {
    const trimmedComment = (comment || '').trim()
    let nextPrProgress = ''
    let nextProcurementProgress = ''
    let extraFields = {}

    if (action === 'send-back') {
      if (!trimmedComment) {
        return { success: false, error: 'Comment is required to send the Purchase Requisition back for revision.' }
      }
      nextPrProgress = progress.value.revisionRequired
      nextProcurementProgress = procurementStage.value.initiated
      extraFields = {
        ProgressRevisionRequiredComment: appendWorkflowComment(
          form?.ProgressRevisionRequiredComment || '',
          trimmedComment
        )
      }
    } else if (action === 'approve') {
      nextPrProgress = progress.value.approved
      nextProcurementProgress = procurementStage.value.prApproved
      extraFields = {}
    } else if (action === 'reject') {
      if (!trimmedComment) {
        return { success: false, error: 'Comment is required to reject the Purchase Requisition.' }
      }
      nextPrProgress = progress.value.rejected
      nextProcurementProgress = procurementStage.value.cancelled
      extraFields = {
        ProgressRejectedComment: trimmedComment
      }
    } else {
      return { success: false, error: 'Unsupported Purchase Requisition review action.' }
    }

    const prUpdate = {
      action: 'update',
      resource: 'PurchaseRequisitions',
      payload: {
        code: prCode,
        data: buildPurchaseRequisitionFormData(form, {
          targetProgress: nextPrProgress,
          extraFields: {
            ProgressRevisionRequiredComment: form?.ProgressRevisionRequiredComment || '',
            ProgressRejectedComment: form?.ProgressRejectedComment || '',
            ...extraFields
          }
        })
      }
    }

    const procurementUpdate = buildProcurementUpdateRequest(form?.ProcurementCode, nextProcurementProgress)
    return {
      success: true,
      requests: procurementUpdate ? [prUpdate, procurementUpdate] : [prUpdate]
    }
  }

  return {
    purchaseRequisitionProgress,
    procurementProgress,
    progress,
    procurementStage,
    currentUserName,
    currentUserRole,
    currentTimestampLabel,
    appendWorkflowComment,
    formatWorkflowCommentHtml,
    isDraftProgress,
    isRevisionRequiredProgress,
    isPendingApprovalProgress,
    isEditableProgress,
    isReadOnlyProgress,
    resolveViewMode,
    buildEditableSubmitRequests,
    buildPendingApprovalRequests,
    buildProcurementCreateRequest,
    buildProcurementUpdateRequest
  }
}
