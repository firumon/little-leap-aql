import { listSwitcherModifier } from 'src/_ui/AQL/composables/Operation/useListSwitcherGating'

// Open orders belong to whoever chases suppliers; the receiving queue to the warehouse.
export default listSwitcherModifier('PurchaseOrders', {
  Open: { any: ['send', 'acknowledge', 'accept', 'cancel'] },
  Receiving: { any: ['accept'] }
})
