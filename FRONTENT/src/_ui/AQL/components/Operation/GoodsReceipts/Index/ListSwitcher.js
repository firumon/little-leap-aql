import { listSwitcherModifier } from 'src/_ui/AQL/composables/Operation/useListSwitcherGating'

// The invalidated view is only useful to whoever can invalidate a receipt.
export default listSwitcherModifier('GoodsReceipts', {
  Invalidated: { any: ['invalidate'] }
})
