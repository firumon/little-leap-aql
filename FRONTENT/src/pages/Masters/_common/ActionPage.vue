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
    <template v-else>
      <q-card flat bordered class="page-card">
        <q-card-section>
          <div class="page-title">
            <q-icon
              :name="currentActionConfig.icon || 'play_arrow'"
              size="24px"
              :color="currentActionConfig.color || 'primary'"
              class="q-mr-sm"
            />
            {{ currentActionConfig.label || actionName }} — {{ record.Code }}
          </div>
          <div class="text-grey-7 q-mt-xs">
            {{ resolvePrimaryText(record) }}
          </div>
        </q-card-section>

        <q-separator />

        <q-card-section class="q-gutter-y-md">
          <!-- Multi-outcome selector -->
          <div v-if="isMultiOutcome">
            <div class="field-label q-mb-sm">Select Outcome</div>
            <q-option-group
              v-if="outcomeOptions.length <= 4"
              :model-value="selectedOutcome"
              :options="outcomeSelectOptions"
              type="radio"
              color="primary"
              @update:model-value="selectedOutcome = $event"
            />
            <q-select
              v-else
              :model-value="selectedOutcome"
              :options="outcomeSelectOptions"
              label="Outcome"
              dense
              outlined
              emit-value
              map-options
              @update:model-value="selectedOutcome = $event"
            />
          </div>

          <!-- Dynamic fields based on column existence -->
          <template v-for="field in resolvedActionFields" :key="field.header">
            <q-input
              v-if="field.type === 'textarea'"
              :model-value="actionForm[field.header]"
              :label="field.label + (field.required ? ' *' : '')"
              dense
              outlined
              type="textarea"
              autogrow
              @update:model-value="actionForm[field.header] = $event"
            />
            <q-input
              v-else-if="field.type === 'date'"
              :model-value="actionForm[field.header]"
              :label="field.label + (field.required ? ' *' : '')"
              dense
              outlined
              type="date"
              @update:model-value="actionForm[field.header] = $event"
            />
            <q-input
              v-else-if="field.type === 'number'"
              :model-value="actionForm[field.header]"
              :label="field.label + (field.required ? ' *' : '')"
              dense
              outlined
              type="number"
              @update:model-value="actionForm[field.header] = $event"
            />
            <q-input
              v-else
              :model-value="actionForm[field.header]"
              :label="field.label + (field.required ? ' *' : '')"
              dense
              outlined
              @update:model-value="actionForm[field.header] = $event"
            />
          </template>

          <!-- No fields message -->
          <div v-if="!resolvedActionFields.length && selectedOutcome" class="text-grey-6 q-py-sm">
            No additional input required. Click submit to proceed.
          </div>
        </q-card-section>
      </q-card>

      <!-- Actions -->
      <div class="row q-mt-md q-gutter-sm justify-end">
        <q-btn flat no-caps label="Cancel" icon="arrow_back" @click="navigateToView" />
        <q-btn
          unelevated
          no-caps
          :color="currentActionConfig.color || 'primary'"
          :label="currentActionConfig.label || actionName"
          :icon="currentActionConfig.icon || 'check'"
          :loading="submitting"
          :disable="isMultiOutcome && !selectedOutcome"
          @click="handleSubmit"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { useResourceData } from 'src/composables/useResourceData'
import { useActionFields } from 'src/composables/useActionFields'
import { callGasApi } from 'src/services/gasApi'

const router = useRouter()
const $q = useQuasar()

const {
  scope, resourceSlug, code, config, resourceName,
  resourceHeaders, resolvedFields, additionalActions
} = useResourceConfig()

const { items, loading, reload } = useResourceData(resourceName)
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

const outcomeSelectOptions = computed(() => {
  return outcomeOptions.value.map((opt) => ({
    label: opt.replace(/([a-z])([A-Z])/g, '$1 $2'),
    value: opt
  }))
})

const record = computed(() => {
  if (!code.value || !items.value.length) return null
  return items.value.find((r) => r.Code === code.value) || null
})

function resolvePrimaryText(row) {
  if (!row) return '-'
  if (row.Name) return row.Name
  return '-'
}

// Initialize selectedOutcome for fixed-value actions
watch(currentActionConfig, (cfg) => {
  if (cfg?.columnValue) {
    selectedOutcome.value = cfg.columnValue
  } else {
    selectedOutcome.value = ''
  }
}, { immediate: true })

// Reset form when action fields change
watch(resolvedActionFields, (fields) => {
  Object.keys(actionForm).forEach((k) => delete actionForm[k])
  fields.forEach((f) => { actionForm[f.header] = '' })
}, { immediate: true })

async function handleSubmit() {
  // Validate required fields
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
      scope: config.value?.scope || 'master',
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
      router.push(`/${scope.value}/${resourceSlug.value}/${code.value}`)
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: `Action failed: ${err.message}`, timeout: 3000 })
  } finally {
    submitting.value = false
  }
}

function navigateToView() {
  router.push(`/${scope.value}/${resourceSlug.value}/${code.value}`)
}

function navigateToList() {
  router.push(`/${scope.value}/${resourceSlug.value}`)
}

watch(() => resourceName.value, (n) => { if (n) reload() }, { immediate: true })
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--master-border);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--master-ink);
  display: flex;
  align-items: center;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
