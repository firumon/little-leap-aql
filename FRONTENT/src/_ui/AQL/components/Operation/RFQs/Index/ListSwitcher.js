import { listSwitcherModifier } from 'src/_ui/AQL/composables/Operation/useListSwitcherGating'

// Drafts belong to whoever raises RFQs; the sent queue to whoever dispatches or closes.
export default listSwitcherModifier('RFQs', {
  Drafts: { any: ['create'] },
  Sent: { any: ['assignSupplier', 'markAsSent', 'close'] }
})
