import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useProductVariants, hasDuplicateVariantSet, validateSkuVariants } from 'src/composables/masters/products/useProductVariants'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useCompositeForm } from 'src/composables/resources/useCompositeForm'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

export function useProductCreateForm() {
  const nav = useResourceNav()
  const $q = useQuasar()
  const { config } = useResourceConfig()
  const {
    parentForm,
    childGroups,
    saving,
    statusOptions,
    initializeForCreate,
    addChildRecord,
    removeChildRecord,
    updateChildField,
    save
  } = useCompositeForm(config)

  const newVariantType = ref('')
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

  function removeVariantType(index) {
    const next = [...variantTypeList.value]
    next.splice(index, 1)
    setVariantTypeList(next)
  }

  function ensureSkuRecordDefaults(record) {
    if (!record || !record.data) return
    if (record.data.Code === undefined || record.data.Code === null) record.data.Code = ''
    if (record.data.ProductCode === undefined || record.data.ProductCode === null) record.data.ProductCode = ''
    if (!record.data.Status) record.data.Status = 'Active'
    for (let i = 1; i <= 5; i += 1) {
      const key = `Variant${i}`
      if (record.data[key] === undefined || record.data[key] === null) record.data[key] = ''
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

  function addSkuRow() {
    addChildRecord('SKUs')
    const lastRow = skuRecords.value[skuRecords.value.length - 1]
    ensureSkuRecordDefaults(lastRow)
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
    if (!validateBeforeSave()) return
    const response = await save()
    if (response.success) {
      const newCode = response.data?.code || response.data?.parentCode
      if (newCode) {
        nav.goTo('view', { code: newCode })
      } else {
        nav.goTo('list')
      }
    }
  }

  function navigateBack() {
    nav.goTo('list')
  }

  onMounted(() => {
    initializeForCreate()
    parentForm.value.Status = parentForm.value.Status || 'Active'
    parentForm.value.VariantTypes = parentForm.value.VariantTypes || ''
    relaxSkuSystemFieldValidation()
  })

  watch(() => skuRecords.value.length, () => {
    relaxSkuSystemFieldValidation()
    skuRecords.value.forEach((row) => ensureSkuRecordDefaults(row))
  }, { immediate: true })

  return {
    parentForm,
    saving,
    statusOptions,
    newVariantType,
    variantTypeList,
    variantColumns,
    skuRecords,
    skuColumns,
    duplicateIssue,
    addVariantType,
    removeVariantType,
    addSkuRow,
    removeSkuRow,
    restoreSkuRow,
    updateSkuField,
    isRowInactive,
    handleSave,
    navigateBack
  }
}

