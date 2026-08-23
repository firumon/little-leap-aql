import {
  buildInvoiceUpdateRequests,
  editableInvoiceItems,
  makeStoredPriceResolver
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { makeLineTaxResolver } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import { canEditInvoice } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'
import { taxTransactionRowsOf } from 'src/_resource/Accounts/TaxTransactions/composables/useTaxTransactionPayload'

/**
 * OutletConsumptionInvoices › Edit › PageAction — JS modifier (tier CP: resource + page).
 *
 *   single step   correct the bill   →   [ Cancel ] [ Save Invoice ]
 *
 * ── A THIN ADAPTER, NOTHING MORE (UI_RESOURCE_DOMAIN_LOGIC.md §9.1) ──
 * `submit` collects the page's answers and hands them to `buildInvoiceUpdateRequests`. It
 * performs NO arithmetic and builds NO rows: which totals the header carries, which lines
 * changed enough to be worth writing, and what the fallbacks are when an answer was never
 * typed are all decided in Layer 2 — by the same functions the summary card renders from, so
 * the figures on screen and the figures in the batch are one calculation (Zero UI Schema
 * Invention).
 *
 * ── THE SUBMIT VETOES FOR THREE REASONS ──
 *   1. STALENESS — `canEditInvoice`, re-checked because time has passed: a payment may have
 *      landed while this page was open. The same predicate drives the Edit FAB and the lock
 *      banner, so the button, the banner and the gate cannot disagree (§8.6).
 *   2. VALIDITY — the builder's own rules, reported through its own message, never restated
 *      here (§8.5 step 3).
 *   3. PERMISSION — gated on what the builder DECLARES, which asks for the item privilege
 *      only when a line is actually being rewritten (§8.5 step 4).
 *
 * It re-reads the control fields rather than importing the page context, because a
 * `PageAction.js` runs OUTSIDE any component `setup()` and cannot call the `inject()` the
 * context composable owns. It receives `pageState` and `resourceRecord` as parameters
 * instead, which is the documented exemption (§6).
 */

const NODE = 'InvoiceEdit'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  /**
   * Register the page's form node.
   *
   * This page writes no record through `pageState` — every answer is a control field and the
   * requests are built in Layer 2 — but the node still has to EXIST, because the sticky
   * form-actions bar mounts against it and renders nothing without one.
   */
  pageState.useNode('OutletConsumptionInvoices')

  const record = () => resourceRecord?.record?.value || {}

  /**
   * Answers typed against a DIFFERENT invoice are ignored — the control node outlives a route
   * change from one invoice's Edit page to another's, and applying stale prices to a second
   * bill would be a real accounting error. The same `EditFor` guard the context reads.
   */
  const field = (header) => {
    if (text(pageState.getControlField(NODE, 'EditFor')) !== text(record().Code)) return undefined
    return pageState.getControlField(NODE, header)
  }

  const overrides = () => {
    const value = field('PriceOverrides')
    return value && typeof value === 'object' ? value : {}
  }

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Save Invoice',

    // Leaving abandons unsaved corrections, so go to the invoice rather than `goBack()` —
    // the user may have arrived from a list row. Returning false stops the built-in
    // goBack() popping a second history entry.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = record()
      if (!text(row.Code)) return { valid: false, message: 'This invoice could not be loaded.' }

      if (!canEditInvoice(row)) {
        return { valid: false, message: 'This invoice can no longer be edited — it has taken a payment or come to rest.' }
      }

      const items = editableInvoiceItems(row)
      const priceOverrides = overrides()
      const issuedPriceListCode = text(row.PriceListCode)
      // Blank until the user picks one; Layer 2 falls back to the issued list.
      const priceListCode = text(field('PriceListCode')) || issuedPriceListCode

      const result = buildInvoiceUpdateRequests({
        record: row,
        items,
        dueDate: field('DueDate'),
        discountType: field('DiscountType'),
        discountValue: field('DiscountValue'),
        priceListCode,
        priceOverrides,
        /**
         * The invoice's CURRENT tax-ledger rows, so Layer 2 can retire them and write the new
         * figures in the same batch. Read through the accounts domain's own setup-free
         * accessor — a `PageAction.js` runs outside any component setup and cannot call
         * `useRecord`. The Edit page context loads the resource so these are in cache; with an
         * empty cache the builder is handed `[]` and correctly writes a fresh set rather than
         * silently leaving a stale one behind.
         */
        taxTransactionRows: taxTransactionRowsOf('OutletConsumptionInvoices', text(row.Code)),
        // The SAME resolver the summary displayed, built from the same price resolver — so
        // the tax the user agreed to and the tax the sheet stores are one calculation.
        calculateLineTax: makeLineTaxResolver({
          priceListCode,
          resolvePrice: makeStoredPriceResolver(items, priceOverrides, {
            priceListCode,
            issuedPriceListCode
          })
        })
      })

      if (!result.valid) return { valid: false, message: result.message }
      if (resourceConfig?.allowed(result.permissions) !== true) {
        return { valid: false, message: 'You are not allowed to change this invoice.' }
      }

      return { requests: result.requests, successMsg: result.successMsg }
    },

    /**
     * Back to the invoice once it is saved.
     *
     * No `onSuccess` is returned with the requests, deliberately: `PageAction.vue` installs
     * its own only when the handler supplies none, and that default is what resets the form
     * state AND performs this navigation. Returning one silently replaced both, leaving the
     * user sitting on the Edit page with no sign the save had landed.
     */
    successRoute: 'view'
  }
}
