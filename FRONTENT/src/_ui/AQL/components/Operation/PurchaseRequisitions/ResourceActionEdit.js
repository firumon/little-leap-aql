import { useAuth } from 'src/composables/core/useAuth'
import { requisitionEditableProgress } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

// State and ownership, both required. A blank on either side fails closed.
const { user } = useAuth()

const text = (value) => String(value ?? '').trim()

export default {
  show: (record) => {
    if (!requisitionEditableProgress(record?.Progress)) return false
    const owner = text(record?.CreatedBy)
    const me = text(user.value?.id)
    return !!owner && !!me && owner === me
  },
  label: 'Edit Requisition'
}
