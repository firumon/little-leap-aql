<template>
  <Header v-bind="finalAttrs" @click="navigateBack" />
</template>

<script setup>
import { computed, inject, useAttrs } from 'vue'
import { useRouter } from 'vue-router'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import Header from 'components/app/Header.vue'

defineOptions({ name: 'SectionsHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: String, default: undefined },
  subtitle: { type: String, default: undefined },
  back: { type: [Boolean, String, Function], default: undefined },
  reload: { type: [Boolean, String], default: undefined }
})

const attrs = useAttrs()
const router = useRouter()
const nav = useResourceNav()

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

// Injected resourceConfig is the useResourceConfig() return object (refs/computeds).
const {
  config, pageName, scope, resourceSlug,
  code: injectedCode, additionalActions
} = resourceConfig || {}

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
  title: props.title ?? derivedTitle.value,
  subtitle: props.subtitle ?? derivedSubtitle.value,
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
