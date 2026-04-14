<template>
  <div class="action-page">
    <!-- Loading -->
    <div v-if="loading" class="q-py-xl text-center">
      <q-spinner-dots color="primary" size="32px" />
    </div>

    <!-- Record not found -->
    <q-card v-else-if="!record" flat bordered class="page-card">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="search_off" size="48px" color="grey-5" />
        <div class="text-subtitle1 text-grey-7 q-mt-md">Record not found</div>
        <q-btn flat color="primary" label="Back to List" icon="arrow_back" class="q-mt-md" @click="navigateToList" />
      </q-card-section>
    </q-card>

    <!-- Action not configured -->
    <q-card v-else-if="!currentActionConfig" flat bordered class="page-card">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="block" size="48px" color="grey-5" />
        <div class="text-subtitle1 text-grey-7 q-mt-md">Action "{{ actionName }}" is not configured</div>
        <q-btn flat color="primary" label="Back" icon="arrow_back" class="q-mt-md" @click="navigateToView" />
      </q-card-section>
    </q-card>

    <!-- Action form -->
    <template v-else-if="sectionsReady">
      <component
        :is="sections.ActionHeader"
        :action-config="currentActionConfig"
        :action-name="actionName"
        :record="record"
      />

      <component
        :is="sections.ActionForm"
        :is-multi-outcome="isMultiOutcome"
        :outcome-options="outcomeOptions"
        :selected-outcome="selectedOutcome"
        :resolved-action-fields="resolvedActionFields"
        :action-form="actionForm"
        @update:selected-outcome="selectedOutcome = $event"
        @update:action-field="(header, val) => { actionForm[header] = val }"
      />

      <component
        :is="sections.ActionActions"
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
import { ref, computed, watch, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import OperationActionHeader from 'components/Operations/_common/OperationActionHeader.vue'
import OperationActionForm from 'components/Operations/_common/OperationActionForm.vue'
import OperationActionActions from 'components/Operations/_common/OperationActionActions.vue'
import { useSectionResolver } from 'src/composables/useSectionResolver'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useActionFields } from 'src/composables/useActionFields'
import { callGasApi } from 'src/services/gasApi'
import { useResourceNav } from 'src/composables/useResourceNav'

const router = useRouter()
const nav = useResourceNav()
const $q = useQuasar()

const {
  scope, resourceSlug, code, config, resourceName,
  resourceHeaders, resolvedFields, additionalActions
} = useResourceConfig()

const { items, loading, reload } = useResourceData(resourceName)

const customUIName = computed(() => config.value?.ui?.customUIName || '')
const { sections, sectionsReady } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope: 'operations',
  sectionDefs: {
    ActionHeader: OperationActionHeader,
    ActionForm: OperationActionForm,
    ActionActions: OperationActionActions
  }
})

const actionName = computed(() => {
  const route = router.currentRoute.value
  return route.params.action || route.meta?.action || ''
})

const currentActionConfig = computed(() => {
  return additionalActions.value.find(
    (a) => a.action.toLowerCase() === actionName.value.toLowerCase()
  ) || null
})

const selectedOutcome = ref('')
const actionForm = reactive({})
const submitting = ref(false)

const {
  column, isMultiOutcome, outcomeOptions, resolvedFields: resolvedActionFields, autoFillColumns
} = useActionFields(resourceHeaders, currentActionConfig, () => selectedOutcome.value)

const record = computed(() => {
  if (!code.value || !items.value.length) return null
  return items.value.find((r) => r.Code === code.value) || null
})

watch(currentActionConfig, (cfg) => {
  if (cfg?.columnValue) {
    selectedOutcome.value = cfg.columnValue
  } else {
    selectedOutcome.value = ''
  }
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
.page-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
