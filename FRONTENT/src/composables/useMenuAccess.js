import { useAuthStore } from 'src/stores/auth'

/**
 * Returns a function that evaluates a menuAccess rule
 * against the currently logged-in user's permissions.
 *
 * Usage:
 *   const { evaluateMenuAccess } = useMenuAccess()
 *   const allowed = evaluateMenuAccess(resource)
 */
export function useMenuAccess() {
  const auth = useAuthStore()

  /**
   * Look up a resource entry by name from the auth store.
   * Returns the resource entry object or null.
   */
  function getResourceEntry(resourceName) {
    const resources = Array.isArray(auth.resources) ? auth.resources : []
    return resources.find((r) => r?.name === resourceName) || null
  }

  /**
   * Check whether the user has ALL of the listed permissions
   * on a specific resource.
   *
   * @param {string} resourceName - Name of the resource (e.g. 'Products')
   * @param {string|string[]} require - Permission key(s) e.g. 'canWrite' or ['canWrite','canDelete']
   * @returns {boolean}
   */
  function checkPermissions(resourceName, require) {
    const entry = getResourceEntry(resourceName)
    if (!entry) return false
    const perms = entry.permissions || {}
    const keys = Array.isArray(require) ? require : [require]
    return keys.every((key) => perms[key] === true)
  }

  /**
   * Evaluate a menuAccess rule object.
   * Supports: absent (fallback canRead), { require }, { all }, { any }
   *
   * @param {object} resource - Full resource entry from auth store (has .name, .permissions, .ui.menu)
   * @returns {boolean} true = user is allowed to access this menu item
   */
  function evaluateMenuAccess(resource) {
    if (!resource) return false

    const resourceName = resource.name
    const menuAccess = resource?.ui?.menu?.menuAccess

    // Case 1: No menuAccess defined → fallback to canRead on own resource
    if (!menuAccess || typeof menuAccess !== 'object') {
      return checkPermissions(resourceName, 'canRead')
    }

    // Case 2 & 3: { require: 'canWrite' } or { require: ['canWrite', 'canDelete'] }
    if (menuAccess.require !== undefined) {
      return checkPermissions(resourceName, menuAccess.require)
    }

    // Case 4: { all: [ { resource, require }, ... ] }  — ALL rules must pass
    if (Array.isArray(menuAccess.all)) {
      return menuAccess.all.every((rule) => {
        const target = rule.resource || resourceName
        return checkPermissions(target, rule.require)
      })
    }

    // Case 5: { any: [ { resource, require }, ... ] }  — ANY rule must pass
    if (Array.isArray(menuAccess.any)) {
      return menuAccess.any.some((rule) => {
        const target = rule.resource || resourceName
        return checkPermissions(target, rule.require)
      })
    }

    // Unknown shape → deny (safe default)
    return false
  }

  return { evaluateMenuAccess }
}

