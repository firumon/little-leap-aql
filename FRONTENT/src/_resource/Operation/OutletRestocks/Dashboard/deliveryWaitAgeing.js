/**
 * Approved restocks not fully delivered, split by time since approval.
 *
 * Answers: How long have outlets waited for approved stock?
 *
 * Uses:
 *   - useRestockDeliveryData: deliveryWait, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockDeliveryData from '../Data/useRestockDeliveryData'

export default (props) => {
  const d = useRestockDeliveryData()

  return {
    widget: 'DebtAgeing',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletRestocks: 'Read' },
    title: 'Delivery wait',
    caption: 'Time since approved',
    data: computed(() => ({
      items: d.deliveryWait.value,
      empty: !d.deliveryWait.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
