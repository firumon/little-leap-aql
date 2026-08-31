import { listSwitcherModifier } from 'src/_ui/AQL/composables/Operation/useListSwitcherGating'

// The received queue belongs to whoever decides on quotations.
export default listSwitcherModifier('SupplierQuotations', {
  Received: { any: ['reject', 'create'] }
})
