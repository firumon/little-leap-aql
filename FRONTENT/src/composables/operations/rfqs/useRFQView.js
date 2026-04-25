import { computed, ref, watch } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { parsePrItemCodeCsv } from './rfqPayload'

export function useRFQView() {
  const nav = useResourceNav()
  const { code } = useResourceConfig()
  const rfqResource = useResourceData(ref('RFQs'))

  const record = computed(() => rfqResource.items.value.find((row) => row.Code === code.value) || null)
  const itemCodes = computed(() => parsePrItemCodeCsv(record.value?.PurchaseRequisitionItemsCode))

  function formatDate(value) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function goToList() {
    nav.goTo('list')
  }

  watch(code, async () => {
    await rfqResource.reload()
  }, { immediate: true })

  return {
    loading: rfqResource.loading,
    record,
    itemCodes,
    formatDate,
    goToList
  }
}

