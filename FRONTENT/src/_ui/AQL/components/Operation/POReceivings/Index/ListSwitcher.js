import { listSwitcherModifier } from 'src/_ui/AQL/composables/Operation/useListSwitcherGating'

// Drafts belong to the inspector; confirmed rows to whoever generates the GRN.
export default listSwitcherModifier('POReceivings', {
  Drafts: { any: ['create'] },
  Confirmed: { any: ['generateGRN'] }
})
