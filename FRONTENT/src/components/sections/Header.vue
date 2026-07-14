<template>
  <Header v-bind="finalAttrs" @click="navigateBack" />
</template>

<script setup>
import { computed, inject, useAttrs } from 'vue'
import { useRouter } from 'vue-router'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import Header from 'components/app/Header.vue'

defineOptions({ name: 'SectionsHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: undefined },
  subtitle: { type: [String, Function], default: undefined },
  back: { type: [Boolean, String, Function], default: undefined },
  reload: { type: [Boolean, String], default: undefined },
  chip: { type: [String, Function], default: '' },
  chipColor: { type: [String, Function], default: 'primary' },
  chipTextColor: { type: [String, Function], default: 'white' },
  backIcon: { type: [String, Function], default: 'arrow_back' },
  reloadIcon: { type: [String, Function], default: 'refresh' },
  leftIconColor: { type: [String, Function], default: 'primary' },
  icon: { type: [String, Function], default: '' },
  iconColor: { type: [String, Function], default: 'primary' },
})

const attrs = useAttrs()
const router = useRouter()
const nav = useResourceNav()

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
const routeConfig = useRouteConfig()

// Injected resourceConfig is the useResourceConfig() return object (refs/computeds).
const {
  config, scope, resourceSlug, additionalActions
} = resourceConfig || {}

const { pageName, code: injectedCode } = routeConfig

// Resolve context from the injected config; attrs override per-instance.
const activeConfig = computed(() => attrs.config || config?.value || null)
const resolvedScope = computed(() => scope?.value || 'master')
const resolvedResourceSlug = computed(() => resourceSlug?.value || '')
const resolvedPageName = computed(() => (pageName?.value || 'index').toLowerCase())
const resolvedCode = computed(() => injectedCode?.value || '')
const resolvedRecord = computed(() => resourceRecord?.record?.value)

const isAction = computed(() => !!attrs.actionName)
const isIndex = computed(() => resolvedPageName.value === 'index')
const recordCode = computed(() => attrs.code || resolvedRecord.value?.Code || resolvedCode.value)

const activeActionConfig = computed(() => {
  if (attrs.actionConfig) return attrs.actionConfig
  const act = attrs.actionName || resolvedPageName.value
  if (!act) return null
  return (additionalActions?.value || []).find(
    (a) => a.action?.toLowerCase() === act.toLowerCase() && a.kind !== 'navigate'
  ) || null
})

// Menu for the current route, else a singular ui.menu.
const matchedMenu = computed(() => {
  const ui = activeConfig.value?.ui
  if (!ui) return null
  const path = `/${resolvedScope.value}/${resolvedResourceSlug.value}`.toLowerCase()
  const matched = (Array.isArray(ui.menus) ? ui.menus : []).find(
    (m) => m.route && path.startsWith(m.route.toLowerCase())
  )
  return matched || ui.menu || null
})

const derivedTitle = computed(() => {
  const menu = matchedMenu.value
  if (menu?.pageTitle) return menu.pageTitle
  if (menu?.label) return menu.label

  if (isIndex.value) return activeConfig.value?.name || ''

  const name = activeConfig.value?.name
  if (isAction.value) return activeActionConfig.value?.label || attrs.actionName || 'Action'
  if (resolvedPageName.value === 'add') return name ? `New ${name}` : 'New Record'
  if (resolvedPageName.value === 'edit') return name ? `Edit ${name}` : 'Edit Record'
  return name || 'Record'
})

const derivedSubtitle = computed(() => {
  const menu = matchedMenu.value
  const menuDesc = menu?.pageDescription || menu?.description
  if (menuDesc) return menuDesc

  if (isIndex.value) return activeConfig.value?.description || ''

  const code = recordCode.value
  if (isAction.value) return code ? `${code} - Action` : 'Run workflow action'
  if (resolvedPageName.value === 'add') return 'Create a new entry'
  if (resolvedPageName.value === 'edit') return code ? `${code} - Modify` : 'Modify details'
  return code ? `${code} - Details` : 'Details'
})

const hasHistory = computed(() => !!window.history.state?.back)
const showBackBtn = computed(() => hasHistory.value || !isIndex.value)

const finalAttrs = computed(() => ({
  ...attrs,
  title: evaluateProp(props.title, resourceRecord, resourceConfig) ?? derivedTitle.value,
  subtitle: evaluateProp(props.subtitle, resourceRecord, resourceConfig) ?? derivedSubtitle.value,
  chip: evaluateProp(props.chip, resourceRecord, resourceConfig),
  chipColor: evaluateProp(props.chipColor, resourceRecord, resourceConfig),
  chipTextColor: evaluateProp(props.chipTextColor, resourceRecord, resourceConfig),
  backIcon: evaluateProp(props.backIcon, resourceRecord, resourceConfig),
  reloadIcon: evaluateProp(props.reloadIcon, resourceRecord, resourceConfig),
  leftIconColor: evaluateProp(props.leftIconColor, resourceRecord, resourceConfig),
  icon: evaluateProp(props.icon, resourceRecord, resourceConfig),
  iconColor: evaluateProp(props.iconColor, resourceRecord, resourceConfig),
  back: props.back ?? showBackBtn.value,
  reload: props.reload ?? true
}))

function navigateBack() {
  const backProp = props.back ?? attrs.back
  if (typeof backProp === 'function') return backProp()
  if (hasHistory.value) return router.back()
  if (!isIndex.value) nav.goTo('index')
}
</script>
