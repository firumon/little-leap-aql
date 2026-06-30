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
import { ref, computed, inject, useAttrs } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'

defineOptions({ name: 'CommonHeader', inheritAttrs: false })

const attrs = useAttrs()

const emit = defineEmits(['reload'])

const nav = useResourceNav()
const { config: resolvedConfig, action, scope, resourceSlug, code: resolvedCode, additionalActions, customUIName } = inject('resourceConfig')
const { record: resolvedRecord } = inject('resourceRecord', { record: ref(null) })

const activeConfig = computed(() => attrs.config || resolvedConfig.value)
const currentAction = computed(() => {
  if (attrs.actionName) return 'action'
  return action.value?.toLowerCase() || 'view'
})
const isIndexPage = computed(() => currentAction.value === 'index')

const recordVal = computed(() => attrs.record || resolvedRecord.value)
const recordCode = computed(() => attrs.code || recordVal.value?.Code || resolvedCode.value)

const activeActionConfig = computed(() => {
  if (attrs.actionConfig) return attrs.actionConfig
  const actName = attrs.actionName || action.value
  if (!actName) return null
  return additionalActions.value?.find(
    (a) => a.action.toLowerCase() === actName.toLowerCase() && a.kind !== 'navigate'
  ) || null
})

// Keep existing resolved title/subtitle/icon/back/reload/chip computations
function evaluate(val) {
  if (typeof val === 'function') {
    return val(recordVal.value, activeConfig.value)
  }
  return val
}

const resolvedHeaderTitle = computed(() => {
  const val = activeConfig.value?.ui?.header?.title
  const evaluated = evaluate(val)
  if (evaluated) return evaluated

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
  const val = activeConfig.value?.ui?.header?.subtitle
  const evaluated = evaluate(val)
  if (evaluated) return evaluated

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

const resolvedHeaderIcon = computed(() => {
  const val = activeConfig.value?.ui?.header?.icon
  return evaluate(val) || null
})

const resolvedBackConfig = computed(() => {
  const val = activeConfig.value?.ui?.header?.back

  let showBack = false
  let icon = 'arrow_back'
  let actionFn = null

  if (val === false || val === 'false') {
    showBack = false
  } else if (typeof val === 'function') {
    showBack = true
    actionFn = val
  } else if (typeof val === 'string' && val !== 'true' && val !== 'false') {
    showBack = true
    icon = val
  } else {
    const hasHistory = !!window.history.state?.back
    if (hasHistory || currentAction.value !== 'index') {
      showBack = true
    } else {
      showBack = false
    }
  }

  return { showBack, icon, actionFn }
})

function navigateBack() {
  const backCfg = resolvedBackConfig.value
  if (backCfg.actionFn) {
    backCfg.actionFn()
    return
  }

  const hasHistory = !!window.history.state?.back
  if (hasHistory) {
    window.history.back()
  } else if (currentAction.value !== 'index') {
    nav.goTo('index')
  }
}

const hasReload = computed(() => {
  const val = activeConfig.value?.ui?.header?.reload
  if (val === false || val === 'false') return false
  if (val) return true
  return isIndexPage.value
})

const resolvedReloadIcon = computed(() => {
  const val = activeConfig.value?.ui?.header?.reload
  if (typeof val === 'string' && val !== 'true' && val !== 'false') {
    return val
  }
  return 'refresh'
})

const resolvedChip = computed(() => {
  const val = activeConfig.value?.ui?.header?.chip
  return evaluate(val) || ''
})

const resolvedChipColor = computed(() => {
  const val = activeConfig.value?.ui?.header?.chipColor
  return evaluate(val) || 'primary'
})

const resolvedChipTextColor = computed(() => {
  const val = activeConfig.value?.ui?.header?.chipTextColor
  return evaluate(val) || 'white'
})

// New: resolve section-level overrides using new useSectionResolver contract
const props = defineProps({ page: { type: String, default: 'View' } })
const { resolvedComponent, propModifier, sectionsReady } = useSectionResolver({ sectionName: 'Header', page: props.page })

const preparedProps = computed(() => ({
  label: resolvedHeaderTitle.value,
  caption: resolvedHeaderSubtitle.value,
  icon: resolvedHeaderIcon.value,
  back: resolvedBackConfig.value.showBack,
  backIcon: resolvedBackConfig.value.icon,
  reload: hasReload.value,
  reloadComponent: null,
  reloadIcon: resolvedReloadIcon.value,
  chip: resolvedChip.value,
  chipColor: resolvedChipColor.value,
  chipTextColor: resolvedChipTextColor.value,
  chipComponent: null
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
