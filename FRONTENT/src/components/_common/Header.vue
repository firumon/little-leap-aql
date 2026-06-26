<template>
  <!-- Case 1: Local header component exists and has a template -> Render it directly -->
  <component
    :is="localComponent"
    v-if="localComponent && hasLocalTemplate"
    v-bind="$props"
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
import { ref, computed, watch } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { registry } from 'src/composables/resources/useSectionResolver'
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'
import { toPascalCase } from 'src/utils/appHelpers'

defineOptions({ name: 'CommonHeader' })

const props = defineProps({
  config: Object,
  record: Object,
  code: String,
  actionConfig: Object,
  actionName: String
})

const emit = defineEmits(['reload'])

const nav = useResourceNav()
const { config: resolvedConfig, action, scope, resourceSlug } = useResourceConfig()

const activeConfig = computed(() => props.config || resolvedConfig.value)
const currentAction = computed(() => {
  if (props.actionName) return 'action'
  return action.value?.toLowerCase() || 'view'
})
const isIndexPage = computed(() => currentAction.value === 'index')

const localComponent = ref(null)
const hasLocalTemplate = ref(false)
const localConfig = ref({})

// Dynamically scan Vite glob registry for local overrides
watch(
  () => [activeConfig.value, resourceSlug.value, scope.value, currentAction.value],
  async ([newVal, slugVal, scopeVal, actionVal]) => {
    if (!newVal) {
      localComponent.value = null
      hasLocalTemplate.value = false
      localConfig.value = {}
      return
    }

    const scopeFolder = toPascalCase(newVal.scope || scopeVal || 'masters')
    const entityName = toPascalCase(slugVal || newVal.slug || newVal.name || '')
    const pageFolder = toPascalCase(actionVal)

    const candidates = [
      `components/${scopeFolder}/${entityName}/${pageFolder}/Header.vue`,
      `components/${scopeFolder}/${entityName}/Header.vue`
    ]

    localComponent.value = null
    hasLocalTemplate.value = false
    localConfig.value = {}

    for (const path of candidates) {
      if (registry[path]) {
        try {
          const module = await registry[path]()
          const comp = module.default || module

          localComponent.value = comp
          hasLocalTemplate.value = !!(comp.render || comp.ssrRender || typeof comp === 'function')
          localConfig.value = module.headerConfig || comp.headerConfig || {}
          break
        } catch (err) {
          console.error(`Failed to load local header at ${path}:`, err)
        }
      }
    }
  },
  { immediate: true }
)

// 1. Title Resolution
const resolvedHeaderTitle = computed(() => {
  const val = localConfig.value.title !== undefined ? localConfig.value.title : activeConfig.value?.ui?.header?.title
  if (typeof val === 'function') {
    return val(props.record)
  }
  if (val) return val

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
    return props.actionConfig?.label || props.actionName || 'Action'
  }
  return activeConfig.value?.name || 'Record'
})

// 2. Subtitle Resolution
const resolvedHeaderSubtitle = computed(() => {
  const val = localConfig.value.subtitle !== undefined ? localConfig.value.subtitle : activeConfig.value?.ui?.header?.subtitle
  if (typeof val === 'function') {
    return val(props.record)
  }
  if (val) return val

  if (isIndexPage.value) {
    return activeConfig.value?.description || ''
  }

  const act = currentAction.value
  if (act === 'add') {
    return 'Create a new entry'
  }

  const recordCode = props.code || props.record?.Code
  if (act === 'edit') {
    return recordCode ? `${recordCode} - Modify` : 'Modify details'
  }
  if (act === 'action') {
    return recordCode ? `${recordCode} - Action` : 'Run workflow action'
  }
  return recordCode ? `${recordCode} - Details` : 'Details'
})

// 3. Left Icon Resolution
const resolvedHeaderIcon = computed(() => {
  const val = localConfig.value.icon !== undefined ? localConfig.value.icon : activeConfig.value?.ui?.header?.icon
  if (typeof val === 'function') {
    return val(props.record)
  }
  return val || null // hidden if not specified
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
  if (typeof val === 'function') {
    return val(props.record)
  }
  return val || ''
})

const resolvedChipColor = computed(() => {
  const val = localConfig.value.chipColor !== undefined ? localConfig.value.chipColor : activeConfig.value?.ui?.header?.chipColor
  if (typeof val === 'function') {
    return val(props.record)
  }
  return val || 'primary'
})

const resolvedChipTextColor = computed(() => {
  const val = localConfig.value.chipTextColor !== undefined ? localConfig.value.chipTextColor : activeConfig.value?.ui?.header?.chipTextColor
  if (typeof val === 'function') {
    return val(props.record)
  }
  return val || 'white'
})
</script>
