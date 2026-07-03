import { computed, watch } from 'vue'
import { normalizeNumber, isQuotedItem } from './supplierQuotationPayload'
import { EXTRA_CHARGE_KEYS } from './supplierQuotationMeta'

export function useSupplierQuotationTotals({ form, items }) {
  const itemSubtotal = computed(() => {
    if (!items || !items.value) return 0
    return items.value.reduce((total, item) => {
      if (!isQuotedItem(item)) return total
      return total + normalizeNumber(item.TotalPrice)
    }, 0)
  })

  const extraChargesTotal = computed(() => {
    if (!form || !form.value || !form.value.ExtraChargesBreakup) return 0
    return EXTRA_CHARGE_KEYS.reduce((total, key) => {
      return total + normalizeNumber(form.value.ExtraChargesBreakup[key])
    }, 0)
  })

  const suggestedTotal = computed(() => {
    return itemSubtotal.value + extraChargesTotal.value
  })

  function syncItemTotal(item) {
    if (!item) return
    item.TotalPrice = normalizeNumber(item.Quantity) * normalizeNumber(item.UnitPrice)
  }

  function syncAllItemTotals() {
    if (!items || !items.value) return
    items.value.forEach(syncItemTotal)
  }

  // Keep per-item totals reactive
  watch(
    items,
    () => {
      syncAllItemTotals()
    },
    { deep: true, immediate: true }
  )

  // Keep grand total reactive
  watch(
    [suggestedTotal, () => form?.value?.ResponseType],
    ([newSuggested, type]) => {
      if (!form || !form.value) return
      if (type === 'DECLINED') {
        form.value.TotalAmount = 0
      } else {
        form.value.TotalAmount = newSuggested
      }
    },
    { immediate: true }
  )

  return {
    itemSubtotal,
    extraChargesTotal,
    suggestedTotal,
    syncItemTotal,
    syncAllItemTotals
  }
}
