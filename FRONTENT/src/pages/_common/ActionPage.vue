<template>
  <q-page class="q-gutter-y-sm" v-if="sectionsReady">
    <!-- 1. Header Section -->
    <component :is="sections.Header"/>

    <!-- 2. ToolBar Section (Usually empty for Actions) -->
    <component :is="sections.ToolBar" v-if="sections.ToolBar"/>

    <!-- 3. Content Section (Action Outcome & Form fields) -->
    <AqlContentWrapper
      :loading="loading"
      :empty="false"
      requires-record
      :record-exists="!!record"
      empty-icon="block"
      empty-title="Action Unavailable"
      :empty-message="`Action &quot;${actionName}&quot; is not available or not configured for this record.`"
    >
      <!-- Action not configured or action not allowed in current state -->
      <q-card v-if="!currentActionConfig || !actionAllowedForRecord" flat bordered class="q-ma-md text-center q-py-xl">
        <q-card-section>
          <q-icon name="block" size="56px" color="grey-5" />
          <div class="text-h6 text-grey-7 q-mt-md">Action not available</div>
          <div class="text-caption text-grey-5 q-mt-sm">
            This action is either not configured or cannot be executed on the record in its current state.
          </div>
          <q-btn flat color="primary" label="Back" icon="arrow_back" class="q-mt-md" @click="navigateToView" />
        </q-card-section>
      </q-card>

      <!-- Main action input form -->
      <component
        v-else
        :is="sections.Content"
        :is-multi-outcome="isMockMultiOutcome"
        :outcome-options="outcomeOptions"
        :selected-outcome="selectedOutcome"
        :resolved-action-fields="resolvedActionFields"
        :action-form="actionForm"
        @update:selected-outcome="selectedOutcome = $event"
        @update:action-field="(header, val) => { actionForm[header] = val }"
      />
    </AqlContentWrapper>

    <!-- 4. Action Section (Submit/Cancel footer) -->
    <component
      v-if="currentActionConfig && actionAllowedForRecord"
      :is="sections.Action"
      :action-label="currentActionConfig.label || actionName"
      :action-icon="currentActionConfig.icon || 'check'"
      :action-color="currentActionConfig.color || 'primary'"
      :submitting="submitting"
      :submit-disabled="isMockMultiOutcome && !selectedOutcome"
      @cancel="navigateToView"
      @submit="handleSubmit"
    />
  </q-page>
  <div v-else class="flex flex-center q-py-xl">
    <q-spinner-dots color="primary" size="32px" />
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive, provide } from 'vue'
import { useRouter } from 'vue-router'
import AqlContentWrapper from 'components/shared/AqlContentWrapper.vue'
import { useMasterActions } from 'src/composables/useMasterActions'
import { useOperationActions } from 'src/composables/useOperationActions'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import { useResourceConfig, isActionVisible } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { useActionFields } from 'src/composables/resources/useActionFields'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import Header from 'components/_common/Header/Header.vue'
import Toolbar from 'components/_common/Toolbar/Toolbar.vue'
import Actions from 'components/_common/Action/ActionsFallback.vue'

defineOptions({ name: 'ActionPage' })

const router = useRouter()
const nav = useResourceNav()

const resourceConfig = useResourceConfig()
const resourceRecord = useRecord()

provide('resourceConfig', resourceConfig)
provide('resourceRecord', resourceRecord)

const {
  scope, resourceSlug, code, config, resourceName,
  resourceHeaders, additionalActions
} = resourceConfig

const isOps = computed(() => scope.value?.toLowerCase() === 'operations')
const masterActions = useMasterActions()
const operationActions = useOperationActions()

const actionsStore = computed(() => isOps.value ? operationActions : masterActions)
const submitting = computed(() => actionsStore.value.submitting.value)

const { record, loading, reload } = resourceRecord

const actionName = computed(() => {
  const route = router.currentRoute.value
  return route.params.action || route.meta?.action || ''
})

// Resolve the four top-level sections for the Action page
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  scope,
  page: 'Action',
  actionKey: actionName,
  sectionDefs: {
    Header: { section: 'Header', default: Header },
    ToolBar: { section: 'Toolbar', default: Toolbar },
    Content: 'Content',
    Action: { section: 'Actions', default: Actions }
  }
})

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

watch(() => resourceName.value, (n) => { if (n) reload() }, { immediate: true })
</script>
