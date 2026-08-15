import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'

// Pure UOM enrichment function
export const enrichUom = (uom, allUomsMap = new Map()) => {
  if (!uom || !uom.Code) return null
  const baseUomCode = uom.BaseUOM || uom.Code
  const baseUomRecord = allUomsMap.get(baseUomCode) || null
  const conversionFactor = Number(uom.ConversionFactor) || 1

  return {
    code: uom.Code,
    name: uom.Name || '',
    baseUom: baseUomCode,
    baseUomName: baseUomRecord?.Name || uom.Name || '',
    conversionFactor,
    isBaseUom: !uom.BaseUOM || uom.BaseUOM === uom.Code || conversionFactor === 1,
    status: uom.Status || 'Active',
    createdAt: uom.CreatedAt || '',
    updatedAt: uom.UpdatedAt || '',
    createdBy: uom.CreatedBy || '',
    updatedBy: uom.UpdatedBy || '',
    _raw: uom
  }
}

// Composable for UOM master resource//
// ONCE PER APP (CORE_ARCHITECTURE_RULES §6) — see `useSkuResource` for the rationale.
const shared = defineSharedComposable((dataStore) => {

  const uoms = computed(() => {
    const rawUoms = dataStore.getRecords('UOMs') || []
    const uomsMap = new Map(rawUoms.map((u) => [u.Code, u]))
    return rawUoms.map((u) => enrichUom(u, uomsMap)).filter(Boolean)
  })

  const activeUoms = computed(() => uoms.value.filter((u) => u.status === 'Active'))

  const uomMap = computed(() => new Map(uoms.value.map((u) => [u.code, u])))

  const getUom = (code) => {
    if (!code) return null
    return uomMap.value.get(code) || null
  }

  // Converts quantity between two UOMs that share the same BaseUOM
  const convertQuantity = (qty, fromCode, toCode) => {
    const numQty = Number(qty) || 0
    if (!fromCode || !toCode || fromCode === toCode) return numQty
    const fromUom = getUom(fromCode)
    const toUom = getUom(toCode)
    if (!fromUom || !toUom) return numQty
    if (fromUom.baseUom !== toUom.baseUom) return numQty
    const inBase = numQty * fromUom.conversionFactor
    return inBase / toUom.conversionFactor
  }

  return {
    uoms,
    allUoms: uoms,
    activeUoms,
    uomMap,
    getUom,
    convertQuantity
  }
})

export function useUomResource() {
  return shared(useDataStore())
}
