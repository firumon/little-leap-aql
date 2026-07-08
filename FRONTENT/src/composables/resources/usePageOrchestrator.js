import { ref, computed, watch, reactive } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCompositeForm } from 'src/composables/resources/useCompositeForm'
import { useMasterActions } from 'src/composables/useMasterActions'
import { useOperationActions } from 'src/composables/useOperationActions'
import { useActionFields } from 'src/composables/resources/useActionFields'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { isActionVisible } from 'src/composables/resources/useResourceConfig'

export function usePageOrchestrator(resConfig, canonicalPage) {
  const nav = useResourceNav()
  const resourceRecord = useRecord()

  const {
    scope,
    code,
    pageSlug,
    config,
    resourceName,
    resourceHeaders,
    additionalActions
  } = resConfig

  const { record, loading, reload, loadRelations, childRecordsByResource } = resourceRecord

  // Form logic setup
  const {
    parentForm, childGroups, saving,
    initializeForCreate, initializeForEdit, addChildRecord, removeChildRecord,
    updateChildField, save
  } = useCompositeForm(config)

  async function loadAndInitializeEdit() {
    await reload()
    if (!record.value) return
    await loadRelations()
    initializeForEdit(record.value, childRecordsByResource.value)
  }

  // Reactively load records/relations depending on page view context
  watch(
    () => [resourceName.value, code.value, canonicalPage.value],
    async ([newName, newCode, pageVal]) => {
      if (!newName) return
      if (pageVal === 'index') {
        await reload()
      } else if (pageVal === 'view') {
        await reload()
        if (record.value) {
          await loadRelations()
        }
      } else if (pageVal === 'edit' && newCode) {
        await loadAndInitializeEdit()
      } else if (pageVal === 'action') {
        await reload()
      } else if (pageVal === 'add') {
        initializeForCreate()
      }
    },
    { immediate: true }
  )

  async function handleSave() {
    const response = await save()
    if (response.success) {
      if (canonicalPage.value === 'edit') {
        nav.goTo('view')
      } else {
        const newCode = response.data?.code || response.data?.parentCode
        if (newCode) {
          nav.goTo('view', { code: newCode })
        } else {
          nav.goTo('index')
        }
      }
    }
  }

  function navigateBack() {
    if (canonicalPage.value === 'edit') {
      nav.goTo('view')
    } else {
      nav.goTo('index')
    }
  }

  // Action execution specific logic setup
  const isOps = computed(() => scope.value?.toLowerCase()?.startsWith('operation'))
  const masterActions = useMasterActions()
  const operationActions = useOperationActions()

  const actionsStore = computed(() => isOps.value ? operationActions : masterActions)
  const submitting = computed(() => actionsStore.value.submitting.value)

  const actionName = computed(() => pageSlug.value || canonicalPage.value || '')

  const currentActionConfig = computed(() => {
    return additionalActions.value.find(
      (a) => a.action.toLowerCase() === actionName.value.toLowerCase() && a.kind !== 'navigate'
    ) || null
  })

  const selectedOutcome = ref('')
  const actionForm = reactive({})
  const {
    column, isMultiOutcome: isMockMultiOutcome, outcomeOptions, resolvedFields: resolvedActionFields
  } = useActionFields(resourceHeaders, currentActionConfig, () => selectedOutcome.value)

  const actionAllowedForRecord = computed(() =>
    !currentActionConfig.value || isActionVisible(currentActionConfig.value, record.value)
  )

  watch(currentActionConfig, (cfg) => {
    selectedOutcome.value = cfg?.columnValue || ''
  }, { immediate: true })

  watch(resolvedActionFields, (fields) => {
    Object.keys(actionForm).forEach((k) => delete actionForm[k])
    fields.forEach((f) => { actionForm[f.header] = '' })
  }, { immediate: true })

  async function handleSubmit() {
    await actionsStore.value.submitAction({
      resourceName: resourceName.value,
      code: code.value,
      actionConfig: {
        ...currentActionConfig.value,
        column: column.value,
        columnValue: selectedOutcome.value
      },
      selectedOutcome: selectedOutcome.value,
      fields: { ...actionForm },
      resolvedFields: resolvedActionFields.value,
      onSuccess: async () => nav.goTo('view')
    })
  }

  function navigateToView() {
    nav.goTo('view')
  }

  return {
    resourceRecord,
    parentForm,
    childGroups,
    saving,
    actionForm,
    selectedOutcome,
    currentActionConfig,
    actionAllowedForRecord,
    actionName,
    isMockMultiOutcome,
    outcomeOptions,
    resolvedActionFields,
    submitting,
    handleSave,
    navigateBack,
    handleSubmit,
    navigateToView,
    addChildRecord,
    removeChildRecord,
    updateChildField
  }
}
