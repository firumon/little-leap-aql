import { useOutletIndex } from 'src/_resource/Master/Outlets/composables/useOutletIndex'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

/**
 * Outlets › Operation Hub › DistributionBars — JS modifier (tier CP: resource + page).
 *
 * Where the estate actually is, across the three location levels the Outlets sheet records.
 * Province leads because it is the coarsest and therefore the one that always has bars; a
 * tenant that fills only `City` gets a City tab and nothing else, because the base drops any
 * group whose bars are all empty rather than offering a tab that opens onto nothing.
 *
 * The card shell is relayed from the UI's own tokens (§10.1) — the framework base
 * deliberately ships no shell of its own, so this is where AQL's is supplied. A JS modifier
 * may import a UI Composable; only `.vue` components are barred from reaching the config
 * directly (§6.1).
 *
 * `items` is a GETTER for the reason every widget's is: a modifier resolves once and caches,
 * so a plain array would latch the empty first tick (§9.2 rule 1).
 */
export default function () {
  const ui = useAQLConfig()

  return {
    title: 'Location Coverage',
    cardClass: ui.cardClass,
    rowStaggerMs: ui.rowStaggerMs,

    items: () => {
      const { geography } = useOutletIndex()
      const { province, city, area } = geography.value

      // Nothing to draw at all — no outlet carries a single location value. The base hides
      // itself on an empty array, so the page shows the metric card and moves straight on.
      if (!province.length && !city.length && !area.length) return []

      return [
        { key: 'province', label: 'Province', items: province },
        { key: 'city', label: 'City', items: city },
        { key: 'area', label: 'Area', items: area }
      ]
    }
  }
}
