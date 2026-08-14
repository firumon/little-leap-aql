import { useAuth } from 'src/composables/core/useAuth'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

/**
 * OutletRestocks › Index — the Core-composable relay for the Index page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Index/`, the page tier (§6.2). Its only consumer is
 * `Index/RestockActionButtons.vue`, which the four Index list views mount (three
 * `.js` modifiers as `btn`, plus `ListPendingCompletion.vue`'s `#btn` slot) and
 * which no other page resolves.
 *
 * It calls no `inject()` — the Index cards never needed page context. It exists
 * because §6 admits no exception for "generic identity/navigation reads that
 * carry no resource content": `useAuth` and `useResourceNav` are Core Composables
 * and a `.vue` file may not import one directly. The relay is where that import
 * legally lives.
 *
 * Nothing is unwrapped or renamed: `user` is `useAuth`'s own ref and `nav` is the
 * whole navigation API, so the button cluster reads them exactly as before.
 */
export function useRestockIndexContext () {
  const { user } = useAuth()
  const nav = useResourceNav()

  return { user, nav }
}
