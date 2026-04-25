import { unref } from 'vue'
import { useRouter } from 'vue-router'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'

function routeParam(value) {
  const resolved = unref(value)
  if (resolved == null) return ''
  return typeof resolved === 'string' ? resolved : String(resolved)
}

function routeQuery(query) {
  if (!query || typeof query !== 'object') return undefined
  return Object.fromEntries(
    Object.entries(query)
      .map(([key, value]) => [key, routeParam(value)])
      .filter(([, value]) => value !== '')
  )
}

/**
 * Generic resource navigation composable.
 *
 * Resolves scope, resourceSlug, and code internally from useResourceConfig().
 * The `params` argument shallow-merges on top of resolved values, allowing
 * callers to override any resolved value.
 *
 * Cross-resource navigation:
 *   Override scope + resourceSlug (and optionally code) in params to navigate
 *   to a different resource without constructing path strings manually.
 *   Example:
 *     nav.goTo('view', { scope: 'operations', resourceSlug: 'purchase-items', code: 'PI001' })
 *
 * routeMappings is built AFTER resolvedParams is assembled (post-merge), so
 * an overridden scope in params correctly selects the right named route set.
 *
 * Only params relevant to each target are passed to router.push — no extra
 * keys are forwarded to avoid Vue Router "discarded invalid param" warnings.
 *
 * Supported targets:
 *   'list'          → /{scope}/{resourceSlug}
 *   'add'           → /{scope}/{resourceSlug}/_add
 *   'view'          → /{scope}/{resourceSlug}/{code}/_view
 *   'edit'          → /{scope}/{resourceSlug}/{code}/_edit
 *   'action'        → /{scope}/{resourceSlug}/{code}/_action/{action}
 *   'resource-page' → /{scope}/{resourceSlug}/{pageSlug}
 *   'record-page'   → /{scope}/{resourceSlug}/{code}/{pageSlug}
 */
export function useResourceNav () {
  const router = useRouter()
  const { scope, resourceSlug, code } = useResourceConfig()

  /**
   * Navigate to a target page within the current (or overridden) resource.
   *
   * @param {string} target - One of: 'list', 'add', 'view', 'edit', 'action', 'resource-page', 'record-page'
   * @param {Object} [params] - Optional overrides. Shallow-merged over resolved scope/resourceSlug/code.
   */
  const goTo = (target, params = {}) => {
    const resolved = {
      scope: routeParam(scope),
      resourceSlug: routeParam(resourceSlug),
      code: routeParam(code),
      ...params
    }
    resolved.scope = routeParam(resolved.scope)
    resolved.resourceSlug = routeParam(resolved.resourceSlug)
    resolved.code = routeParam(resolved.code)
    resolved.action = routeParam(resolved.action)
    resolved.pageSlug = routeParam(resolved.pageSlug)

    // Build scopePrefix from resolved.scope (post-merge) so cross-resource
    // overrides correctly select the right named route set.
    const scopePrefix = resolved.scope === 'operations'
      ? 'operations'
      : resolved.scope === 'accounts'
        ? 'accounts'
        : 'resource'

    const routeMappings = {
      list:            `${scopePrefix}-list`,
      add:             `${scopePrefix}-add`,
      view:            `${scopePrefix}-view`,
      edit:            `${scopePrefix}-edit`,
      action:          `${scopePrefix}-action`,
      'resource-page': `${scopePrefix}-resource-page`,
      'record-page':   `${scopePrefix}-record-page`
    }

    const routeName = routeMappings[target]
    if (!routeName) {
      console.error(`[useResourceNav] Invalid navigation target: "${target}"`)
      return
    }

    // Only pass params that each target route actually uses — avoids Vue Router
    // "discarded invalid param" warnings for unused segments.
    const base = { scope: resolved.scope, resourceSlug: resolved.resourceSlug }
    const withCode = { ...base, code: resolved.code }

    const routeParams = {
      list:            base,
      add:             base,
      view:            withCode,
      edit:            withCode,
      action:          { ...withCode, action: resolved.action },
      'resource-page': { ...base, pageSlug: resolved.pageSlug },
      'record-page':   { ...withCode, pageSlug: resolved.pageSlug }
    }[target]

    router.push({ name: routeName, params: routeParams, query: routeQuery(params.query) })
  }

  return { goTo }
}
