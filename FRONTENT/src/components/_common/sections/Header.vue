<template>
  <!-- Case 1: Local header template exists -> Render it directly with modified props -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <!-- Case 2: Standard fallback using the shared GenericHeaderPanel -->
  <GenericHeaderPanel
    v-else
    :label="finalProps.label"
    :caption="finalProps.caption"
    :icon="finalProps.icon"
    :back="finalProps.back"
    :back-icon="finalProps.backIcon"
    :reload="finalProps.reload"
    :reload-component="finalProps.reloadComponent"
    :reload-icon="finalProps.reloadIcon"
    :chip="finalProps.chip"
    :chip-color="finalProps.chipColor"
    :chip-text-color="finalProps.chipTextColor"
    :chip-component="finalProps.chipComponent"
    @click="navigateBack"
  />
</template>

<script setup>
import { computed, inject, useAttrs } from 'vue'
import { useRouter } from 'vue-router'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useCommonSection } from 'src/composables/resources/useCommonSection'
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'

defineOptions({ name: 'CommonHeader', inheritAttrs: false })

const attrs = useAttrs()
const router = useRouter()
const nav = useResourceNav()
const props = defineProps({ page: { type: String, default: 'View' } })

const resourceConfig = inject('resourceConfig')
const resourceRecord = inject('resourceRecord', null)

const { config, pageName, scope, resourceSlug, code: resolvedCode, additionalActions, customUIName } = resourceConfig || {}
const resolvedRecord = computed(() => resourceRecord?.record?.value)

const activeConfig = computed(() => attrs.config || config?.value)
const currentAction = computed(() => {
  if (attrs.actionName) return 'action'
  return pageName?.value?.toLowerCase() || 'view'
})
const isIndexPage = computed(() => currentAction.value === 'index')

const recordVal = computed(() => attrs.record || resolvedRecord.value)
const recordCode = computed(() => attrs.code || recordVal.value?.Code || resolvedCode?.value)

const activeActionConfig = computed(() => {
  if (attrs.actionConfig) return attrs.actionConfig
  const actName = attrs.actionName || pageName?.value
  if (!actName) return null
  return additionalActions?.value?.find(
    (a) => a.action.toLowerCase() === actName.toLowerCase() && a.kind !== 'navigate'
  ) || null
})

const resolvedHeaderTitle = computed(() => {
  if (isIndexPage.value) {
    return activeConfig.value?.name || ''
  }

  const act = currentAction.value
  if (act === 'add') {
    return activeConfig.value?.name ? `New ${activeConfig.value.name}` : 'New Record'
  }
  if (act === 'edit') {
    return activeConfig.value?.name ? `Edit ${activeConfig.value.name}` : 'Edit Record'
  }
  if (act === 'action') {
    return activeActionConfig.value?.label || attrs.actionName || 'Action'
  }
  return activeConfig.value?.name || 'Record'
})

const resolvedHeaderSubtitle = computed(() => {
  if (isIndexPage.value) {
    return activeConfig.value?.description || ''
  }

  const act = currentAction.value
  if (act === 'add') {
    return 'Create a new entry'
  }

  const rCode = recordCode.value
  if (act === 'edit') {
    return rCode ? `${rCode} - Modify` : 'Modify details'
  }
  if (act === 'action') {
    return rCode ? `${rCode} - Action` : 'Run workflow action'
  }
  return rCode ? `${rCode} - Details` : 'Details'
})

const showBackBtn = computed(() => {
  const hasHistory = !!window.history.state?.back
  return hasHistory || currentAction.value !== 'index'
})

const hasReload = computed(() => currentAction.value === 'index')

const preparedProps = computed(() => ({
  label: resolvedHeaderTitle.value,
  caption: resolvedHeaderSubtitle.value,
  icon: null,
  back: showBackBtn.value,
  backIcon: 'arrow_back',
  reload: hasReload.value,
  reloadComponent: null,
  reloadIcon: 'refresh',
  chip: '',
  chipColor: 'primary',
  chipTextColor: 'white',
  chipComponent: null
}))

const {
  resolvedComponent,
  finalProps,
  propModifier,
  sectionsReady
} = useCommonSection({
  sectionName: 'Header',
  page: props.page,
  preparedProps,
  evaluateKeys: ['label', 'caption', 'icon', 'chip', 'chipColor', 'chipTextColor']
})

function navigateBack() {
  const rawProps = propModifier.value(preparedProps.value)
  if (typeof rawProps.back === 'function') {
    rawProps.back()
    return
  }

  const hasHistory = !!window.history.state?.back
  if (hasHistory) {
    router.back()
  } else if (currentAction.value !== 'index') {
    nav.goTo('index')
  }
}
</script>
