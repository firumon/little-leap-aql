import { useRoute, useRouter } from 'vue-router'
import { useResourceConfig } from 'src/composables/useResourceConfig'
import { computed } from 'vue'

export function useResourceNav () {
  const router = useRouter()
  const route = useRoute()
  const { scope, resourceSlug, code } = useResourceConfig()

  const goTo = (target, params = {}) => {
    const resolvedParams = {
      scope: scope.value,
      resourceSlug: resourceSlug.value,
      code: code.value || route.params.code,
      ...params
    }

    const routeMappings = {
      list: scope.value === 'operations' ? 'operations-list' : 'resource-list',
      add: scope.value === 'operations' ? 'operations-add' : 'resource-add',
      view: scope.value === 'operations' ? 'operations-view' : 'resource-view',
      edit: scope.value === 'operations' ? 'operations-edit' : 'resource-edit',
      action: scope.value === 'operations' ? 'operations-action' : 'resource-action',
      'resource-page': scope.value === 'operations' ? 'operations-resource-page' : 'resource-resource-page',
      'record-page': scope.value === 'operations' ? 'operations-record-page' : 'resource-record-page'
    }

    const routeName = routeMappings[target]
    if (routeName) {
      router.push({ name: routeName, params: resolvedParams })
    } else {
      console.error(`Invalid navigation target: ${target}`)
    }
  }

  return { goTo }
}
