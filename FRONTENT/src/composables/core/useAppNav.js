import { useRouter } from 'vue-router'

const APP_ROUTE_MAP = {
  home: { name: 'home' },
  landing: { name: 'landing' },
  login: { name: 'login' },
  dashboard: { name: 'dashboard' },
  profile: { name: 'profile' }
}

export function useAppNav() {
  const router = useRouter()

  function goTo(target, params = {}) {
    const route = APP_ROUTE_MAP[target]
    if (!route) {
      return router.push(target)
    }

    return router.push({ ...route, params })
  }

  function goToPath(path) {
    return router.push(path)
  }

  return {
    goTo,
    goToPath
  }
}

