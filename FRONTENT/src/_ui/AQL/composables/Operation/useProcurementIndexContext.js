import { useAuth } from 'src/composables/core/useAuth'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

// The Core-composable relay every procurement Index row cluster reads. A `.vue` file
// may not import a Core Composable directly, so the import legally lives here.
export function useProcurementIndexContext () {
  const { user } = useAuth()
  const nav = useResourceNav()

  return { user, nav }
}
