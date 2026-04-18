<template>
  <div class="action-page">
    <!-- Wait for section resolution -->
    <component v-if="!sectionsReady" :is="fallbackLoading" />

    <!-- Loading record -->
    <component v-else-if="loading" :is="sections.Loading" />

    <!-- Record not found -->
    <component
      v-else-if="!record"
      :is="sections.Empty"
      icon="search_off"
      message="Record not found"
      back-label="Back to List"
      @back="navigateToList"
    />

    <!-- Action not configured -->
    <component
      v-else-if="!currentActionConfig"
      :is="sections.Empty"
      icon="block"
      :message="`Action &quot;${actionName}&quot; is not configured`"
      back-label="Back"
      @back="navigateToView"
    />

    <!-- Action not available for this record (visibleWhen failed) -->
    <component
      v-else-if="!actionAllowedForRecord"
      :is="sections.Empty"
      icon="block"
      :message="`Action &quot;${currentActionConfig.label || actionName}&quot; is not available for this record in its current state`"
      back-label="Back"
      @back="navigateToView"
    />

    <!-- Action form -->
    <template v-else>
      <component
        :is="sections.Header"
        :action-config="currentActionConfig"
        :action-name="actionName"
        :record="record"
      />

      <component
        :is="sections.Form"
        :is-multi-outcome="isMultiOutcome"
        :outcome-options="outcomeOptions"
        :selected-outcome="selectedOutcome"
        :resolved-action-fields="resolvedActionFields"
        :action-form="actionForm"
        @update:selected-outcome="selectedOutcome = $event"
        @update:action-field="(header, val) => { actionForm[header] = val }"
      />

      <component
        :is="sections.Actions"
        :action-label="currentActionConfig.label || actionName"
        :action-icon="currentActionConfig.icon || 'check'"
        :action-color="currentActionConfig.color || 'primary'"
        :submitting="submitting"
        :submit-disabled="isMultiOutcome && !selectedOutcome"
        @cancel="navigateToView"
        @submit="handleSubmit"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive, h } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import OperationActionLoading from 'components/Operations/_common/OperationActionLoading.vue'
import OperationActionEmpty from 'components/Operations/_common/OperationActionEmpty.vue'
import OperationActionHeader from 'components/Operations/_common/OperationActionHeader.vue'
import OperationActionForm from 'components/Operations/_common/OperationActionForm.vue'
import OperationActionActions from 'components/Operations/_common/OperationActionActions.vue'
import { useActionResolver } from 'src/composables/useActionResolver'
import { useResourceConfig, isActionVisible } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useActionFields } from 'src/composables/useActionFields'
import { callGasApi } from 'src/services/gasApi'
import { useResourceNav } from 'src/composables/useResourceNav'

const router = useRouter()
const nav = useResourceNav()
const $q = useQuasar()

const {
  resourceSlug, code, config, resourceName,
  resourceHeaders, additionalActions, customUIName
} = useResourceConfig()

const { items, loading, reload } = useResourceData(resourceName)

const actionName = computed(() => {
  const route = router.currentRoute.value
  return route.params.action || route.meta?.action || ''
})

const { sections, sectionsReady } = useActionResolver({
  resourceSlug,
  customUIName,
  actionKey: actionName,
  scope: 'operations',
  sectionDefs: {
    Loading: OperationActionLoading,
    Empty: OperationActionEmpty,
    Header: OperationActionHeader,
    Form: OperationActionForm,
    Actions: OperationActionActions
  }
})

const fallbackLoading = { render: () => h(OperationActionLoading) }

const currentActionConfig = computed(() => {
  return additionalActions.value.find(
    (a) => a.action.toLowerCase() === actionName.value.toLowerCase() && a.kind !== 'navigate'
  ) || null
})

const selectedOutcome = ref('')
const actionForm = reactive({})
const submitting = ref(false)

const {
  column, isMultiOutcome, outcomeOptions, resolvedFields: resolvedActionFields
} = useActionFields(resourceHeaders, currentActionConfig, () => selectedOutcome.value)

const record = computed(() => {
  if (!code.value || !items.value.length) return null
  return items.value.find((r) => r.Code === code.value) || null
})

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
  for (const field of resolvedActionFields.value) {
    if (field.required && !(actionForm[field.header] || '').toString().trim()) {
      $q.notify({ type: 'negative', message: `${field.label} is required`, timeout: 2200 })
      return
    }
  }

  submitting.value = true
  try {
    const payload = {
      action: 'executeAction',
      scope: config.value?.scope || 'operation',
      resource: resourceName.value,
      code: code.value,
      actionName: actionName.value,
      column: column.value,
      columnValue: selectedOutcome.value,
      fields: { ...actionForm }
    }

    const response = await callGasApi('executeAction', payload, {
      showLoading: true,
      loadingMessage: `Executing ${currentActionConfig.value?.label || actionName.value}...`,
      successMessage: `${currentActionConfig.value?.label || actionName.value} completed successfully`
    })

    if (response.success) {
      nav.goTo('view')
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: `Action failed: ${err.message}`, timeout: 3000 })
  } finally {
    submitting.value = false
  }
}

function navigateToView() {
  nav.goTo('view')
}

function navigateToList() {
  nav.goTo('list')
}

watch(() => resourceName.value, (n) => { if (n) reload() }, { immediate: true })
</script>

<style scoped>
.action-page {
  display: grid;
  gap: 12px;
  padding-bottom: 32px;
}
</style>
