import { ref, computed, watch, reactive } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useActionFields } from 'src/composables/resources/useActionFields'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { isActionVisible } from 'src/composables/resources/useResourceConfig'

// Record loading, action-page field resolution, and navigation. Add/Edit form
// state and submission are owned by pageState (usePageState.js) + the
// Create/Update content components + PageAction.vue — see PAGE_STATE.md.
export function usePageOrchestrator(resConfig, canonicalPage) {
  const nav = useResourceNav()
  const resourceRecord = useRecord()
  const { code, pageSlug } = useRouteConfig()

  const {
    resourceName,
    resourceHeaders,
    additionalActions
  } = resConfig

  const { record, loading, reload, loadRelations } = resourceRecord

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
        await reload()
      } else if (pageVal === 'action') {
        await reload()
      }
    },
    { immediate: true }
  )

  function navigateBack() {
    if (canonicalPage.value === 'edit') {
      nav.goTo('view')
    } else {
      nav.goTo('index')
    }
  }

  // Action-page field resolution — dispatch itself is owned by PageAction.vue
  // (pageState.run/executeAction, see submitAction() there).
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

  function navigateToView() {
    nav.goTo('view')
  }

  return {
    resourceRecord,
    actionForm,
    selectedOutcome,
    currentActionConfig,
    actionAllowedForRecord,
    actionName,
    column,
    isMockMultiOutcome,
    outcomeOptions,
    resolvedActionFields,
    navigateBack,
    navigateToView
  }
}
