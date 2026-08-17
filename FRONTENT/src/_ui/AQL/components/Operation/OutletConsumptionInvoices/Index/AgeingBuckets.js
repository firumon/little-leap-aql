import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'

/**
 * OutletConsumptionInvoices › Index › AgeingBuckets — JS modifier (tier CP: resource + page).
 *
 * How the receivable book is SPREAD, in three bands derived at runtime from the observed
 * ages of the open invoices themselves.
 *
 * ── WHY THE BANDS ARE NOT 30/60/90 ──
 * A fixed table only works for a business whose terms match it. A tenant invoicing weekly
 * would see every invoice in the first band and learn nothing; a tenant on 120-day terms
 * would see everything in the last and conclude it was in crisis. `distributionTiers` splits
 * the observed min→max span into equal thirds instead, so the shape of the book is legible
 * whatever the trading rhythm — and the bands re-scale on their own as the book changes.
 *
 * Returns `[]` when there are fewer than two distinct ages, which trips the section's strict
 * hide rule and removes it from the page. One outstanding invoice is not a distribution, and
 * three bands with everything piled in one is noise dressed as insight.
 *
 * `items` is function-valued and the composable is called inside the closure — see
 * `MetricCards.js` for why both are necessary.
 */
export default function () {
  return {
    title: 'Outstanding by Age',
    items: () => {
      const { ageingBuckets } = useInvoiceIndex()
      // Colour is PRESENTATION and is assigned here, by position, rather than in Layer 2 —
      // the domain knows how the book is spread, not which of three bands should read as a
      // warning. `caption` already carries the band's own day range, computed alongside the
      // band it describes so the label and the range cannot drift.
      const colors = ['positive', 'warning', 'negative']
      return ageingBuckets.value.map((bucket, index) => ({
        label: bucket.label,
        caption: bucket.caption,
        color: colors[index] || 'primary',
        count: bucket.count
      }))
    }
  }
}

