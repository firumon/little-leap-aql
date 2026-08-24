import { isEditable } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

// Edit Items is DRAFT-only. `show` is function-valued so it re-runs per render: a run that
// departs while the page is open loses the button without a reload.
export default {
  show: (record) => isEditable(record),
  label: 'Edit Items'
}
