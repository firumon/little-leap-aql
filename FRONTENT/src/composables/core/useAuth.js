/**
 * useAuth — the single read surface for "who is signed in".
 *
 * ARCHITECTURE RULES §5 forbids a component from importing a Pinia store, but
 * components legitimately need the current user (seeding a `RequestedUser`
 * field, gating a control by region, showing an avatar). This composable is
 * that boundary: it wraps `useAuthStore` and hands back a flat, already-shaped
 * user object plus the two membership questions callers actually ask, so no
 * `.vue` file has to know the store's getter names or the nested shape of
 * `accessRegion`.
 *
 * Mutation workflows (login, profile updates) stay in [useAuthLogic]; this
 * composable re-exports only `logout`, which is the one auth action a component
 * triggers directly.
 */

import { computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useAuthLogic } from 'src/composables/core/useAuthLogic'

const text = (value) => String(value ?? '').trim()

export function useAuth () {
  const authStore = useAuthStore()
  const authLogic = useAuthLogic()

  /**
   * Flat projection of the session user. Every field is normalized here so a
   * caller never has to fall back across `name`/`Name`/`UserName` itself — the
   * spellings differ between the login payload and the Users sheet.
   */
  const user = computed(() => {
    const profile = authStore.userProfile || authStore.user
    if (!profile) return null
    return {
      name: text(profile.name || profile.Name || profile.UserName || profile.Username),
      email: text(profile.email || profile.Email),
      id: text(profile.id || profile.UserID || profile.Code || profile.code),
      role: authStore.userRole,
      roles: authStore.userRoles,
      designation: authStore.userDesignation,
      // Object: `{ code, isUniverse, children, parents, regions }`.
      // Read it through `hasRegionAccess` rather than comparing `.code` by hand.
      accessRegion: authStore.userAccessRegion,
      designationScope: authStore.userDesignationScope,
      avatar: text(profile.avatar || profile.Avatar)
    }
  })

  const designationScope = computed(() => authStore.userDesignationScope)
  const isAuthenticated = computed(() => !!authStore.token)

  function logout () {
    return authLogic.logout()
  }

  function hasRole (roleName) {
    const target = text(roleName).toLowerCase()
    if (!target) return false
    return (user.value?.roles || []).some((role) => text(role).toLowerCase() === target)
  }

  // Checks if the user is allowed to access records for the given resource and region.
  function hasRegionAccess (regionCode, resourceName) {
    const target = text(regionCode)
    if (!target) return true

    const region = user.value?.accessRegion
    if (!region) return false
    if (region.isUniverse) return true

    return region.regions?.[resourceName]?.[target] === true
  }

  return {
    user,
    designationScope,
    isAuthenticated,
    logout,
    hasRole,
    hasRegionAccess
  }
}
