<template>
  <!-- Case 1: Local header component exists and has a template -> Render it directly -->
  <component
    :is="localComponent"
    v-if="localComponent && hasLocalTemplate"
    v-bind="$attrs"
  />

  <!-- Case 2: Standard fallback using the shared GenericHeaderPanel -->
  <GenericHeaderPanel
    v-else
    :label="resolvedHeaderTitle"
    :caption="resolvedHeaderSubtitle"
    :icon="resolvedHeaderIcon"
    :back="resolvedBackConfig.showBack"
    :back-icon="resolvedBackConfig.icon"
    :reload="hasReload"
    :reload-component="localConfig.reloadComponent"
    :reload-icon="resolvedReloadIcon"
    :chip="resolvedChip"
    :chip-color="resolvedChipColor"
    :chip-text-color="resolvedChipTextColor"
    :chip-component="localConfig.chipComponent"
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

// Resolve the local header component using the central 12-tier resolver
const { sections } = useSectionResolver({
  resourceSlug,
  customUIName,
  scope,
  actionKey: action,
  sectionDefs: {
    Header: 'Header'
  },
  allowScriptOnly: true
})

const localComponent = computed(() => {
  const comp = sections.Header
  if (!comp) return null
  // Prevent infinite loop recursion if it resolves to the orchestrator itself
  if (comp.name === 'CommonHeader') {
    return null
  }
  return comp
})

const hasLocalTemplate = computed(() => {
  const comp = localComponent.value
  return !!(comp && (comp.render || comp.ssrRender || typeof comp === 'function'))
})

const localConfig = computed(() => {
  const comp = localComponent.value
  return comp?.header || {}
})

// Helper to evaluate static values or dynamic functions with active record and resource config
function evaluate(val) {
  if (typeof val === 'function') {
    return val(recordVal.value, activeConfig.value)
  }
  return val
}

// 1. Title Resolution
const resolvedHeaderTitle = computed(() => {
  const val = localConfig.value.title !== undefined ? localConfig.value.title : activeConfig.value?.ui?.header?.title
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
    return activeActionConfig.value?.label || props.actionName || 'Action'
  }
  return activeConfig.value?.name || 'Record'
})

// 2. Subtitle Resolution
const resolvedHeaderSubtitle = computed(() => {
  const val = localConfig.value.subtitle !== undefined ? localConfig.value.subtitle : activeConfig.value?.ui?.header?.subtitle
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

// 3. Left Icon Resolution
const resolvedHeaderIcon = computed(() => {
  const val = localConfig.value.icon !== undefined ? localConfig.value.icon : activeConfig.value?.ui?.header?.icon
  return evaluate(val) || null // hidden if not specified
})

// 4. Overloaded Back Button Configuration
const resolvedBackConfig = computed(() => {
  const val = localConfig.value.back !== undefined ? localConfig.value.back : activeConfig.value?.ui?.header?.back

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
    // val is true, 'true', or undefined
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

// 5. Reload Configuration
const hasReload = computed(() => {
  const val = localConfig.value.reload !== undefined ? localConfig.value.reload : activeConfig.value?.ui?.header?.reload
  if (val === false || val === 'false') return false
  if (val) return true
  return isIndexPage.value // default to index page
})

const resolvedReloadIcon = computed(() => {
  const val = localConfig.value.reload !== undefined ? localConfig.value.reload : activeConfig.value?.ui?.header?.reload
  if (typeof val === 'string' && val !== 'true' && val !== 'false') {
    return val
  }
  return 'refresh'
})

// 6. Status Chip Resolution
const resolvedChip = computed(() => {
  const val = localConfig.value.chip !== undefined ? localConfig.value.chip : activeConfig.value?.ui?.header?.chip
  return evaluate(val) || ''
})

const resolvedChipColor = computed(() => {
  const val = localConfig.value.chipColor !== undefined ? localConfig.value.chipColor : activeConfig.value?.ui?.header?.chipColor
  return evaluate(val) || 'primary'
})

const resolvedChipTextColor = computed(() => {
  const val = localConfig.value.chipTextColor !== undefined ? localConfig.value.chipTextColor : activeConfig.value?.ui?.header?.chipTextColor
  return evaluate(val) || 'white'
})
</script>
