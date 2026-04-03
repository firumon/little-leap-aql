import { defineRouter } from '#q-app/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
import { isStandalone } from 'src/utils/pwa-utils'
import routes from './routes'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

/**
 * Plain (non-composable) version of evaluateMenuAccess for use in the router guard.
 * Cannot use composables here (no setup context).
 *
 * @param {object} resource - The full resource entry to evaluate
 * @param {Array} allResources - Full list of authorized resources (for cross-resource checks)
 * @returns {boolean}
 */
function evaluateMenuAccessInline(resource, allResources) {
  if (!resource) return false

  const resourceName = resource.name
  const menuAccess = resource?.ui?.menu?.menuAccess

  function checkPerms(resName, require) {
    const entry = allResources.find((r) => r?.name === resName)
    if (!entry) return false
    const perms = entry.permissions || {}
    const keys = Array.isArray(require) ? require : [require]
    return keys.every((k) => perms[k] === true)
  }

  if (!menuAccess || typeof menuAccess !== 'object') {
    return checkPerms(resourceName, 'canRead')
  }

  if (menuAccess.require !== undefined) {
    return checkPerms(resourceName, menuAccess.require)
  }

  if (Array.isArray(menuAccess.all)) {
    return menuAccess.all.every((rule) => checkPerms(rule.resource || resourceName, rule.require))
  }

  if (Array.isArray(menuAccess.any)) {
    return menuAccess.any.some((rule) => checkPerms(rule.resource || resourceName, rule.require))
  }

  return false
}

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })

  Router.beforeEach((to, from, next) => {
    const isProdNonStandalone = !process.env.DEV && !isStandalone()
    if (isProdNonStandalone) {
      if (to.name !== 'landing') {
        return next({ name: 'landing' })
      }
      return next()
    }

    const token = localStorage.getItem('token')
    const isAuthenticated = !!token
    const resources = JSON.parse(localStorage.getItem('resources') || '[]')

    // Check if the route requires authentication
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
    const requiredResource = to.matched
      .map((record) => record.meta?.requiredResource)
      .find((resource) => !!resource)

    // Public pages (always accessible)
    // Redirect to dashboard if logged in and trying to access public auth pages
    if (isAuthenticated && (to.name === 'login' || to.name === 'landing')) {
      return next('/dashboard')
    }

    // Redirect to login if auth is required and not logged in
    if (requiresAuth && !isAuthenticated) {
      return next('/login')
    }

    // Find the resource entry whose menu.route matches the navigation target
    const matchedResource = Array.isArray(resources)
      ? resources.find((r) => r?.ui?.menu?.route === to.path)
      : null

    const effectiveRequiredResource = requiredResource || matchedResource?.name

    if (effectiveRequiredResource && isAuthenticated) {
      // Find the full resource entry for permission evaluation
      const targetEntry = Array.isArray(resources)
        ? resources.find((r) => r?.name === effectiveRequiredResource)
        : null

      const allowed = targetEntry ? evaluateMenuAccessInline(targetEntry, resources) : false

      if (!allowed) {
        return next('/dashboard')
      }
    }

    // Default: allow navigation
    next()
  })

  return Router
})
