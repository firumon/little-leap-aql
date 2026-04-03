<template>
  <q-page class="resource-page">
    <MasterBreadcrumb
      :scope="scope"
      :resource-slug="resourceSlug"
      :resource-title="resourceTitle"
      :code="code"
      :action="action"
      :action-label="actionLabel"
    />
    <router-view :key="routeKey" />
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import MasterBreadcrumb from 'src/components/Masters/MasterBreadcrumb.vue'
import { useResourceConfig } from 'src/composables/useResourceConfig'

const route = useRoute()
const { scope, resourceSlug, code, action, config, additionalActions } = useResourceConfig()

const resourceTitle = computed(() => config.value?.ui?.menu?.pageTitle || config.value?.name || resourceSlug.value)

const actionLabel = computed(() => {
  const a = action.value
  if (!a || a === 'list') return ''
  if (a === 'add') return 'Add'
  if (a === 'view') return ''
  if (a === 'edit') return 'Edit'
  // Additional actions — find label from config
  const actionConfig = additionalActions.value.find(
    (ac) => ac.action.toLowerCase() === a.toLowerCase()
  )
  return actionConfig?.label || a.charAt(0).toUpperCase() + a.slice(1)
})

// Keep router-view stable across query-only changes (e.g. ?view=),
// so switching list views does not remount the whole page.
const routeKey = computed(() => `${route.path}`)
</script>

<style scoped>
.resource-page {
  --master-font: 'Sora', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  --master-bg-1: #f8fafc;
  --master-bg-2: #eef2f7;
  --master-ink: #0f172a;
  --master-soft-ink: #51607a;
  --master-primary: #0f766e;
  --master-primary-700: #0b5d56;
  --master-surface: #ffffff;
  --master-border: #dbe3ed;

  font-family: var(--master-font);
  color: var(--master-ink);
  background:
    radial-gradient(1000px 520px at 12% -10%, #dfe8f6 0%, transparent 58%),
    radial-gradient(900px 420px at 100% -5%, #d9ece7 0%, transparent 52%),
    linear-gradient(160deg, var(--master-bg-1) 0%, var(--master-bg-2) 100%);
  min-height: 100%;
  padding: 8px;
}

@media (min-width: 600px) {
  .resource-page {
    padding: 12px 16px;
  }
}
</style>
