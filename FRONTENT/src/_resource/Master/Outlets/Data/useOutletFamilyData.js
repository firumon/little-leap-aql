/**
 * Mother companies family aggregations, billing rankings, and outstanding balances.
 *
 * Reads:
 *   Outlets: through useOutletIndex (motherOutlets, familyCodesFor, childOutletsFor)
 *   OutletConsumptionInvoices: through useInvoiceData (invoicedByOutletCode, range, controls, loading)
 *   OutletPayments: through useOutletPaymentIndex (views.Outlets)
 *
 * Exposes:
 *   loading                       - true while underlying invoice data is loading
 *   motherCompanies               - array of mother company objects with family totals
 *   topMotherCompaniesInvoiced    - top 8 mother companies by invoiced money in range
 *   topMotherCompaniesOutstanding - top 8 mother companies by total outstanding balance
 *   range                         - active range ref from useInvoiceData
 *   controls                      - active controls array from useInvoiceData
 *
 * Controls:
 *   range: delegated from useInvoiceData
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useOutletIndex } from '../composables/useOutletIndex'
import useInvoiceData from 'src/_resource/Operation/OutletConsumptionInvoices/Data/useInvoiceData'
import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'

export default function useOutletFamilyData () {
  const { remember } = useRecord()

  return remember('useOutletFamilyData', () => {
    const { motherOutlets, familyCodesFor } = useOutletIndex()
    const invoiceData = useInvoiceData()
    const { views } = useOutletPaymentIndex()

    const loading = invoiceData.loading
    const range = invoiceData.range
    const controls = invoiceData.controls

    const topMotherCompaniesInvoiced = computed(() => {
      const codeMap = invoiceData.invoicedByOutletCode.value || new Map()

      return motherOutlets.value
        .map((mother) => {
          const codes = familyCodesFor(mother.Code || mother.code)
          let total = 0
          for (const c of codes) {
            total += codeMap.get(c) || 0
          }
          return {
            label: mother.Name || mother.name || mother.Code || mother.code,
            value: Number(total.toFixed(2)),
            caption: `${codes.length - 1} sub-outlets`
          }
        })
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    })

    const topMotherCompaniesOutstanding = computed(() => {
      const balanceByCode = new Map(
        (views.Outlets.value || []).map((row) => [row.code, row.totalBalance || 0])
      )

      return motherOutlets.value
        .map((mother) => {
          const codes = familyCodesFor(mother.Code || mother.code)
          let balance = 0
          for (const c of codes) {
            balance += balanceByCode.get(c) || 0
          }
          return {
            label: mother.Name || mother.name || mother.Code || mother.code,
            value: Number(balance.toFixed(2)),
            caption: `${codes.length - 1} sub-outlets`
          }
        })
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    })

    return {
      loading,
      motherCompanies: motherOutlets,
      topMotherCompaniesInvoiced,
      topMotherCompaniesOutstanding,
      range,
      controls
    }
  })
}
