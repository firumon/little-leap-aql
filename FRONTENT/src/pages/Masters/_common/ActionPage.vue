<template>
  <div class="action-page">
    <component v-if="!sectionsReady" :is="fallbackLoading" />

    <component v-else-if="loading" :is="sections.Loading" />

    <component
      v-else-if="!record"
      :is="sections.Empty"
      icon="search_off"
      message="Record not found"
      back-label="Back to List"
      @back="navigateToList"
    />

    <component
      v-else-if="!currentActionConfig"
      :is="sections.Empty"
      icon="block"
      :message="`Action &quot;${actionName}&quot; is not configured`"
      back-label="Back"
      @back="navigateToView"
    />

    <component
      v-else-if="!actionAllowedForRecord"
      :is="sections.Empty"
      icon="block"
      :message="`Action &quot;${currentActionConfig.label || actionName}&quot; is not available for this record in its current state`"
      back-label="Back"
      @back="navigateToView"
    />

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
import MasterActionLoading from 'components/Masters/_common/MasterActionLoading.vue'
import MasterActionEmpty from 'components/Masters/_common/MasterActionEmpty.vue'
import MasterActionHeader from 'components/Masters/_common/MasterActionHeader.vue'
import MasterActionForm from 'components/Masters/_common/MasterActionForm.vue'
import MasterActionActions from 'components/Masters/_common/MasterActionActions.vue'
import { useMasterActions } from 'src/composables/useMasterActions'
import { useActionResolver } from 'src/composables/resources/useActionResolver'
import { useResourceConfig, isActionVisible } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useActionFields } from 'src/composables/resources/useActionFields'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

const router = useRouter()
const nav = useResourceNav()
const $q = useQuasar()
const { submitting, submitAction } = useMasterActions()

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
  scope: 'masters',
  sectionDefs: {
    Loading: MasterActionLoading,
    Empty: MasterActionEmpty,
    Header: MasterActionHeader,
    Form: MasterActionForm,
    Actions: MasterActionActions
  }
})

const fallbackLoading = { render: () => h(MasterActionLoading) }

const currentActionConfig = computed(() => {
  return additionalActions.value.find(
    (a) => a.action.toLowerCase() === actionName.value.toLowerCase() && a.kind !== 'navigate'
  ) || null
})

const selectedOutcome = ref('')
const actionForm = reactive({})
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
  await submitAction({
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
