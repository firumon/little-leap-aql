import { markRaw } from 'vue'

/**
 * Walks a list of `{ modules, path }` tiers in order and returns the first
 * resolvable component (wrapped in `markRaw`). Falls back to `defaultComponent`
 * when nothing matches.
 *
 * `modules` is an `import.meta.glob` registry object. `path` is the exact key
 * to look up inside it.
 */
export async function resolveTieredComponent(tiers, defaultComponent) {
  for (const tier of tiers) {
    if (!tier) continue
    const { modules, path } = tier
    if (!modules || !path) continue
    if (!modules[path]) continue
    try {
      const mod = await modules[path]()
      return markRaw(mod.default || mod)
    } catch (e) {
      console.warn(`[TieredResolver] Failed to load ${path}`, e)
    }
  }
  return markRaw(defaultComponent)
}
