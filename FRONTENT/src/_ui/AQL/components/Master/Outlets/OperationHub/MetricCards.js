import { useOutletIndex } from 'src/_resource/Master/Outlets/composables/useOutletIndex'

/**
 * Outlets › Operation Hub › MetricCards — JS modifier (tier CP: resource + page).
 *
 * The page's opening statement: how big is the estate. One card, so `MetricCards` spans it
 * `col-12` by its own count-driven grid — which is the full-width treatment this page's brief
 * asks for, obtained from the base rather than from a bespoke layout.
 *
 * ── NO `unit` STRING ──
 * The card is a label and a number, nothing else. A subtitle beside the figure ("all
 * registered", "of 139 registered") competes with the figure for the reader's eye and turns
 * a scannable row of counts into a row of sentences. Where the registered total genuinely
 * matters it is already on screen as the DENOMINATOR of the activity bar further down, which
 * is the one place a second number belongs.
 *
 * Returns `[]` on a tenant with no outlets at all, which trips the section's strict hide rule
 * and removes it from the page (§9.2 rule 2). `items` is a GETTER: a modifier's return is
 * resolved once and cached, so a plain array would freeze at whatever the store held on the
 * first tick — usually empty, since sections resolve before the fetch settles.
 */
export default function () {
  return {
    items: () => {
      const { totalsMetrics } = useOutletIndex()
      const totals = totalsMetrics.value

      if (!totals.total) return []

      return [
        {
          label: 'Active Outlets',
          number: totals.active,
          color: totals.active > 0 ? 'primary' : 'grey-6'
        }
      ]
    }
  }
}
