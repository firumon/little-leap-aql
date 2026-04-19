import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useProductVariants, hasDuplicateVariantSet, validateSkuVariants } from 'src/composables/masters/products/useProductVariants'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useCompositeForm } from 'src/composables/resources/useCompositeForm'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

export function useProductEditForm() {
  const $q = useQuasar()
  const nav = useResourceNav()
  const { code, config, resourceName } = useResourceConfig()
  const { items, loading: resourceLoading, reload, updateLocalRecord } = useResourceData(resourceName)
  const skusResource = useResourceData(ref('SKUs'))
  const {
    parentForm,
    childGroups,
    saving,
    statusOptions,
    initializeForEdit,
    addChildRecord,
    removeChildRecord,
    updateChildField,
    save
  } = useCompositeForm(config)

  const initLoading = ref(false)
  const newVariantType = ref('')
  const record = computed(() => {
    if (!code.value || !Array.isArray(items.value)) return null
    return items.value.find((row) => row.Code === code.value) || null
  })

  const { variantColumns } = useProductVariants(parentForm)
  const skuGroup = computed(() => childGroups.value.find((group) => group.resource?.name === 'SKUs') || null)
  const skuRecords = computed(() => skuGroup.value?.records || [])
  const variantTypeList = computed(() => {
    const raw = (parentForm.value?.VariantTypes || '').toString().trim()
    if (!raw) return []
    return raw.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 5)
  })
  const activeSkuRecords = computed(() => skuRecords.value.filter((row) => row._action !== 'deactivate' && (row.data?.Status || 'Active') !== 'Inactive'))
  const duplicateIssue = computed(() => hasDuplicateVariantSet(activeSkuRecords.value, variantColumns.value))
  const skuColumns = computed(() => [
    { name: 'Code', label: 'SKU Code', field: 'Code', align: 'left' },
    ...variantColumns.value.map((variant) => ({ name: variant.key, label: variant.label, field: variant.key, align: 'left' })),
    { name: 'Status', label: 'Status', field: 'Status', align: 'left' },
    { name: 'actions', label: '', field: 'actions', align: 'right' }
  ])
  const loading = computed(() => resourceLoading.value || initLoading.value)

  function ensureSkuRecordDefaults(recordRow) {
    if (!recordRow || !recordRow.data) return
    if (recordRow.data.Code === undefined || recordRow.data.Code === null) recordRow.data.Code = ''
    if (recordRow.data.ProductCode === undefined || recordRow.data.ProductCode === null) recordRow.data.ProductCode = code.value || ''
    if (!recordRow.data.Status) recordRow.data.Status = 'Active'
    for (let i = 1; i <= 5; i += 1) {
      const key = `Variant${i}`
      if (recordRow.data[key] === undefined || recordRow.data[key] === null) recordRow.data[key] = ''
    }
  }

  function relaxSkuSystemFieldValidation() {
    if (!skuGroup.value || !Array.isArray(skuGroup.value.resolvedFields)) return
    skuGroup.value.resolvedFields = skuGroup.value.resolvedFields.map((field) => {
      if (field.header === 'ProductCode' || field.header === 'ParentCode') {
        return { ...field, required: false }
      }
      return field
    })
  }

  function ensureSkuParentLinkBeforeSave() {
    skuRecords.value.forEach((row) => {
      if (!row?.data || row._action === 'deactivate') return
      row.data.ProductCode = code.value || row.data.ProductCode || ''
    })
  }

  function setVariantTypeList(nextList) {
    const normalized = nextList.map((entry) => (entry || '').toString().trim()).filter(Boolean).slice(0, 5)
    parentForm.value.VariantTypes = normalized.join(',')
  }

  function addVariantType() {
    const next = newVariantType.value.trim()
    if (!next) return
    if (variantTypeList.value.length >= 5) {
      $q.notify({ type: 'warning', message: 'Maximum 5 variant types allowed.', timeout: 2200 })
      return
    }
    const exists = variantTypeList.value.some((item) => item.toLowerCase() === next.toLowerCase())
    if (exists) {
      $q.notify({ type: 'warning', message: 'Variant type already exists.', timeout: 2200 })
      return
    }
    setVariantTypeList([...variantTypeList.value, next])
    newVariantType.value = ''
  }

  function applyVariantRemovalToRows(removedIndex) {
    const start = removedIndex + 1
    skuRecords.value.forEach((row) => {
      for (let i = start; i < 5; i += 1) {
        const currentKey = `Variant${i}`
        const nextKey = `Variant${i + 1}`
        row.data[currentKey] = row.data[nextKey] || ''
      }
      row.data.Variant5 = ''
    })
  }

  function confirmRemoveVariantType(index) {
    const current = [...variantTypeList.value]
    if (!current[index]) return
    const removedLabel = current[index]

    $q.dialog({
      title: 'Remove Variant Type',
      message: `Removing "${removedLabel}" will update existing SKU variant columns. Continue?`,
      cancel: true,
      persistent: true
    }).onOk(() => {
      current.splice(index, 1)
      setVariantTypeList(current)
      applyVariantRemovalToRows(index)
    })
  }

  function addSkuRow() {
    addChildRecord('SKUs')
    ensureSkuRecordDefaults(skuRecords.value[skuRecords.value.length - 1])
  }

  function removeSkuRow(index) {
    removeChildRecord('SKUs', index)
  }

  function restoreSkuRow(index) {
    const row = skuRecords.value[index]
    if (!row) return
    row._action = row.data?.Code ? 'update' : 'create'
    row.data.Status = 'Active'
  }

  function updateSkuField(index, field, value) {
    updateChildField('SKUs', index, field, value)
  }

  function isRowInactive(row) {
    return row?._action === 'deactivate' || (row?.data?.Status || 'Active') === 'Inactive'
  }

  async function loadAndInitialize(forceSync = false) {
    if (!resourceName.value || !code.value) return
    initLoading.value = true
    try {
      await reload(forceSync)
      await skusResource.reload(forceSync)
      if (!record.value) return
      const skuRows = skusResource.items.value.filter((row) => row.ProductCode === code.value)
      initializeForEdit(record.value, { SKUs: skuRows })
      relaxSkuSystemFieldValidation()
      skuRecords.value.forEach((row) => ensureSkuRecordDefaults(row))
    } finally {
      initLoading.value = false
    }
  }

  function validateBeforeSave() {
    const productName = (parentForm.value?.Name || '').toString().trim()
    if (!productName) {
      $q.notify({ type: 'negative', message: 'Product Name is required.', timeout: 2200 })
      return false
    }

    for (let i = 0; i < activeSkuRecords.value.length; i += 1) {
      const row = activeSkuRecords.value[i]
      const error = validateSkuVariants(row, variantColumns.value)
      if (error) {
        $q.notify({ type: 'negative', message: `SKU row ${i + 1}: ${error}`, timeout: 2500 })
        return false
      }
    }

    const duplicate = hasDuplicateVariantSet(activeSkuRecords.value, variantColumns.value)
    if (duplicate) {
      $q.notify({ type: 'negative', message: `Duplicate variant set found in rows ${duplicate.row1} and ${duplicate.row2}.`, timeout: 2600 })
      return false
    }
    return true
  }

  async function handleSave() {
    relaxSkuSystemFieldValidation()
    ensureSkuParentLinkBeforeSave()
    if (!validateBeforeSave()) return
    const response = await save()
    if (response.success) {
      await updateLocalRecord({ ...parentForm.value, Code: code.value })
      const skuRowsToUpdate = skuRecords.value.filter((row) => row?.data?.Code).map((row) => row.data)
      for (const sku of skuRowsToUpdate) {
        await skusResource.updateLocalRecord(sku)
      }
      nav.goTo('view')
    }
  }

  function navigateBack() {
    nav.goTo('view')
  }

  function navigateToList() {
    nav.goTo('list')
  }

  watch(() => [resourceName.value, code.value], async ([name, currentCode]) => {
    if (!name || !currentCode) return
    await loadAndInitialize()
  }, { immediate: true })

  return {
    code,
    parentForm,
    saving,
    statusOptions,
    newVariantType,
    record,
    variantColumns,
    skuRecords,
    variantTypeList,
    duplicateIssue,
    skuColumns,
    loading,
    addVariantType,
    confirmRemoveVariantType,
    addSkuRow,
    removeSkuRow,
    restoreSkuRow,
    updateSkuField,
    isRowInactive,
    handleSave,
    navigateBack,
    navigateToList
  }
}

